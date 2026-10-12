'use strict';

const User = require('../models/User');
const { isAdminRole } = require('../config/constants');
const logger = require('./logger');

/**
 * Award (or deduct) points for a user without ever going below zero.
 * HR VIP / admin accounts never accumulate points - the leaderboard is for
 * contributors, not for platform staff.
 *
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {number} delta
 * @param {{ silent?: boolean, reason?: string }} [options]
 */
const awardPoints = async (userId, delta, options = {}) => {
  if (!userId || !Number.isFinite(delta) || delta === 0) return null;
  if (options.silent) return null;

  try {
    return await User.updateOne(
      { _id: userId, role: { $nin: ['hr_vip_employee', 'admin'] } },
      [{ $set: { points: { $max: [0, { $add: ['$points', delta] }] } } }],
    );
  } catch (err) {
    // Never let a leaderboard failure break the business operation.
    logger.warn(`Could not award ${delta} points to ${userId}: ${err.message}`);
    return null;
  }
};

/** Sum of all positive point deltas, used when publishing a project. */
const totalPoints = (deltas) => Object.values(deltas).reduce((sum, n) => sum + n, 0);

module.exports = { awardPoints, totalPoints, isAdminRole };
