'use strict';

const { PAGINATION } = require('../config/constants');

/**
 * Normalise `?page` and `?limit` query params into a safe skip/limit pair.
 * @param {import('express').Request} req
 * @returns {{ page: number, limit: number, skip: number }}
 */
const getPagination = (req) => {
  const rawPage = Number.parseInt(req.query.page, 10);
  const rawLimit = Number.parseInt(req.query.limit, 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, PAGINATION.MAX_LIMIT) : PAGINATION.DEFAULT_LIMIT;

  return { page, limit, skip: (page - 1) * limit };
};

/** Build the `meta` block returned alongside every paginated collection. */
const buildMeta = ({ page, limit, total }) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
});

/** Whitelist based sort parsing -> mongoose sort object. */
const buildSort = (sortKey, allowed = ['createdAt'], fallback = '-createdAt') => {
  if (!sortKey) return { [fallback]: -1 };
  const desc = sortKey.startsWith('-');
  const field = desc ? sortKey.slice(1) : sortKey;
  if (!allowed.includes(field)) return { [fallback]: -1 };
  return { [field]: desc ? -1 : 1 };
};

module.exports = { getPagination, buildMeta, buildSort };
