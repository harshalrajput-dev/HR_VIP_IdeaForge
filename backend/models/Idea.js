'use strict';

const mongoose = require('mongoose');

const {
  IDEA_STATUS,
  IDEA_STATUSES,
  ALLOWED_STATUS_TRANSITIONS,
  CATEGORIES,
  PRIORITIES,
  LIMITS,
} = require('../config/constants');

const statusEntrySchema = new mongoose.Schema(
  {
    status: { type: String, enum: IDEA_STATUSES, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    changedByName: { type: String, trim: true },
    note: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { _id: false, timestamps: { createdAt: 'changedAt', updatedAt: false } }
);

const ideaSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [LIMITS.TITLE_MIN, `Title must be at least ${LIMITS.TITLE_MIN} characters`],
      maxlength: [LIMITS.TITLE_MAX, `Title cannot exceed ${LIMITS.TITLE_MAX} characters`],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [LIMITS.DESCRIPTION_MIN, `Description must be at least ${LIMITS.DESCRIPTION_MIN} characters`],
      maxlength: [LIMITS.DESCRIPTION_MAX, `Description cannot exceed ${LIMITS.DESCRIPTION_MAX} characters`],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: { values: CATEGORIES, message: '`{VALUE}` is not a supported category' },
      default: 'Other',
      index: true,
    },
    status: {
      type: String,
      enum: { values: IDEA_STATUSES, message: '`{VALUE}` is not a valid status' },
      default: IDEA_STATUS.SUBMITTED,
      index: true,
    },
    priority: { type: String, enum: PRIORITIES, default: 'Medium' },
    tags: {
      type: [String],
      default: [],
      validate: [(arr) => arr.length <= 8, 'An idea can carry at most 8 tags'],
    },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    /** Storing user ids (not a counter) makes upvote toggling and dedupe trivial. */
    upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    commentCount: { type: Number, default: 0, min: 0 },
    /** The comment an HR VIP reviewer (or the author) crowned as the winning solution. */
    bestSolution: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
    /** Published credits - only present once the project is Completed. */
    credits: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectCredit', default: null },
    reviewNotes: { type: String, trim: true, maxlength: 1000, default: '' },
    isFeatured: { type: Boolean, default: false },
    statusHistory: { type: [statusEntrySchema], default: [] },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id?.toString();
        delete ret._id;
        delete ret.__v;
        ret.upvoteCount = ret.upvotes?.length ?? 0;
        delete ret.upvotes;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

ideaSchema.index({ title: 'text', description: 'text', tags: 'text' });
ideaSchema.index({ status: 1, createdAt: -1 });
ideaSchema.index({ category: 1, status: 1, createdAt: -1 });
ideaSchema.index({ author: 1, createdAt: -1 });

/** Never let the transition map drift away from the enum. */
IDEA_STATUSES.forEach((status) => {
  if (!ALLOWED_STATUS_TRANSITIONS[status]) {
    throw new Error(`ALLOWED_STATUS_TRANSITIONS is missing an entry for "${status}"`);
  }
});

/** Is `to` reachable from `from`? Used by the admin controller. */
ideaSchema.methods.canTransitionTo = function canTransitionTo(nextStatus) {
  return (ALLOWED_STATUS_TRANSITIONS[this.status] || []).includes(nextStatus);
};

/** Append an audit entry to the status history. */
ideaSchema.methods.pushStatusEntry = function pushStatusEntry({ status, changedBy, note = '' }) {
  this.status = status;
  this.statusHistory.push({
    status,
    changedBy,
    changedByName: changedBy?.name,
    note,
  });
};

module.exports = mongoose.models.Idea || mongoose.model('Idea', ideaSchema);
