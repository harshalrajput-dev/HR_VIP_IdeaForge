'use strict';

/**
 * `.lean()` skips Mongoose virtuals and the schema `toJSON` transform, so list
 * endpoints must normalise their documents by hand. These helpers give every
 * API response the same public shape as a non-lean document: `id` (never
 * `_id`), no `__v`, no raw upvote id arrays and no internal audit fields.
 */

const omit = (doc, keys) => {
  const copy = { ...doc };
  keys.forEach((key) => delete copy[key]);
  return copy;
};

/** Strip Mongoose internals and expose a stable `id`. */
const withId = (doc) => {
  if (!doc) return doc;
  const copy = { ...doc };
  if (copy._id) {
    copy.id = String(copy._id);
    delete copy._id;
  }
  delete copy.__v;
  return copy;
};

/** A lean populated sub-document still carries `_id`; give it `id` too. */
const withNestedId = (parent, key) => {
  const value = parent[key];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    parent[key] = withId(value);
  }
  return parent;
};

/**
 * Idea shape consumed by IdeaCard / Home / AdminDashboard.
 * @param {object} idea lean idea document
 * @param {string} [currentUserId] adds `upvotedByMe`
 */
const plainIdea = (idea, currentUserId) => {
  if (!idea) return idea;
  const upvotes = Array.isArray(idea.upvotes) ? idea.upvotes : [];
  const copy = {
    ...withId(omit(idea, ['statusHistory'])),
    upvoteCount: upvotes.length || idea.upvoteCount || 0,
    upvotedByMe: currentUserId
      ? upvotes.some((uid) => String(uid) === String(currentUserId))
      : Boolean(idea.upvotedByMe),
  };
  // Voter ids stay server-side: only the aggregate count is public.
  delete copy.upvotes;
  withNestedId(copy, 'author');
  withNestedId(copy, 'bestSolution');
  return copy;
};

/** Comment shape consumed by DiscussionThread. */
const plainComment = (comment) => {
  if (!comment) return comment;
  const copy = withId(comment);
  withNestedId(copy, 'userId');
  return copy;
};

/** ProjectCredit shape consumed by ProjectCredits / WallOfFame. */
const plainProject = (project) => {
  if (!project) return project;
  const copy = withId(project);
  withNestedId(copy, 'idea');
  withNestedId(copy, 'originalIdeaBy');
  if (Array.isArray(copy.contributors)) {
    copy.contributors = copy.contributors.map((person) => {
      const next = { ...person };
      withNestedId(next, 'user');
      return next;
    });
  }
  return copy;
};

/** User shape consumed by the admin People tab. */
const plainUser = (user) => withId(user);

module.exports = { withId, plainIdea, plainComment, plainProject, plainUser };
