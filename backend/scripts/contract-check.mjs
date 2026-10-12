/**
 * Live contract check: replays every API call the React client makes against a
 * running server + real MongoDB, asserting the response shapes the components
 * actually destructure.
 *
 * Requires a running API with the seed data loaded:
 *   npm run seed:fresh && npm start   (in another shell)
 *   npm run test:contract
 */
const BASE = process.env.API_URL || 'http://localhost:5000/api';

let pass = 0;
const results = [];
const check = (name, fn) => {
  try {
    fn();
    pass += 1;
    results.push(`  PASS  ${name}`);
  } catch (err) {
    results.push(`  FAIL  ${name}\n        ${err.message}`);
    process.exitCode = 1;
  }
};
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const call = async (path, { method = 'GET', token, body } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
};

const run = async () => {
  // ---- Home page -------------------------------------------------------
  const filters = await call('/ideas/meta/filters');
  check('GET /ideas/meta/filters -> categories + statuses arrays', () => {
    assert(filters.status === 200, `status ${filters.status}`);
    assert(Array.isArray(filters.json.data.categories), 'categories not an array');
    assert(Array.isArray(filters.json.data.statuses), 'statuses not an array');
    assert(filters.json.data.categories.includes('Automation'), 'missing Automation');
    assert(filters.json.data.statuses.length === 5, 'expected 5 statuses');
    assert(filters.json.data.countsByStatus, 'countsByStatus missing');
  });

  const feed = await call('/ideas?page=1&limit=12&sort=-createdAt');
  check('GET /ideas -> feed shape consumed by IdeaCard', () => {
    assert(feed.status === 200, `status ${feed.status}`);
    assert(Array.isArray(feed.json.data), 'data not an array');
    assert(feed.json.meta.total >= 6, `expected >=6 ideas, got ${feed.json.meta.total}`);
    feed.json.data.forEach((idea) => {
      assert(idea.id, 'idea missing id');
      assert(idea.title && idea.description, 'idea missing title/description');
      assert(idea.status && idea.category, 'idea missing status/category');
      assert(typeof idea.upvoteCount === 'number', 'upvoteCount must be a number');
      assert(typeof idea.commentCount === 'number', 'commentCount must be a number');
      assert('upvotedByMe' in idea, 'upvotedByMe missing');
      assert(idea.author && idea.author.name, 'author not populated');
    });
  });

  const filtered = await call('/ideas?status=Completed&category=Software%20Bug');
  check('GET /ideas?status&category -> filtered feed', () => {
    assert(filtered.status === 200, `status ${filtered.status}`);
    assert(filtered.json.data.length === 1, `expected 1, got ${filtered.json.data.length}`);
    assert(filtered.json.data[0].status === 'Completed', 'wrong status returned');
  });

  const searched = await call('/ideas?search=payroll');
  check('GET /ideas?search -> keyword search', () => {
    assert(searched.json.data.length >= 1, 'search returned nothing');
  });

  const paginated = await call('/ideas?page=1&limit=2');
  check('GET /ideas?limit -> pagination meta for Pagination.jsx', () => {
    const m = paginated.json.meta;
    ['page', 'limit', 'total', 'totalPages', 'hasNextPage', 'hasPrevPage'].forEach((k) =>
      assert(k in m, `meta.${k} missing`)
    );
    assert(m.limit === 2, 'limit not honoured');
    assert(m.hasNextPage === true, 'hasNextPage should be true');
    assert(m.hasPrevPage === false, 'hasPrevPage should be false');
  });

  // ---- Auth ------------------------------------------------------------
  const mayaLogin = await call('/auth/login', {
    method: 'POST',
    body: { email: 'maya@hrvip.com', password: 'Password123' },
  });
  check('POST /auth/login -> token + profile used by AuthContext', () => {
    assert(mayaLogin.status === 200, `status ${mayaLogin.status}`);
    const { user, token } = mayaLogin.json.data;
    assert(token && token.split('.').length === 3, 'token is not a JWT');
    ['id', 'name', 'email', 'role', 'isAdmin', 'points'].forEach((k) => assert(k in user, `user.${k} missing`));
    assert(user.isAdmin === false, 'maya should not be admin');
  });
  const maya = mayaLogin.json.data.token;

  const adminLogin = await call('/auth/login', {
    method: 'POST',
    body: { email: 'admin@hrvip.com', password: 'Password123' },
  });
  check('POST /auth/login (HR VIP) -> isAdmin true', () => {
    assert(adminLogin.json.data.user.isAdmin === true, 'admin should have isAdmin true');
    assert(adminLogin.json.data.user.role === 'hr_vip_employee', 'wrong role');
  });
  const admin = adminLogin.json.data.token;

  const me = await call('/auth/me', { token: maya });
  check('GET /auth/me -> restored session profile', () => {
    assert(me.status === 200, `status ${me.status}`);
    assert(me.json.data.user.email === 'maya@hrvip.com', 'wrong user');
  });

  const anonMe = await call('/auth/me');
  check('GET /auth/me (anon) -> 401 for the axios interceptor', () => {
    assert(anonMe.status === 401, `status ${anonMe.status}`);
  });

  // ---- IdeaDetails + DiscussionThread ----------------------------------
  const allIdeas = await call('/ideas?limit=50', { token: maya });

  // This script mutates data (comments, votes, publish, status moves), so it
  // only runs against a freshly seeded database.
  const hasStatus = (status) => allIdeas.json.data.some((i) => i.status === status);
  if (!hasStatus('In Discussion') || !hasStatus('Approved')) {
    console.error('\nContract check needs pristine seed data.');
    console.error('Run `npm run seed:fresh` (backend) and start the API again.\n');
    process.exit(1);
  }

  const target = allIdeas.json.data.find((i) => i.status === 'In Discussion');
  check('seeded data contains an in-discussion idea', () => assert(target, 'none found'));

  const detail = await call(`/ideas/${target.id}`, { token: maya });
  check('GET /ideas/:id -> permissions block used by IdeaDetails', () => {
    assert(detail.status === 200, `status ${detail.status}`);
    const d = detail.json.data;
    assert(d.permissions, 'permissions missing');
    ['canEdit', 'canModerate', 'canMarkBest'].forEach((k) => assert(k in d.permissions, `permissions.${k} missing`));
    assert(d.permissions.canEdit === false, 'maya did not author this idea');
    assert(d.permissions.canMarkBest === false, 'non-author non-admin must not mark best');
    assert(typeof d.commentCount === 'number', 'commentCount missing');
    assert(d.author.name, 'author not populated');
  });

  const comments = await call(`/ideas/${target.id}/comments`);
  check('GET /ideas/:id/comments -> thread shape used by DiscussionThread', () => {
    assert(comments.status === 200, `status ${comments.status}`);
    assert(Array.isArray(comments.json.data), 'comments not an array');
    assert(comments.json.data.length >= 2, 'expected seeded comments');
    comments.json.data.forEach((c) => {
      assert(c.id && c.text, 'comment missing id/text');
      assert('isBestSolution' in c, 'isBestSolution missing');
      assert(c.userId && c.userId.name, 'comment author not populated');
    });
    assert(comments.json.meta.ideaStatus, 'meta.ideaStatus missing');
  });

  const newComment = await call(`/ideas/${target.id}/comments`, {
    method: 'POST',
    token: maya,
    body: { text: 'Contract check comment: verified the fix works in staging for two consecutive runs.' },
  });
  check('POST /ideas/:id/comments -> 201 with ideaStatus feedback', () => {
    assert(newComment.status === 201, `status ${newComment.status}`);
    assert(newComment.json.data.userId.name === 'Maya Iyer', 'author not echoed');
    assert(newComment.json.data.ideaStatus, 'ideaStatus missing');
  });

  // Upvote toggle
  const upTarget = allIdeas.json.data.find(
    (i) => i.author.id !== me.json.data.user.id && i.upvotedByMe === false
  );
  const before = upTarget.upvoteCount;
  const up1 = await call(`/ideas/${upTarget.id}/upvote`, { method: 'POST', token: maya });
  const up2 = await call(`/ideas/${upTarget.id}/upvote`, { method: 'POST', token: maya });
  check('POST /ideas/:id/upvote -> toggles on then off', () => {
    assert(up1.json.data.upvotedByMe === true, 'first upvote should register');
    assert(up1.json.data.upvoteCount === before + 1, `expected ${before + 1}, got ${up1.json.data.upvoteCount}`);
    assert(up2.json.data.upvotedByMe === false, 'second call should remove the vote');
    assert(up2.json.data.upvoteCount === before, 'count should return to original');
  });

  // ---- AdminDashboard ---------------------------------------------------
  const dash = await call('/admin/dashboard', { token: admin });
  check('GET /admin/dashboard -> Overview tab shape', () => {
    assert(dash.status === 200, `status ${dash.status}`);
    const d = dash.json.data;
    ['Submitted', 'In Discussion', 'Under HR VIP Review', 'Approved', 'Completed'].forEach((s) =>
      assert(s in d.counts, `counts.${s} missing`)
    );
    ['ideas', 'users', 'comments', 'projects', 'needsReview', 'awaitingApproval', 'readyToShip'].forEach((k) =>
      assert(k in d.totals, `totals.${k} missing`)
    );
    assert(Array.isArray(d.topContributors) && d.topContributors[0].name, 'topContributors empty');
    assert(d.recentIdeas[0].id, 'recentIdeas missing id');
  });

  const denied = await call('/admin/dashboard', { token: maya });
  check('GET /admin/dashboard (standard user) -> 403', () => {
    assert(denied.status === 403, `status ${denied.status}`);
  });

  const queue = await call('/admin/ideas?status=Approved&limit=10', { token: admin });
  check('GET /admin/ideas?status=Approved -> Publish tab select options', () => {
    assert(queue.status === 200, `status ${queue.status}`);
    assert(queue.json.data.length >= 1, 'no approved idea to publish');
    queue.json.data.forEach((i) => {
      assert(i.id && i.title, 'queue item missing id/title');
      assert('upvoteCount' in i && 'commentCount' in i, 'queue item counters missing');
    });
  });

  const publishTarget = queue.json.data[0];

  // Real flow: HR VIP must crown a best solution before credits can be resolved.
  const targetComments = await call(`/ideas/${publishTarget.id}/comments`, { token: admin });
  const bestPick = targetComments.json.data[0];
  const crown = await call(`/comments/${bestPick.id}/mark-best`, { method: 'PATCH', token: admin });
  check('PATCH /comments/:id/mark-best -> crowns the solution', () => {
    assert(crown.status === 200, `status ${crown.status} ${JSON.stringify(crown.json).slice(0, 160)}`);
    assert(crown.json.data.comment.isBestSolution === true, 'comment not crowned');
    assert(crown.json.data.ideaBestSolution, 'ideaBestSolution missing for IdeaDetails');
  });

  const publish = await call('/admin/projects', {
    method: 'POST',
    token: admin,
    body: {
      ideaId: publishTarget.id,
      projectLink: 'https://intranet.hrvip.test/onboarding-flow',
      developedBy: 'HR VIP Team',
      techStack: ['Node.js', 'React'],
      impact: 'Onboarding kickoff moved from day 3 to day 0.',
      summary: 'Task-based onboarding workflow with owners, due dates and escalation.',
    },
  });
  check('POST /admin/projects -> credit record for the Wall of Fame', () => {
    assert(publish.status === 201, `status ${publish.status} ${JSON.stringify(publish.json).slice(0, 200)}`);
    const p = publish.json.data;
    assert(p.developedBy === 'HR VIP Team', 'developedBy wrong');
    assert(p.originalIdeaByName, 'originalIdeaByName missing');
    assert(Array.isArray(p.contributors) && p.contributors.length >= 1, 'no contributors resolved');
    p.contributors.forEach((c) => {
      assert(c.name, 'contributor name missing');
      assert(c.role, 'contributor role missing');
    });
  });

  const afterPublish = await call(`/ideas/${publishTarget.id}`, { token: admin });
  check('published idea flips to Completed and links its credits', () => {
    assert(afterPublish.json.data.status === 'Completed', `status is ${afterPublish.json.data.status}`);
    assert(afterPublish.json.data.credits, 'credits not linked');
    assert(afterPublish.json.data.completedAt, 'completedAt not set');
    assert(afterPublish.json.data.contributorCount >= 1, 'contributorCount missing');
  });

  const users = await call('/admin/users?search=maya&limit=10', { token: admin });
  check('GET /admin/users?search -> People tab shape', () => {
    assert(users.status === 200, `status ${users.status}`);
    assert(users.json.data.length >= 1, 'no users found');
    assert(users.json.data[0].id, 'People tab keys off _id');
    assert('password' in users.json.data[0] === false, 'password hash leaked to the client');
  });

  const promote = await call(`/admin/users/${users.json.data[0].id}/role`, {
    method: 'PATCH',
    token: admin,
    body: { role: 'hr_vip_employee' },
  });
  check('PATCH /admin/users/:id/role -> role change', () => {
    assert(promote.status === 200, `status ${promote.status}`);
    assert(promote.json.data.role === 'hr_vip_employee', 'role not updated');
  });
  await call(`/admin/users/${users.json.data[0].id}/role`, {
    method: 'PATCH',
    token: admin,
    body: { role: 'user' },
  });

  // ---- WallOfFame ------------------------------------------------------
  const wall = await call('/projects?page=1&limit=9', {});
  check('GET /projects (public) -> WallOfFame card data', () => {
    assert(wall.status === 200, `status ${wall.status}`);
    assert(wall.json.data.length >= 2, `expected 2+ published projects, got ${wall.json.data.length}`);
    wall.json.data.forEach((p) => {
      assert(p.title, 'project title missing');
      assert(p.developedBy, 'Developed By missing');
      assert(p.originalIdeaBy && p.originalIdeaBy.name, 'Original Idea By not populated');
      assert(Array.isArray(p.contributors) && p.contributors.length, 'contributors missing');
      p.contributors.forEach((c) => assert(c.user && c.user.name, 'contributor user not populated'));
      assert(p.idea, 'idea reference not populated');
    });
  });

  const wallAnon = await call('/projects');
  check('GET /projects requires no auth (public showcase)', () => {
    assert(wallAnon.status === 200, `status ${wallAnon.status}`);
  });

  const featured = await call('/projects?featured=true', {});
  check('GET /projects?featured=true -> featured filter', () => {
    assert(featured.status === 200, `status ${featured.status}`);
    featured.json.data.forEach((p) => assert(p.isFeatured === true, 'non-featured project returned'));
  });

  // ---- Status transitions from the IdeaDetails sidebar -----------------
  const sent = await call(`/ideas/${target.id}/status`, {
    method: 'PATCH',
    token: admin,
    body: { status: 'Under HR VIP Review', note: 'Taking this to the review board' },
  });
  check('PATCH /ideas/:id/status -> lifecycle move with audit note', () => {
    assert(sent.status === 200, `status ${sent.status}`);
    assert(sent.json.data.status === 'Under HR VIP Review', 'status not applied');
    assert(sent.json.data.previousStatus === 'In Discussion', 'previousStatus missing');
  });

  const illegal = await call(`/ideas/${target.id}/status`, {
    method: 'PATCH',
    token: admin,
    body: { status: 'Completed' },
  });
  check('PATCH /ideas/:id/status -> illegal transition blocked', () => {
    assert(illegal.status === 422, `status ${illegal.status}`);
  });

  const userStatus = await call(`/ideas/${target.id}/status`, {
    method: 'PATCH',
    token: maya,
    body: { status: 'Approved' },
  });
  check('PATCH /ideas/:id/status (standard user) -> 403', () => {
    assert(userStatus.status === 403, `status ${userStatus.status}`);
  });

  // ---- Validation feedback ---------------------------------------------
  const invalid = await call('/ideas', {
    method: 'POST',
    token: maya,
    body: { title: 'short', description: 'tiny', category: 'Nope' },
  });
  check('POST /ideas (invalid) -> 422 with field errors for the form', () => {
    assert(invalid.status === 422, `status ${invalid.status}`);
    assert(Array.isArray(invalid.json.errors), 'errors array missing');
    invalid.json.errors.forEach((e) => assert(e.field && e.message, 'malformed field error'));
  });

  // ---- CORS preflight (browser requirement) ----------------------------
  const preflight = await fetch(`${BASE}/ideas`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:5173',
      'Access-Control-Request-Method': 'GET',
    },
  });
  check('CORS preflight from the Vite origin succeeds', () => {
    assert(preflight.status === 204 || preflight.status === 200, `status ${preflight.status}`);
    assert(preflight.headers.get('access-control-allow-origin') === 'http://localhost:5173', 'origin not echoed');
  });

  console.log('\nHR VIP IdeaForge - live API <-> client contract check\n');
  console.log(results.join('\n'));
  console.log(`\n${pass}/${results.length} checks passed\n`);
};

run().catch((err) => {
  console.error('Contract check crashed:', err);
  process.exit(1);
});
