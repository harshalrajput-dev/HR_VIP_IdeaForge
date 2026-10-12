import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import IdeaCard from '../components/IdeaCard';
import Pagination from '../components/Pagination';
import SearchSuggestions from '../components/SearchSuggestions';
import { Alert, EmptyState, ErrorState, SkeletonList, Spinner } from '../components/Feedback';
import { StatusBadge } from '../components/StatusBadge';
import api from '../services/api';
import { useApi, useMutation } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { CATEGORIES, IDEA_STATUSES, STATUS_STYLES } from '../utils/constants';
import { cn, formatNumber, toQuery } from '../utils/format';

const SORTS = [
  { value: '-createdAt', label: 'Newest' },
  { value: '-upvoteCount', label: 'Most upvoted' },
  { value: '-commentCount', label: 'Most discussed' },
  { value: 'createdAt', label: 'Oldest' },
];

const STATUS_COUNTS = [
  { status: 'Submitted', hint: 'Awaiting first response' },
  { status: 'In Discussion', hint: 'Solutions being proposed' },
  { status: 'Under HR VIP Review', hint: 'With the review board' },
  { status: 'Approved', hint: 'Green-lit for build' },
  { status: 'Completed', hint: 'Shipped to production' },
];

/** The public idea feed with category, status, search and sort filters. */
export default function Home() {
  const { isAuthenticated, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchDraft, setSearchDraft] = useState(searchParams.get('search') || '');
  const [updatingId, setUpdatingId] = useState(null);
  const [flash, setFlash] = useState(null);

  const filters = useMemo(
    () => ({
      category: searchParams.get('category') || '',
      status: searchParams.get('status') || '',
      sort: searchParams.get('sort') || '-createdAt',
      search: searchParams.get('search') || '',
      mine: searchParams.get('mine') || '',
      page: Number(searchParams.get('page')) || 1,
    }),
    [searchParams]
  );

  const { data: meta } = useApi(() => api.get('/ideas/meta/filters'), [], { initialData: null });

  const { data: ideas = [], meta: pageMeta, loading, error, refetch, setData } = useApi(
    () => api.get(`/ideas${toQuery(filters)}`),
    [searchParams.toString()]
  );

  const upvote = useMutation((id) => api.post(`/ideas/${id}/upvote`));

  const setFilter = useCallback(
    (key, value) => {
      const next = new URLSearchParams(searchParams);
      if (!value || value === '-createdAt' || value === '1') next.delete(key);
      else next.set(key, value);
      if (key !== 'page') next.delete('page'); // any filter change resets pagination
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  // Keep the search box in sync when the URL changes (e.g. back button).
  useEffect(() => {
    setSearchDraft(filters.search);
  }, [filters.search]);

  const handleUpvote = async (idea) => {
    if (!isAuthenticated) {
      setFlash({ tone: 'warning', message: 'Log in to upvote ideas and support your colleagues.' });
      return;
    }
    setUpdatingId(idea.id);
    try {
      const res = await upvote.mutate(idea.id);
      setData((prev) =>
        prev.map((item) =>
          item.id === idea.id
            ? { ...item, upvoteCount: res.data.upvoteCount, upvotedByMe: res.data.upvotedByMe }
            : item
        )
      );
    } catch (err) {
      setFlash({ tone: 'error', message: err.message });
    } finally {
      setUpdatingId(null);
    }
  };

  const activeFilters = [filters.category, filters.status, filters.search, filters.mine].filter(Boolean).length;
  const totalIdeas = pageMeta?.total ?? 0;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-900 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.22),transparent_55%)]" />
        <div className="container-app relative py-14 sm:py-20">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-forge-300 ring-1 ring-inset ring-white/10">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-forge-400" />
              Crowdsourced innovation · live
            </span>
            <h1 className="mt-5 text-4xl font-black leading-[1.1] tracking-tight sm:text-5xl">
              Turn complaints into{' '}
              <span className="bg-gradient-to-r from-forge-300 to-forge-500 bg-clip-text text-transparent">
                shipped software
              </span>
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300">
              Post the bug, the bottleneck or the limitation. The community proposes workarounds, HR VIP reviews them,
              and the best solutions get built — with every contributor credited on the Wall of Fame.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={isAuthenticated ? '/ideas/new' : '/register'} className="btn-primary px-5 py-3 text-sm">
                🔥 Submit your first idea
              </Link>
              <Link
                to="/wall-of-fame"
                className="btn border border-white/15 bg-white/5 px-5 py-3 text-sm text-white hover:bg-white/10"
              >
                🏆 See what shipped
              </Link>
            </div>
          </div>

          {/* Lifecycle counters */}
          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {STATUS_COUNTS.map(({ status, hint }) => {
              const count = meta?.countsByStatus?.[status] ?? 0;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilter('status', filters.status === status ? '' : status)}
                  className={cn(
                    'rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-white/20 hover:bg-white/[0.06]',
                    filters.status === status && 'border-forge-400/60 bg-forge-500/10'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-forge-400" />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{status}</span>
                  </div>
                  <p className="mt-1.5 text-2xl font-bold text-white">{formatNumber(count)}</p>
                  <p className="text-[11px] text-slate-500">{hint}</p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Feed */}
      <div className="container-app py-10">
        {/* Filter bar */}
        <div className="card mb-6 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            {/* Search */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setFilter('search', searchDraft.trim());
              }}
              className="relative flex-1"
            >
              <SearchSuggestions
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onSelect={(idea) => {
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.set('search', idea.title);
                    next.delete('page');
                    return next;
                  }, { replace: false });
                }}
                placeholder="Search ideas, bugs and limitations…"
                aria-label="Search ideas"
              />
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filters.category}
                onChange={(e) => setFilter('category', e.target.value)}
                className="input w-auto min-w-[10rem] cursor-pointer"
                aria-label="Filter by category"
              >
                <option value="">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={filters.status}
                onChange={(e) => setFilter('status', e.target.value)}
                className="input w-auto min-w-[11rem] cursor-pointer"
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                {IDEA_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                value={filters.sort}
                onChange={(e) => setFilter('sort', e.target.value)}
                className="input w-auto cursor-pointer"
                aria-label="Sort ideas"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>

              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => setFilter('mine', filters.mine ? '' : 'true')}
                  className={cn('btn px-3.5 py-2.5 text-xs', filters.mine ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700')}
                >
                  My ideas
                </button>
              ) : null}

              {activeFilters ? (
                <button type="button" onClick={() => setSearchParams({}, { replace: true })} className="btn-ghost px-3.5 py-2.5 text-xs">
                  Clear ({activeFilters})
                </button>
              ) : null}
            </div>
          </div>

          {/* Active status filter chips */}
          {filters.status ? (
            <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
              <span className="text-xs font-medium text-slate-500">Showing:</span>
              <StatusBadge status={filters.status} size="sm" />
              {filters.category ? <span className="chip bg-slate-100 text-slate-600">{filters.category}</span> : null}
              {filters.mine ? <span className="chip bg-slate-900 text-white">Posted by me</span> : null}
            </div>
          ) : null}
        </div>

        {flash ? (
          <Alert tone={flash.tone} className="mb-6" onDismiss={() => setFlash(null)}>
            {flash.message}
            {!isAuthenticated ? (
              <Link to="/login" className="ml-1 font-semibold underline">
                Log in
              </Link>
            ) : null}
          </Alert>
        ) : null}

        {/* Results */}
        {error ? (
          <ErrorState error={error} onRetry={refetch} title="Could not load the idea feed" />
        ) : loading ? (
          <SkeletonList count={6} />
        ) : ideas.length === 0 ? (
          <EmptyState
            icon={activeFilters ? '🔍' : '💡'}
            title={activeFilters ? 'No ideas match those filters' : 'The forge is empty — start it'}
            message={
              activeFilters
                ? 'Try removing a filter or searching for a different keyword.'
                : 'Every shipped project started as somebody typing "this is broken". Post the first one.'
            }
            action={
              activeFilters ? (
                <button type="button" onClick={() => setSearchParams({}, { replace: true })} className="btn-ghost">
                  Clear filters
                </button>
              ) : (
                <Link to={isAuthenticated ? '/ideas/new' : '/register'} className="btn-primary">
                  Submit an idea
                </Link>
              )
            }
          />
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                <span className="font-semibold text-slate-900">{formatNumber(totalIdeas)}</span>{' '}
                {totalIdeas === 1 ? 'idea' : 'ideas'}
                {filters.category ? ` in ${filters.category}` : ''}
              </p>
              {upvote.loading ? <Spinner className="text-forge-500" /> : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {ideas.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  onUpvote={handleUpvote}
                  upvoting={updatingId === idea.id}
                />
              ))}
            </div>

            <Pagination
              meta={pageMeta}
              className="mt-8"
              onPageChange={(page) => {
                setFilter('page', String(page));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </>
        )}

        {isAdmin ? (
          <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-5 text-center">
            <p className="text-sm text-slate-600">
              You have HR VIP access.{' '}
              <Link to="/admin" className="font-semibold text-forge-600 hover:underline">
                Open the review dashboard →
              </Link>
            </p>
            <p className="mt-1 text-xs text-slate-400">
              <span className={cn('chip mr-1 ring-1 ring-inset', STATUS_STYLES['Under HR VIP Review'])}>
                {formatNumber(meta?.countsByStatus?.['Under HR VIP Review'] ?? 0)}
              </span>
              ideas currently waiting on your review
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}
