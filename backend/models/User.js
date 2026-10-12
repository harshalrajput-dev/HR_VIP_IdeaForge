'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { ALL_ROLES, ROLES, LIMITS, isAdminRole } = require('../config/constants');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [LIMITS.NAME_MIN, `Name must be at least ${LIMITS.NAME_MIN} characters`],
      maxlength: [LIMITS.NAME_MAX, `Name cannot exceed ${LIMITS.NAME_MAX} characters`],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [EMAIL_REGEX, 'Please provide a valid email address'],
    },
    // `select: false` keeps the hash out of every query result by default.
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [LIMITS.PASSWORD_MIN, `Password must be at least ${LIMITS.PASSWORD_MIN} characters`],
      select: false,
    },
    role: {
      type: String,
      enum: { values: ALL_ROLES, message: '`{VALUE}` is not a supported role' },
      default: ROLES.USER,
      index: true,
    },
    points: { type: Number, default: 0, min: 0 },
    department: { type: String, trim: true, maxlength: 80, default: 'General' },
    jobTitle: { type: String, trim: true, maxlength: 80, default: '' },
    avatarUrl: { type: String, trim: true, default: '' },
    bio: { type: String, trim: true, maxlength: 280, default: '' },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id?.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

/** Hash the password whenever it is set or changed. */
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const rounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;
  this.password = await bcrypt.hash(this.password, rounds);
  return next();
});

/** Compare a plain-text candidate against the stored hash. */
userSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password) return Promise.reject(new Error('Password hash was not selected on this document'));
  return bcrypt.compare(candidate, this.password);
};

/** Convenience flag consumed by the API/UI to gate admin UI. */
userSchema.virtual('isAdmin').get(function isAdmin() {
  return isAdminRole(this.role);
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
