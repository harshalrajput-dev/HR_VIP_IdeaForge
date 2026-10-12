'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');

const controller = require('../controllers/authController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/authMiddleware');
const { LIMITS } = require('../config/constants');

const router = express.Router();

/** Tight limiter on credential endpoints to blunt brute-force attacks. */
const authLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MINUTES || 15) * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 25),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts, please try again later' },
});

const registerRules = [
  body('name').trim().isLength({ min: LIMITS.NAME_MIN, max: LIMITS.NAME_MAX }).withMessage(`Name must be ${LIMITS.NAME_MIN}-${LIMITS.NAME_MAX} characters`),
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail({ gmail_remove_dots: false }),
  body('password')
    .isLength({ min: LIMITS.PASSWORD_MIN })
    .withMessage(`Password must be at least ${LIMITS.PASSWORD_MIN} characters`)
    .matches(/[a-zA-Z]/)
    .withMessage('Password must contain at least one letter')
    .matches(/\d/)
    .withMessage('Password must contain at least one number'),
  body('department').optional({ values: 'falsy' }).trim().isLength({ max: 80 }).withMessage('Department cannot exceed 80 characters'),
  body('jobTitle').optional({ values: 'falsy' }).trim().isLength({ max: 80 }).withMessage('Job title cannot exceed 80 characters'),
  body('bio').optional({ values: 'falsy' }).trim().isLength({ max: 280 }).withMessage('Bio cannot exceed 280 characters'),
];

const loginRules = [
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail({ gmail_remove_dots: false }),
  body('password').notEmpty().withMessage('Password is required'),
];

// --- Public ---------------------------------------------------------------
router.post('/register', authLimiter, registerRules, validate, controller.register);
router.post('/login', authLimiter, loginRules, validate, controller.login);
router.get('/users/:id', controller.getPublicProfile);

// --- Authenticated --------------------------------------------------------
router.get('/me', protect, controller.getMe);
router.patch(
  '/me',
  protect,
  [
    body('name').optional().trim().isLength({ min: LIMITS.NAME_MIN, max: LIMITS.NAME_MAX }).withMessage('Invalid name length'),
    body('department').optional().trim().isLength({ max: 80 }).withMessage('Invalid department'),
    body('jobTitle').optional().trim().isLength({ max: 80 }).withMessage('Invalid job title'),
    body('bio').optional().trim().isLength({ max: 280 }).withMessage('Invalid bio'),
    body('avatarUrl').optional({ values: 'falsy' }).isURL().withMessage('Avatar must be a valid URL'),
  ],
  validate,
  controller.updateMe
);
router.post(
  '/change-password',
  protect,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: LIMITS.PASSWORD_MIN })
      .withMessage(`New password must be at least ${LIMITS.PASSWORD_MIN} characters`)
      .matches(/[a-zA-Z]/)
      .withMessage('Password must contain at least one letter')
      .matches(/\d/)
      .withMessage('Password must contain at least one number'),
  ],
  validate,
  controller.changePassword
);

module.exports = router;
