import { cn } from '../utils/format';

/** Full-width shimmer placeholder used while a feed loads. */
export function SkeletonCard() {
  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <div className="skeleton h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-2/3" />
          <div className="skeleton h-3 w-1/3" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-5/6" />
      </div>
      <div className="mt-5 flex gap-2">
        <div className="skeleton h-7 w-24 rounded-full" />
        <div className="skeleton h-7 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 4 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** Friendly empty state. */
export function EmptyState({ icon = '💡', title = 'Nothing here yet', message, action = null }) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-4 text-5xl" aria-hidden="true">
        {icon}
      </span>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      {message ? <p className="mt-2 max-w-md text-sm text-slate-500">{message}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

/** Error state with a retry affordance. */
export function ErrorState({ error, onRetry, title = 'We could not load this' }) {
  const message = error?.message || 'An unexpected error occurred. Please try again.';
  return (
    <div className="card border-rose-200 bg-rose-50/60 px-6 py-12 text-center">
      <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-2xl" aria-hidden="true">
        ⚠️
      </span>
      <h3 className="text-base font-semibold text-rose-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-rose-700">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn-danger mt-6">
          Try again
        </button>
      ) : null}
    </div>
  );
}

/** Dismissible flash message. */
export function Alert({ tone = 'info', title, children, onDismiss, className = '' }) {
  const tones = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    error: 'border-rose-200 bg-rose-50 text-rose-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  };
  const icons = { info: 'ℹ️', success: '✅', error: '⛔', warning: '⚠️' };

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-xl border px-4 py-3 text-sm', tones[tone], className)}
    >
      <span aria-hidden="true">{icons[tone]}</span>
      <div className="flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && 'mt-0.5')}>{children}</div> : null}
      </div>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss">
          ✕
        </button>
      ) : null}
    </div>
  );
}

export function Spinner({ className = '' }) {
  return (
    <span
      className={cn('inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent', className)}
      role="status"
      aria-label="Loading"
    />
  );
}
