import { avatarTone, cn, initials } from '../utils/format';

/** Circular user avatar with an initials fallback (no image hosting required). */
export default function Avatar({ name = 'Anonymous', src = '', size = 'md', className = '' }) {
  const sizes = {
    xs: 'h-6 w-6 text-[10px]',
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-lg',
  };

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-white',
        sizes[size] ?? sizes.md,
        src ? 'bg-slate-200' : avatarTone(name),
        className
      )}
      title={name}
    >
      {src ? (
        <img src={src} alt={name} className="h-full w-full rounded-full object-cover" loading="lazy" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
