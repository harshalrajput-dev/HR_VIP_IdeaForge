/**
 * Server-render smoke test for the React client.
 *
 * Vite compiles the real source (JSX, `import.meta.env`, hooks) in SSR mode and
 * each page/component is rendered with react-dom/server. This catches broken
 * imports, undefined references and bad hook usage that a `vite build` alone
 * would not.
 *
 *   node scripts/ssr-smoke.jsx
 */
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement as h } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const checks = [];
const check = (name, fn) => {
  try {
    fn();
    checks.push(`  PASS  ${name}`);
  } catch (err) {
    checks.push(`  FAIL  ${name}\n        ${err.message}`);
    process.exitCode = 1;
  }
};

/** Minimal window/localStorage shim so browser-only globals resolve in Node. */
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    localStorage: {
      _v: {},
      getItem(k) {
        return this._v[k] ?? null;
      },
      setItem(k, v) {
        this._v[k] = String(v);
      },
      removeItem(k) {
        delete this._v[k];
      },
    },
    scrollTo() {},
    addEventListener() {},
    removeEventListener() {},
  };
}

// Node >= 21 exposes a read-only `navigator`; only define it when missing.
if (typeof globalThis.navigator === 'undefined') {
  globalThis.navigator = { onLine: true };
}

const run = async () => {
  const vite = await createServer({
    configFile: false,
    root: process.cwd(),
    logLevel: 'error',
    server: { middlewareMode: true },
    plugins: [react()],
  });

  const load = (path) => vite.ssrLoadModule(path);

  const [
    { default: App },
    { AuthProvider },
    { default: Navbar },
    { default: Footer },
    { default: IdeaCard },
    { default: DiscussionThread, CommentItem },
    { default: ProjectCredits },
    { default: Home },
    { default: IdeaDetails },
    { default: CreateIdea },
    { default: AdminDashboard },
    { default: WallOfFame },
    { default: Profile },
    { default: ContributorProfile },
    { default: UserLink },
    { default: Login },
    { default: Register },
    { default: NotFound },
  ] = await Promise.all([
    load('/src/App.jsx'),
    load('/src/context/AuthContext.jsx'),
    load('/src/components/Navbar.jsx'),
    load('/src/components/Footer.jsx'),
    load('/src/components/IdeaCard.jsx'),
    load('/src/components/DiscussionThread.jsx'),
    load('/src/components/ProjectCredits.jsx'),
    load('/src/pages/Home.jsx'),
    load('/src/pages/IdeaDetails.jsx'),
    load('/src/pages/CreateIdea.jsx'),
    load('/src/pages/AdminDashboard.jsx'),
    load('/src/pages/WallOfFame.jsx'),
    load('/src/pages/Profile.jsx'),
    load('/src/pages/ContributorProfile.jsx'),
    load('/src/components/UserLink.jsx'),
    load('/src/pages/Login.jsx'),
    load('/src/pages/Register.jsx'),
    load('/src/pages/NotFound.jsx'),
  ]);

  const render = (element, route = '/') =>
    renderToStaticMarkup(
      h(
        MemoryRouter,
        { initialEntries: [route] },
        h(AuthProvider, null, element)
      )
    );

  /** Seeds the persisted session so auth-gated components render signed-in. */
  const SESSION_USER = {
    id: '507f1f77bcf86cd799439011',
    name: 'Maya Iyer',
    email: 'maya@hrvip.com',
    role: 'user',
    isAdmin: false,
    points: 120,
    department: 'Data & Analytics',
    jobTitle: 'Senior Analyst',
    avatarUrl: '',
    bio: 'I like unglamorous data problems.',
    createdAt: new Date(Date.now() - 86_400_000 * 30).toISOString(),
  };
  const withSession = (user = SESSION_USER) => {
    window.localStorage.setItem('hrvip:token', 'test.token.value');
    window.localStorage.setItem('hrvip:user', JSON.stringify(user));
  };
  const clearSession = () => {
    window.localStorage.removeItem('hrvip:token');
    window.localStorage.removeItem('hrvip:user');
  };

  /** Same as render() but mounts inside a real <Route> so useParams() resolves. */
  const renderAtRoute = (element, pathPattern, route) =>
    renderToStaticMarkup(
      h(
        MemoryRouter,
        { initialEntries: [route] },
        h(AuthProvider, null, h(Routes, null, h(Route, { path: pathPattern, element })))
      )
    );

  const sampleIdea = {
    id: '507f1f77bcf86cd799439011',
    title: 'Payroll dashboard times out during the December bonus run',
    description: 'Every December the payroll dashboard throws a 504 gateway timeout because it aggregates 11 months of payslips in one synchronous request.',
    category: 'Software Bug',
    status: 'In Discussion',
    priority: 'Critical',
    tags: ['payroll', 'performance'],
    upvoteCount: 12,
    commentCount: 4,
    upvotedByMe: false,
    createdAt: new Date(Date.now() - 3600_000).toISOString(),
    author: { id: 'u1', name: 'Ananya Rao', role: 'user', department: 'Data & Analytics', points: 120 },
  };

  const sampleCredits = {
    id: 'c1',
    title: 'Leave tracker and the HR portal show different balances',
    summary: 'Nightly reconciliation between the HR portal snapshot and live HRMS balances.',
    impact: 'Leave-related HR tickets dropped ~85% in the first month.',
    developedBy: 'HR VIP Team',
    projectLink: 'https://intranet.hrvip.local/leave-reconciliation',
    techStack: ['Node.js', 'MongoDB'],
    metrics: { ticketsReducedWeekly: 13 },
    publishedAt: new Date(Date.now() - 86400_000).toISOString(),
    originalIdeaBy: { name: 'Ananya Rao', jobTitle: 'Data Analyst' },
    originalIdeaByName: 'Ananya Rao',
    contributors: [
      { name: 'Maya Iyer', role: 'Solution Author', note: 'Crowned best solution', user: { name: 'Maya Iyer' } },
      { name: 'Dev Patel', role: 'Co-Solver', user: { name: 'Dev Patel' } },
    ],
    idea: { id: 'idea-1' },
  };

  check('App module loads and exports a component (needs a DOM to render)', () => {
    if (typeof App !== 'function') throw new Error('App is not a component');
  });

  check('Navbar renders brand + anonymous actions', () => {
    const html = renderToStaticMarkup(
      h(MemoryRouter, null, h(AuthProvider, null, h(Navbar)))
    );
    if (!html.includes('HR VIP IdeaForge')) throw new Error('brand missing');
    if (!html.includes('Join IdeaForge')) throw new Error('logged-out CTA missing');
  });

  check('Footer renders the 5-stage lifecycle legend', () => {
    const html = renderToStaticMarkup(h(MemoryRouter, null, h(AuthProvider, null, h(Footer))));
    ['Submitted', 'In Discussion', 'Under HR VIP Review', 'Approved', 'Completed'].forEach((s) => {
      if (!html.includes(s)) throw new Error(`missing stage: ${s}`);
    });
  });

  check('IdeaCard renders title, status badge, tags and upvote count', () => {
    const html = renderToStaticMarkup(
      h(MemoryRouter, null, h(AuthProvider, null, h(IdeaCard, { idea: sampleIdea, onUpvote: () => {} })))
    );
    if (!html.includes(sampleIdea.title)) throw new Error('title missing');
    if (!html.includes('In Discussion')) throw new Error('status badge missing');
    if (!html.includes('#payroll')) throw new Error('tags missing');
    if (!html.includes('12')) throw new Error('upvote count missing');
    if (!html.includes('Ananya Rao')) throw new Error('author missing');
  });

  check('ProjectCredits renders all three mandated credit blocks', () => {
    const html = renderToStaticMarkup(
      h(MemoryRouter, null, h(AuthProvider, null, h(ProjectCredits, { credits: sampleCredits })))
    );
    if (!html.includes('Original idea by')) throw new Error('missing "Original Idea By"');
    if (!html.includes('Key contributors')) throw new Error('missing "Key Contributors"');
    if (!html.includes('Developed by')) throw new Error('missing "Developed By"');
    if (!html.includes('Ananya Rao')) throw new Error('original author missing');
    if (!html.includes('Maya Iyer')) throw new Error('contributor missing');
    if (!html.includes('HR VIP Team')) throw new Error('developed-by team missing');
  });

  check('DiscussionThread shows a loading skeleton before data arrives', () => {
    const html = render(h(DiscussionThread, { ideaId: 'x', canMarkBest: false }));
    if (!html.includes('skeleton')) throw new Error('expected skeleton placeholders');
  });

  check('CommentItem renders a normal solution without moderation controls', () => {
    const comment = {
      id: 'c1',
      text: 'A reconciliation worker fixed this in a week.',
      isBestSolution: false,
      createdAt: new Date(Date.now() - 7200_000).toISOString(),
      userId: { name: 'Maya Iyer', role: 'user', jobTitle: 'Senior Software Engineer' },
    };
    const html = renderToStaticMarkup(
      h(
        MemoryRouter,
        null,
        h(AuthProvider, null, h('ol', null, h(CommentItem, { comment, currentUserId: 'someone-else' })))
      )
    );
    if (!html.includes('A reconciliation worker')) throw new Error('comment body missing');
    if (!html.includes('Maya Iyer')) throw new Error('author missing');
    if (html.includes('Mark best solution')) throw new Error('non-moderator should not see the crown button');
  });

  check('CommentItem highlights the best solution and offers the crown toggle', () => {
    const best = {
      id: 'c2',
      text: 'Root cause found: the query does a collection scan per employee.',
      isBestSolution: true,
      bestMarkedAt: new Date(Date.now() - 3600_000).toISOString(),
      createdAt: new Date(Date.now() - 86400_000).toISOString(),
      userId: { name: 'Dev Patel', role: 'user' },
    };
    const html = renderToStaticMarkup(
      h(
        MemoryRouter,
        null,
        h(AuthProvider, null, h('ol', null, h(CommentItem, { comment: best, currentUserId: 'u1', canMarkBest: true })))
      )
    );
    if (!html.includes('Best solution')) throw new Error('best-solution marker missing');
    if (!html.includes('unmark')) throw new Error('unmark toggle missing');
    if (!html.includes('Dev Patel')) throw new Error('author missing');
  });

  check('CommentItem shows edit/delete only to the comment owner', () => {
    const own = {
      id: 'c3',
      text: 'My own comment.',
      createdAt: new Date().toISOString(),
      userId: { name: 'Me', role: 'user', id: 'me' },
    };
    const html = renderToStaticMarkup(
      h(
        MemoryRouter,
        null,
        h(AuthProvider, null, h('ol', null, h(CommentItem, { comment: own, currentUserId: 'me' })))
      )
    );
    if (!html.includes('Edit')) throw new Error('owner should see Edit');
    if (!html.includes('Delete')) throw new Error('owner should see Delete');
  });

  check('Home renders the hero and the full idea catalogue', () => {
    const html = render(h(Home));
    if (!html.includes('Turn complaints into')) throw new Error('hero headline missing');
    if (!html.includes('AI &amp; Emerging Tech')) throw new Error('category filter missing');
    if (!html.includes('Under HR VIP Review')) throw new Error('status lifecycle missing');
  });

  check('IdeaDetails renders its loading shell at /ideas/:id', () => {
    const html = render(h(IdeaDetails), '/ideas/507f1f77bcf86cd799439011');
    if (typeof html !== 'string') throw new Error('expected markup string');
  });

  check('CreateIdea renders the form with category picker', () => {
    const html = render(h(CreateIdea));
    if (!html.includes('Submit an idea')) throw new Error('heading missing');
    if (!html.includes('What is the problem?')) throw new Error('description field missing');
    if (!html.includes('Publish idea')) throw new Error('submit button missing');
  });

  check('AdminDashboard renders the HR VIP panel', () => {
    const html = render(h(AdminDashboard));
    if (!html.includes('Review &amp; ship')) throw new Error('panel heading missing');
    if (!html.includes('HR VIP employee panel')) throw new Error('badge missing');
  });

  check('WallOfFame renders the empty showcase state', () => {
    const html = render(h(WallOfFame));
    if (!html.includes('Wall of Fame')) throw new Error('heading missing');
    if (!html.includes('Original Idea By')) throw new Error('credit promise copy missing');
  });

  check('Login renders sign-in form + demo account shortcuts', () => {
    const html = render(h(Login), '/login');
    if (!html.includes('Welcome back')) throw new Error('heading missing');
    if (!html.includes('admin@hrvip.com')) throw new Error('demo account missing');
  });

  check('Register renders the sign-up form + password strength meter', () => {
    const html = render(h(Register), '/register');
    if (!html.includes('Join the forge')) throw new Error('heading missing');
    if (!html.includes('Full name')) throw new Error('name field missing');
  });

  check('NotFound renders the 404 page', () => {
    const html = render(h(NotFound), '/nope');
    if (!html.includes('404')) throw new Error('404 missing');
  });

  /* ---------------------------------------------------------------------- */
  /* Newly integrated endpoints                                             */
  /* ---------------------------------------------------------------------- */

  check('Profile renders both the details and password forms', () => {
    withSession();
    try {
      const html = render(h(Profile), '/profile');
      ['Profile details', 'Change password', 'Current password', 'New password', 'Save changes'].forEach((s) => {
        if (!html.includes(s)) throw new Error(`missing: ${s}`);
      });
      if (!html.includes('maya@hrvip.com')) throw new Error('session email missing');
      if (!html.includes('/people/507f1f77bcf86cd799439011')) throw new Error('public profile link missing');
    } finally {
      clearSession();
    }
  });

  check('Profile renders nothing when signed out', () => {
    clearSession();
    const html = render(h(Profile), '/profile');
    if (html.length !== 0) throw new Error('expected an empty render without a session');
  });

  check('ContributorProfile shows a loading shell for a valid id', () => {
    const html = renderAtRoute(h(ContributorProfile), '/people/:id', '/people/507f1f77bcf86cd799439011');
    if (!html.includes('skeleton')) throw new Error('expected skeleton placeholders');
  });

  check('ContributorProfile rejects a malformed id before calling the API', () => {
    const html = renderAtRoute(h(ContributorProfile), '/people/:id', '/people/not-an-object-id');
    if (!html.includes('not valid')) throw new Error('expected the invalid-link state');
  });

  check('UserLink points at the public profile for a real id', () => {
    const html = renderToStaticMarkup(
      h(MemoryRouter, null, h(UserLink, { user: { id: '507f1f77bcf86cd799439011', name: 'Maya Iyer' } }))
    );
    if (!html.includes('href="/people/507f1f77bcf86cd799439011"')) throw new Error('missing profile href');
    if (!html.includes('Maya Iyer')) throw new Error('missing name');
  });

  check('UserLink degrades to plain text when the id is missing', () => {
    const html = renderToStaticMarkup(
      h(MemoryRouter, null, h(UserLink, { user: { name: 'Deleted User' } }))
    );
    if (html.includes('href')) throw new Error('should not render a link without an id');
    if (!html.includes('Deleted User')) throw new Error('missing name');
  });

  check('AdminDashboard exposes the published-projects tab', () => {
    const html = render(h(AdminDashboard), '/admin');
    if (!html.includes('Published projects')) throw new Error('projects tab missing');
  });

  await vite.close();

  console.log('\nHR VIP IdeaForge - client render smoke test\n');
  console.log(checks.join('\n'));
  console.log(`\n${checks.filter((c) => c.includes('PASS')).length}/${checks.length} checks passed\n`);
};

run().catch((err) => {
  console.error('Render smoke test crashed:', err);
  process.exit(1);
});
