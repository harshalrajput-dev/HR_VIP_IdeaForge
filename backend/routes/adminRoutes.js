'use strict';

const express = require('express');
const { body, param } = require('express-validator');

const controller = require('../controllers/adminController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');
const { CATEGORIES, DEVELOPED_BY_DEFAULT, ROLES, IDEA_STATUSES } = require('../config/constants');

const idRule = param('id').isMongoId().withMessage('Invalid id');
const isUrl = (value) => !value || /^https?:\/\/.+/i.test(String(value));

/* -------------------------------------------------------------------------- */
/* Public: the Wall of Fame feed (no authentication required)                 */
/* -------------------------------------------------------------------------- */
const publicProjectRouter = express.Router();
publicProjectRouter.get('/', controller.getWallOfFame);

/* -------------------------------------------------------------------------- */
/* Protected: everything below requires an HR VIP employee account             */
/* -------------------------------------------------------------------------- */
const router = express.Router();
router.use(protect, adminOnly);

// Dashboard
router.get('/dashboard', controller.getDashboardStats);

// Review queue
router.get('/ideas', controller.getIdeasForReview);
router.patch(
  '/ideas/:id/review',
  idRule,
  [body('decision').isIn(['approve', 'request-changes', 'send-to-review', 'complete']).withMessage('Unknown review decision')],
  validate,
  controller.reviewIdea
);

// Project publishing / Wall of Fame management
router.get('/projects', controller.listProjects);
router.post(
  '/projects',
  [
    body('ideaId').isMongoId().withMessage('A valid ideaId is required'),
    body('projectLink').optional({ values: 'falsy' }).custom(isUrl).withMessage('Project link must be a valid http(s) URL'),
    body('developedBy').optional().trim().isLength({ min: 2, max: 120 }).withMessage('"Developed By" must be 2-120 characters'),
    body('techStack')
      .optional()
      .custom((v) => (Array.isArray(v) ? v : String(v).split(',')).length <= 12)
      .withMessage('At most 12 technologies'),
    body('impact').optional().trim().isLength({ max: 400 }).withMessage('Impact cannot exceed 400 characters'),
    body('summary').optional().trim().isLength({ max: 600 }).withMessage('Summary cannot exceed 600 characters'),
    body('contributors')
      .optional()
      .isArray({ max: 12 })
      .withMessage('contributors must be an array of at most 12 entries'),
  ],
  validate,
  controller.publishProject
);
router.patch(
  '/projects/:id',
  idRule,
  [body('projectLink').optional({ values: 'falsy' }).custom(isUrl).withMessage('Project link must be a valid http(s) URL')],
  validate,
  controller.updateProject
);

// People
router.get('/users', controller.listUsers);
router.patch(
  '/users/:id/role',
  idRule,
  [body('role').optional().isIn(Object.values(ROLES)).withMessage(`Role must be one of: ${Object.values(ROLES).join(', ')}`)],
  validate,
  controller.updateUserRole
);

/** Static option lists so the dashboard never hard-codes enums. */
router.get('/options', (_req, res) =>
  res.json({
    success: true,
    data: {
      categories: CATEGORIES,
      statuses: IDEA_STATUSES,
      roles: Object.values(ROLES),
      defaultDevelopedBy: DEVELOPED_BY_DEFAULT,
    },
  })
);

module.exports = router;
module.exports.publicProjectRouter = publicProjectRouter;
module.exports.adminRouter = router;
