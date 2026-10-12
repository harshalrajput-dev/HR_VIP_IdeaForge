import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import Avatar from '../components/Avatar';
import DiscussionThread from '../components/DiscussionThread';
import ProjectCredits from '../components/ProjectCredits';
import { Alert, ErrorState, Spinner } from '../components/Feedback';
import { CategoryChip, PriorityBadge, RoleBadge, StatusBadge } from '../components/StatusBadge';
import UserLink from '../components/UserLink';
import api from '../services/api';
import { useApi, useMutation } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { IDEA_STATUS, IDEA_STATUSES, LIFECYCLE } from '../utils/constants';
import { cn, formatDateTime, formatNumber, timeAgo } from '../utils/format';

/** Full idea view: description, lifecycle rail, discussion and credits. */
export default function IdeaDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin } = useAuth();

  const [flash, setFlash] = useState(null);
  const [upvoting, setUpvoting] = useState(false);
  const [statusDraft, setStatusDraft] = useState('');
  const [statusNote, setStatusNote] = useState('');

  const { data: idea, loading, error, refetch, setData } = useApi(() => api.get(`/ideas/${id}`), [id]);

  const upvote = useMutation((ideaId) => api.post(`/ideas/${ideaId}/upvote`));
  const updateStatus = useMutation(({ ideaId, status, note }) => api.patch(`/ideas/${ideaId}/status`, { status, note }));
  const deleteIdea = useMutation((ideaId) => api.delete(`/ideas/${ideaId}`));

  const handleUpvote = useCallback(async () => {
    if (!isAuthenticated) {
      setFlash({ tone: 'warning', message: 'Log in to upvote this idea.' });
      return;
    }
    setUpvoting(true);
    try {
      const res = await upvote.mutate(id);
      setData((prev) => ({ ...prev, upvoteCount: res.data.upvoteCount, upvotedByMe: res.data.upvotedByMe }));
    } catch (err) {
      setFlash({ tone: 'error', message: err.message });
    } finally {
      setUpvoting(false);
    }
  }, [id, isAuthenticated, upvote, setData]);

  const handleStatusChange = async (event) => {
    event.preventDefault();
    const status = statusDraft || idea.status;
    if (status === idea.status) return;

    try {
      const res = await updateStatus.mutate({ ideaId: id, status, note: statusNote.trim() || undefined });
      setData((prev) => ({ ...prev, status: res.data.status, reviewNotes: res.data.reviewNotes ?? prev.reviewNotes }));
      setStatusDraft('');
      setStatusNote('');
      setFlash({ tone: 'success', message: res.message });
    } catch (err) {
      setFlash({ tone: 'error', message: err.message, details: err.details });
    }
  };

  const handleDelete = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Delete this idea and its entire discussion? This cannot be undone.')) return;
    try {
      await deleteIdea.mutate(id);
      navigate('/');
    } catch (err) {
      setFlash({ tone: 'error', message: err.message });
    }
  };

  if (loading) {
    return (
      <div className="container-app py-10">
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="skeleton h-8 w-3/4" />
          <div className="skeleton h-4 w-1/3" />
          <div className="skeleton h-40 w-full rounded-2xl" />
          <div className="skeleton h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-app py-16">
        <div className="mx-auto max-w-2xl">
          <ErrorState error={error} onRetry={refetch} title="Could not load this idea" />
          <div className="mt-6 text-center">
            <Link to="/" className="text-sm font-semibold text-forge-600 hover:underline">
              ← Back to the feed
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const author = idea.author || {};
  const isOwnIdea = String(author.id) === String(user?.id);
  const upvotes = idea.upvoteCount ?? 0;
  const stageIndex = LIFECYCLE.indexOf(idea.status);
  const canMarkBest = idea.permissions?.canMarkBest ?? false;
  const credits = idea.credits && idea.credits.developedBy ? idea.credits : null;

  return (
    <div className="container-app py-8">
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main column */}
        <div className="lg:col-span-2">
          <Link to="/" className="text-sm font-medium text-slate-500 hover:text-forge-600">
            ← Back to the feed
          </Link>

          {flash ? (
            <Alert tone={flash.tone} className="mt-4" onDismiss={() => setFlash(null)}>
              {flash.message}
            </Alert>
          ) : null}

          <article className="card mt-4 p-6 sm:p-8">
            {/* Meta */}
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={idea.status} />
              <CategoryChip category={idea.category} />
              {idea.priority ? <PriorityBadge priority={idea.priority} /> : null}
              {idea.isFeatured ? <span className="chip bg-forge-50 font-semibold text-forge-700">★ Featured</span> : null}
            </div>

            <h1 className="mt-4 text-2xl font-black leading-tight tracking-tight text-slate-900 sm:text-3xl">
              {idea.title}
            </h1>

            {/* Author */}
            <div className="mt-5 flex flex-wrap items-center gap-3 border-b border-slate-100 pb-5">
              <Avatar name={author.name || 'Unknown'} src={author.avatarUrl} size="md" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <UserLink user={author} className="text-sm font-semibold text-slate-900">
                    {author.name || 'Unknown'}
                  </UserLink>
                  <RoleBadge role={author.role} />
                </div>
                <p className="text-xs text-slate-500">
                  {[author.jobTitle, author.department].filter(Boolean).join(' · ')}
                  {author.jobTitle || author.department ? ' · ' : ''}
                  {timeAgo(idea.createdAt)}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleUpvote}
                  disabled={upvoting || isOwnIdea}
                  aria-pressed={Boolean(idea.upvotedByMe)}
                  className={cn(
                    'btn px-4 py-2.5 text-sm',
                    idea.upvotedByMe
                      ? 'bg-forge-500 text-white hover:bg-forge-600'
                      : 'border border-slate-200 bg-white text-slate-700 hover:border-forge-300 hover:bg-forge-50'
                  )}
                  title={isOwnIdea ? 'You cannot upvote your own idea' : idea.upvotedByMe ? 'Remove upvote' : 'Upvote'}
                >
                  {upvoting ? <Spinner /> : <span aria-hidden="true">▲</span>}
                  {formatNumber(upvotes)} {upvotes === 1 ? 'upvote' : 'upvotes'}
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="mt-6 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700">{idea.description}</div>

            {Array.isArray(idea.tags) && idea.tags.length ? (
              <div className="mt-6 flex flex-wrap gap-1.5">
                {idea.tags.map((tag) => (
                  <Link
                    key={tag}
                    to={`/?search=${encodeURIComponent(tag)}`}
                    className="rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200 transition hover:bg-forge-50 hover:text-forge-700"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            ) : null}

            {/* Reviewer note */}
            {idea.reviewNotes ? (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-700">HR VIP review note</p>
                <p className="mt-1.5 text-sm text-amber-900">{idea.reviewNotes}</p>
                {idea.reviewedBy?.name ? (
                  <p className="mt-1.5 text-xs text-amber-700/80">
                    — {idea.reviewedBy.name}, {formatDateTime(idea.reviewedAt)}
                  </p>
                ) : null}
              </div>
            ) : null}
          </article>

          {/* Credits for completed projects */}
          {credits ? <ProjectCredits credits={credits} idea={idea} className="mt-6" /> : null}

          {/* Discussion */}
          <div className="mt-8">
            <DiscussionThread
              ideaId={id}
              currentUserId={user?.id}
              canMarkBest={canMarkBest}
              onCommentCountChange={(count) => setData((prev) => ({ ...prev, commentCount: count }))}
              onBestSolutionChange={(bestId) => setData((prev) => ({ ...prev, bestSolution: bestId }))}
            />
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Lifecycle rail */}
          <section className="card p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Lifecycle</h2>
            <ol className="mt-4 space-y-0">
              {LIFECYCLE.map((status, index) => {
                const done = index < stageIndex;
                const current = index === stageIndex;
                return (
                  <li key={status} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ring-2',
                          done && 'bg-emerald-500 text-white ring-emerald-500',
                          current && 'bg-forge-500 text-white ring-forge-200',
                          !done && !current && 'bg-white text-slate-400 ring-slate-200'
                        )}
                      >
                        {done ? '✓' : index + 1}
                      </span>
                      {index < LIFECYCLE.length - 1 ? (
                        <span className={cn('my-0.5 w-0.5 flex-1', done ? 'bg-emerald-300' : 'bg-slate-200')} />
                      ) : null}
                    </div>
                    <div className="pb-4">
                      <p className={cn('text-sm font-semibold', current ? 'text-forge-700' : done ? 'text-slate-700' : 'text-slate-400')}>
                        {status}
                      </p>
                      {current ? <p className="text-[11px] text-forge-600">Current stage</p> : null}
                    </div>
                  </li>
                );
              })}
            </ol>

            {idea.completedAt ? (
              <p className="mt-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                Shipped {formatDateTime(idea.completedAt)}
              </p>
            ) : null}
          </section>

          {/* Stats */}
          <section className="card p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">At a glance</h2>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              {[
                { label: 'Upvotes', value: upvotes },
                { label: 'Solutions', value: idea.commentCount ?? 0 },
                { label: 'Contributors', value: idea.contributorCount ?? 0 },
                { label: 'Author points', value: author.points ?? 0 },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-100">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{stat.label}</dt>
                  <dd className="mt-0.5 text-lg font-bold text-slate-900">{formatNumber(stat.value)}</dd>
                </div>
              ))}
            </dl>
            {idea.bestSolution ? (
              <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <span aria-hidden="true">★</span> Best solution identified
              </p>
            ) : null}
          </section>

          {/* HR VIP controls */}
          {isAdmin ? (
            <section className="card border-slate-800 bg-slate-900 p-5 text-white">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-forge-300">
                <span className="h-1.5 w-1.5 rounded-full bg-forge-400" />
                HR VIP controls
              </h2>
              <p className="mt-2 text-xs text-slate-400">
                Only valid lifecycle transitions are accepted. Use the dashboard to approve and publish projects.
              </p>

              <form onSubmit={handleStatusChange} className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-300" htmlFor="status">
                    New status
                  </label>
                  <select
                    id="status"
                    value={statusDraft || idea.status}
                    onChange={(e) => setStatusDraft(e.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-forge-400 focus:outline-none"
                  >
                    {IDEA_STATUSES.map((status) => (
                      <option key={status} value={status} className="text-slate-900">
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-300" htmlFor="note">
                    Note (optional)
                  </label>
                  <textarea
                    id="note"
                    rows={2}
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="Context for the audit trail…"
                    className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-forge-400 focus:outline-none"
                  />
                </div>

                <button type="submit" disabled={updateStatus.loading || statusDraft === ''} className="btn-primary w-full py-2 text-xs">
                  {updateStatus.loading ? <Spinner /> : null}
                  Update status
                </button>
                {statusDraft === '' ? <p className="text-[11px] text-slate-500">Select a status to enable this.</p> : null}
              </form>

              <Link
                to="/admin"
                className="mt-4 block rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-center text-xs font-semibold text-white hover:bg-white/10"
              >
                Open review dashboard →
              </Link>
            </section>
          ) : null}

          {/* Author actions */}
          {(isOwnIdea || isAdmin) && idea.status !== IDEA_STATUS.COMPLETED ? (
            <section className="card p-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Danger zone</h2>
              <p className="mt-2 text-xs text-slate-500">
                Deleting removes the idea, its comments and any published credits.
              </p>
              <button type="button" onClick={handleDelete} disabled={deleteIdea.loading} className="btn-danger mt-3 w-full py-2 text-xs">
                {deleteIdea.loading ? 'Deleting…' : 'Delete idea'}
              </button>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
