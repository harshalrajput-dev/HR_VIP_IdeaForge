'use strict';

const mongoose = require('mongoose');
const Comment = require('../models/Comment');
const Idea = require('../models/Idea');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { getPagination, buildMeta } = require('../utils/pagination');
const { plainComment } = require('../utils/serialise');
const { awardPoints } = require('../utils/points');
const { isAdminRole, POINTS, IDEA_STATUS } = require('../config/constants');

/** Guard against dangling ObjectIds before touching the database. */
const assertIdeaId = (id) => {
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest('Invalid idea id');
};

/**
 * GET /api/ideas/:ideaId/comments
 * Best solution first, then chronological. `?sort=oldest|newest|top` supported.
 */
const getCommentsByIdea = asyncHandler(async (req, res) => {
  assertIdeaId(req.params.ideaId);
  const { page, limit, skip } = getPagination(req);
  const sortMode = req.query.sort || 'best';

  const idea = await Idea.findById(req.params.ideaId).select('_id status bestSolution');
  if (!idea) throw ApiError.notFound('Idea not found');

  const filter = { ideaId: idea._id, isHidden: false };
  const sortSpec =
    sortMode === 'oldest'
      ? { createdAt: 1 }
      : sortMode === 'newest'
        ? { createdAt: -1 }
        : { isBestSolution: -1, createdAt: 1 };

  const [comments, total] = await Promise.all([
    Comment.find(filter)
      .populate('userId', 'name role points department jobTitle avatarUrl')
      .populate('bestMarkedBy', 'name role')
      .sort(sortSpec)
      .skip(skip)
      .limit(limit)
      .lean(),
    Comment.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: comments.map((c) => plainComment(c)),
    meta: { ...buildMeta({ page, limit, total }), ideaStatus: idea.status, bestSolutionId: idea.bestSolution },
  });
});

/**
 * POST /api/ideas/:ideaId/comments
 * The first comment automatically promotes the idea to "In Discussion",
 * and an idea under review is nudged towards resolution rather than closed.
 */
const addComment = asyncHandler(async (req, res) => {
  const { ideaId } = req.params;
  const { text, replyTo } = req.body;
  assertIdeaId(ideaId);

  const idea = await Idea.findById(ideaId);
  if (!idea) throw ApiError.notFound('Idea not found');

  if (replyTo && mongoose.isValidObjectId(replyTo)) {
    const parentExists = await Comment.exists({ _id: replyTo, ideaId: idea._id });
    if (!parentExists) throw ApiError.badRequest('The comment you are replying to no longer exists');
  }

  const comment = await Comment.create({
    ideaId: idea._id,
    userId: req.user._id,
    text,
    replyTo: replyTo && mongoose.isValidObjectId(replyTo) ? replyTo : null,
  });

  idea.commentCount = (idea.commentCount || 0) + 1;

  let statusChanged = false;
  if (idea.status === IDEA_STATUS.SUBMITTED) {
    idea.pushStatusEntry({
      status: IDEA_STATUS.IN_DISCUSSION,
      changedBy: req.user._id,
      note: 'Discussion started',
    });
    statusChanged = true;
  }
  await idea.save();

  await comment.populate('userId', 'name role points department jobTitle avatarUrl');

  res.status(201).json({
    success: true,
    message: statusChanged ? 'Solution posted. Idea moved to "In Discussion".' : 'Solution posted',
    data: { ...comment.toJSON(), ideaStatus: idea.status, statusChanged },
  });
});

/**
 * PATCH /api/comments/:id/mark-best
 * Exactly one best solution per idea: the previous winner is demoted first.
 * Allowed for HR VIP employees and the idea's author.
 */
const markBestSolution = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest('Invalid comment id');

  const comment = await Comment.findById(id).populate('userId', 'name');
  if (!comment) throw ApiError.notFound('Comment not found');

  const idea = await Idea.findById(comment.ideaId);
  if (!idea) throw ApiError.notFound('Idea not found');

  const isAuthor = String(idea.author) === String(req.user._id);
  if (!isAuthor && !isAdminRole(req.user.role)) {
    throw ApiError.forbidden('Only the idea author or an HR VIP employee can select the best solution');
  }

  const alreadyBest = comment.isBestSolution;

  // Demote every other winner for this idea.
  await Comment.updateMany(
    { ideaId: idea._id, _id: { $ne: comment._id }, isBestSolution: true },
    { $set: { isBestSolution: false, bestMarkedBy: null, bestMarkedAt: null } }
  );

  if (alreadyBest) {
    comment.unmarkAsBest();
    idea.bestSolution = null;
  } else {
    comment.markAsBest(req.user._id);
    idea.bestSolution = comment._id;
    // Reverse an earlier award if the crown moves to a different person.
    if (idea.statusHistory.some((h) => h.status === IDEA_STATUS.APPROVED)) {
      // no-op: approval is a one-time milestone, tracked by the audit log
    }
    await awardPoints(comment.userId._id, POINTS.BEST_SOLUTION);
  }

  await Promise.all([comment.save(), idea.save()]);

  await comment.populate('userId', 'name role points department jobTitle avatarUrl');

  res.json({
    success: true,
    message: alreadyBest ? 'Best solution marker removed' : 'Marked as the best solution',
    data: { comment: comment.toJSON(), ideaBestSolution: idea.bestSolution },
  });
});

/** PATCH /api/comments/:id - edit your own comment. */
const updateComment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest('Invalid comment id');

  const comment = await Comment.findById(id);
  if (!comment) throw ApiError.notFound('Comment not found');

  const isOwner = String(comment.userId) === String(req.user._id);
  if (!isOwner && !isAdminRole(req.user.role)) throw ApiError.forbidden('You can only edit your own comments');

  comment.text = req.body.text;
  await comment.save();
  await comment.populate('userId', 'name role points department jobTitle avatarUrl');

  res.json({ success: true, message: 'Comment updated', data: comment.toJSON() });
});

/**
 * DELETE /api/comments/:id
 * Also clears `Idea.bestSolution` and decrements the counter when needed.
 */
const deleteComment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest('Invalid comment id');

  const comment = await Comment.findById(id);
  if (!comment) throw ApiError.notFound('Comment not found');

  const isOwner = String(comment.userId) === String(req.user._id);
  if (!isOwner && !isAdminRole(req.user.role)) throw ApiError.forbidden('You can only delete your own comments');

  const idea = await Idea.findById(comment.ideaId);
  await comment.deleteOne();

  if (idea) {
    idea.commentCount = Math.max(0, (idea.commentCount || 1) - 1);
    if (idea.bestSolution && String(idea.bestSolution) === String(comment._id)) idea.bestSolution = null;
    await idea.save();
  }

  res.json({ success: true, message: 'Comment deleted' });
});

module.exports = { getCommentsByIdea, addComment, markBestSolution, updateComment, deleteComment };
