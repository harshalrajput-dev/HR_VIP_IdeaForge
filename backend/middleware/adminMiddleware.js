'use strict';

const { isAdminRole } = require('../config/constants');
const ApiError = require('../utils/ApiError');

/**
 * Restrict a route to HR VIP employees / admins.
 * Must be mounted after `protect` so `req.user` is populated.
 * @type {import('express').RequestHandler}
 */
const adminOnly = (req, _res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized('Authentication required'));
  }

  if (!isAdminRole(req.user.role)) {
    return next(ApiError.forbidden('HR VIP employee access required'));
  }

  return next();
};

module.exports = { adminOnly };
