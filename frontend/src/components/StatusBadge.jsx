import { IDEA_STATUS, PRIORITY_STYLES, STATUS_DOT, STATUS_STYLES } from '../utils/constants';
import { cn } from '../utils/format';

/** Lifecycle badge - the colour is the single source of truth for "where is this?". */
export function StatusBadge({ status = IDEA_STATUS.SUBMITTED, size = 'md', className = '' }) {
  return (
    <span
      className={cn(
        'chip ring-1 ring-inset font-semibold',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        STATUS_STYLES[status] ?? STATUS_STYLES[IDEA_STATUS.SUBMITTED],
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status] ?? STATUS_DOT[IDEA_STATUS.SUBMITTED])} />
      {status}
    </span>
  );
}

export function PriorityBadge({ priority = 'Medium' }) {
  if (!priority) return null;
  return (
    <span className={cn('chip ring-1 ring-inset', PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.Medium)}>
      {priority} priority
    </span>
  );
}

export function CategoryChip({ category, className = '' }) {
  return (
    <span className={cn('chip bg-slate-100 font-medium text-slate-600', className)}>{category}</span>
  );
}

export function RoleBadge({ role = 'user' }) {
  const isStaff = role === 'hr_vip_employee' || role === 'admin';
  return (
    <span
      className={cn(
        'chip text-[11px] font-semibold uppercase tracking-wide',
        isStaff ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
      )}
      title={isStaff ? 'HR VIP employee' : 'Community member'}
    >
      {isStaff ? 'HR VIP' : 'Member'}
    </span>
  );
}
