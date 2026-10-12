'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');

const controller = require('../controllers/ideaController');
const commentController = require('../controllers/commentController');
const validate = require('../middleware/validate');
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');
const { CATEGORIES, PRIORITIES, LIMITS, IDEA_STATUSES } = require('../config/constants');

const router = express.Router();

const ideaIdRule = param('id').isMongoId().withMessage('Invalid idea id');
const ideaIdParamRule = param('ideaId').isMongoId().withMessage('Invalid idea id');

const createRules = [
  body('title')
    .trim()
    .isLength({ min: LIMITS.TITLE_MIN, max: LIMITS.TITLE_MAX })
    .withMessage(`Title must be ${LIMITS.TITLE_MIN}-${LIMITS.TITLE_MAX} characters`),
  body('description')
    .trim()
    .isLength({ min: LIMITS.DESCRIPTION_MIN, max: LIMITS.DESCRIPTION_MAX })
    .withMessage(`Description must be ${LIMITS.DESCRIPTION_MIN}-${LIMITS.DESCRIPTION_MAX} characters`),
  body('category').isIn(CATEGORIES).withMessage(`Category must be one of: ${CATEGORIES.join(', ')}`),
  body('priority').optional().isIn(PRIORITIES).withMessage(`Priority must be one of: ${PRIORITIES.join(', ')}`),
  body('tags')
    .optional()
    .custom((value) => {
      const list = Array.isArray(value) ? value : String(value).split(',');
      return list.every((t) => String(t).trim().length <= 30) && list.length <= 8;
    })
    .withMessage('Provide at most 8 tags of 30 characters each'),
];

// --- Public read ----------------------------------------------------------
router.get('/meta/filters', controller.getFilterOptions);
router.get('/', optionalAuth, controller.getIdeas);
router.get('/:id', optionalAuth, ideaIdRule, validate, controller.getIdeaById);

// --- Comments (nested for a RESTful discussion thread) -------------------
router.get('/:ideaId/comments', ideaIdParamRule, validate, commentController.getCommentsByIdea);
router.post(
  '/:ideaId/comments',
  protect,
  ideaIdParamRule,
  [body('text').trim().isLength({ min: LIMITS.COMMENT_MIN, max: LIMITS.COMMENT_MAX }).withMessage(`Comment must be ${LIMITS.COMMENT_MIN}-${LIMITS.COMMENT_MAX} characters`)],
  validate,
  commentController.addComment
);

// --- Authenticated writes -------------------------------------------------
router.post('/', protect, createRules, validate, controller.createIdea);
router.post('/:id/upvote', protect, ideaIdRule, validate, controller.upvoteIdea);

router.patch(
  '/:id',
  protect,
  ideaIdRule,
  [
    body('title').optional().trim().isLength({ min: LIMITS.TITLE_MIN, max: LIMITS.TITLE_MAX }).withMessage('Invalid title length'),
    body('description').optional().trim().isLength({ min: LIMITS.DESCRIPTION_MIN, max: LIMITS.DESCRIPTION_MAX }).withMessage('Invalid description length'),
    body('category').optional().isIn(CATEGORIES).withMessage('Invalid category'),
    body('priority').optional().isIn(PRIORITIES).withMessage('Invalid priority'),
  ],
  validate,
  controller.updateIdea
);

router.delete('/:id', protect, ideaIdRule, validate, controller.deleteIdea);

// --- Status transitions (HR VIP only) -------------------------------------
router.patch(
  '/:id/status',
  protect,
  adminOnly,
  ideaIdRule,
  [body('status').isIn(IDEA_STATUSES).withMessage(`Status must be one of: ${IDEA_STATUSES.join(', ')}`), body('note').optional().trim().isLength({ max: 500 })],
  validate,
  controller.updateIdeaStatus
);

/** Convenience endpoint for the feed filters UI. */
router.get(
  '/search/suggestions',
  optionalAuth,
  [query('q').trim().isLength({ min: 2 }).withMessage('Search term must be at least 2 characters')],
  validate,
  // `getIdeas` filters on `search`; alias the shorthand so `q` actually filters.
  (req, _res, next) => {
    req.query.search = req.query.q;
    next();
  },
  controller.getIdeas
);

module.exports = router;
