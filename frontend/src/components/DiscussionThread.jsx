import { useCallback, useState } from 'react';

import Avatar from './Avatar';
import { RoleBadge } from './StatusBadge';
import UserLink from './UserLink';
import { Alert, EmptyState, SkeletonList, Spinner } from './Feedback';
import api from '../services/api';
import { useApi, useMutation } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { cn, formatDateTime, timeAgo } from '../utils/format';
import { LIMITS } from '../utils/constants';

const SORTS = [
  { value: 'best', label: 'Best first' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'newest', label: 'Newest' },
];

/**
 * Community discussion for one idea: post a solution, sort the thread and
 * crown the winning answer ("Mark Best Solution").
 *
 * @param {object} props
 * @param {string} props.ideaId
 * @param {boolean} props.canMarkBest  idea author or HR VIP
 * @param {string}  props.currentUserId
 * @param {Function} props.onCommentCountChange
 * @param {Function} props.onBestSolutionChange
 */
export default function DiscussionThread({
  ideaId,
  canMarkBest = false,
  currentUserId,
  onCommentCountChange,
  onBestSolutionChange,
}) {
  const { isAuthenticated, user } = useAuth();
  const [sort, setSort] = useState('best');
  const [text, setText] = useState('');
  const [flash, setFlash] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');

  const {
    data: comments = [],
    meta,
    loading,
    error,
    refetch,
    setData,
  } = useApi(
    () => api.get(`/ideas/${ideaId}/comments`, { params: { sort, limit: 50 } }),
    [ideaId, sort],
    { initialData: [] }
  );

  const addComment = useMutation((payload) => api.post(`/ideas/${ideaId}/comments`, payload));
  const markBest = useMutation((id) => api.patch(`/comments/${id}/mark-best`));
  const updateComment = useMutation(({ id, body }) => api.patch(`/comments/${id}`, { text: body }));
  const deleteComment = useMutation((id) => api.delete(`/comments/${id}`));

  /** Optimistically prepend the new comment so the thread feels instant. */
  const handleSubmit = async (event) => {
    event.preventDefault();
    const body = text.trim();
    if (body.length < LIMITS.COMMENT_MIN) {
      setFlash({ tone: 'error', message: `Your solution must be at least ${LIMITS.COMMENT_MIN} characters.` });
      return;
    }

    setFlash(null);
    try {
      const res = await addComment.mutate({ text: body });
      setText('');
      setData((prev) => {
        const next = [...prev, res.data].sort(sortComments(sort));
        onCommentCountChange?.(next.length);
        return next;
      });
      setFlash({ tone: 'success', message: res.message || 'Solution posted' });
    } catch (err) {
      setFlash({ tone: 'error', message: err.message, details: err.details });
    }
  };

  const handleMarkBest = async (comment) => {
    setFlash(null);
    try {
      const res = await markBest.mutate(comment.id);
      // A new crown demotes the previous one - reflect that in the local list.
      setData((prev) =>
        prev.map((c) => ({ ...c, isBestSolution: c.id === comment.id ? Boolean(res.data.comment.isBestSolution) : false }))
      );
      onBestSolutionChange?.(res.data.ideaBestSolution);
      setFlash({ tone: 'success', message: res.message });
    } catch (err) {
      setFlash({ tone: 'error', message: err.message });
    }
  };

  const handleUpdate = async (comment) => {
    try {
      const res = await updateComment.mutate({ id: comment.id, body: editingText.trim() });
      setData((prev) => prev.map((c) => (c.id === comment.id ? { ...c, text: res.data.text } : c)));
      setEditingId(null);
    } catch (err) {
      setFlash({ tone: 'error', message: err.message });
    }
  };

  const handleDelete = async (comment) => {
    try {
      await deleteComment.mutate(comment.id);
      setData((prev) => {
        const next = prev.filter((c) => c.id !== comment.id);
        onCommentCountChange?.(next.length);
        return next;
      });
      if (comment.isBestSolution) onBestSolutionChange?.(null);
    } catch (err) {
      setFlash({ tone: 'error', message: err.message });
    }
  };

  if (loading) return <SkeletonList count={2} />;
  if (error) {
    return <Alert tone="error" title="Could not load the discussion">{error.message}</Alert>;
  }

  return (
    <section id="discussion" className="scroll-mt-24">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          Community discussion
          <span className="chip bg-slate-100 text-slate-600">{meta?.total ?? comments.length}</span>
        </h2>
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
          {SORTS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSort(option.value)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                sort === option.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      {flash ? (
        <Alert tone={flash.tone} className="mb-4" onDismiss={() => setFlash(null)}>
          {flash.message}
        </Alert>
      ) : null}

      {/* Composer */}
      {isAuthenticated ? (
        <form onSubmit={handleSubmit} className="card mb-6 p-4">
          <div className="flex gap-3">
            <Avatar name={user.name} src={user.avatarUrl} size="md" />
            <div className="flex-1">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                maxLength={LIMITS.COMMENT_MAX}
                placeholder="Share a workaround, a root cause, or a full solution. Be specific - this thread decides what gets built."
                className="input resize-y"
                aria-label="Your solution"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className={cn('text-xs', text.length > LIMITS.COMMENT_MAX - 200 ? 'text-amber-600' : 'text-slate-400')}>
                  {text.trim().length}/{LIMITS.COMMENT_MAX} characters
                </p>
                <button type="submit" disabled={addComment.loading} className="btn-primary">
                  {addComment.loading ? <Spinner /> : null}
                  {addComment.loading ? 'Posting…' : 'Post solution'}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <Alert tone="info" className="mb-6" title="Join the discussion">
          <a href="/login" className="font-semibold underline">
            Log in
          </a>{' '}
          or{' '}
          <a href="/register" className="font-semibold underline">
            create an account
          </a>{' '}
          to post a solution.
        </Alert>
      )}

      {/* Thread */}
      {comments.length === 0 ? (
        <EmptyState
          icon="🧩"
          title="No solutions yet"
          message="Be the first to post a workaround. The HR VIP reviewer picks the best solution and credits you on the Wall of Fame."
        />
      ) : (
        <ol className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              canMarkBest={canMarkBest}
              isEditing={editingId === comment.id}
              editingText={editingText}
              busy={markBest.loading || updateComment.loading || deleteComment.loading}
              onStartEdit={() => {
                setEditingId(comment.id);
                setEditingText(comment.text);
              }}
              onChangeEdit={setEditingText}
              onCancelEdit={() => setEditingId(null)}
              onSave={() => handleUpdate(comment)}
              onMarkBest={() => handleMarkBest(comment)}
              onDelete={() => handleDelete(comment)}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * A single solution in the thread. Purely presentational so it can be rendered
 * (and asserted on) in isolation from the fetching container above.
 */
export function CommentItem({
  comment,
  currentUserId,
  canMarkBest = false,
  isEditing = false,
  editingText = '',
  busy = false,
  onStartEdit,
  onChangeEdit,
  onCancelEdit,
  onSave,
  onMarkBest,
  onDelete,
}) {
  const author = comment.userId || {};
  const isOwn = String(author.id ?? author._id) === String(currentUserId);
  const canModerate = isOwn || canMarkBest;

  return (
    <li
      className={cn(
        'card p-5 transition-colors',
        comment.isBestSolution && 'border-emerald-300 bg-emerald-50/40 ring-1 ring-emerald-200'
      )}
    >
      {comment.isBestSolution ? (
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-700">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px] text-white">
            ✓
          </span>
          Best solution
          {comment.bestMarkedAt ? (
            <span className="font-medium normal-case tracking-normal text-emerald-600/80">
              · crowned {timeAgo(comment.bestMarkedAt)}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex gap-3">
        <Avatar name={author.name || 'Unknown'} src={author.avatarUrl} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <UserLink user={author} className="text-sm font-semibold text-slate-900">
              {author.name || 'Unknown'}
            </UserLink>
            <RoleBadge role={author.role} />
            {author.jobTitle ? <span className="text-[11px] text-slate-400">{author.jobTitle}</span> : null}
            <span className="text-[11px] text-slate-400" title={formatDateTime(comment.createdAt)}>
              {timeAgo(comment.createdAt)}
            </span>
          </div>

          {isEditing ? (
            <div className="mt-2">
              <textarea value={editingText} onChange={(e) => onChangeEdit(e.target.value)} rows={3} className="input resize-y" />
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={onSave} disabled={busy} className="btn-primary px-3 py-1.5 text-xs">
                  Save
                </button>
                <button type="button" onClick={onCancelEdit} className="btn-ghost px-3 py-1.5 text-xs">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{comment.text}</p>
          )}

          {canModerate && !isEditing ? (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              {canMarkBest ? (
                <button
                  type="button"
                  onClick={onMarkBest}
                  disabled={busy}
                  className={cn(
                    'chip px-3 py-1.5 font-semibold ring-1 ring-inset transition',
                    comment.isBestSolution
                      ? 'bg-emerald-500 text-white ring-emerald-500'
                      : 'bg-white text-emerald-700 ring-emerald-200 hover:bg-emerald-50'
                  )}
                >
                  {comment.isBestSolution ? '★ Best solution — unmark' : '★ Mark best solution'}
                </button>
              ) : null}
              {isOwn ? (
                <>
                  <button
                    type="button"
                    onClick={onStartEdit}
                    className="chip bg-white px-3 py-1.5 text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={onDelete}
                    disabled={busy}
                    className="chip bg-white px-3 py-1.5 text-rose-600 ring-1 ring-inset ring-rose-200 hover:bg-rose-50"
                  >
                    Delete
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/** Local sort mirroring the API ordering. */
function sortComments(mode) {
  return (a, b) => {
    if (a.isBestSolution !== b.isBestSolution) return a.isBestSolution ? -1 : 1;
    const diff = new Date(a.createdAt) - new Date(b.createdAt);
    return mode === 'newest' ? -diff : diff;
  };
}
