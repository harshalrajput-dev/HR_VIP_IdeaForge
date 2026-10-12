'use strict';

const { generateToken } = require('../utils/token');
const User = require('../models/User');
const { isAdminRole } = require('../config/constants');

/**
 * Shared shape of every authenticated response payload.
 * @param {import('mongoose').Document} user
 * @param {string} [token]
 */
const buildAuthPayload = (user, token) => ({
  user: {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    isAdmin: isAdminRole(user.role),
    points: user.points,
    department: user.department,
    jobTitle: user.jobTitle,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    createdAt: user.createdAt,
  },
  token,
});

/** Sign a token for an already-persisted user. */
const issueSession = async (user) => {
  const token = generateToken(user);
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });
  return token;
};

/** @see buildAuthPayload */
module.exports = { buildAuthPayload, issueSession, User };
