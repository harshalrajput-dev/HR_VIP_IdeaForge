'use strict';

const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, extractToken, unauthorized } = require('../utils/token');
const { isAdminRole } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * Verify the JWT and load the current user onto `req.user`.
 * Fails closed: no token, bad token, expired token, deleted or deactivated
 * account all return 401.
 * @type {import('express').RequestHandler}
 */
const protect = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) throw unauthorized('No authentication token provided');

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError' ? 'Your session has expired, please log in again' : 'Invalid authentication token';
    throw unauthorized(message);
  }

  const user = await User.findById(decoded.sub);
  if (!user) throw unauthorized('The account for this token no longer exists');
  if (!user.isActive) throw unauthorized('This account has been deactivated');

  req.user = user;
  req.token = token;
  return next();
});

/**
 * Attach `req.user` when a valid token is present, but never block the request.
 * Used by public read endpoints so the UI can render "upvoted by me" state.
 * @type {import('express').RequestHandler}
 */
const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next();

  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.sub);
    if (user && user.isActive) req.user = user;
  } catch (err) {
    logger.debug(`optionalAuth ignored token: ${err.message}`);
  }
  return next();
});

/** Route guard for HR VIP staff. Must run after `protect`. */
const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role) && !roles.some((r) => isAdminRole(r))) {
      return next(require('../utils/ApiError').forbidden('This area is restricted to HR VIP employees'));
    }
    return next();
  };

module.exports = { protect, optionalAuth, requireRole };
