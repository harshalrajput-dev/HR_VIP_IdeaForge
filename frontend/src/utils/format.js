/** Small, dependency-free formatting + className helpers. */

export const cn = (...classes) => classes.filter(Boolean).join(' ');

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

/** "3 hours ago" / "in 2 days" */
export function timeAgo(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return 'just now';
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), 'hour');
  if (abs < 2592000) return relative.format(Math.round(seconds / 86400), 'day');
  if (abs < 31536000) return relative.format(Math.round(seconds / 2592000), 'month');
  return relative.format(Math.round(seconds / 31536000), 'year');
}

export const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

export const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

export const formatNumber = (value) => (Number.isFinite(value) ? value.toLocaleString('en-GB') : '0');

export const formatCompact = (value) => (Number.isFinite(value) ? compact.format(value) : '0');

/** Initials for the avatar fallback: "Maya Iyer" -> "MI" */
export function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Deterministic avatar tint so a user keeps the same colour everywhere. */
export function avatarTone(name = '') {
  const tones = [
    'bg-forge-100 text-forge-700',
    'bg-emerald-100 text-emerald-700',
    'bg-sky-100 text-sky-700',
    'bg-violet-100 text-violet-700',
    'bg-rose-100 text-rose-700',
    'bg-amber-100 text-amber-800',
  ];
  const sum = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return tones[sum % tones.length];
}

export const truncate = (text = '', max = 160) =>
  text.length <= max ? text : `${text.slice(0, max).trimEnd()}...`;

/** Build a querystring from an object, dropping empty values. */
export function toQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) return;
    search.set(key, Array.isArray(value) ? value.join(',') : String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const titleCase = (value = '') => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Guard for ids taken from the URL. The API casts query params straight into
 * ObjectIds, so a malformed id would otherwise surface as a 500 instead of a
 * friendly "not found" state.
 */
export const isObjectId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
