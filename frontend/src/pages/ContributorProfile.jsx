import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import Avatar from '../components/Avatar';
import IdeaCard from '../components/IdeaCard';
import Pagination from '../components/Pagination';
import { EmptyState, ErrorState, SkeletonList } from '../components/Feedback';
import { RoleBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import api from '../services/api';
import { formatDate, formatNumber, isObjectId, timeAgo, toQuery } from '../utils/format';

const SORTS = [
  { value: '-createdAt', label: 'Newest' },
  { value: '-upvoteCount', label: 'Most upvoted' },
  { value: '-commentCount', label: 'Most discussed' },
];

/**
 * Public contributor profile — GET /api/auth/users/:id.
 *
 * Lists the ideas this person authored so a reviewer can judge a solution
 * author's track record without needing an admin session.
 */
export default function ContributorProfile() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const [sort, setSort] = useState('-createdAt');
  const [page, setPage] = useState(1);

  const valid = isObjectId(id);

  const {
    data: profile,
    loading: loadingProfile,
    error: profileError,
    refetch: refetchProfile,
  } = useApi(() => api.get(`/auth/users/${id}`), [id], { skip: !valid });

  const query = useMemo(() => toQuery({ author: id, sort, page, limit: 12 }), [id, sort, page]);

  const {
    data: ideas = [],
    meta,
    loading: loadingIdeas,
    error: ideasError,
    refetch: refetchIdeas,
  } = useApi(() => api.get(`/ideas${query}`), [query], { skip: !valid, initialData: [] });

  if (!valid) {
    return (
      <div className="container-app py-16">
        <EmptyState
          icon="🔍"
          title="That profile link is not valid"
          message="The address does not point at a real contributor."
          action={
            <Link to="/" className="btn-primary">
              Back to the idea feed
            </Link>
          }
        />
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="container-app py-16">
        <ErrorState error={profileError} onRetry={refetchProfile} title="Could not load this profile" />
      </div>
    );
  }

  if (loadingProfile || !profile) {
    return (
      <div className="container-app max-w-4xl py-10">
        <div className="card p-6">
          <div className="skeleton h-24 w-24 rounded-full" />
          <div className="mt-5 space-y-2">
            <div className="skeleton h-5 w-1/3" />
            <div className="skeleton h-3 w-1/2" />
            <div className="skeleton h-3 w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  const isSelf = currentUser?.id === profile.id;
  const stats = profile.stats || { ideas: 0, projects: 0 };

  return (
    <div className="container-app max-w-5xl py-10">
      {/* Identity */}
      <section className="card overflow-hidden">
        <div className="relative bg-slate-900 px-6 py-8 text-white sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.28),transparent_60%)]" />
          <div className="relative flex flex-wrap items-start gap-5">
            <Avatar name={profile.name} src={profile.avatarUrl} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{profile.name}</h1>
                <RoleBadge role={profile.role} />
              </div>
              <p className="mt-1 text-sm text-slate-300">
                {[profile.jobTitle, profile.department].filter(Boolean).join(' · ') || 'Community member'}
              </p>
              <p className="mt-1 text-xs text-slate-400">Member since {formatDate(profile.createdAt)}</p>
              {profile.bio ? (
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-200">{profile.bio}</p>
              ) : null}
            </div>

            {isSelf ? (
              <Link to="/profile" className="btn border border-white/15 bg-white/5 px-4 py-2 text-xs text-white hover:bg-white/10">
                Edit my profile
              </Link>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x divide-slate-100">
          {[
            { label: 'Points', value: profile.points ?? 0 },
            { label: 'Ideas raised', value: stats.ideas ?? 0 },
            { label: 'Projects credited', value: stats.projects ?? 0 },
          ].map((stat) => (
            <div key={stat.label} className="px-4 py-5 text-center">
              <p className="text-2xl font-black text-slate-900">{formatNumber(stat.value)}</p>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Their ideas */}
      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Ideas by {profile.name.split(' ')[0]}
          </h2>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="input w-auto cursor-pointer py-1.5 text-xs"
            aria-label="Sort this contributor's ideas"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {ideasError ? (
          <ErrorState error={ideasError} onRetry={refetchIdeas} title="Could not load these ideas" />
        ) : loadingIdeas ? (
          <SkeletonList count={3} />
        ) : ideas.length === 0 ? (
          <EmptyState
            icon="💡"
            title={`${profile.name.split(' ')[0]} has not raised an idea yet`}
            message="When they do, it will show up here with its votes and discussion count."
          />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {ideas.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} onUpvote={() => {}} />
              ))}
            </div>
            <Pagination
              meta={meta}
              className="mt-8"
              onPageChange={(next) => {
                setPage(next);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </>
        )}
      </section>

      <p className="mt-8 text-center text-xs text-slate-400">
        Last activity {timeAgo(profile.createdAt)} ·{' '}
        <Link to="/wall-of-fame" className="font-semibold text-forge-600 hover:underline">
          See everything that shipped
        </Link>
      </p>
    </div>
  );
}
