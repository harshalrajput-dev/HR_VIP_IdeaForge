'use strict';

const mongoose = require('mongoose');
const Idea = require('../models/Idea');
const Comment = require('../models/Comment');
const ProjectCredit = require('../models/ProjectCredit');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { getPagination, buildMeta } = require('../utils/pagination');
const { plainIdea, plainProject, plainUser } = require('../utils/serialise');
const { awardPoints } = require('../utils/points');
const {
  IDEA_STATUS,
  IDEA_STATUSES,
  DEVELOPED_BY_DEFAULT,
  POINTS,
  ROLES,
  isAdminRole,
  canTransition,
} = require('../config/constants');

/**
 * GET /api/admin/dashboard
 * The HR VIP cockpit: queue counts, idea health, top contributors.
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  const [byStatus, totalIdeas, totalUsers, totalComments, projects, leaders, recentIdeas] = await Promise.all([
    Idea.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Idea.countDocuments(),
    User.countDocuments({ isActive: true }),
    Comment.countDocuments(),
    ProjectCredit.countDocuments(),
    User.find({ role: ROLES.USER })
      .select('name points department jobTitle avatarUrl')
      .sort({ points: -1 })
      .limit(5)
      .lean(),
    Idea.find()
      .sort({ updatedAt: -1 })
      .limit(6)
      .select('title status category createdAt updatedAt upvotes commentCount author')
      .populate('author', 'name role avatarUrl')
      .lean(),
  ]);

  const counts = Object.fromEntries(IDEA_STATUSES.map((s) => [s, 0]));
  byStatus.forEach((row) => {
    counts[row._id] = row.count;
  });

  res.json({
    success: true,
    data: {
      counts,
      totals: {
        ideas: totalIdeas,
        users: totalUsers,
        comments: totalComments,
        projects,
        needsReview: counts[IDEA_STATUS.SUBMITTED] + counts[IDEA_STATUS.IN_DISCUSSION] + counts[IDEA_STATUS.UNDER_REVIEW],
        awaitingApproval: counts[IDEA_STATUS.UNDER_REVIEW],
        readyToShip: counts[IDEA_STATUS.APPROVED],
      },
      topContributors: leaders.map(plainUser),
      recentIdeas: recentIdeas.map((i) => plainIdea(i, req.user?._id)),
    },
  });
});

/**
 * GET /api/admin/ideas
 * The review queue - filterable by status / category / search.
 */
const getIdeasForReview = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const { status, category, search, sort } = req.query;

  const filter = {};
  if (status) {
    const statuses = String(status).split(',').map((s) => s.trim()).filter((s) => IDEA_STATUSES.includes(s));
    filter.status = { $in: statuses.length ? statuses : [status] };
  }
  if (category) filter.category = category;
  if (search) {
    const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ title: { $regex: safe, $options: 'i' } }, { description: { $regex: safe, $options: 'i' } }];
  }

  const sortSpec = sort === 'oldest' ? { createdAt: 1 } : sort === 'status' ? { status: 1, createdAt: -1 } : { createdAt: -1 };

  const [ideas, total] = await Promise.all([
    Idea.find(filter)
      .select('-statusHistory')
      .populate('author', 'name email role points department jobTitle avatarUrl')
      .populate('bestSolution', populateUser('userId'))
      .sort(sortSpec)
      .skip(skip)
      .limit(limit)
      .lean(),
    Idea.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: ideas.map((idea) => plainIdea(idea, req.user?._id)),
    meta: buildMeta({ page, limit, total }),
  });
});

/** Small helper to keep populate definitions readable. */
function populateUser(path = 'userId') {
  return { path, select: 'name role points jobTitle avatarUrl department' };
}

/**
 * PATCH /api/admin/ideas/:id/review
 * HR VIP review verdict.
 *   approve            -> "Approved"
 *   request-changes    -> "In Discussion"  (with a mandatory note)
 *   send-to-review     -> "Under HR VIP Review"
 * Rejections are modelled as "request changes" because the lifecycle has no
 * terminal rejected state - authors are encouraged to iterate.
 */
const reviewIdea = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { decision, note } = req.body;

  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest('Invalid idea id');

  const targetByDecision = {
    approve: IDEA_STATUS.APPROVED,
    'request-changes': IDEA_STATUS.IN_DISCUSSION,
    'send-to-review': IDEA_STATUS.UNDER_REVIEW,
    complete: IDEA_STATUS.COMPLETED,
  };

  const targetStatus = targetByDecision[decision];
  if (!targetStatus) {
    throw ApiError.unprocessable(`decision must be one of: ${Object.keys(targetByDecision).join(', ')}`);
  }
  if (decision === 'request-changes' && !note?.trim()) {
    throw ApiError.unprocessable('A note explaining the requested changes is required');
  }

  const idea = await Idea.findById(id).populate('author', 'name role');
  if (!idea) throw ApiError.notFound('Idea not found');

  if (targetStatus === IDEA_STATUS.COMPLETED) {
    throw ApiError.unprocessable('Use POST /api/admin/projects to publish a completed project (credits are mandatory)');
  }
  if (idea.status === targetStatus) {
    throw ApiError.badRequest(`Idea is already in "${targetStatus}"`);
  }
  if (!canTransition(idea.status, targetStatus)) {
    throw ApiError.unprocessable(`Invalid transition: "${idea.status}" -> "${targetStatus}"`);
  }

  const previousStatus = idea.status;
  idea.pushStatusEntry({ status: targetStatus, changedBy: req.user._id, note: note || `Marked as ${decision}` });
  idea.reviewedBy = req.user._id;
  idea.reviewedAt = new Date();
  if (note?.trim()) idea.reviewNotes = note.trim();
  if (targetStatus === IDEA_STATUS.APPROVED) await awardPoints(idea.author._id, POINTS.IDEA_APPROVED);

  await idea.save();

  res.json({
    success: true,
    message: `${idea.title}: "${previousStatus}" -> "${targetStatus}"`,
    data: { id: idea._id, previousStatus, status: idea.status, reviewNotes: idea.reviewNotes },
  });
});

/**
 * POST /api/admin/projects
 * Publish a completed project and its Wall of Fame credits.
 *
 * Contributors default to the author(s) of the crowned "best solution"
 * comment(s), which keeps the credit wall honest and zero-effort.
 */
const publishProject = asyncHandler(async (req, res) => {
  const {
    ideaId,
    projectLink = '',
    developedBy = DEVELOPED_BY_DEFAULT,
    techStack = [],
    impact = '',
    summary = '',
    metrics = {},
    contributors = [],
  } = req.body;

  if (!mongoose.isValidObjectId(ideaId)) throw ApiError.badRequest('Invalid idea id');

  const idea = await Idea.findById(ideaId);
  if (!idea) throw ApiError.notFound('Idea not found');

  if (idea.status !== IDEA_STATUS.APPROVED && idea.status !== IDEA_STATUS.COMPLETED) {
    throw ApiError.unprocessable(
      `Only approved ideas can be published. Current status: "${idea.status}". Approve it first.`
    );
  }

  // Resolve contributors: explicit list wins, otherwise derive from best solutions.
  let resolved = [];
  if (Array.isArray(contributors) && contributors.length) {
    const ids = contributors.map((c) => (typeof c === 'string' ? c : c.user)).filter(Boolean);
    const users = await User.find({ _id: { $in: ids } }).select('name role');
    const byId = new Map(users.map((u) => [String(u._id), u]));
    resolved = contributors
      .filter((c) => byId.has(String(typeof c === 'string' ? c : c.user)))
      .map((c) => {
        const user = byId.get(String(typeof c === 'string' ? c : c.user));
        return {
          user: user._id,
          name: user.name,
          role: (typeof c === 'object' && c.role) || 'Solution Author',
          solutionComment: null,
          note: (typeof c === 'object' && c.note) || '',
          pointsAwarded: POINTS.PROJECT_PUBLISHED_CONTRIBUTOR,
        };
      });
  } else {
    const bestComments = await Comment.find({ ideaId: idea._id, isBestSolution: true }).populate(
      'userId',
      'name role'
    );
    const crownCount = await Comment.countDocuments({ ideaId: idea._id, isBestSolution: true });
    resolved = bestComments
      .filter((c) => c.userId)
      .map((c) => ({
        user: c.userId._id,
        name: c.userId.name,
        role: crownCount > 1 ? 'Co-Solver' : 'Solution Author',
        solutionComment: c._id,
        note: 'Crowned best solution',
        pointsAwarded: POINTS.PROJECT_PUBLISHED_CONTRIBUTOR,
      }));
  }

  if (!resolved.length) {
    throw ApiError.unprocessable(
      'No contributors could be resolved. Mark a best solution first or pass an explicit contributors list.'
    );
  }

  const authorDoc = await User.findById(idea.author).select('name');

  const credit = await ProjectCredit.findOneAndUpdate(
    { idea: idea._id },
    {
      idea: idea._id,
      title: idea.title,
      summary: summary || idea.description.slice(0, 240),
      originalIdeaBy: idea.author,
      originalIdeaByName: authorDoc?.name || 'Unknown',
      contributors: resolved,
      developedBy: developedBy?.trim() || DEVELOPED_BY_DEFAULT,
      projectLink: projectLink.trim(),
      techStack: Array.isArray(techStack) ? techStack : String(techStack).split(',').map((t) => t.trim()).filter(Boolean),
      impact,
      metrics,
      isFeatured: Boolean(req.body.isFeatured),
      publishedBy: req.user._id,
      publishedAt: new Date(),
    },
    { upsert: true, new: true, runValidators: true }
  )
    .populate('contributors.user', 'name role points avatarUrl jobTitle department')
    .populate('idea', 'title status category completedAt');

  // Drive the idea to Completed through the audited lifecycle.
  if (idea.status !== IDEA_STATUS.COMPLETED) {
    idea.pushStatusEntry({
      status: IDEA_STATUS.COMPLETED,
      changedBy: req.user._id,
      note: `Project published: ${projectLink || 'internal release'}`,
    });
    idea.completedAt = new Date();
    idea.credits = credit._id;
    await idea.save();
  } else {
    idea.credits = credit._id;
    await idea.save();
  }

  await Promise.all([
    awardPoints(idea.author, POINTS.PROJECT_PUBLISHED_AUTHOR),
    ...resolved
      .filter((c) => String(c.user) !== String(idea.author))
      .map((c) => awardPoints(c.user, POINTS.PROJECT_PUBLISHED_CONTRIBUTOR)),
  ]);

  res.status(201).json({
    success: true,
    message: 'Project published to the Wall of Fame',
    data: credit.toJSON(),
  });
});

/** GET /api/admin/projects */
const listProjects = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const filter = {};
  if (req.query.featured === 'true') filter.isFeatured = true;

  const [projects, total] = await Promise.all([
    ProjectCredit.find(filter)
      .populate('originalIdeaBy', 'name role points avatarUrl jobTitle department')
      .populate('contributors.user', 'name role points avatarUrl jobTitle department')
      .populate('publishedBy', 'name role jobTitle')
      .sort('-publishedAt')
      .skip(skip)
      .limit(limit)
      .lean(),
    ProjectCredit.countDocuments(filter),
  ]);

  res.json({ success: true, data: projects.map(plainProject), meta: buildMeta({ page, limit, total }) });
});

/** PATCH /api/admin/projects/:id */
const updateProject = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest('Invalid project id');

  const project = await ProjectCredit.findById(id);
  if (!project) throw ApiError.notFound('Project not found');

  const fields = ['summary', 'developedBy', 'projectLink', 'techStack', 'impact', 'isFeatured'];
  fields.forEach((field) => {
    if (req.body[field] !== undefined) project[field] = req.body[field];
  });
  if (req.body.metrics) project.metrics = req.body.metrics;

  await project.save();
  res.json({ success: true, message: 'Project credits updated', data: project.toJSON() });
});

/**
 * GET /api/projects  (public - powers the Wall of Fame)
 * Completed projects with full credit information, newest first.
 */
const getWallOfFame = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const filter = {};
  if (req.query.featured === 'true') filter.isFeatured = true;
  if (req.query.developedBy) filter.developedBy = req.query.developedBy;
  if (req.query.search) {
    const safe = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { title: { $regex: safe, $options: 'i' } },
      { summary: { $regex: safe, $options: 'i' } },
      { techStack: { $regex: safe, $options: 'i' } },
    ];
  }

  const [projects, total] = await Promise.all([
    ProjectCredit.find(filter)
      .populate('originalIdeaBy', 'name role points avatarUrl jobTitle department')
      .populate('contributors.user', 'name role points avatarUrl jobTitle department')
      .populate('idea', 'title status category commentCount completedAt')
      .sort('-publishedAt')
      .skip(skip)
      .limit(limit)
      .lean(),
    ProjectCredit.countDocuments(filter),
  ]);

  res.json({ success: true, data: projects.map(plainProject), meta: buildMeta({ page, limit, total }) });
});

/** GET /api/admin/users */
const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const { search, role } = req.query;

  const filter = { isActive: true };
  if (role) filter.role = role;
  if (search) {
    const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ name: { $regex: safe, $options: 'i' } }, { email: { $regex: safe, $options: 'i' } }];
  }

  const [users, total] = await Promise.all([
    User.find(filter).select('-password').sort('-createdAt').skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  res.json({ success: true, data: users.map(plainUser), meta: buildMeta({ page, limit, total }) });
});

/** PATCH /api/admin/users/:id/role - promote or demote an employee. */
const updateUserRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role, isActive } = req.body;

  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest('Invalid user id');

  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');

  if (role !== undefined) {
    if (!Object.values(ROLES).includes(role)) {
      throw ApiError.unprocessable(`role must be one of: ${Object.values(ROLES).join(', ')}`);
    }
    // Never let the last HR VIP lock everyone out of the admin panel.
    if (user.role !== role && isAdminRole(user.role) && role === ROLES.USER) {
      const remaining = await User.countDocuments({ role: { $in: [ROLES.HR_VIP, ROLES.ADMIN] }, isActive: true });
      if (remaining <= 1) throw ApiError.badRequest('At least one active HR VIP employee must remain');
    }
    user.role = role;
  }

  if (isActive !== undefined) user.isActive = Boolean(isActive);

  await user.save();
  res.json({ success: true, message: 'User updated', data: user.toJSON() });
});

module.exports = {
  getDashboardStats,
  getIdeasForReview,
  reviewIdea,
  publishProject,
  listProjects,
  updateProject,
  getWallOfFame,
  listUsers,
  updateUserRole,
};
