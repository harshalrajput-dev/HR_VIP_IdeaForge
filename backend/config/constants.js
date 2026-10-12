'use strict';

/**
 * Centralised application constants.
 * Keeps enums in one place so models, controllers and validation stay in sync.
 */

const ROLES = Object.freeze({
  USER: 'user',
  HR_VIP: 'hr_vip_employee',
  ADMIN: 'admin',
});

const ALL_ROLES = Object.freeze([ROLES.USER, ROLES.HR_VIP, ROLES.ADMIN]);

/** Roles allowed into the HR VIP admin panel. */
const ADMIN_ROLES = Object.freeze([ROLES.HR_VIP, ROLES.ADMIN]);

/** Idea lifecycle - the order below is the happy path. */
const IDEA_STATUS = Object.freeze({
  SUBMITTED: 'Submitted',
  IN_DISCUSSION: 'In Discussion',
  UNDER_REVIEW: 'Under HR VIP Review',
  APPROVED: 'Approved',
  COMPLETED: 'Completed',
});

const IDEA_STATUSES = Object.freeze([
  IDEA_STATUS.SUBMITTED,
  IDEA_STATUS.IN_DISCUSSION,
  IDEA_STATUS.UNDER_REVIEW,
  IDEA_STATUS.APPROVED,
  IDEA_STATUS.COMPLETED,
]);

/** Allowed status transitions (an HR VIP reviewer may move an idea back and forth). */
const ALLOWED_STATUS_TRANSITIONS = Object.freeze({
  [IDEA_STATUS.SUBMITTED]: [IDEA_STATUS.IN_DISCUSSION, IDEA_STATUS.UNDER_REVIEW],
  [IDEA_STATUS.IN_DISCUSSION]: [IDEA_STATUS.SUBMITTED, IDEA_STATUS.UNDER_REVIEW],
  [IDEA_STATUS.UNDER_REVIEW]: [IDEA_STATUS.IN_DISCUSSION, IDEA_STATUS.APPROVED],
  [IDEA_STATUS.APPROVED]: [IDEA_STATUS.UNDER_REVIEW, IDEA_STATUS.COMPLETED],
  [IDEA_STATUS.COMPLETED]: [IDEA_STATUS.APPROVED],
});

const CATEGORIES = Object.freeze([
  'Process Improvement',
  'Software Bug',
  'Software Limitation',
  'Automation',
  'Data & Analytics',
  'AI & Emerging Tech',
  'Training & Culture',
  'Workplace & Facilities',
  'Other',
]);

const PRIORITIES = Object.freeze(['Low', 'Medium', 'High', 'Critical']);

/** Gamification economy. */
const POINTS = Object.freeze({
  IDEA_SUBMITTED: 10,
  UPVOTE_RECEIVED: 2,
  BEST_SOLUTION: 25,
  IDEA_APPROVED: 15,
  PROJECT_PUBLISHED_AUTHOR: 50,
  PROJECT_PUBLISHED_CONTRIBUTOR: 40,
});

const DEVELOPED_BY_DEFAULT = 'HR VIP Team';

const LIMITS = Object.freeze({
  TITLE_MIN: 8,
  TITLE_MAX: 140,
  DESCRIPTION_MIN: 20,
  DESCRIPTION_MAX: 5000,
  COMMENT_MIN: 2,
  COMMENT_MAX: 2000,
  NAME_MIN: 2,
  NAME_MAX: 60,
  PASSWORD_MIN: 8,
});

const PAGINATION = Object.freeze({
  DEFAULT_LIMIT: Number(process.env.DEFAULT_PAGE_SIZE) || 12,
  MAX_LIMIT: Number(process.env.MAX_PAGE_SIZE) || 50,
});

const isAdminRole = (role) => ADMIN_ROLES.includes(role);
const canTransition = (from, to) =>
  Boolean(ALLOWED_STATUS_TRANSITIONS[from]) && ALLOWED_STATUS_TRANSITIONS[from].includes(to);

module.exports = {
  ROLES,
  ALL_ROLES,
  ADMIN_ROLES,
  IDEA_STATUS,
  IDEA_STATUSES,
  ALLOWED_STATUS_TRANSITIONS,
  CATEGORIES,
  PRIORITIES,
  POINTS,
  DEVELOPED_BY_DEFAULT,
  LIMITS,
  PAGINATION,
  isAdminRole,
  canTransition,
};
