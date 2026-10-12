/**
 * Client-side mirrors of the backend enums (backend/config/constants.js).
 * Kept in one place so badges, filters and forms never drift.
 */

export const IDEA_STATUS = Object.freeze({
  SUBMITTED: 'Submitted',
  IN_DISCUSSION: 'In Discussion',
  UNDER_REVIEW: 'Under HR VIP Review',
  APPROVED: 'Approved',
  COMPLETED: 'Completed',
});

export const IDEA_STATUSES = Object.freeze([
  IDEA_STATUS.SUBMITTED,
  IDEA_STATUS.IN_DISCUSSION,
  IDEA_STATUS.UNDER_REVIEW,
  IDEA_STATUS.APPROVED,
  IDEA_STATUS.COMPLETED,
]);

/** Tailwind classes per lifecycle stage - drives the status badges. */
export const STATUS_STYLES = Object.freeze({
  [IDEA_STATUS.SUBMITTED]: 'bg-slate-100 text-slate-700 ring-slate-200',
  [IDEA_STATUS.IN_DISCUSSION]: 'bg-sky-50 text-sky-700 ring-sky-200',
  [IDEA_STATUS.UNDER_REVIEW]: 'bg-amber-50 text-amber-800 ring-amber-200',
  [IDEA_STATUS.APPROVED]: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  [IDEA_STATUS.COMPLETED]: 'bg-forge-50 text-forge-700 ring-forge-200',
});

export const STATUS_DOT = Object.freeze({
  [IDEA_STATUS.SUBMITTED]: 'bg-slate-400',
  [IDEA_STATUS.IN_DISCUSSION]: 'bg-sky-500',
  [IDEA_STATUS.UNDER_REVIEW]: 'bg-amber-500',
  [IDEA_STATUS.APPROVED]: 'bg-emerald-500',
  [IDEA_STATUS.COMPLETED]: 'bg-forge-500',
});

export const CATEGORIES = Object.freeze([
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

export const PRIORITIES = Object.freeze(['Low', 'Medium', 'High', 'Critical']);

export const PRIORITY_STYLES = Object.freeze({
  Low: 'bg-slate-100 text-slate-600 ring-slate-200',
  Medium: 'bg-sky-50 text-sky-700 ring-sky-200',
  High: 'bg-amber-50 text-amber-800 ring-amber-200',
  Critical: 'bg-rose-50 text-rose-700 ring-rose-200',
});

export const CONTRIBUTOR_ROLES = Object.freeze([
  'Solution Author',
  'Co-Solver',
  'Reviewer',
  'Tester',
  'Domain Expert',
]);

/** Always shown as the "Developed By" credit unless an HR VIP overrides it. */
export const DEVELOPED_BY_DEFAULT = 'HR VIP Team';

export const LIMITS = Object.freeze({
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

/** Ordered lifecycle for the progress rail on IdeaDetails. */
export const LIFECYCLE = IDEA_STATUSES;
