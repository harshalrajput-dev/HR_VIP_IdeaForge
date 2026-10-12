import { Link } from 'react-router-dom';

import { cn, isObjectId } from '../utils/format';

/**
 * Renders a person's name as a link to their public contributor profile.
 * Falls back to plain text when the payload carries no usable id (lists
 * populate a trimmed author object, and the id may be missing on old records).
 */
export default function UserLink({ user, name, className = '', children }) {
  const id = user?.id || user?._id;
  const label = children ?? user?.name ?? name ?? 'Unknown';

  if (!isObjectId(id)) {
    return <span className={className}>{label}</span>;
  }

  return (
    <Link to={`/people/${id}`} className={cn('transition-colors hover:text-forge-600 hover:underline', className)}>
      {label}
    </Link>
  );
}
