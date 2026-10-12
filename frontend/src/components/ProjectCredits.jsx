import { Link } from 'react-router-dom';

import Avatar from './Avatar';
import { RoleBadge } from './StatusBadge';
import UserLink from './UserLink';
import { formatDate, formatNumber } from '../utils/format';
import { DEVELOPED_BY_DEFAULT } from '../utils/constants';

/**
 * Wall of Fame credit block — the explicit attribution required before a
 * project can be marked Completed:
 *   Original Idea By · Key Contributors · Developed By
 */
export default function ProjectCredits({ credits, idea, className = '' }) {
  if (!credits) return null;

  const author = credits.originalIdeaBy || {};
  const contributors = credits.contributors || [];
  const ideaId = credits.idea?.id || credits.idea?._id || idea?.id;

  return (
    <section className={`card overflow-hidden ${className}`}>
      {/* Forge header */}
      <div className="relative bg-slate-900 px-6 py-7 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.35),transparent_60%)]" />
        <div className="relative">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-forge-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-forge-200 ring-1 ring-inset ring-forge-400/40">
            ★ Shipped project
          </p>
          <h3 className="mt-3 text-xl font-bold leading-snug">{credits.title}</h3>
          {credits.summary ? <p className="mt-2 max-w-2xl text-sm text-slate-300">{credits.summary}</p> : null}
          <p className="mt-3 text-xs text-slate-400">
            Published {formatDate(credits.publishedAt)}
            {credits.publishedBy?.name ? ` by ${credits.publishedBy.name}` : ''}
          </p>
        </div>
      </div>

      <div className="grid gap-6 p-6 md:grid-cols-3">
        {/* 1. Original Idea By */}
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Original idea by</h4>
          <div className="mt-3 flex items-center gap-3">
            <Avatar name={author.name || credits.originalIdeaByName || 'Unknown'} src={author.avatarUrl} size="md" />
            <div className="min-w-0">
              <UserLink
                user={author}
                className="block truncate text-sm font-semibold text-slate-900"
              >
                {author.name || credits.originalIdeaByName}
              </UserLink>
              <p className="truncate text-[11px] text-slate-500">
                {author.jobTitle || author.department || 'Community member'}
              </p>
            </div>
          </div>
          {ideaId ? (
            <Link to={`/ideas/${ideaId}`} className="mt-3 inline-block text-xs font-semibold text-forge-600 hover:underline">
              Read the original idea →
            </Link>
          ) : null}
        </div>

        {/* 2. Key Contributors */}
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Key contributors{contributors.length ? ` (${contributors.length})` : ''}
          </h4>
          {contributors.length ? (
            <ul className="mt-3 space-y-3">
              {contributors.map((person) => {
                const user = person.user || {};
                const name = user.name || person.name;
                return (
                  <li key={`${person.user?.id || person.user?._id || name}`} className="flex items-start gap-3">
                    <Avatar name={name} src={user.avatarUrl} size="sm" />
                    <div className="min-w-0">
                      <UserLink user={user} name={name} className="block truncate text-sm font-semibold text-slate-900" />
                      <p className="text-[11px] font-medium text-emerald-700">{person.role}</p>
                      {person.note ? <p className="text-[11px] text-slate-500">{person.note}</p> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Credits pending</p>
          )}
        </div>

        {/* 3. Developed By */}
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Developed by</h4>
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-forge-50 px-3 py-3 ring-1 ring-inset ring-forge-200">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-forge-500 text-white">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                <path d="M12 2l2.3 6.2L20.5 10.5l-6.2 2.3L12 19l-2.3-6.2L3.5 10.5l6.2-2.3L12 2z" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-bold text-forge-800">{credits.developedBy || DEVELOPED_BY_DEFAULT}</p>
              <RoleBadge role="hr_vip_employee" />
            </div>
          </div>

          {credits.projectLink ? (
            <a
              href={credits.projectLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-forge-600"
            >
              <span aria-hidden="true">↗</span> Open project
            </a>
          ) : (
            <p className="mt-3 text-[11px] text-slate-400">Internal release — no public link</p>
          )}
        </div>
      </div>

      {/* Impact / stack / metrics */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4">
        {credits.impact ? (
          <p className="mr-auto text-sm font-medium text-slate-700">
            <span className="text-slate-400">Impact: </span>
            {credits.impact}
          </p>
        ) : (
          <span className="mr-auto" />
        )}

        {Array.isArray(credits.techStack) &&
          credits.techStack.map((tech) => (
            <span key={tech} className="chip bg-white text-slate-600 ring-1 ring-inset ring-slate-200">
              {tech}
            </span>
          ))}

        {credits.metrics &&
          Object.entries(credits.metrics).map(([key, value]) => (
            <span key={key} className="chip bg-slate-900 font-semibold text-white">
              {key.replace(/([A-Z])/g, ' $1')}: {formatNumber(value)}
            </span>
          ))}
      </div>
    </section>
  );
}
