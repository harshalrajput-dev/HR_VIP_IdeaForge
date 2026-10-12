import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Alert, Spinner } from '../components/Feedback';
import { CategoryChip } from '../components/StatusBadge';
import api from '../services/api';
import { useMutation } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { CATEGORIES, LIMITS, PRIORITIES, PRIORITY_STYLES } from '../utils/constants';
import { cn } from '../utils/format';

const CATEGORY_HINTS = {
  'Software Bug': 'Something is broken and you can reproduce it.',
  'Software Limitation': 'The tool works, but it cannot do what you need.',
  'Process Improvement': 'A workflow that wastes time, money or goodwill.',
  Automation: 'A manual step that a script or workflow could own.',
  'Data & Analytics': 'Reporting, dashboards, data quality or access.',
  'AI & Emerging Tech': 'Opportunities where newer tooling could help.',
  'Training & Culture': 'Onboarding, learning, documentation or process.',
  'Workplace & Facilities': 'Physical workspace, hardware or logistics.',
  Other: 'Anything that does not fit the other categories.',
};

/** Form for raising a new idea, bug or software limitation. */
export default function CreateIdea() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Software Bug',
    priority: 'Medium',
    tags: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);

  const { mutate, loading } = useMutation((payload) => api.post('/ideas', payload));

  const parsedTags = useMemo(
    () =>
      form.tags
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean)
        .slice(0, 8),
    [form.tags]
  );

  const update = (key) => (e) => {
    const { value } = e.target;
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = () => {
    const errors = {};
    const title = form.title.trim();
    const description = form.description.trim();

    if (title.length < LIMITS.TITLE_MIN) errors.title = `At least ${LIMITS.TITLE_MIN} characters`;
    if (title.length > LIMITS.TITLE_MAX) errors.title = `At most ${LIMITS.TITLE_MAX} characters`;
    if (description.length < LIMITS.DESCRIPTION_MIN) errors.description = `At least ${LIMITS.DESCRIPTION_MIN} characters`;
    if (description.length > LIMITS.DESCRIPTION_MAX) errors.description = `At most ${LIMITS.DESCRIPTION_MAX} characters`;

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    if (!validate()) return;

    try {
      const res = await mutate({
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        priority: form.priority,
        tags: parsedTags,
      });
      navigate(`/ideas/${res.data.id}`, { replace: true });
    } catch (err) {
      setError(err);
      setFieldErrors(err.fieldErrors || {});
    }
  };

  return (
    <div className="container-app py-10">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <Link to="/" className="text-sm font-medium text-slate-500 hover:text-forge-600">
            ← Back to the feed
          </Link>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Submit an idea</h1>
          <p className="mt-2 text-sm text-slate-500">
            Posting as <span className="font-semibold text-slate-700">{user?.name}</span>. The clearer the problem, the
            faster somebody solves it. Your idea starts as <strong>Submitted</strong> and moves to{' '}
            <strong>In Discussion</strong> as soon as the first solution lands.
          </p>
        </div>

        {error ? (
          <Alert tone="error" className="mb-6" title="Could not publish your idea">
            {error.message}
          </Alert>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <div className="card p-6">
            {/* Title */}
            <div>
              <label className="label" htmlFor="title">
                Title
              </label>
              <input
                id="title"
                required
                value={form.title}
                onChange={update('title')}
                className="input"
                placeholder="e.g. Payroll dashboard times out during the December bonus run"
                aria-invalid={Boolean(fieldErrors.title)}
              />
              <div className="mt-1 flex justify-between">
                <p className={cn('hint', fieldErrors.title && 'text-rose-600')}>
                  {fieldErrors.title || 'Write it as a single searchable sentence.'}
                </p>
                <p className="hint">
                  {form.title.trim().length}/{LIMITS.TITLE_MAX}
                </p>
              </div>
            </div>

            {/* Category */}
            <div className="mt-5">
              <span className="label">Category</span>
              <div className="grid gap-2 sm:grid-cols-3">
                {CATEGORIES.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, category }))}
                    className={cn(
                      'rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition',
                      form.category === category
                        ? 'border-forge-400 bg-forge-50 text-forge-800 ring-1 ring-inset ring-forge-300'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    )}
                    aria-pressed={form.category === category}
                  >
                    {category}
                  </button>
                ))}
              </div>
              <p className="hint">{CATEGORY_HINTS[form.category]}</p>
            </div>

            {/* Priority */}
            <div className="mt-5">
              <span className="label">Business impact</span>
              <div className="flex flex-wrap gap-2">
                {PRIORITIES.map((priority) => (
                  <button
                    key={priority}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, priority }))}
                    className={cn(
                      'chip px-3.5 py-2 font-semibold ring-1 ring-inset transition',
                      form.priority === priority
                        ? PRIORITY_STYLES[priority]
                        : 'bg-white text-slate-500 ring-slate-200 hover:bg-slate-50'
                    )}
                    aria-pressed={form.priority === priority}
                  >
                    {priority}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="mt-5">
              <label className="label" htmlFor="description">
                What is the problem?
              </label>
              <textarea
                id="description"
                required
                rows={8}
                value={form.description}
                onChange={update('description')}
                className="input resize-y font-normal leading-relaxed"
                placeholder={'Describe what you were trying to do, what happened instead, and the impact on your work.\n\nThe best posts include:\n  1. What you expected to happen\n  2. What actually happened\n  3. Who is affected and how often'}
                aria-invalid={Boolean(fieldErrors.description)}
              />
              <div className="mt-1 flex justify-between">
                <p className={cn('hint', fieldErrors.description && 'text-rose-600')}>
                  {fieldErrors.description || 'Minimum 20 characters. Include steps to reproduce if it is a bug.'}
                </p>
                <p className="hint">
                  {form.description.trim().length}/{LIMITS.DESCRIPTION_MAX}
                </p>
              </div>
            </div>

            {/* Tags */}
            <div className="mt-5">
              <label className="label" htmlFor="tags">
                Tags <span className="font-normal text-slate-400">(optional, comma separated, max 8)</span>
              </label>
              <input
                id="tags"
                value={form.tags}
                onChange={update('tags')}
                className="input"
                placeholder="payroll, performance, december"
              />
              {parsedTags.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {parsedTags.map((tag) => (
                    <span key={tag} className="chip bg-slate-100 text-slate-600">
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {/* Summary + actions */}
          <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryChip category={form.category} />
              <span className={cn('chip ring-1 ring-inset', PRIORITY_STYLES[form.priority])}>
                {form.priority} impact
              </span>
              <span className="chip bg-slate-100 text-slate-600">+10 pts on submit</span>
            </div>
            <div className="flex gap-2">
              <Link to="/" className="btn-ghost">
                Cancel
              </Link>
              <button type="submit" disabled={loading} className="btn-primary px-6">
                {loading ? <Spinner /> : null}
                {loading ? 'Publishing…' : 'Publish idea'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
