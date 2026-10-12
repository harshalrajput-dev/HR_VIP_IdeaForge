import { Link } from 'react-router-dom';

import Avatar from './Avatar';
import { CategoryChip, PriorityBadge, StatusBadge } from './StatusBadge';
import UserLink from './UserLink';
import { useAuth } from '../context/AuthContext';
import { cn, formatNumber, timeAgo, truncate } from '../utils/format';
import { IDEA_STATUS } from '../utils/constants';

/**
 * Feed card for a single idea: status badge, category, excerpt and the
 * upvote control. Upvoting is optimistic and requires authentication.
 */
export default function IdeaCard({ idea, onUpvote, upvoting = false }) {
  const { isAuthenticated } = useAuth();

  const upvotes = idea.upvoteCount ?? (idea.upvotes?.length ?? 0);
  const comments = idea.commentCount ?? 0;
  const isAuthor = Boolean(idea.author);
  const isCompleted = idea.status === IDEA_STATUS.COMPLETED;

  return (
    <article className="card group relative flex flex-col p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-forge-200 hover:shadow-glow">
      {isCompleted ? (
        <div className="absolute right-0 top-0 rounded-bl-xl bg-forge-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
          Shipped
        </div>
      ) : null}

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={idea.status} size="sm" />
        <CategoryChip category={idea.category} />
        {idea.priority && idea.priority !== 'Medium' ? <PriorityBadge priority={idea.priority} /> : null}
      </div>

      {/* Title */}
      <h3 className="mt-3 text-[17px] font-semibold leading-snug text-slate-900">
        <Link to={`/ideas/${idea.id}`} className="after:absolute after:inset-0 after:content-['']">
          {idea.title}
        </Link>
      </h3>

      {/* Excerpt */}
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{truncate(idea.description, 190)}</p>

      {/* Tags */}
      {Array.isArray(idea.tags) && idea.tags.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {idea.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
              #{tag}
            </span>
          ))}
        </div>
      ) : null}

      {/* Footer */}
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar name={idea.author?.name || 'Unknown'} src={idea.author?.avatarUrl} size="sm" />
          <div className="min-w-0 leading-tight">
            {/* The card title's ::after overlay covers the whole article, so this
                link needs its own stacking context to stay clickable. */}
            <UserLink
              user={idea.author}
              className="relative z-10 block truncate text-xs font-semibold text-slate-800"
            />
            <p className="text-[11px] text-slate-400">
              {idea.author?.department ? `${idea.author.department} · ` : ''}
              {timeAgo(idea.createdAt)}
            </p>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-1.5">
          <Link
            to={`/ideas/${idea.id}#discussion`}
            className="chip bg-slate-50 px-2.5 py-1.5 text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-100"
            title={`${comments} comment${comments === 1 ? '' : 's'}`}
          >
            <span aria-hidden="true">💬</span> {formatNumber(comments)}
          </Link>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onUpvote?.(idea);
            }}
            disabled={!isAuthenticated || upvoting}
            title={
              !isAuthenticated
                ? 'Log in to upvote'
                : idea.upvotedByMe
                  ? 'Remove your upvote'
                  : 'Upvote this idea'
            }
            aria-pressed={Boolean(idea.upvotedByMe)}
            className={cn(
              'chip px-2.5 py-1.5 font-semibold ring-1 ring-inset transition-all',
              idea.upvotedByMe
                ? 'bg-forge-500 text-white ring-forge-500'
                : 'bg-white text-slate-600 ring-slate-200 hover:bg-forge-50 hover:text-forge-700 hover:ring-forge-200',
              !isAuthenticated && 'cursor-not-allowed opacity-60'
            )}
          >
            <span aria-hidden="true">▲</span> {formatNumber(upvotes)}
          </button>
        </div>
      </div>

      {isAuthor && idea.bestSolution ? (
        <p className="mt-3 text-[11px] font-medium text-emerald-700">✓ Best solution identified</p>
      ) : null}
    </article>
  );
}
