import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { Alert, Spinner } from '../components/Feedback';
import { useAuth } from '../context/AuthContext';
import { useMutation } from '../hooks/useApi';

/** Split-screen sign-in screen with demo account shortcuts. */
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/';

  const [form, setForm] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);

  const { mutate, loading } = useMutation((credentials) => login(credentials));

  const update = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    try {
      const user = await mutate(form);
      navigate(user?.isAdmin ? '/admin' : redirectTo, { replace: true });
    } catch (err) {
      setError(err);
      setFieldErrors(err.fieldErrors || {});
    }
  };

  const useDemo = (email) => {
    setForm({ email, password: 'Password123' });
    setError(null);
  };

  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-slate-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(249,115,22,0.28),transparent_55%)]" />
        <div className="relative">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-forge-400 to-forge-700">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                <path d="M12 2l2.3 6.2L20.5 10.5l-6.2 2.3L12 19l-2.3-6.2L3.5 10.5l6.2-2.3L12 2z" />
              </svg>
            </span>
            <span className="text-base font-bold">HR VIP IdeaForge</span>
          </Link>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-black leading-tight">
            Your idea is probably the one that <span className="text-forge-400">unblocks everyone</span>.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            Sign in to post problems, propose solutions, upvote the ones that matter and get credited on the Wall of
            Fame when HR VIP ships your work.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-slate-300">
            {[
              'Raise bugs and software limitations in under a minute',
              'Earn points for solutions the community adopts',
              'Permanent credit on every shipped project',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="mt-0.5 text-forge-400" aria-hidden="true">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">Internal platform · HR VIP Technology</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
          <p className="mt-1.5 text-sm text-slate-500">Log in to continue to the idea forge.</p>

          {error ? (
            <Alert tone="error" className="mt-6" title="Could not sign you in">
              {error.message}
            </Alert>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label className="label" htmlFor="email">
                Work email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={update('email')}
                className="input"
                placeholder="you@company.com"
                aria-invalid={Boolean(fieldErrors.email)}
              />
              {fieldErrors.email ? <p className="hint text-rose-600">{fieldErrors.email}</p> : null}
            </div>

            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={form.password}
                onChange={update('password')}
                className="input"
                placeholder="••••••••"
                aria-invalid={Boolean(fieldErrors.password)}
              />
              {fieldErrors.password ? <p className="hint text-rose-600">{fieldErrors.password}</p> : null}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? <Spinner /> : null}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Demo accounts</p>
            <p className="mt-1 text-xs text-slate-400">Run <code className="font-mono">npm run seed</code> in the backend first.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => useDemo('admin@hrvip.com')}
                className="rounded-lg border border-slate-200 px-3 py-2 text-left text-xs transition hover:border-forge-300 hover:bg-forge-50"
              >
                <span className="block font-semibold text-slate-800">HR VIP employee</span>
                <span className="block text-slate-500">admin@hrvip.com</span>
              </button>
              <button
                type="button"
                onClick={() => useDemo('maya@hrvip.com')}
                className="rounded-lg border border-slate-200 px-3 py-2 text-left text-xs transition hover:border-forge-300 hover:bg-forge-50"
              >
                <span className="block font-semibold text-slate-800">Standard user</span>
                <span className="block text-slate-500">maya@hrvip.com</span>
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-slate-400">Password: Password123</p>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            No account yet?{' '}
            <Link to="/register" className="font-semibold text-forge-600 hover:underline">
              Join IdeaForge
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
