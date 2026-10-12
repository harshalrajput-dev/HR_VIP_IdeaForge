'use strict';

const mongoose = require('mongoose');
const Idea = require('../models/Idea');
const Comment = require('../models/Comment');
const ProjectCredit = require('../models/ProjectCredit');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { getPagination, buildMeta, buildSort } = require('../utils/pagination');
const { plainIdea } = require('../utils/serialise');
const { awardPoints } = require('../utils/points');
const { isAdminRole, POINTS, IDEA_STATUS, CATEGORIES, IDEA_STATUSES, PRIORITIES } = require('../config/constants');

const SORTABLE = ['createdAt', 'updatedAt', 'upvoteCount', 'commentCount', 'title'];

/** Strip private audit internals before sending an idea to a client. */
const serialise = (idea) => {
  const json = idea.toJSON();
  delete json.statusHistory;
  return json;
};

/**
 * POST /api/ideas
 * Anyone authenticated can raise an idea, a bug or a software limitation.
 */
const createIdea = asyncHandler(async (req, res) => {
  const { title, description, category, priority, tags } = req.body;

  const idea = await Idea.create({
    title,
    description,
    category,
    priority: priority || 'Medium',
    tags: Array.isArray(tags)
      ? tags
      : typeof tags === 'string'
        ? tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [],
    author: req.user._id,
    status: IDEA_STATUS.SUBMITTED,
    statusHistory: [{ status: IDEA_STATUS.SUBMITTED, changedBy: req.user._id, changedByName: req.user.name, note: 'Idea submitted' }],
  });

  await awardPoints(req.user._id, POINTS.IDEA_SUBMITTED);
  await idea.populate('author', 'name email role points department jobTitle avatarUrl');

  res.status(201).json({
    success: true,
    message: 'Idea submitted. The community can now discuss and solve it.',
    data: serialise(idea),
  });
});

/**
 * GET /api/ideas
 * Public feed with category / status / author / search filters + pagination.
 */
const getIdeas = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const { category, status, author, priority, search, sort, mine, featured } = req.query;

  const filter = {};

  if (category) {
    const categories = String(category).split(',').map((c) => c.trim()).filter((c) => CATEGORIES.includes(c));
    filter.category = { $in: categories.length ? categories : [category] };
  }
  if (status) {
    const statuses = String(status).split(',').map((s) => s.trim()).filter(Boolean);
    filter.status = { $in: statuses.length ? statuses : [status] };
  }
  if (priority && PRIORITIES.includes(priority)) filter.priority = priority;
  if (featured === 'true') filter.isFeatured = true;
  if (author && mongoose.isValidObjectId(author)) filter.author = author;
  if (mine === 'true') {
    if (!req.user) throw ApiError.unauthorized('Log in to list your own ideas');
    filter.author = req.user._id;
  }
  if (search) {
    const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { title: { $regex: safe, $options: 'i' } },
      { description: { $regex: safe, $options: 'i' } },
      { tags: { $regex: safe, $options: 'i' } },
    ];
  }

  const sortSpec = buildSort(sort, SORTABLE, '-createdAt');

  const [ideas, total] = await Promise.all([
    Idea.find(filter)
      .select('-statusHistory')
      .populate('author', 'name role points department jobTitle avatarUrl')
      .populate('credits', 'developedBy projectLink contributors originalIdeaByName')
      .sort(sortSpec)
      .skip(skip)
      .limit(limit)
      .lean(),
    Idea.countDocuments(filter),
  ]);

  // `.lean()` bypasses the schema transform, so normalise to the public shape.
  const data = ideas.map((idea) => plainIdea(idea, req.user?._id));

  res.json({ success: true, data, meta: buildMeta({ page, limit, total }) });
});

/** GET /api/ideas/:id */
const getIdeaById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest('Invalid idea id');

  const idea = await Idea.findById(id)
    .populate('author', 'name email role points department jobTitle avatarUrl')
    .populate('credits')
    .populate({
      path: 'bestSolution',
      populate: { path: 'userId', select: 'name role points avatarUrl jobTitle' },
    })
    .populate({ path: 'reviewedBy', select: 'name role jobTitle' });

  if (!idea) throw ApiError.notFound('Idea not found');

  const [commentsTotal, contributorCount] = await Promise.all([
    Comment.countDocuments({ ideaId: idea._id, isHidden: false }),
    idea.credits?.contributors?.length || 0,
  ]);

  const json = serialise(idea);
  json.upvotedByMe = req.user ? idea.upvotes.some((uid) => String(uid) === String(req.user._id)) : false;
  json.commentCount = commentsTotal;
  json.contributorCount = contributorCount;
  json.permissions = {
    canEdit: req.user && (String(idea.author._id) === String(req.user._id) || isAdminRole(req.user.role)),
    canModerate: req.user && isAdminRole(req.user.role),
    canMarkBest: req.user && (String(idea.author._id) === String(req.user._id) || isAdminRole(req.user.role)),
  };

  res.json({ success: true, data: json });
});

/**
 * POST /api/ideas/:id/upvote
 * Toggle semantics - the same user cannot inflate the score twice.
 */
const upvoteIdea = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest('Invalid idea id');

  const idea = await Idea.findById(id);
  if (!idea) throw ApiError.notFound('Idea not found');

  const userId = String(req.user._id);
  const existingIndex = idea.upvotes.findIndex((uid) => String(uid) === userId);
  const isAuthor = String(idea.author) === userId;

  if (isAuthor) throw ApiError.badRequest('You cannot upvote your own idea');

  if (existingIndex >= 0) {
    idea.upvotes.splice(existingIndex, 1);
    await awardPoints(idea.author, -POINTS.UPVOTE_RECEIVED);
  } else {
    idea.upvotes.push(req.user._id);
    await awardPoints(idea.author, POINTS.UPVOTE_RECEIVED);
  }

  await idea.save();

  res.json({
    success: true,
    message: existingIndex >= 0 ? 'Upvote removed' : 'Thanks for supporting this idea',
    data: { id: idea._id, upvoteCount: idea.upvotes.length, upvotedByMe: existingIndex < 0 },
  });
});

/**
 * PATCH /api/ideas/:id/status
 * HR VIP only. Validates the lifecycle transition, keeps an audit trail and
 * rewards the author on approval.
 */
const updateIdeaStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body;

  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest('Invalid idea id');
  if (!IDEA_STATUSES.includes(status)) {
    throw ApiError.unprocessable(`Status must be one of: ${IDEA_STATUSES.join(', ')}`);
  }

  const idea = await Idea.findById(id).populate('author', 'name role');
  if (!idea) throw ApiError.notFound('Idea not found');

  if (idea.status === status) {
    throw ApiError.badRequest(`Idea is already in "${status}"`);
  }
  if (!idea.canTransitionTo(status)) {
    throw ApiError.unprocessable(
      `Invalid transition: "${idea.status}" -> "${status}". Allowed next: ${
        require('../config/constants').ALLOWED_STATUS_TRANSITIONS[idea.status].join(', ') || 'none'
      }`
    );
  }

  const previousStatus = idea.status;
  idea.pushStatusEntry({ status, changedBy: req.user._id, note });
  idea.reviewedBy = req.user._id;
  idea.reviewedAt = new Date();
  if (status === IDEA_STATUS.APPROVED) {
    idea.reviewNotes = note || idea.reviewNotes;
    await awardPoints(idea.author._id, POINTS.IDEA_APPROVED);
  }
  if (status === IDEA_STATUS.COMPLETED) idea.completedAt = new Date();

  await idea.save();

  res.json({
    success: true,
    message: `Status moved from "${previousStatus}" to "${status}"`,
    data: { id: idea._id, previousStatus, status: idea.status },
  });
});

/** PATCH /api/ideas/:id - author edits content, admin edits anything. */
const updateIdea = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest('Invalid idea id');

  const idea = await Idea.findById(id);
  if (!idea) throw ApiError.notFound('Idea not found');

  const isAuthor = String(idea.author) === String(req.user._id);
  const isAdmin = isAdminRole(req.user.role);
  if (!isAuthor && !isAdmin) throw ApiError.forbidden('You can only edit your own ideas');

  const { title, description, category, priority, tags, reviewNotes, isFeatured } = req.body;

  if (title !== undefined) idea.title = title;
  if (description !== undefined) idea.description = description;
  if (category !== undefined) idea.category = category;
  if (priority !== undefined) idea.priority = priority;
  if (tags !== undefined) idea.tags = Array.isArray(tags) ? tags : String(tags).split(',').map((t) => t.trim()).filter(Boolean);
  if (isAdmin) {
    if (reviewNotes !== undefined) idea.reviewNotes = reviewNotes;
    if (isFeatured !== undefined) idea.isFeatured = Boolean(isFeatured);
  }

  await idea.save();
  await idea.populate('author', 'name role points department jobTitle avatarUrl');

  res.json({ success: true, message: 'Idea updated', data: serialise(idea) });
});

/** DELETE /api/ideas/:id - hard delete with cascade cleanup. */
const deleteIdea = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest('Invalid idea id');

  const idea = await Idea.findById(id);
  if (!idea) throw ApiError.notFound('Idea not found');

  const isAuthor = String(idea.author) === String(req.user._id);
  if (!isAuthor && !isAdminRole(req.user.role)) {
    throw ApiError.forbidden('You can only delete your own ideas');
  }

  await Promise.all([
    Comment.deleteMany({ ideaId: idea._id }),
    ProjectCredit.deleteOne({ idea: idea._id }),
  ]);
  await idea.deleteOne();

  res.json({ success: true, message: 'Idea and its discussion have been deleted' });
});

/** GET /api/ideas/meta/filters - powers the filter dropdowns on the client. */
const getFilterOptions = asyncHandler(async (_req, res) => {
  const counts = await Idea.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c._id, c.count]));

  res.json({
    success: true,
    data: {
      categories: CATEGORIES,
      priorities: PRIORITIES,
      statuses: IDEA_STATUSES,
      countsByStatus: byStatus,
    },
  });
});

module.exports = {
  createIdea,
  getIdeas,
  getIdeaById,
  upvoteIdea,
  updateIdeaStatus,
  updateIdea,
  deleteIdea,
  getFilterOptions,
};
