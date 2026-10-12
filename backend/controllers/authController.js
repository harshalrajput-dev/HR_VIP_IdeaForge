'use strict';

const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { buildAuthPayload, issueSession } = require('../utils/authPayload');
const { ROLES, isAdminRole, LIMITS } = require('../config/constants');

/** Emails that should be promoted to HR VIP on sign-up (comma separated env). */
const bootstrapAdminEmails = () =>
  (process.env.BOOTSTRAP_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

/**
 * POST /api/auth/register
 * First account on a fresh database is bootstrapped as HR VIP so the platform
 * is usable immediately; listed emails are always promoted.
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, department, jobTitle, bio } = req.body;
  const normalisedEmail = email.toLowerCase().trim();

  if (await User.exists({ email: normalisedEmail })) {
    throw ApiError.conflict('An account with that email already exists');
  }

  const isFirstUser = (await User.estimatedDocumentCount()) === 0;
  const shouldBeAdmin = isFirstUser || bootstrapAdminEmails().includes(normalisedEmail);

  const user = await User.create({
    name,
    email: normalisedEmail,
    password,
    role: shouldBeAdmin ? ROLES.HR_VIP : ROLES.USER,
    department: department || 'General',
    jobTitle: jobTitle || '',
    bio: bio || '',
  });

  const token = await issueSession(user);

  res.status(201).json({
    success: true,
    message: shouldBeAdmin
      ? 'Account created with HR VIP employee access'
      : 'Welcome to HR VIP IdeaForge',
    data: buildAuthPayload(user, token),
  });
});

/** POST /api/auth/login */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
  if (!user) throw ApiError.unauthorized('Invalid email or password');

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw ApiError.unauthorized('Invalid email or password');

  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated. Contact HR VIP.');

  const token = await issueSession(user);

  res.json({
    success: true,
    message: `Welcome back, ${user.name.split(' ')[0]}`,
    data: buildAuthPayload(user, token),
  });
});

/** GET /api/auth/me - current user profile */
const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, data: buildAuthPayload(req.user, req.token) });
});

/** PATCH /api/auth/me - update the editable parts of a profile */
const updateMe = asyncHandler(async (req, res) => {
  const { name, department, jobTitle, bio, avatarUrl } = req.body;

  const user = await User.findById(req.user._id).select('+password');
  if (!user) throw ApiError.notFound('User not found');

  if (name !== undefined) user.name = name;
  if (department !== undefined) user.department = department;
  if (jobTitle !== undefined) user.jobTitle = jobTitle;
  if (bio !== undefined) user.bio = bio;
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;

  await user.save();
  user.password = undefined;

  res.json({ success: true, message: 'Profile updated', data: buildAuthPayload(user, req.token) });
});

/**
 * POST /api/auth/change-password
 * Requires the current password - a stolen token alone cannot lock the owner out.
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < LIMITS.PASSWORD_MIN) {
    throw ApiError.unprocessable(`New password must be at least ${LIMITS.PASSWORD_MIN} characters`);
  }

  const user = await User.findById(req.user._id).select('+password');
  if (!user) throw ApiError.notFound('User not found');

  if (!(await user.comparePassword(currentPassword || ''))) {
    throw ApiError.unauthorized('Current password is incorrect');
  }
  if (await user.comparePassword(newPassword)) {
    throw ApiError.badRequest('New password must be different from the current one');
  }

  user.password = newPassword; // pre-save hook re-hashes with bcrypt
  await user.save();

  res.json({ success: true, message: 'Password changed successfully' });
});

/** GET /api/auth/users/:id - public-facing contributor profile */
const getPublicProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('name role points department jobTitle bio avatarUrl createdAt');
  if (!user) throw ApiError.notFound('User not found');

  const [ideas, credits] = await Promise.all([
    User.db.model('Idea').countDocuments({ author: user._id }),
    User.db.model('ProjectCredit').countDocuments({ $or: [{ originalIdeaBy: user._id }, { 'contributors.user': user._id }] }),
  ]);

  res.json({
    success: true,
    data: {
      ...user.toJSON(),
      isAdmin: isAdminRole(user.role),
      stats: { ideas, projects: credits },
    },
  });
});

module.exports = { register, login, getMe, updateMe, changePassword, getPublicProfile };
