'use strict';

const mongoose = require('mongoose');

const { LIMITS } = require('../config/constants');

const commentSchema = new mongoose.Schema(
  {
    ideaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Idea', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    text: {
      type: String,
      required: [true, 'Comment text is required'],
      trim: true,
      minlength: [LIMITS.COMMENT_MIN, `Comment must be at least ${LIMITS.COMMENT_MIN} characters`],
      maxlength: [LIMITS.COMMENT_MAX, `Comment cannot exceed ${LIMITS.COMMENT_MAX} characters`],
    },
    /** Marks the community (or HR VIP) approved solution for this idea. */
    isBestSolution: { type: Boolean, default: false, index: true },
    bestMarkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    bestMarkedAt: { type: Date, default: null },
    /** Optional one-level threading so a reviewer can ask a follow-up question. */
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
    isHidden: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id?.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

commentSchema.index({ ideaId: 1, isBestSolution: 1 });
commentSchema.index({ ideaId: 1, createdAt: 1 });

/** Crown this comment as the winning solution (and stamp the audit fields). */
commentSchema.methods.markAsBest = function markAsBest(userId) {
  this.isBestSolution = true;
  this.bestMarkedBy = userId;
  this.bestMarkedAt = new Date();
};

/** Remove the crown. */
commentSchema.methods.unmarkAsBest = function unmarkAsBest() {
  this.isBestSolution = false;
  this.bestMarkedBy = null;
  this.bestMarkedAt = null;
};

module.exports = mongoose.models.Comment || mongoose.model('Comment', commentSchema);
