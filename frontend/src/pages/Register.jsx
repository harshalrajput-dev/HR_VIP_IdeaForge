import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Alert, Spinner } from '../components/Feedback';
import { useAuth } from '../context/AuthContext';
import { useMutation } from '../hooks/useApi';
import { LIMITS } from '../utils/constants';
import { cn } from '../utils/format';

/** Client-side mirror of the backend password policy so users get instant feedback. */
const scorePassword = (value) => {
  let score = 0;
  if (value.length >= LIMITS.PASSWORD_MIN) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.min(score, 4);
};

const STRENGTH = [
  { label: 'Too short', color: 'bg-rose-500' },
  { label: 'Weak', color: 'bg-rose-500' },
  { label: 'Fair', color: 'bg-amber-500' },
  { label: 'Good', color: 'bg-sky-500' },
  { label: 'Strong', color: 'bg-emerald-500' },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Self-service registration. The first account on a fresh DB becomes HR VIP. */
export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    department: '',
    jobTitle: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);

  const { mutate, loading } = useMutation((payload) => register(payload));

  const strength = useMemo(() => scorePassword(form.password), [form.password]);

  const update = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  /** Client validation mirrors the API rules so nobody waits on a round trip. */
  const validate = () => {
    const errors = {};
    if (form.name.trim().length < LIMITS.NAME_MIN) errors.name = `At least ${LIMITS.NAME_MIN} characters`;
    if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = 'Enter a valid work email';
    if (form.password.length < LIMITS.PASSWORD_MIN) errors.password = `At least ${LIMITS.PASSWORD_MIN} characters`;
    else if (!/[a-zA-Z]/.test(form.password) || !/\d/.test(form.password)) {
      errors.password = 'Mix letters and numbers';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    if (!validate()) return;

    try {
      const user = await mutate({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        department: form.department.trim() || undefined,
        jobTitle: form.jobTitle.trim() || undefined,
      });
      navigate(user?.isAdmin ? '/admin' : '/ideas/new', { replace: true });
    } catch (err) {
      setError(err);
      setFieldErrors(err.fieldErrors || {});
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12 sm:px-8">
      <div className="w-full max-w-lg">
        <div className="text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-forge-400 to-forge-700 shadow-glow">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="currentColor" aria-hidden="true">
              <path d="M12 2l2.3 6.2L20.5 10.5l-6.2 2.3L12 19l-2.3-6.2L3.5 10.5l6.2-2.3L12 2z" />
            </svg>
          </span>
          <h1 className="mt-5 text-2xl font-bold text-slate-900">Join the forge</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Create an account to post ideas, solve problems and earn reputation points.
          </p>
        </div>

        {error ? (
          <Alert tone="error" className="mt-6" title="Registration failed">
            {error.message}
          </Alert>
        ) : null}

        <form onSubmit={handleSubmit} className="card mt-6 p-6" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="name">
                Full name
              </label>
              <input
                id="name"
                autoComplete="name"
                required
                value={form.name}
                onChange={update('name')}
                className="input"
                placeholder="Maya Iyer"
                aria-invalid={Boolean(fieldErrors.name)}
              />
              {fieldErrors.name ? <p className="hint text-rose-600">{fieldErrors.name}</p> : null}
            </div>

            <div className="sm:col-span-2">
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
                placeholder="maya@company.com"
                aria-invalid={Boolean(fieldErrors.email)}
              />
              {fieldErrors.email ? <p className="hint text-rose-600">{fieldErrors.email}</p> : null}
            </div>

            <div className="sm:col-span-2">
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={form.password}
                onChange={update('password')}
                className="input"
                placeholder="At least 8 characters, with a number"
                aria-invalid={Boolean(fieldErrors.password)}
              />
              {form.password ? (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={cn(
                          'h-1 flex-1 rounded-full transition-colors',
                          i < strength ? STRENGTH[strength].color : 'bg-slate-200'
                        )}
                      />
                    ))}
                  </div>
                  <p className="hint">Password strength: {STRENGTH[strength].label}</p>
                </div>
              ) : null}
              {fieldErrors.password ? <p className="hint text-rose-600">{fieldErrors.password}</p> : null}
            </div>

            <div>
              <label className="label" htmlFor="department">
                Department <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="department"
                value={form.department}
                onChange={update('department')}
                className="input"
                placeholder="Engineering"
              />
            </div>

            <div>
              <label className="label" htmlFor="jobTitle">
                Job title <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="jobTitle"
                value={form.jobTitle}
                onChange={update('jobTitle')}
                className="input"
                placeholder="Software Engineer"
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary mt-6 w-full py-3">
            {loading ? <Spinner /> : null}
            {loading ? 'Creating account…' : 'Create account'}
          </button>

          <p className="mt-3 text-center text-[11px] text-slate-400">
            The first account on a new installation is automatically granted HR VIP reviewer access.
          </p>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-forge-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
