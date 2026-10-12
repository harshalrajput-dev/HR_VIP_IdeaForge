import { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';

import Avatar from './Avatar';
import { RoleBadge } from './StatusBadge';
import { useAuth } from '../context/AuthContext';
import { cn, formatNumber } from '../utils/format';

const NAV_LINKS = [
  { to: '/', label: 'Idea Feed', end: true },
  { to: '/wall-of-fame', label: 'Wall of Fame' },
  { to: '/ideas/new', label: 'Submit Idea', authOnly: true },
];

const linkClasses = ({ isActive }) =>
  cn(
    'relative rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
  );

/** Top navigation: branding, primary links, live auth status and quick actions. */
export default function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-900/95 backdrop-blur">
      <div className="container-app">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Brand */}
          <Link to="/" className="group flex items-center gap-3" onClick={() => setMenuOpen(false)}>
            <img
              src="/logo.png"
              alt="HR VIP IdeaForge logo"
              className="h-9 w-9 shrink-0 rounded-md object-contain"
            />
            <span className="leading-tight">
              <span className="block text-[15px] font-bold tracking-tight text-white">HR VIP IdeaForge</span>
              <span className="block text-[11px] font-medium text-forge-300">Ideas into reality</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {NAV_LINKS.filter((l) => !l.authOnly || isAuthenticated).map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className={linkClasses}>
                {({ isActive }) => (
                  <>
                    {link.label}
                    {isActive ? (
                      <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-forge-400" />
                    ) : null}
                  </>
                )}
              </NavLink>
            ))}
            {isAdmin ? (
              <NavLink to="/admin" className={linkClasses}>
                {({ isActive }) => (
                  <>
                    HR VIP Panel
                    {isActive ? <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-forge-400" /> : null}
                  </>
                )}
              </NavLink>
            ) : null}
          </nav>

          {/* Auth status */}
          <div className="hidden items-center gap-3 md:flex">
            {isAuthenticated ? (
              <>
                <Link
                  to="/profile"
                  className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 py-1.5 pl-1.5 pr-3 transition hover:bg-white/10"
                  title="Your profile and settings"
                >
                  <Avatar name={user.name} src={user.avatarUrl} size="sm" />
                  <span className="leading-tight">
                    <span className="block max-w-[9rem] truncate text-xs font-semibold text-white">{user.name}</span>
                    <span className="block text-[11px] text-forge-300">
                      {formatNumber(user.points)} pts
                    </span>
                  </span>
                </Link>
                <button type="button" onClick={handleLogout} className="btn border border-white/15 bg-white/5 px-3 py-2 text-xs text-slate-200 hover:bg-white/10">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  state={{ from: location.pathname }}
                  className="btn px-3 py-2 text-xs text-slate-200 hover:bg-white/10"
                >
                  Log in
                </Link>
                <Link to="/register" className="btn-primary px-4 py-2 text-xs">
                  Join IdeaForge
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            className="btn border border-white/15 bg-white/5 px-3 py-2 text-white md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label="Toggle navigation"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile drawer */}
        {menuOpen ? (
          <div className="animate-fade-in-up border-t border-white/10 pb-4 pt-2 md:hidden">
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              {NAV_LINKS.filter((l) => !l.authOnly || isAuthenticated).map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    cn('rounded-lg px-3 py-2.5 text-sm font-medium', isActive ? 'bg-forge-500/15 text-forge-300' : 'text-slate-300')
                  }
                >
                  {link.label}
                </NavLink>
              ))}
              {isAdmin ? (
                <NavLink
                  to="/admin"
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    cn('rounded-lg px-3 py-2.5 text-sm font-medium', isActive ? 'bg-forge-500/15 text-forge-300' : 'text-slate-300')
                  }
                >
                  HR VIP Panel
                </NavLink>
              ) : null}
            </nav>

            <div className="mt-4 border-t border-white/10 pt-4">
              {isAuthenticated ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={user.name} src={user.avatarUrl} />
                    <div>
                      <Link
                        to="/profile"
                        onClick={() => setMenuOpen(false)}
                        className="block text-sm font-semibold text-white hover:underline"
                      >
                        {user.name}
                      </Link>
                      <p className="text-xs text-slate-400">
                        {formatNumber(user.points)} pts {isAdmin ? '• HR VIP' : ''}
                      </p>
                    </div>
                    <RoleBadge role={user.role} />
                  </div>
                  <div className="flex gap-2">
                    <Link
                      to="/?mine=true"
                      onClick={() => setMenuOpen(false)}
                      className="btn flex-1 border border-white/15 bg-white/5 text-slate-200"
                    >
                      My ideas
                    </Link>
                    <Link to="/profile" onClick={() => setMenuOpen(false)} className="btn-primary flex-1">
                      Settings
                    </Link>
                  </div>
                  <button type="button" onClick={handleLogout} className="btn w-full border border-white/15 bg-white/5 text-slate-200">
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link to="/login" onClick={() => setMenuOpen(false)} className="btn w-full border border-white/15 bg-white/5 text-slate-200">
                    Log in
                  </Link>
                  <Link to="/register" onClick={() => setMenuOpen(false)} className="btn-primary w-full">
                    Join IdeaForge
                  </Link>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
