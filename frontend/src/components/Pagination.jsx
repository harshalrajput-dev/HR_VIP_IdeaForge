import { cn, formatNumber } from '../utils/format';

/** Page controls driven by the API `meta` block. */
export default function Pagination({ meta, onPageChange, className = '' }) {
  if (!meta || meta.totalPages <= 1) return null;

  const { page, totalPages, total } = meta;
  const pages = [];
  const start = Math.max(1, page - 1);
  const end = Math.min(totalPages, page + 1);
  for (let i = start; i <= end; i += 1) pages.push(i);

  return (
    <nav className={cn('flex flex-wrap items-center justify-between gap-3', className)} aria-label="Pagination">
      <p className="text-xs text-slate-500">
        Page <span className="font-semibold text-slate-700">{page}</span> of {totalPages} ·{' '}
        {formatNumber(total)} result{total === 1 ? '' : 's'}
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!meta.hasPrevPage}
          className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
        >
          ← Prev
        </button>

        {start > 1 && (
          <>
            <button type="button" onClick={() => onPageChange(1)} className="btn-ghost px-3 py-1.5 text-xs">
              1
            </button>
            {start > 2 && <span className="px-1 text-slate-400">…</span>}
          </>
        )}

        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              'btn px-3 py-1.5 text-xs',
              p === page ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            )}
          >
            {p}
          </button>
        ))}

        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="px-1 text-slate-400">…</span>}
            <button type="button" onClick={() => onPageChange(totalPages)} className="btn-ghost px-3 py-1.5 text-xs">
              {totalPages}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!meta.hasNextPage}
          className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </nav>
  );
}
