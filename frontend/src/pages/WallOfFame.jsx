import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import ProjectCredits from '../components/ProjectCredits';
import Pagination from '../components/Pagination';
import UserLink from '../components/UserLink';
import { EmptyState, ErrorState, SkeletonList } from '../components/Feedback';
import api from '../services/api';
import { useApi } from '../hooks/useApi';
import { cn, formatNumber, timeAgo, toQuery } from '../utils/format';

const HIGHLIGHTS = [
  { key: 'impact', label: 'What shipped' },
  { key: 'tech', label: 'Built with' },
];

/** Public showcase of every completed project and who gets the credit. */
export default function WallOfFame() {
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [page, setPage] = useState(1);

  const query = useMemo(
    () => toQuery({ page, limit: 9, featured: featuredOnly ? 'true' : '', search: activeSearch }),
    [page, featuredOnly, activeSearch]
  );

  const { data: projects = [], meta, loading, error, refetch } = useApi(
    () => api.get(`/projects${query}`),
    [query],
    { initialData: [] }
  );

  const contributors = useMemo(() => {
    const tally = new Map();
    projects.forEach((project) =>
      (project.contributors || []).forEach((person) => {
        const name = person.user?.name || person.name;
        const id = person.user?.id || person.user?._id;
        if (!tally.has(name)) tally.set(name, { name, id, count: 0 });
        tally.get(name).count += 1;
      })
    );
    return [...tally.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  }, [projects]);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-900 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(249,115,22,0.3),transparent_55%)]" />
        <div className="container-app relative py-14 text-center sm:py-20">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-forge-300 ring-1 ring-inset ring-white/10">
            🏆 Wall of Fame
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-black leading-[1.1] tracking-tight sm:text-5xl">
            Ideas that became <span className="bg-gradient-to-r from-forge-300 to-forge-500 bg-clip-text text-transparent">real software</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300">
            Every project here started as somebody&apos;s complaint. Each one names the{' '}
            <strong className="text-white">Original Idea By</strong>, the{' '}
            <strong className="text-white">Key Contributors</strong> who solved it, and the{' '}
            <strong className="text-white">HR VIP Team</strong> that shipped it.
          </p>

          <div className="mx-auto mt-8 grid max-w-2xl grid-cols-3 gap-3">
            {[
              { label: 'Projects shipped', value: meta?.total ?? 0 },
              { label: 'On this page', value: projects.length },
              { label: 'Top contributors', value: contributors.length },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-2xl font-bold text-white">{formatNumber(stat.value)}</p>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="container-app py-10">
        {/* Filters */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setActiveSearch(search.trim());
            }}
            className="relative flex-1"
          >
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true">
              🔍
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search shipped projects or tech…"
              className="input pl-10"
              aria-label="Search projects"
            />
          </form>

          <button
            type="button"
            onClick={() => {
              setFeaturedOnly((v) => !v);
              setPage(1);
            }}
            className={cn(
              'btn px-4 py-2.5 text-xs',
              featuredOnly ? 'bg-forge-500 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            )}
          >
            ★ Featured only
          </button>

          <Link to="/ideas/new" className="btn-primary px-4 py-2.5 text-xs">
            Ship your idea →
          </Link>
        </div>

        {/* Content */}
        {error ? (
          <ErrorState error={error} onRetry={refetch} title="Could not load the Wall of Fame" />
        ) : loading ? (
          <SkeletonList count={3} />
        ) : projects.length === 0 ? (
          <EmptyState
            icon="🏆"
            title="Nothing shipped yet"
            message="Once HR VIP approves an idea and publishes the finished project, it lands here with full credit."
            action={
              <Link to="/" className="btn-primary">
                Browse open ideas
              </Link>
            }
          />
        ) : (
          <>
            <div className="space-y-6">
              {projects.map((project) => (
                <div key={project.id} className="animate-fade-in-up">
                  <ProjectCredits credits={project} />
                  <p className="mt-2 text-right text-[11px] text-slate-400">Published {timeAgo(project.publishedAt)}</p>
                </div>
              ))}
            </div>

            <Pagination meta={meta} className="mt-8" onPageChange={setPage} />

            {/* Contributor leaderboard */}
            {contributors.length ? (
              <section className="card mt-10 p-6">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Most decorated contributors</h2>
                <ul className="mt-4 flex flex-wrap gap-3">
                  {contributors.map((person, index) => (
                    <li
                      key={person.name}
                      className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3.5 py-2 ring-1 ring-inset ring-slate-100"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-forge-500 text-[11px] font-bold text-white">
                        {index + 1}
                      </span>
                      <UserLink user={{ id: person.id, name: person.name }} className="text-sm font-semibold text-slate-800" />
                      <span className="text-xs text-slate-500">
                        {person.count} project{person.count === 1 ? '' : 's'}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}

        {/* How it works */}
        <section className="mt-12 grid gap-4 md:grid-cols-3">
          {HIGHLIGHTS.concat({ key: 'credit', label: 'Credit never expires' }).map((item) => (
            <div key={item.key} className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-900">{item.label}</p>
              <p className="mt-1.5 text-sm text-slate-500">
                {
                  {
                    impact:
                      'Every published project documents the outcome, so contributors can point at real impact in a review cycle.',
                    tech: 'The stack is published openly so the next team can reuse the solution instead of rebuilding it.',
                    credit: 'Names are permanently attached to the project, the idea and your profile contribution score.',
                  }[item.key]
                }
              </p>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
