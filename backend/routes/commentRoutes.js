'use strict';

const express = require('express');
const { body, param } = require('express-validator');

const controller = require('../controllers/commentController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/authMiddleware');
const { LIMITS } = require('../config/constants');

const router = express.Router();

const commentIdRule = param('id').isMongoId().withMessage('Invalid comment id');
const textRule = body('text')
  .trim()
  .isLength({ min: LIMITS.COMMENT_MIN, max: LIMITS.COMMENT_MAX })
  .withMessage(`Comment must be ${LIMITS.COMMENT_MIN}-${LIMITS.COMMENT_MAX} characters`);

/** Crown / un-crown the winning solution (idea author or HR VIP). */
router.patch('/:id/mark-best', protect, commentIdRule, validate, controller.markBestSolution);

router.patch('/:id', protect, commentIdRule, [textRule], validate, controller.updateComment);

router.delete('/:id', protect, commentIdRule, validate, controller.deleteComment);

module.exports = router;
