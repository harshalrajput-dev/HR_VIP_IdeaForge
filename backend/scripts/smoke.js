'use strict';

/**
 * End-to-end API smoke test.
 * Boots the real Express app against an ephemeral in-memory MongoDB, then walks
 * the entire product lifecycle: register -> post -> discuss -> review ->
 * approve -> best solution -> publish -> Wall of Fame.
 *
 *   npm test
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_for_smoke_tests_only_0123456789';
process.env.BCRYPT_SALT_ROUNDS = '4'; // keep the suite fast
process.env.RATE_LIMIT_MAX = '100000';
process.env.AUTH_RATE_LIMIT_MAX = '100000';
process.env.LOG_LEVEL = 'error';

const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');

let passed = 0;
const results = [];

const check = (name, fn) => {
  try {
    fn();
    passed += 1;
    results.push(`  PASS  ${name}`);
  } catch (err) {
    results.push(`  FAIL  ${name}\n        ${err.message}`);
    process.exitCode = 1;
  }
};

const run = async () => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri('hr_vip_ideaforge_test');

  const mongoose = require('mongoose');
  const { connectDB, disconnectDB } = require('../config/db');
  await connectDB();

  const request = require('supertest');
  const app = require('../server');

  const api = () => request(app);

  // ---------------------------------------------------------------- auth ---
  const admin = { email: 'admin@hrvip.test', password: 'Password123' };
  const alice = { email: 'alice@hrvip.test', password: 'Password123' };
  const bob = { email: 'bob@hrvip.test', password: 'Password123' };

  const adminRes = await api().post('/api/auth/register').send({ name: 'Rohan Admin', email: admin.email, password: admin.password, department: 'HR VIP' });
  check('first registered account is bootstrapped as hr_vip_employee', () => {
    assert.equal(adminRes.status, 201);
    assert.equal(adminRes.body.data.user.role, 'hr_vip_employee');
    assert.ok(adminRes.body.data.token);
  });

  const aliceRes = await api().post('/api/auth/register').send({ name: 'Alice Author', email: alice.email, password: alice.password, department: 'Engineering' });
  check('subsequent accounts are standard users', () => {
    assert.equal(aliceRes.status, 201);
    assert.equal(aliceRes.body.data.user.role, 'user');
  });

  const bobRes = await api().post('/api/auth/register').send({ name: 'Bob Solver', email: bob.email, password: bob.password });
  check('third account registers', () => assert.equal(bobRes.status, 201));

  const weakRes = await api().post('/api/auth/register').send({ name: 'Weak', email: 'weak@hrvip.test', password: 'short' });
  check('weak password is rejected with 422', () => {
    assert.equal(weakRes.status, 422);
    assert.ok(Array.isArray(weakRes.body.errors));
  });

  const dupeRes = await api().post('/api/auth/register').send({ name: 'Alice Again', email: alice.email, password: alice.password });
  check('duplicate email is rejected with 409', () => assert.equal(dupeRes.status, 409));

  const badLogin = await api().post('/api/auth/login').send({ email: alice.email, password: 'WrongPass123' });
  check('wrong password returns 401', () => assert.equal(badLogin.status, 401));

  const loginRes = await api().post('/api/auth/login').send({ email: alice.email, password: alice.password });
  check('login returns a JWT and the user profile', () => {
    assert.equal(loginRes.status, 200);
    assert.ok(loginRes.body.data.token);
    assert.equal(loginRes.body.data.user.email, alice.email);
  });

  const adminToken = adminRes.body.data.token;
  const aliceToken = aliceRes.body.data.token;
  const bobToken = bobRes.body.data.token;

  const auth = (t) => ({ Authorization: `Bearer ${t}` });

  const meRes = await api().get('/api/auth/me').set(auth(aliceToken));
  check('GET /auth/me returns the profile for a valid token', () => {
    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.data.user.name, 'Alice Author');
  });

  const noAuth = await api().get('/api/auth/me');
  check('GET /auth/me without a token returns 401', () => assert.equal(noAuth.status, 401));

  const badAuth = await api().get('/api/auth/me').set({ Authorization: 'Bearer nonsense.token.value' });
  check('GET /auth/me with a tampered token returns 401', () => assert.equal(badAuth.status, 401));

  // --------------------------------------------------------------- ideas ---
  const noCreate = await api().post('/api/ideas').send({ title: 'Nope', description: 'x', category: 'Other' });
  check('creating an idea requires authentication', () => assert.equal(noCreate.status, 401));

  const badIdea = await api().post('/api/ideas').set(auth(aliceToken)).send({ title: 'Too short', description: 'tiny', category: 'Other' });
  check('short idea title/description returns 422', () => assert.equal(badIdea.status, 422));

  const badCategory = await api().post('/api/ideas').set(auth(aliceToken)).send({
    title: 'Valid title for the validation test',
    description: 'This description is definitely long enough to pass validation checks.',
    category: 'Nonsense Category',
  });
  check('unknown category returns 422', () => assert.equal(badCategory.status, 422));

  const createRes = await api().post('/api/ideas').set(auth(aliceToken)).send({
    title: 'Expense claims sit for 21 days in the approver inbox',
    description: 'Small claims under 500 with a valid receipt and no policy flag should be auto-approved. Today every claim waits for a human, which is why we see 21 day turnaround times.',
    category: 'Automation',
    priority: 'High',
    tags: ['expense', 'automation'],
  });
  check('author can create an idea with status "Submitted"', () => {
    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.data.status, 'Submitted');
    assert.equal(createRes.body.data.author.email, alice.email);
  });
  const ideaId = createRes.body.data.id;

  const authorPoints = createRes.body.data.author.points;
  check('author earns points for submitting an idea', () => assert.ok(authorPoints > 0, `points=${authorPoints}`));

  const selfUpvote = await api().post(`/api/ideas/${ideaId}/upvote`).set(auth(aliceToken));
  check('authors cannot upvote their own idea', () => assert.equal(selfUpvote.status, 400));

  const up1 = await api().post(`/api/ideas/${ideaId}/upvote`).set(auth(bobToken));
  check('another user can upvote', () => {
    assert.equal(up1.status, 200);
    assert.equal(up1.body.data.upvoteCount, 1);
    assert.equal(up1.body.data.upvotedByMe, true);
  });

  const up2 = await api().post(`/api/ideas/${ideaId}/upvote`).set(auth(bobToken));
  check('upvoting twice toggles the vote off (no double count)', () => {
    assert.equal(up2.status, 200);
    assert.equal(up2.body.data.upvoteCount, 0);
  });

  await api().post(`/api/ideas/${ideaId}/upvote`).set(auth(bobToken));
  const upAdmin = await api().post(`/api/ideas/${ideaId}/upvote`).set(auth(adminToken));
  check('multiple unique upvotes accumulate', () => assert.equal(upAdmin.body.data.upvoteCount, 2));

  // ----------------------------------------------------------- discussion ---
  const emptyComment = await api().post(`/api/ideas/${ideaId}/comments`).set(auth(bobToken)).send({ text: 'x' });
  check('comment shorter than the minimum is rejected', () => assert.equal(emptyComment.status, 422));

  const c1 = await api().post(`/api/ideas/${ideaId}/comments`).set(auth(bobToken)).send({
    text: 'We already have a policy engine from the procurement module. A dry run against three months of history suggests 58% of claims would clear automatically.',
  });
  check('first comment moves the idea to "In Discussion"', () => {
    assert.equal(c1.status, 201);
    assert.equal(c1.body.data.ideaStatus, 'In Discussion');
    assert.equal(c1.body.data.statusChanged, true);
  });

  await api().post(`/api/ideas/${ideaId}/comments`).set(auth(adminToken)).send({
    text: 'Interesting. Can you share the false positive rate from the dry run so we can set the auto-approve threshold responsibly?',
  });

  const commentsRes = await api().get(`/api/ideas/${ideaId}/comments`);
  check('discussion thread is publicly readable', () => {
    assert.equal(commentsRes.status, 200);
    assert.equal(commentsRes.body.data.length, 2);
    assert.equal(commentsRes.body.meta.ideaStatus, 'In Discussion');
  });

  const bobCommentId = c1.body.data.id;

  const bobMarks = await api().patch(`/api/comments/${bobCommentId}/mark-best`).set(auth(bobToken));
  check('a random user cannot mark the best solution', () => assert.equal(bobMarks.status, 403));

  const markBest = await api().patch(`/api/comments/${bobCommentId}/mark-best`).set(auth(adminToken));
  check('HR VIP can mark a best solution', () => {
    assert.equal(markBest.status, 200);
    assert.equal(markBest.body.data.comment.isBestSolution, true);
    assert.ok(markBest.body.data.ideaBestSolution);
  });

  // ----------------------------------------------------------- review flow ---
  const skipStatus = await api().patch(`/api/ideas/${ideaId}/status`).set(auth(adminToken)).send({ status: 'Completed' });
  check('illegal status transition is rejected with 422', () => assert.equal(skipStatus.status, 422));

  const userStatus = await api().patch(`/api/ideas/${ideaId}/status`).set(auth(bobToken)).send({ status: 'Under HR VIP Review' });
  check('standard users cannot change idea status (403)', () => assert.equal(userStatus.status, 403));

  const toReview = await api().patch(`/api/ideas/${ideaId}/status`).set(auth(adminToken)).send({ status: 'Under HR VIP Review', note: 'Picked up by HR VIP' });
  check('HR VIP moves the idea to "Under HR VIP Review"', () => {
    assert.equal(toReview.status, 200);
    assert.equal(toReview.body.data.status, 'Under HR VIP Review');
  });

  const backTo = await api().patch(`/api/ideas/${ideaId}/status`).set(auth(adminToken)).send({ status: 'In Discussion' });
  check('HR VIP can send an idea back for more work', () => assert.equal(backTo.body.data.status, 'In Discussion'));

  const rejected = await api().patch('/api/admin/ideas/' + ideaId + '/review').set(auth(adminToken)).send({ decision: 'request-changes' });
  check('requesting changes without a note is rejected', () => assert.equal(rejected.status, 422));

  await api().patch(`/api/ideas/${ideaId}/status`).set(auth(adminToken)).send({ status: 'Under HR VIP Review' });
  const approve = await api().patch('/api/admin/ideas/' + ideaId + '/review').set(auth(adminToken)).send({ decision: 'approve', note: 'Approved for the Q3 automation sprint' });
  check('HR VIP approves the idea', () => {
    assert.equal(approve.status, 200);
    assert.equal(approve.body.data.status, 'Approved');
    assert.equal(approve.body.data.reviewNotes, 'Approved for the Q3 automation sprint');
  });

  // ------------------------------------------------------------- publish ---
  const unapproved = await api().post('/api/ideas').set(auth(bobToken)).send({
    title: 'Meeting room panel shows phantom availability on floor three',
    description: 'The sensor feed and the booking system never reconcile, so the floor three panel lists occupied rooms as free for the whole afternoon.',
    category: 'Software Bug',
  });
  const unapprovedId = unapproved.body.data.id;
  const publishTooEarly = await api().post('/api/admin/projects').set(auth(adminToken)).send({ ideaId: unapprovedId });
  check('a project cannot be published before the idea is approved', () => {
    assert.equal(publishTooEarly.status, 422);
    assert.match(publishTooEarly.body.message, /Only approved ideas/);
  });

  const noCreditsIdea = await api().post('/api/ideas').set(auth(bobToken)).send({
    title: 'Training recordings are impossible to search by topic',
    description: 'Compliance and onboarding recordings are re-recorded every quarter and the old ones die in a SharePoint folder nobody can search.',
    category: 'Training & Culture',
  });
  const noCreditsId = noCreditsIdea.body.data.id;
  await api().patch(`/api/ideas/${noCreditsId}/status`).set(auth(adminToken)).send({ status: 'Under HR VIP Review' });
  await api().patch(`/api/admin/ideas/${noCreditsId}/review`).set(auth(adminToken)).send({ decision: 'approve' });
  const noCredits = await api().post('/api/admin/projects').set(auth(adminToken)).send({ ideaId: noCreditsId });
  check('publishing without a best solution or explicit contributors is refused', () => {
    assert.equal(noCredits.status, 422);
    assert.match(noCredits.body.message, /No contributors/);
  });

  const publish = await api().post('/api/admin/projects').set(auth(adminToken)).send({
    ideaId,
    projectLink: 'https://intranet.hrvip.test/expense-autopilot',
    developedBy: 'HR VIP Team',
    techStack: ['Node.js', 'React', 'PostgreSQL'],
    impact: 'Claim turnaround fell from 21 days to under 2 hours for 58% of submissions.',
    summary: 'Auto-approval pipeline for low-value expense claims using the existing procurement policy engine.',
    isFeatured: true,
  });
  check('HR VIP publishes the project with credits', () => {
    assert.equal(publish.status, 201);
    assert.equal(publish.body.data.developedBy, 'HR VIP Team');
    assert.equal(publish.body.data.originalIdeaByName, 'Alice Author');
    assert.equal(publish.body.data.contributors.length, 1);
    assert.equal(publish.body.data.contributors[0].name, 'Bob Solver');
  });

  const detail = await api().get(`/api/ideas/${ideaId}`);
  check('idea is now "Completed" and linked to its credits', () => {
    assert.equal(detail.body.data.status, 'Completed');
    assert.ok(detail.body.data.credits);
    assert.equal(detail.body.data.contributorCount, 1);
    assert.ok(detail.body.data.completedAt);
  });

  const publicPublish = await api().post('/api/admin/projects').set(auth(bobToken)).send({ ideaId });
  check('standard users cannot publish projects (403)', () => assert.equal(publicPublish.status, 403));

  const anonPublish = await api().post('/api/admin/projects').send({ ideaId });
  check('anonymous users cannot publish projects (401)', () => assert.equal(anonPublish.status, 401));

  // --------------------------------------------------------- wall of fame ---
  const wall = await api().get('/api/projects');
  check('public Wall of Fame feed lists completed projects', () => {
    assert.equal(wall.status, 200);
    assert.equal(wall.body.data.length, 1);
    const p = wall.body.data[0];
    assert.equal(p.developedBy, 'HR VIP Team');
    assert.equal(p.originalIdeaBy.name, 'Alice Author');
    assert.equal(p.contributors[0].name, 'Bob Solver');
  });

  // ------------------------------------------------------------- filters ---
  const feed = await api().get('/api/ideas?status=Completed&category=Automation&page=1&limit=5');
  check('feed supports status + category filters with pagination meta', () => {
    assert.equal(feed.status, 200);
    assert.equal(feed.body.data.length, 1);
    assert.equal(feed.body.meta.total, 1);
    assert.equal(feed.body.meta.page, 1);
  });

  const search = await api().get('/api/ideas?search=expense');
  check('feed supports keyword search', () => assert.equal(search.body.data.length, 1));

  const filters = await api().get('/api/ideas/meta/filters');
  check('filter metadata endpoint exposes enums', () => {
    assert.ok(filters.body.data.categories.includes('Automation'));
    assert.ok(filters.body.data.statuses.includes('Completed'));
  });

  // ------------------------------------------------------------- admin -----
  const stats = await api().get('/api/admin/dashboard').set(auth(adminToken));
  check('admin dashboard returns lifecycle counts', () => {
    assert.equal(stats.status, 200);
    assert.equal(stats.body.data.totals.ideas, 3);
    assert.equal(stats.body.data.counts.Completed, 1);
    assert.equal(stats.body.data.counts.Approved, 1);
    assert.equal(stats.body.data.totals.projects, 1);
    assert.ok(Array.isArray(stats.body.data.topContributors));
  });

  const statsDenied = await api().get('/api/admin/dashboard').set(auth(aliceToken));
  check('standard users are blocked from the admin dashboard (403)', () => assert.equal(statsDenied.status, 403));

  const promoted = await api().patch(`/api/admin/users/${aliceRes.body.data.user.id}/role`).set(auth(adminToken)).send({ role: 'hr_vip_employee' });
  check('admin can promote a user to hr_vip_employee', () => {
    assert.equal(promoted.status, 200);
    assert.equal(promoted.body.data.role, 'hr_vip_employee');
  });

  const demoteLast = await api().patch(`/api/admin/users/${bobRes.body.data.user.id}/role`).set(auth(adminToken)).send({ role: 'user' });
  check('demoting a standard user is a no-op but succeeds', () => assert.equal(demoteLast.status, 200));

  const health = await api().get('/health');
  check('health endpoint reports the database connection', () => {
    assert.equal(health.status, 200);
    assert.equal(health.body.data.db, 'connected');
  });

  const notFound = await api().get('/api/does-not-exist');
  check('unknown routes return a 404 envelope', () => {
    assert.equal(notFound.status, 404);
    assert.equal(notFound.body.success, false);
  });

  const badId = await api().get('/api/ideas/not-a-valid-id');
  check('malformed ObjectId is rejected by the validation layer (422)', () => assert.equal(badId.status, 422));

  const missing = await api().get('/api/ideas/64b7f9f2c1a2b3c4d5e6f7a8');
  check('a well-formed but unknown id returns 404', () => assert.equal(missing.status, 404));

  // ---------------------------------------------------------- teardown -----
  await mongoose.connection.dropDatabase();
  await disconnectDB();
  await mongod.stop();

  console.log('\nHR VIP IdeaForge - API smoke test\n');
  console.log(results.join('\n'));
  const total = results.length;
  console.log(`\n${passed}/${total} checks passed\n`);
};

run().catch(async (err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
