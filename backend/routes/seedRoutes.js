'use strict';

const express = require('express');

const asyncHandler = require('../utils/asyncHandler');
const { seedDatabase } = require('../scripts/seed');

const router = express.Router();

/**
 * Seed / demo-data endpoint.
 *
 *   GET  /api/seed            -> idempotent upsert of the demo dataset
 *   GET  /api/seed?fresh=true -> wipe the collections first, then seed
 *
 * When `SEED_SECRET` is set, callers must supply it via the `x-seed-secret`
 * header or `?secret=` query param. Useful so a public deployment still exposes
 * a convenient way to (re)create demo accounts like admin@hrvip.com and
 * maya@hrvip.com without leaving the endpoint wide open.
 */
const seedHandler = asyncHandler(async (req, res) => {
  const secret = process.env.SEED_SECRET;
  if (secret) {
    const provided = req.get('x-seed-secret') || req.query.secret;
    if (provided !== secret) {
      return res.status(401).json({ success: false, message: 'Invalid or missing seed secret' });
    }
  }

  const fresh = ['1', 'true', 'yes'].includes(String(req.query.fresh).toLowerCase());
  const counts = await seedDatabase({ fresh });

  return res.json({
    success: true,
    message: `Database seeded${fresh ? ' (fresh)' : ''}`,
    data: counts,
  });
});

router.get('/', seedHandler);
router.post('/', seedHandler);

module.exports = router;
