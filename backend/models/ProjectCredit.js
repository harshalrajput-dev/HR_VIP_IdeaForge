'use strict';

const mongoose = require('mongoose');

const { DEVELOPED_BY_DEFAULT } = require('../config/constants');

/**
 * The public "Wall of Fame" record for a completed project.
 * One document per completed idea: who thought of it, who helped build it,
 * who shipped it, and where it lives.
 */
const contributorSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    /** Denormalised so credits survive a user rename / account removal. */
    name: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ['Solution Author', 'Co-Solver', 'Reviewer', 'Tester', 'Domain Expert'],
      default: 'Solution Author',
    },
    /** The crowned "best solution" comment, when applicable. */
    solutionComment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
    note: { type: String, trim: true, maxlength: 240, default: '' },
    pointsAwarded: { type: Number, default: 0, min: 0 },
  },
  { _id: false, timestamps: { createdAt: 'creditedAt', updatedAt: false } }
);

const projectCreditSchema = new mongoose.Schema(
  {
    idea: { type: mongoose.Schema.Types.ObjectId, ref: 'Idea', required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    summary: { type: String, trim: true, maxlength: 600, default: '' },
    /** Original Idea By - the employee who raised the problem. */
    originalIdeaBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    originalIdeaByName: { type: String, required: true, trim: true },
    /** Key Contributors - everyone who delivered a solution. */
    contributors: { type: [contributorSchema], default: [] },
    /** Developed By - always the internal team that shipped it. */
    developedBy: { type: String, trim: true, maxlength: 120, default: DEVELOPED_BY_DEFAULT },
    projectLink: { type: String, trim: true, default: '' },
    techStack: { type: [String], default: [] },
    impact: { type: String, trim: true, maxlength: 400, default: '' },
    metrics: {
      type: Map,
      of: Number,
      default: undefined,
    },
    isFeatured: { type: Boolean, default: false, index: true },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    publishedAt: { type: Date, default: Date.now },
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

projectCreditSchema.index({ publishedAt: -1 });
projectCreditSchema.index({ isFeatured: 1, publishedAt: -1 });
projectCreditSchema.index({ 'contributors.user': 1 });

/** Human readable one-liner used on the Wall of Fame card. */
projectCreditSchema.virtual('creditLine').get(function creditLine() {
  const names = this.contributors.map((c) => c.name);
  if (!names.length) return `Original idea by ${this.originalIdeaByName}`;
  if (names.length <= 2) return `Original idea by ${this.originalIdeaByName} - solution by ${names.join(' & ')}`;
  return `Original idea by ${this.originalIdeaByName} - with ${names.length} key contributors`;
});

module.exports =
  mongoose.models.ProjectCredit || mongoose.model('ProjectCredit', projectCreditSchema);
