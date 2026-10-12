import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import Avatar from '../components/Avatar';
import { Alert, Spinner } from '../components/Feedback';
import { RoleBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useMutation } from '../hooks/useApi';
import api from '../services/api';
import { LIMITS } from '../utils/constants';
import { formatDate, formatNumber } from '../utils/format';

/** Mirrors the API password policy so feedback is instant. */
const validatePassword = (value) => {
  if (value.length < LIMITS.PASSWORD_MIN) return `At least ${LIMITS.PASSWORD_MIN} characters`;
  if (!/[a-zA-Z]/.test(value) || !/\d/.test(value)) return 'Mix letters and numbers';
  return null;
};

/**
 * Self-service account settings.
 *
 * Profile fields go through PATCH /api/auth/me (the session token and cached
 * user are refreshed by AuthContext), credentials through
 * POST /api/auth/change-password, which re-verifies the current password so a
 * stolen token alone cannot lock the owner out.
 */
export default function Profile() {
  const { user, updateProfile } = useAuth();

  const [form, setForm] = useState({ name: '', department: '', jobTitle: '', bio: '', avatarUrl: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [flash, setFlash] = useState(null);

  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwErrors, setPwErrors] = useState({});
  const [pwFlash, setPwFlash] = useState(null);

  // Re-seed the form whenever the session user changes (login, refresh, 401).
  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name ?? '',
      department: user.department ?? '',
      jobTitle: user.jobTitle ?? '',
      bio: user.bio ?? '',
      avatarUrl: user.avatarUrl ?? '',
    });
  }, [user]);

  const saveProfile = useMutation((payload) => updateProfile(payload));
  const changePassword = useMutation((payload) => api.post('/auth/change-password', payload));

  const dirty = useMemo(() => {
    if (!user) return false;
    return (
      form.name !== (user.name ?? '') ||
      form.department !== (user.department ?? '') ||
      form.jobTitle !== (user.jobTitle ?? '') ||
      form.bio !== (user.bio ?? '') ||
      form.avatarUrl !== (user.avatarUrl ?? '')
    );
  }, [form, user]);

  const update = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    setFlash(null);
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setFlash(null);

    const errors = {};
    const name = form.name.trim();
    if (name.length < LIMITS.NAME_MIN || name.length > LIMITS.NAME_MAX) {
      errors.name = `${LIMITS.NAME_MIN}-${LIMITS.NAME_MAX} characters`;
    }
    if (form.department.trim().length > 80) errors.department = 'Keep this under 80 characters';
    if (form.jobTitle.trim().length > 80) errors.jobTitle = 'Keep this under 80 characters';
    if (form.bio.trim().length > 280) errors.bio = 'Keep this under 280 characters';
    const avatar = form.avatarUrl.trim();
    if (avatar && !/^https?:\/\/.+/i.test(avatar)) errors.avatarUrl = 'Must be a valid http(s) URL';
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    try {
      await saveProfile.mutate({
        name,
        department: form.department.trim(),
        jobTitle: form.jobTitle.trim(),
        bio: form.bio.trim(),
        avatarUrl: form.avatarUrl.trim(),
      });
      setFlash({ tone: 'success', message: 'Profile updated' });
    } catch (err) {
      setError(err);
      setFieldErrors(err.fieldErrors || {});
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPwFlash(null);

    const errors = {};
    if (!pw.currentPassword) errors.currentPassword = 'Enter your current password';
    const policy = validatePassword(pw.newPassword);
    if (policy) errors.newPassword = policy;
    if (pw.newPassword && pw.newPassword !== pw.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    if (pw.newPassword && pw.newPassword === pw.currentPassword) {
      errors.newPassword = 'Choose a password you have not used here before';
    }
    setPwErrors(errors);
    if (Object.keys(errors).length) return;

    try {
      const res = await changePassword.mutate({
        currentPassword: pw.currentPassword,
        newPassword: pw.newPassword,
      });
      setPw({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPwFlash({ tone: 'success', message: res.message });
    } catch (err) {
      setPwFlash({ tone: 'error', message: err.message });
      setPwErrors(err.fieldErrors || {});
    }
  };

  if (!user) return null;

  return (
    <div className="container-app max-w-4xl py-10">
      {/* Identity card */}
      <section className="card overflow-hidden">
        <div className="relative bg-slate-900 px-6 py-7 text-white sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.28),transparent_60%)]" />
          <div className="relative flex flex-wrap items-center gap-5">
            <Avatar name={user.name} src={user.avatarUrl} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold">{user.name}</h1>
                <RoleBadge role={user.role} />
              </div>
              <p className="mt-1 text-sm text-slate-300">{user.email}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {[user.jobTitle, user.department].filter(Boolean).join(' · ') || 'No department set'} · member since{' '}
                {formatDate(user.createdAt)}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center">
              <p className="text-2xl font-bold text-forge-300">{formatNumber(user.points)}</p>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">points</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:px-8">
          <Link to={`/people/${user.id}`} className="btn-ghost px-4 py-2 text-xs">
            View my public profile →
          </Link>
          <Link to="/?mine=true" className="btn-ghost px-4 py-2 text-xs">
            My ideas
          </Link>
          {user.isAdmin ? (
            <Link to="/admin" className="btn-ghost px-4 py-2 text-xs">
              HR VIP panel
            </Link>
          ) : null}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Profile details */}
        <div className="lg:col-span-3">
          <form onSubmit={handleProfileSubmit} className="card p-6" noValidate>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Profile details</h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Your name, department and bio are shown to everyone on your public profile and on Wall of Fame credits.
            </p>

            {flash ? (
              <Alert tone={flash.tone} className="mt-4" onDismiss={() => setFlash(null)}>
                {flash.message}
              </Alert>
            ) : null}
            {error ? (
              <Alert tone="error" className="mt-4" title="Could not save your profile">
                {error.message}
              </Alert>
            ) : null}

            <div className="mt-5 space-y-4">
              <div>
                <label className="label" htmlFor="name">
                  Full name
                </label>
                <input
                  id="name"
                  value={form.name}
                  onChange={update('name')}
                  className="input"
                  aria-invalid={Boolean(fieldErrors.name)}
                />
                {fieldErrors.name ? <p className="hint text-rose-600">{fieldErrors.name}</p> : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="department">
                    Department
                  </label>
                  <input
                    id="department"
                    value={form.department}
                    onChange={update('department')}
                    className="input"
                    placeholder="e.g. Talent Acquisition"
                    aria-invalid={Boolean(fieldErrors.department)}
                  />
                  {fieldErrors.department ? <p className="hint text-rose-600">{fieldErrors.department}</p> : null}
                </div>
                <div>
                  <label className="label" htmlFor="jobTitle">
                    Job title
                  </label>
                  <input
                    id="jobTitle"
                    value={form.jobTitle}
                    onChange={update('jobTitle')}
                    className="input"
                    placeholder="e.g. Senior Analyst"
                    aria-invalid={Boolean(fieldErrors.jobTitle)}
                  />
                  {fieldErrors.jobTitle ? <p className="hint text-rose-600">{fieldErrors.jobTitle}</p> : null}
                </div>
              </div>

              <div>
                <label className="label" htmlFor="avatarUrl">
                  Avatar URL <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id="avatarUrl"
                  value={form.avatarUrl}
                  onChange={update('avatarUrl')}
                  className="input"
                  placeholder="https://…"
                  aria-invalid={Boolean(fieldErrors.avatarUrl)}
                />
                {fieldErrors.avatarUrl ? <p className="hint text-rose-600">{fieldErrors.avatarUrl}</p> : null}
                <p className="hint">Leave empty to fall back to your initials.</p>
              </div>

              <div>
                <label className="label" htmlFor="bio">
                  Bio
                </label>
                <textarea
                  id="bio"
                  rows={3}
                  value={form.bio}
                  onChange={update('bio')}
                  className="input resize-y"
                  placeholder="What do you work on, and what kind of problems do you like solving?"
                  aria-invalid={Boolean(fieldErrors.bio)}
                />
                <div className="flex items-center justify-between">
                  {fieldErrors.bio ? <p className="hint text-rose-600">{fieldErrors.bio}</p> : <span />}
                  <p className="hint">{form.bio.trim().length}/280</p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-5">
              <button type="submit" disabled={saveProfile.loading || !dirty} className="btn-primary">
                {saveProfile.loading ? <Spinner /> : null}
                {saveProfile.loading ? 'Saving…' : 'Save changes'}
              </button>
              {dirty ? (
                <button
                  type="button"
                  onClick={() => {
                    setForm({
                      name: user.name ?? '',
                      department: user.department ?? '',
                      jobTitle: user.jobTitle ?? '',
                      bio: user.bio ?? '',
                      avatarUrl: user.avatarUrl ?? '',
                    });
                    setFieldErrors({});
                    setFlash(null);
                    setError(null);
                  }}
                  className="btn-ghost"
                >
                  Reset
                </button>
              ) : (
                <p className="text-xs text-slate-400">No unsaved changes</p>
              )}
            </div>
          </form>
        </div>

        {/* Security */}
        <div className="lg:col-span-2">
          <form onSubmit={handlePasswordSubmit} className="card p-6" noValidate>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Password</h2>
            <p className="mt-1.5 text-sm text-slate-500">
              At least {LIMITS.PASSWORD_MIN} characters, mixing letters and numbers.
            </p>

            {pwFlash ? (
              <Alert tone={pwFlash.tone} className="mt-4" onDismiss={() => setPwFlash(null)}>
                {pwFlash.message}
              </Alert>
            ) : null}

            <div className="mt-5 space-y-4">
              <div>
                <label className="label" htmlFor="currentPassword">
                  Current password
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  value={pw.currentPassword}
                  onChange={(e) => {
                    setPw((prev) => ({ ...prev, currentPassword: e.target.value }));
                    setPwErrors((prev) => ({ ...prev, currentPassword: undefined }));
                  }}
                  className="input"
                  aria-invalid={Boolean(pwErrors.currentPassword)}
                />
                {pwErrors.currentPassword ? <p className="hint text-rose-600">{pwErrors.currentPassword}</p> : null}
              </div>

              <div>
                <label className="label" htmlFor="newPassword">
                  New password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={pw.newPassword}
                  onChange={(e) => {
                    setPw((prev) => ({ ...prev, newPassword: e.target.value }));
                    setPwErrors((prev) => ({ ...prev, newPassword: undefined }));
                  }}
                  className="input"
                  aria-invalid={Boolean(pwErrors.newPassword)}
                />
                {pwErrors.newPassword ? <p className="hint text-rose-600">{pwErrors.newPassword}</p> : null}
              </div>

              <div>
                <label className="label" htmlFor="confirmPassword">
                  Confirm new password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={pw.confirmPassword}
                  onChange={(e) => {
                    setPw((prev) => ({ ...prev, confirmPassword: e.target.value }));
                    setPwErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                  }}
                  className="input"
                  aria-invalid={Boolean(pwErrors.confirmPassword)}
                />
                {pwErrors.confirmPassword ? <p className="hint text-rose-600">{pwErrors.confirmPassword}</p> : null}
              </div>
            </div>

            <button
              type="submit"
              disabled={changePassword.loading || !pw.currentPassword || !pw.newPassword}
              className="btn-dark mt-5 w-full"
            >
              {changePassword.loading ? <Spinner /> : null}
              {changePassword.loading ? 'Updating…' : 'Change password'}
            </button>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              Changing your password does not sign you out — your current session token stays valid until it expires.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
