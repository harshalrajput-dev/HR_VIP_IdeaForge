import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import Avatar from '../components/Avatar';
import ProjectCredits from '../components/ProjectCredits';
import { Alert, EmptyState, ErrorState, SkeletonList, Spinner } from '../components/Feedback';
import Pagination from '../components/Pagination';
import { CategoryChip, RoleBadge, StatusBadge } from '../components/StatusBadge';
import UserLink from '../components/UserLink';
import api from '../services/api';
import { useApi, useMutation } from '../hooks/useApi';
import { useAdminOptions } from '../hooks/useAdminOptions';
import { useAuth } from '../context/AuthContext';
import { IDEA_STATUS } from '../utils/constants';
import { cn, formatDate, formatNumber, timeAgo, toQuery } from '../utils/format';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'review', label: 'Review queue' },
  { key: 'publish', label: 'Publish project' },
  { key: 'projects', label: 'Published projects' },
  { key: 'people', label: 'People' },
];

const DECISIONS = [
  { key: 'send-to-review', label: 'Start review', tone: 'btn-dark', status: IDEA_STATUS.UNDER_REVIEW },
  { key: 'approve', label: 'Approve', tone: 'btn-primary', status: IDEA_STATUS.APPROVED },
];

/** HR VIP employee control panel: review, approve, publish and manage people. */
export default function AdminDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');
  const [flash, setFlash] = useState(null);

  // Category/status/role lists come from the API so the panel can never drift
  // from the server enums.
  const { options, roleLabel } = useAdminOptions();

  return (
    <div className="container-app py-8">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-forge-400" />
            HR VIP employee panel
          </span>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Review &amp; ship</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Signed in as <span className="font-semibold text-slate-700">{user?.name}</span> ({user?.role}). Every
            decision you make is written to the idea&apos;s audit trail.
          </p>
        </div>
        <Link to="/" className="btn-ghost text-xs">
          ← Public feed
        </Link>
      </div>

      {flash ? (
        <Alert tone={flash.tone} className="mb-6" onDismiss={() => setFlash(null)}>
          {flash.message}
        </Alert>
      ) : null}

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-semibold transition',
              tab === item.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? <Overview onNavigate={setTab} options={options} /> : null}
      {tab === 'review' ? <ReviewQueue flash={flash} setFlash={setFlash} options={options} /> : null}
      {tab === 'publish' ? <PublishProject flash={flash} setFlash={setFlash} options={options} /> : null}
      {tab === 'projects' ? <ProjectsManager flash={flash} setFlash={setFlash} options={options} /> : null}
      {tab === 'people' ? <People flash={flash} setFlash={setFlash} options={options} roleLabel={roleLabel} /> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Overview                                                                   */
/* -------------------------------------------------------------------------- */
function Overview({ onNavigate, options }) {
  const { data, loading, error, refetch } = useApi(() => api.get('/admin/dashboard'));

  if (loading) return <SkeletonList count={3} />;
  if (error) return <ErrorState error={error} onRetry={refetch} title="Could not load the dashboard" />;

  const cards = [
    { label: 'Needs attention', value: data.totals.needsReview, tone: 'text-amber-600', hint: 'Submitted + in discussion' },
    { label: 'Awaiting approval', value: data.totals.awaitingApproval, tone: 'text-sky-600', hint: 'Under HR VIP review' },
    { label: 'Ready to ship', value: data.totals.readyToShip, tone: 'text-emerald-600', hint: 'Approved, not yet published' },
    { label: 'Published projects', value: data.totals.projects, tone: 'text-forge-600', hint: 'On the Wall of Fame' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => onNavigate(card.label === 'Ready to ship' ? 'publish' : 'review')}
            className="card p-5 text-left transition hover:-translate-y-0.5 hover:border-forge-200 hover:shadow-glow"
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{card.label}</p>
            <p className={cn('mt-2 text-3xl font-black', card.tone)}>{formatNumber(card.value)}</p>
            <p className="mt-1 text-xs text-slate-400">{card.hint}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Lifecycle funnel */}
        <section className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Lifecycle distribution</h2>
          <ul className="mt-4 space-y-3">
            {options.statuses.map((status) => {
              const count = data.counts[status] ?? 0;
              const pct = data.totals.ideas ? Math.round((count / data.totals.ideas) * 100) : 0;
              return (
                <li key={status}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{status}</span>
                    <span className="text-xs text-slate-500">
                      {formatNumber(count)} · {pct}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        status === IDEA_STATUS.COMPLETED
                          ? 'bg-forge-500'
                          : status === IDEA_STATUS.APPROVED
                            ? 'bg-emerald-500'
                            : status === IDEA_STATUS.UNDER_REVIEW
                              ? 'bg-amber-500'
                              : status === IDEA_STATUS.IN_DISCUSSION
                                ? 'bg-sky-500'
                                : 'bg-slate-400'
                      )}
                      style={{ width: `${Math.max(pct, count ? 4 : 0)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 text-center">
            {[
              { label: 'Ideas', value: data.totals.ideas },
              { label: 'Comments', value: data.totals.comments },
              { label: 'Members', value: data.totals.users },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-xl font-bold text-slate-900">{formatNumber(stat.value)}</p>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Top contributors */}
        <section className="card p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Top contributors</h2>
          {data.topContributors.length ? (
            <ol className="mt-4 space-y-3">
              {data.topContributors.map((person, index) => (
                <li key={person.id} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-forge-500 text-[11px] font-bold text-white">
                    {index + 1}
                  </span>
                  <Avatar name={person.name} src={person.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <UserLink user={person} className="truncate text-sm font-semibold text-slate-800" />
                    <p className="truncate text-[11px] text-slate-400">{person.department}</p>
                  </div>
                  <span className="chip bg-slate-100 font-semibold text-slate-700">{formatNumber(person.points)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No contributors yet.</p>
          )}
        </section>
      </div>

      {/* Recent activity */}
      <section className="card p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Recently touched</h2>
        <ul className="mt-4 divide-y divide-slate-100">
          {data.recentIdeas.map((idea) => (
            <li key={idea.id} className="flex flex-wrap items-center gap-3 py-3">
              <StatusBadge status={idea.status} size="sm" />
              <Link to={`/ideas/${idea.id}`} className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 hover:text-forge-600">
                {idea.title}
              </Link>
              <span className="text-xs text-slate-400">
                <UserLink user={idea.author} /> · {timeAgo(idea.updatedAt)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Review queue                                                               */
/* -------------------------------------------------------------------------- */
function ReviewQueue({ flash, setFlash, options }) {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [noteDrafts, setNoteDrafts] = useState({});
  const [openNotes, setOpenNotes] = useState({});
  const [busyId, setBusyId] = useState(null);

  const query = useMemo(() => toQuery({ status, search, page, limit: 10 }), [status, search, page]);

  const { data: ideas = [], meta, loading, error, refetch } = useApi(
    () => api.get(`/admin/ideas${query}`),
    [query],
    { initialData: [] }
  );

  const review = useMutation(({ ideaId, decision, note }) =>
    api.patch(`/admin/ideas/${ideaId}/review`, { decision, note })
  );

  const decide = async (idea, decision) => {
    setBusyId(idea.id);
    setFlash(null);
    try {
      const res = await review.mutate({ ideaId: idea.id, decision, note: noteDrafts[idea.id]?.trim() || undefined });
      setFlash({ tone: 'success', message: res.message });
      setNoteDrafts((prev) => ({ ...prev, [idea.id]: '' }));
      setOpenNotes((prev) => ({ ...prev, [idea.id]: false }));
      refetch();
    } catch (err) {
      setFlash({ tone: 'error', message: err.message, details: err.details });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search the review queue…"
          className="input flex-1"
          aria-label="Search ideas"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="input w-auto cursor-pointer"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {options.statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={refetch} title="Could not load the review queue" />
      ) : loading ? (
        <SkeletonList count={4} />
      ) : ideas.length === 0 ? (
        <EmptyState icon="✅" title="Queue is clear" message="No ideas match this filter right now." />
      ) : (
        <ul className="space-y-4">
          {ideas.map((idea) => {
            const hasBest = Boolean(idea.bestSolution);
            return (
              <li key={idea.id} className="card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={idea.status} size="sm" />
                  <CategoryChip category={idea.category} />
                  <span className="chip bg-slate-50 text-slate-500">▲ {idea.upvoteCount}</span>
                  <span className="chip bg-slate-50 text-slate-500">💬 {idea.commentCount}</span>
                  {hasBest ? <span className="chip bg-emerald-50 font-semibold text-emerald-700">★ best solution picked</span> : null}
                </div>

                <Link to={`/ideas/${idea.id}`} className="mt-2 block text-base font-semibold text-slate-900 hover:text-forge-600">
                  {idea.title}
                </Link>
                <p className="mt-1 text-xs text-slate-500">
                  <UserLink user={idea.author} className="font-semibold" /> · {idea.author?.department} ·{' '}
                  {timeAgo(idea.createdAt)}
                </p>
                <p className="mt-2 line-clamp-2-safe text-sm text-slate-600">{idea.description}</p>

                {idea.reviewNotes ? (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">📝 {idea.reviewNotes}</p>
                ) : null}

                {/* Actions */}
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                  {DECISIONS.map((decision) => (
                    <button
                      key={decision.key}
                      type="button"
                      onClick={() => decide(idea, decision.key)}
                      disabled={busyId === idea.id || idea.status === decision.status}
                      className={cn('btn px-3.5 py-2 text-xs', decision.tone)}
                    >
                      {busyId === idea.id && review.loading ? <Spinner /> : null}
                      {decision.label}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setOpenNotes((prev) => ({ ...prev, [idea.id]: !prev[idea.id] }))}
                    className="btn-ghost px-3.5 py-2 text-xs"
                  >
                    {openNotes[idea.id] ? 'Hide' : 'Request changes'}…
                  </button>

                  <Link to={`/ideas/${idea.id}`} className="btn-ghost ml-auto px-3.5 py-2 text-xs">
                    Open thread →
                  </Link>
                </div>

                {openNotes[idea.id] ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <label className="label text-amber-900" htmlFor={`note-${idea.id}`}>
                      What needs to change? (required)
                    </label>
                    <textarea
                      id={`note-${idea.id}`}
                      rows={2}
                      value={noteDrafts[idea.id] || ''}
                      onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [idea.id]: e.target.value }))}
                      placeholder="e.g. Add reproduction steps and the affected payroll run date."
                      className="input resize-y"
                    />
                    <button
                      type="button"
                      onClick={() => decide(idea, 'request-changes')}
                      disabled={busyId === idea.id || !(noteDrafts[idea.id] || '').trim()}
                      className="btn mt-2 border border-amber-300 bg-amber-200 px-3.5 py-2 text-xs text-amber-900 hover:bg-amber-300"
                    >
                      Send back with feedback
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={!meta.hasPrevPage} className="btn-ghost text-xs">
            ← Previous
          </button>
          <span className="text-xs text-slate-500">
            Page {meta.page} of {meta.totalPages}
          </span>
          <button type="button" onClick={() => setPage((p) => p + 1)} disabled={!meta.hasNextPage} className="btn-ghost text-xs">
            Next →
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Publish project                                                            */
/* -------------------------------------------------------------------------- */
function PublishProject({ flash, setFlash, options }) {
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState({
    projectLink: '',
    developedBy: options.defaultDevelopedBy,
    techStack: '',
    impact: '',
    summary: '',
    isFeatured: false,
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [published, setPublished] = useState(null);

  const { data: approved = [], loading, refetch } = useApi(
    () => api.get('/admin/ideas', { params: { status: IDEA_STATUS.APPROVED, limit: 50 } }),
    [],
    { initialData: [] }
  );

  const publish = useMutation((payload) => api.post('/admin/projects', payload));

  const update = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handlePublish = async (event) => {
    event.preventDefault();
    setFlash(null);
    if (!selectedId) {
      setFieldErrors({ ideaId: 'Select an approved idea to publish' });
      return;
    }

    try {
      const res = await publish.mutate({
        ideaId: selectedId,
        projectLink: form.projectLink.trim(),
        developedBy: form.developedBy.trim() || options.defaultDevelopedBy,
        techStack: form.techStack
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        impact: form.impact.trim(),
        summary: form.summary.trim(),
        isFeatured: form.isFeatured,
      });
      setPublished(res.data);
      setFlash({ tone: 'success', message: res.message });
      setForm({ projectLink: '', developedBy: options.defaultDevelopedBy, techStack: '', impact: '', summary: '', isFeatured: false });
      setSelectedId('');
      refetch();
    } catch (err) {
      setErrorState(err);
    }
  };

  const setErrorState = (err) => {
    setFlash({ tone: 'error', message: err.message, details: err.details });
    setFieldErrors(err.fieldErrors || {});
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <div className="card p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Publish a completed project</h2>
          <p className="mt-2 text-sm text-slate-500">
            Publishing marks the idea <strong>Completed</strong> and creates its Wall of Fame entry. Contributors are
            derived automatically from the crowned best solution.
          </p>

          <form onSubmit={handlePublish} className="mt-5 space-y-4">
            <div>
              <label className="label" htmlFor="ideaId">
                Approved idea
              </label>
              <select
                id="ideaId"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="input cursor-pointer"
                aria-invalid={Boolean(fieldErrors.ideaId)}
              >
                <option value="">{loading ? 'Loading…' : 'Select an approved idea'}</option>
                {approved.map((idea) => (
                  <option key={idea.id} value={idea.id}>
                    {idea.title}
                  </option>
                ))}
              </select>
              {fieldErrors.ideaId ? <p className="hint text-rose-600">{fieldErrors.ideaId}</p> : null}
              {!loading && approved.length === 0 ? (
                <p className="hint">No approved ideas are waiting. Approve something in the review queue first.</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="developedBy">
                  Developed by
                </label>
                <input id="developedBy" value={form.developedBy} onChange={update('developedBy')} className="input" />
                <p className="hint">Defaults to {options.defaultDevelopedBy}.</p>
              </div>
              <div>
                <label className="label" htmlFor="projectLink">
                  Project link
                </label>
                <input
                  id="projectLink"
                  value={form.projectLink}
                  onChange={update('projectLink')}
                  className="input"
                  placeholder="https://intranet.company/…"
                  aria-invalid={Boolean(fieldErrors.projectLink)}
                />
                {fieldErrors.projectLink ? <p className="hint text-rose-600">{fieldErrors.projectLink}</p> : null}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="techStack">
                Tech stack <span className="font-normal text-slate-400">(comma separated)</span>
              </label>
              <input
                id="techStack"
                value={form.techStack}
                onChange={update('techStack')}
                className="input"
                placeholder="React, Node.js, PostgreSQL"
              />
            </div>

            <div>
              <label className="label" htmlFor="summary">
                Project summary
              </label>
              <textarea
                id="summary"
                rows={2}
                value={form.summary}
                onChange={update('summary')}
                className="input resize-y"
                placeholder="One or two sentences on what was built."
              />
            </div>

            <div>
              <label className="label" htmlFor="impact">
                Measured impact
              </label>
              <input
                id="impact"
                value={form.impact}
                onChange={update('impact')}
                className="input"
                placeholder="Turnaround fell from 21 days to 2 hours for 58% of claims."
              />
            </div>

            <label className="flex items-center gap-2.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={update('isFeatured')}
                className="h-4 w-4 rounded border-slate-300 text-forge-500 focus:ring-forge-500"
              />
              Feature on the Wall of Fame
            </label>

            <button type="submit" disabled={publish.loading} className="btn-primary w-full py-3">
              {publish.loading ? <Spinner /> : null}
              {publish.loading ? 'Publishing…' : 'Publish to the Wall of Fame'}
            </button>
          </form>
        </div>
      </div>

      <div className="lg:col-span-2">
        {published ? (
          <div className="animate-fade-in-up">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-emerald-700">✓ Published just now</p>
            <ProjectCredits credits={published} />
          </div>
        ) : (
          <div className="card p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Credit rules</h3>
            <ul className="mt-3 space-y-2.5 text-sm text-slate-600">
              {[
                'Original Idea By — taken from the idea author, permanently.',
                'Key Contributors — everyone who posted a crowned best solution.',
                'Developed By — the internal team that shipped it (HR VIP Team).',
                'Only Approved ideas can be published; a best solution must exist.',
              ].map((rule) => (
                <li key={rule} className="flex gap-2">
                  <span className="text-forge-500" aria-hidden="true">
                    →
                  </span>
                  {rule}
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-400">
              Last published: {formatDate(new Date())}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Published projects                                                          */
/* -------------------------------------------------------------------------- */

/** Metrics are a Map<Number> on the model; the editor works on a flat row list. */
const toMetricRows = (metrics) =>
  Object.entries(metrics || {}).map(([key, value]) => ({ key, value: String(value) }));

const ProjectEditor = ({ project, options, onCancel, onSaved }) => {
  const [draft, setDraft] = useState({
    summary: project.summary || '',
    developedBy: project.developedBy || options.defaultDevelopedBy,
    projectLink: project.projectLink || '',
    techStack: Array.isArray(project.techStack) ? project.techStack.join(', ') : '',
    impact: project.impact || '',
    isFeatured: Boolean(project.isFeatured),
  });
  const [metricRows, setMetricRows] = useState(() => toMetricRows(project.metrics));
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);

  const save = useMutation((payload) => api.patch(`/admin/projects/${project.id}`, payload));

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setDraft((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const setRow = (index, key, value) =>
    setMetricRows((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    const errors = {};
    const developedBy = draft.developedBy.trim();
    if (developedBy.length < 2 || developedBy.length > 120) {
      errors.developedBy = 'Must be 2-120 characters';
    }
    const link = draft.projectLink.trim();
    if (link && !/^https?:\/\/.+/i.test(link)) errors.projectLink = 'Must be a valid http(s) URL';
    if (draft.summary.trim().length > 600) errors.summary = 'Keep this under 600 characters';
    if (draft.impact.trim().length > 400) errors.impact = 'Keep this under 400 characters';
    const tech = draft.techStack
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (tech.length > 12) errors.techStack = 'At most 12 technologies';
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    // Only send metrics with a usable key + numeric value; blanks are dropped.
    const metrics = {};
    metricRows.forEach((row) => {
      const key = row.key.trim();
      const num = Number(row.value);
      if (key && row.value.trim() !== '' && Number.isFinite(num)) metrics[key] = num;
    });

    try {
      const res = await save.mutate({
        summary: draft.summary.trim(),
        developedBy,
        projectLink: link,
        techStack: tech,
        impact: draft.impact.trim(),
        isFeatured: draft.isFeatured,
        metrics,
      });
      onSaved(res);
    } catch (err) {
      setError(err);
      setFieldErrors(err.fieldErrors || {});
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4" noValidate>
      {error ? (
        <Alert tone="error" onDismiss={() => setError(null)}>
          {error.message}
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`summary-${project.id}`}>
            Summary
          </label>
          <textarea
            id={`summary-${project.id}`}
            rows={3}
            value={draft.summary}
            onChange={set('summary')}
            className="input resize-y"
            aria-invalid={Boolean(fieldErrors.summary)}
          />
          {fieldErrors.summary ? <p className="hint text-rose-600">{fieldErrors.summary}</p> : null}
        </div>
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor={`developedBy-${project.id}`}>
              Developed by
            </label>
            <input
              id={`developedBy-${project.id}`}
              value={draft.developedBy}
              onChange={set('developedBy')}
              className="input"
              aria-invalid={Boolean(fieldErrors.developedBy)}
            />
            {fieldErrors.developedBy ? <p className="hint text-rose-600">{fieldErrors.developedBy}</p> : null}
          </div>
          <div>
            <label className="label" htmlFor={`projectLink-${project.id}`}>
              Project link
            </label>
            <input
              id={`projectLink-${project.id}`}
              value={draft.projectLink}
              onChange={set('projectLink')}
              className="input"
              placeholder="https://intranet.company/…"
              aria-invalid={Boolean(fieldErrors.projectLink)}
            />
            {fieldErrors.projectLink ? <p className="hint text-rose-600">{fieldErrors.projectLink}</p> : null}
          </div>
        </div>
      </div>

      <div>
        <label className="label" htmlFor={`techStack-${project.id}`}>
          Tech stack <span className="font-normal text-slate-400">(comma separated)</span>
        </label>
        <input
          id={`techStack-${project.id}`}
          value={draft.techStack}
          onChange={set('techStack')}
          className="input"
          placeholder="React, Node.js, PostgreSQL"
          aria-invalid={Boolean(fieldErrors.techStack)}
        />
        {fieldErrors.techStack ? <p className="hint text-rose-600">{fieldErrors.techStack}</p> : null}
      </div>

      <div>
        <label className="label" htmlFor={`impact-${project.id}`}>
          Measured impact
        </label>
        <input
          id={`impact-${project.id}`}
          value={draft.impact}
          onChange={set('impact')}
          className="input"
          aria-invalid={Boolean(fieldErrors.impact)}
        />
        {fieldErrors.impact ? <p className="hint text-rose-600">{fieldErrors.impact}</p> : null}
      </div>

      {/* Metrics */}
      <div>
        <span className="label">Impact metrics</span>
        {metricRows.length ? (
          <ul className="space-y-2">
            {metricRows.map((row, index) => (
              <li key={index} className="flex flex-wrap items-center gap-2">
                <input
                  value={row.key}
                  onChange={(e) => setRow(index, 'key', e.target.value)}
                  className="input flex-1"
                  placeholder="ticketsReducedWeekly"
                  aria-label="Metric name"
                />
                <input
                  value={row.value}
                  onChange={(e) => setRow(index, 'value', e.target.value)}
                  className="input w-28"
                  inputMode="numeric"
                  placeholder="13"
                  aria-label="Metric value"
                />
                <button
                  type="button"
                  onClick={() => setMetricRows((prev) => prev.filter((_, i) => i !== index))}
                  className="btn-ghost px-3 py-2 text-xs"
                  aria-label={`Remove metric ${row.key || index + 1}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">No metrics recorded.</p>
        )}
        <button
          type="button"
          onClick={() => setMetricRows((prev) => [...prev, { key: '', value: '' }])}
          className="btn-ghost mt-2 px-3 py-1.5 text-xs"
        >
          + Add metric
        </button>
      </div>

      <label className="flex items-center gap-2.5 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={draft.isFeatured}
          onChange={set('isFeatured')}
          className="h-4 w-4 rounded border-slate-300 text-forge-500 focus:ring-forge-500"
        />
        Feature on the Wall of Fame
      </label>

      <div className="flex gap-2 border-t border-slate-200 pt-4">
        <button type="submit" disabled={save.loading} className="btn-primary px-4 py-2 text-xs">
          {save.loading ? <Spinner /> : null}
          {save.loading ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" onClick={onCancel} disabled={save.loading} className="btn-ghost px-4 py-2 text-xs">
          Cancel
        </button>
      </div>
    </form>
  );
};

/** Manage everything already on the Wall of Fame — GET/PATCH /api/admin/projects. */
function ProjectsManager({ flash, setFlash, options }) {
  const [page, setPage] = useState(1);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const query = useMemo(() => toQuery({ page, limit: 10, featured: featuredOnly ? 'true' : '' }), [page, featuredOnly]);

  const { data: projects = [], meta, loading, error, refetch } = useApi(
    () => api.get(`/admin/projects${query}`),
    [query],
    { initialData: [] }
  );

  const handleSaved = (res) => {
    setEditingId(null);
    setFlash({ tone: 'success', message: res.message });
    refetch();
  };

  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <p className="text-sm text-slate-500">
          {meta?.total ? `${formatNumber(meta.total)} project${meta.total === 1 ? '' : 's'} published` : 'Published projects'}
        </p>
        <button
          type="button"
          onClick={() => {
            setFeaturedOnly((v) => !v);
            setPage(1);
          }}
          className={cn(
            'btn ml-auto px-3.5 py-2 text-xs',
            featuredOnly ? 'bg-forge-500 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          )}
        >
          ★ Featured only
        </button>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={refetch} title="Could not load published projects" />
      ) : loading ? (
        <SkeletonList count={2} />
      ) : projects.length === 0 ? (
        <EmptyState
          icon="🏆"
          title="Nothing published yet"
          message="Approve an idea in the review queue, then publish it to create a Wall of Fame entry."
        />
      ) : (
        <ul className="space-y-4">
          {projects.map((project) => {
            const ideaId = project.idea?.id || project.idea?._id;
            const editing = editingId === project.id;
            return (
              <li key={project.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {project.idea?.status ? <StatusBadge status={project.idea.status} size="sm" /> : null}
                      {project.isFeatured ? (
                        <span className="chip bg-forge-500 font-semibold text-white">★ Featured</span>
                      ) : null}
                      <span className="chip bg-slate-50 text-slate-500">
                        {formatDate(project.publishedAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-base font-semibold text-slate-900">{project.title}</p>
                    {project.summary ? (
                      <p className="mt-1 line-clamp-2-safe text-sm text-slate-600">{project.summary}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-slate-500">
                      Original idea by <UserLink user={project.originalIdeaBy} className="font-semibold" /> ·{' '}
                      {project.contributors?.length || 0} contributor
                      {project.contributors?.length === 1 ? '' : 's'} · developed by {project.developedBy}
                    </p>
                    {project.idea?.title ? (
                      <Link
                        to={ideaId ? `/ideas/${ideaId}` : '/'}
                        className="mt-1 inline-block text-xs font-semibold text-forge-600 hover:underline"
                      >
                        {project.idea.title} →
                      </Link>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditingId(editing ? null : project.id)}
                    className="btn-ghost shrink-0 px-3.5 py-2 text-xs"
                  >
                    {editing ? 'Close' : 'Edit'}
                  </button>
                </div>

                {editing ? (
                  <ProjectEditor
                    project={project}
                    options={options}
                    onCancel={() => setEditingId(null)}
                    onSaved={handleSaved}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <Pagination meta={meta} onPageChange={setPage} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* People                                                                     */
/* -------------------------------------------------------------------------- */
function People({ flash, setFlash, options, roleLabel }) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);

  const query = useMemo(() => toQuery({ search, role: roleFilter, page, limit: 15 }), [search, roleFilter, page]);

  const { data: users = [], meta, loading, error, refetch } = useApi(
    () => api.get(`/admin/users${query}`),
    [query],
    { initialData: [] }
  );

  const updateRole = useMutation(({ id, role }) => api.patch(`/admin/users/${id}/role`, { role }));

  const handleRole = async (person, role) => {
    setFlash(null);
    try {
      await updateRole.mutate({ id: person.id, role });
      setFlash({ tone: 'success', message: `${person.name} is now ${roleLabel(role).toLowerCase()}.` });
      refetch();
    } catch (err) {
      setFlash({ tone: 'error', message: err.message });
    }
  };

  return (
    <div className="space-y-5">
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by name or email…"
          className="input flex-1"
          aria-label="Search people"
        />
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="input w-auto cursor-pointer"
          aria-label="Filter by role"
        >
          <option value="">All roles</option>
          {options.roles.map((role) => (
            <option key={role} value={role}>
              {roleLabel(role)}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={refetch} title="Could not load people" />
      ) : loading ? (
        <SkeletonList count={4} />
      ) : users.length === 0 ? (
        <EmptyState icon="👥" title="No people match" message="Try a different search or role filter." />
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {users.map((person) => (
              <li key={person.id} className="flex flex-wrap items-center gap-3 p-4">
                <Avatar name={person.name} src={person.avatarUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <UserLink user={person} className="truncate text-sm font-semibold text-slate-900" />
                    <RoleBadge role={person.role} />
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    {person.email} · {person.department} · {formatNumber(person.points)} pts
                  </p>
                </div>
                <select
                  value={person.role}
                  onChange={(e) => handleRole(person, e.target.value)}
                  disabled={updateRole.loading}
                  className="input w-auto cursor-pointer py-1.5 text-xs"
                  aria-label={`Change role for ${person.name}`}
                >
                  {options.roles.map((role) => (
                    <option key={role} value={role}>
                      {roleLabel(role)}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}

      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={!meta.hasPrevPage} className="btn-ghost text-xs">
            ← Previous
          </button>
          <span className="text-xs text-slate-500">
            Page {meta.page} of {meta.totalPages}
          </span>
          <button type="button" onClick={() => setPage((p) => p + 1)} disabled={!meta.hasNextPage} className="btn-ghost text-xs">
            Next →
          </button>
        </div>
      ) : null}
    </div>
  );
}
