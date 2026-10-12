import { Link } from 'react-router-dom';

import { LIFECYCLE, IDEA_STATUS } from '../utils/constants';
import { cn } from '../utils/format';

const FOOTER_LINKS = [
  {
    title: 'Platform',
    links: [
      { label: 'Idea feed', to: '/' },
      { label: 'Wall of Fame', to: '/wall-of-fame' },
      { label: 'Submit an idea', to: '/ideas/new' },
    ],
  },
  {
    title: 'Lifecycle',
    links: LIFECYCLE.map((status) => ({ label: status, to: `/?status=${encodeURIComponent(status)}` })),
  },
];

const CREATOR = {
  role: 'Web Developer & Creator',
  name: 'Harshal Rajput',
  tagline: 'Web Development in progress',
  email: 'rharshal524@gmail.com',
  phone: '+919328550230',
  phoneDisplay: '+91 9328550230',
  whatsapp:
    'https://wa.me/919328550230?text=Hello%2C%20dev%20Harshal%20Rajput%20I%20came%20from%20HR%20VIP%20IdeaForge',
};

function MailIcon(props) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true" {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m3.5 7 8.5 6 8.5-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PhoneIcon(props) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true" {...props}>
      <path
        d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WhatsAppIcon(props) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

const contactLinkClasses =
  'inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-forge-400/40 hover:bg-white/10 hover:text-white';

/** Site footer with the lifecycle legend, creator credits and API pointer. */
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-white/10 bg-slate-900 text-slate-300">
      <div className="container-app py-12">
        <div className="grid gap-10 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="HR VIP IdeaForge logo" className="h-8 w-8 rounded-md object-contain" />
              <span className="text-sm font-bold text-white">HR VIP IdeaForge</span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-400">
              A crowdsourced innovation platform. Anyone can raise a problem, the community proposes solutions, and the
              HR VIP team reviews, approves and ships the best ones — crediting every contributor publicly.
            </p>
          </div>

          {/* Link columns */}
          {FOOTER_LINKS.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">{group.title}</h3>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} className="text-sm text-slate-400 transition-colors hover:text-forge-300">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Creator credits */}
        <div className="relative mt-10 overflow-hidden rounded-2xl border border-white/10 bg-slate-800/60 p-6">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-forge-500/20 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-forge-400 to-forge-700 text-xl shadow-glow"
                aria-hidden="true"
              >
                👨‍💻
              </span>
              <div>
                <span className="inline-flex items-center rounded-full bg-forge-500/15 px-2.5 py-1 text-[11px] font-semibold text-forge-300 ring-1 ring-inset ring-forge-500/30">
                  {CREATOR.role}
                </span>
                <p className="mt-1.5 text-lg font-bold tracking-tight text-white">{CREATOR.name}</p>
                <p className="text-xs font-medium text-slate-400">{CREATOR.tagline}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a href={`mailto:${CREATOR.email}`} className={contactLinkClasses}>
                <MailIcon className="text-forge-300" />
                <span>{CREATOR.email}</span>
              </a>
              <a href={`tel:${CREATOR.phone}`} className={contactLinkClasses}>
                <PhoneIcon className="text-forge-300" />
                <span>{CREATOR.phoneDisplay}</span>
              </a>
              <a
                href={CREATOR.whatsapp}
                target="_blank"
                rel="noreferrer"
                className="btn bg-emerald-500 text-white shadow-sm hover:bg-emerald-600 active:scale-[0.98]"
              >
                <WhatsAppIcon />
                Chat on WhatsApp
              </a>
            </div>
          </div>
        </div>

        {/* Lifecycle strip */}
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Idea lifecycle</p>
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
            {LIFECYCLE.map((status, index) => (
              <li key={status} className="flex items-center gap-2">
                <span
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
                    status === IDEA_STATUS.COMPLETED
                      ? 'bg-forge-500 text-white ring-forge-500'
                      : 'bg-white/5 text-slate-300 ring-white/10'
                  )}
                >
                  {index + 1}. {status}
                </span>
                {index < LIFECYCLE.length - 1 ? <span className="text-slate-600">→</span> : null}
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row">
          <p>
            © {year} HR VIP IdeaForge. Crafted by <span className="font-semibold text-slate-300">{CREATOR.name}</span>{' '}
            and the people who file the ideas.
          </p>
          <p>
            API: <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-slate-400">/api</code>{' '}
            · <span className="text-slate-400">MERN stack</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
