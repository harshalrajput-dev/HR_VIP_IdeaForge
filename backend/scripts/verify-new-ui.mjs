/**
 * End-to-end verification of the endpoints newly wired into the UI.
 * Requires a running API (npm start in ./backend) and seeded demo data.
 *
 *   node scripts/verify-new-ui.mjs
 */
const BASE = (process.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

let pass = 0;
let fail = 0;

const check = (name, condition, extra = '') => {
  if (condition) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name}${extra ? `\n        ${extra}` : ''}`);
  }
};

const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ...json };
};

const run = async () => {
  console.log(`\nVerifying newly integrated UI endpoints against ${BASE}\n`);

  // --- log in as the seeded HR VIP ------------------------------------------
  const login = await call('POST', '/auth/login', {
    body: { email: 'admin@hrvip.com', password: 'Password123' },
  });
  check('HR VIP demo account can sign in', login.status === 200 && login.data?.token, `status ${login.status}`);
  if (login.status !== 200) {
    console.log('\nCannot continue without a session. Run `npm run seed` in ./backend first.\n');
    process.exit(1);
  }
  const adminToken = login.data.token;
  const adminId = login.data.user.id;

  const userLogin = await call('POST', '/auth/login', {
    body: { email: 'maya@hrvip.com', password: 'Password123' },
  });
  check('standard demo account can sign in', userLogin.status === 200 && userLogin.data?.token);
  const userToken = userLogin.data?.token;
  const userId = userLogin.data?.user.id;

  // --- PATCH /auth/me -------------------------------------------------------
  const original = login.data.user;
  const patched = await call('PATCH', '/auth/me', {
    token: adminToken,
    body: { jobTitle: 'Verified Principal HRVIP' },
  });
  check(
    'PATCH /auth/me updates the profile and returns a fresh token',
    patched.status === 200 && patched.data?.user?.jobTitle === 'Verified Principal HRVIP' && Boolean(patched.data?.token),
    `status ${patched.status} jobTitle=${patched.data?.user?.jobTitle}`
  );
  check('PATCH /auth/me keeps the email immutable', patched.data?.user?.email === original.email);

  const restored = await call('PATCH', '/auth/me', {
    token: adminToken,
    body: { jobTitle: original.jobTitle },
  });
  check('PATCH /auth/me can restore the original value', restored.status === 200);

  const badAvatar = await call('PATCH', '/auth/me', { token: adminToken, body: { avatarUrl: 'not-a-url' } });
  check('PATCH /auth/me rejects a malformed avatarUrl (422)', badAvatar.status === 422, `status ${badAvatar.status}`);

  // --- POST /auth/change-password -------------------------------------------
  const wrongPw = await call('POST', '/auth/change-password', {
    token: adminToken,
    body: { currentPassword: 'definitely-wrong', newPassword: 'NewPass123' },
  });
  check('change-password rejects a wrong current password (401)', wrongPw.status === 401, `status ${wrongPw.status}`);

  const samePw = await call('POST', '/auth/change-password', {
    token: adminToken,
    body: { currentPassword: 'Password123', newPassword: 'Password123' },
  });
  check('change-password rejects reusing the current password (400)', samePw.status === 400, `status ${samePw.status}`);

  const weakPw = await call('POST', '/auth/change-password', {
    token: adminToken,
    body: { currentPassword: 'Password123', newPassword: 'short1' },
  });
  check('change-password enforces the length policy (422)', weakPw.status === 422, `status ${weakPw.status}`);

  const anonPw = await call('POST', '/auth/change-password', {
    body: { currentPassword: 'Password123', newPassword: 'NewPass123' },
  });
  check('change-password requires authentication (401)', anonPw.status === 401, `status ${anonPw.status}`);

  // --- GET /auth/users/:id ---------------------------------------------------
  const pub = await call('GET', `/auth/users/${userId}`);
  check('GET /auth/users/:id is public (no token)', pub.status === 200, `status ${pub.status}`);
  check('GET /auth/users/:id never leaks the email', pub.data && pub.data.email === undefined, `email=${pub.data?.email}`);
  check(
    'GET /auth/users/:id returns the stats block the UI renders',
    pub.data?.stats && typeof pub.data.stats.ideas === 'number' && typeof pub.data.stats.projects === 'number',
    JSON.stringify(pub.data?.stats)
  );
  check('GET /auth/users/:id returns the point total', typeof pub.data?.points === 'number');

  const pubMissing = await call('GET', '/auth/users/507f1f77bcf86cd7994390ff');
  check('GET /auth/users/:id 404s for an unknown id', pubMissing.status === 404, `status ${pubMissing.status}`);

  // --- GET /admin/options ---------------------------------------------------
  const options = await call('GET', '/admin/options', { token: adminToken });
  check('GET /admin/options requires HR VIP (anonymous -> 401)', (await call('GET', '/admin/options')).status === 401);
  check('GET /admin/options returns the enum lists', options.status === 200 && options.data?.categories?.length === 9, `status ${options.status}`);
  check(
    'GET /admin/options covers categories, statuses, roles and the default team',
    Array.isArray(options.data?.categories) &&
      Array.isArray(options.data?.statuses) &&
      Array.isArray(options.data?.roles) &&
      typeof options.data?.defaultDevelopedBy === 'string',
    JSON.stringify(options.data)
  );
  check(
    'GET /admin/options is admin-only (standard user -> 403)',
    (await call('GET', '/admin/options', { token: userToken })).status === 403
  );

  // --- GET /admin/projects + PATCH /admin/projects/:id ----------------------
  const projects = await call('GET', '/admin/projects?limit=50', { token: adminToken });
  check('GET /admin/projects lists published projects', projects.status === 200 && Array.isArray(projects.data), `status ${projects.status}`);
  check('GET /admin/projects returns pagination meta', projects.meta?.hasOwnProperty('totalPages'));

  const target = projects.data?.[0];
  if (target) {
    const beforeImpact = target.impact || '';
    const probe = `[verify-${Date.now()}]`;

    const edited = await call('PATCH', `/admin/projects/${target.id}`, {
      token: adminToken,
      body: { impact: `${beforeImpact} ${probe}`.trim(), isFeatured: !target.isFeatured },
    });
    check('PATCH /admin/projects/:id saves', edited.status === 200 && edited.data?.id === target.id, `status ${edited.status}`);
    check(
      'PATCH /admin/projects/:id applies the new values',
      (edited.data?.impact || '').includes(probe) && edited.data?.isFeatured === !target.isFeatured,
      `impact=${edited.data?.impact}`
    );

    const metricsEdit = await call('PATCH', `/admin/projects/${target.id}`, {
      token: adminToken,
      body: { metrics: { verificationProbe: 7 } },
    });
    check('PATCH /admin/projects/:id round-trips metrics', metricsEdit.status === 200, `status ${metricsEdit.status}`);

    const badLink = await call('PATCH', `/admin/projects/${target.id}`, {
      token: adminToken,
      body: { projectLink: 'ftp://nope' },
    });
    check('PATCH /admin/projects/:id rejects a non-http(s) link (422)', badLink.status === 422, `status ${badLink.status}`);

    const anonEdit = await call('PATCH', `/admin/projects/${target.id}`, { body: { impact: 'hacked' } });
    check('PATCH /admin/projects/:id requires auth (401)', anonEdit.status === 401, `status ${anonEdit.status}`);

    const userEdit = await call('PATCH', `/admin/projects/${target.id}`, {
      token: userToken,
      body: { impact: 'hacked' },
    });
    check('PATCH /admin/projects/:id is admin-only (standard user -> 403)', userEdit.status === 403, `status ${userEdit.status}`);

    // Restore.
    await call('PATCH', `/admin/projects/${target.id}`, {
      token: adminToken,
      body: { impact: beforeImpact, isFeatured: Boolean(target.isFeatured) },
    });
    const restoredProject = await call('GET', `/admin/projects?limit=1`, { token: adminToken });
    check('project state was restored after the test', restoredProject.status === 200);
  } else {
    console.log('  SKIP  no published project available to exercise PATCH /admin/projects/:id');
  }

  // --- GET /ideas/search/suggestions (the q -> search alias) ---------------
  const s1 = await call('GET', '/ideas/search/suggestions?q=zzzznomatchzzzz&limit=5');
  check('search/suggestions is reachable (not shadowed)', s1.status === 200, `status ${s1.status}`);
  check(
    'search/suggestions actually filters on q',
    s1.data?.length === 0,
    `expected 0 results, got ${s1.data?.length} — the q/search alias is not applied`
  );

  const s2 = await call('GET', '/ideas/search/suggestions?q=z');
  check('search/suggestions rejects a term under 2 chars (422)', s2.status === 422, `status ${s2.status}`);

  const ideasList = await call('GET', '/ideas?limit=50');
  const withTitle = (ideasList.data || []).find((i) => i.title && i.title.length > 3);
  if (withTitle) {
    const token = withTitle.title.split(/\s+/)[0].replace(/[^A-Za-z0-9]/g, '');
    if (token.length >= 2) {
      const s3 = await call('GET', `/ideas/search/suggestions?q=${encodeURIComponent(token)}&limit=5`);
      check(
        `search/suggestions returns matches for "${token}"`,
        s3.status === 200 && s3.data.some((i) => i.title.toLowerCase().includes(token.toLowerCase())),
        `status ${s3.status}, ${s3.data?.length} results`
      );
    }
  }

  // --- Regression: the feed filters still work -----------------------------
  const mine = await call('GET', '/ideas?mine=true', { token: userToken });
  check('GET /ideas?mine=true still filters by author', mine.status === 200 && Array.isArray(mine.data), `status ${mine.status}`);

  const anonMine = await call('GET', '/ideas?mine=true');
  check('GET /ideas?mine=true rejects anonymous access (401)', anonMine.status === 401, `status ${anonMine.status}`);

  const byAuthor = await call('GET', `/ideas?author=${userId}`);
  check(
    'GET /ideas?author= powers the contributor profile list',
    byAuthor.status === 200 && (byAuthor.data || []).every((i) => i.author?.id === userId),
    `status ${byAuthor.status}`
  );

  console.log(`\n${pass}/${pass + fail} checks passed\n`);
  if (fail) process.exitCode = 1;
};

run().catch((err) => {
  console.error('\nVerification crashed:', err.message);
  console.error('Is the backend running on port 5000 with seeded demo data?\n');
  process.exit(1);
});
