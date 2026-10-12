'use strict';

/**
 * Focused test for the GET /api/ideas/search/suggestions `q` -> `search` alias.
 *
 * The live server may predate the fix, so this boots the real app against an
 * ephemeral in-memory MongoDB to prove the route actually filters.
 *
 *   node scripts/verify-suggestions.js
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_suggestions_0123456789abcdef';
process.env.BCRYPT_SALT_ROUNDS = '4';
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
  process.env.MONGO_URI = mongod.getUri('hrvip_suggestions_test');

  const mongoose = require('mongoose');
  await mongoose.connect(process.env.MONGO_URI);

  const request = require('supertest');
  const app = require('../server');

  const User = require('../models/User');
  const Idea = require('../models/Idea');

  const author = await User.create({
    name: 'Suggestion Author',
    email: 'suggester@hrvip.com',
    password: 'Password123',
  });

  await Idea.create([
    {
      title: 'Payroll export times out for the December bonus run',
      description: 'The payroll export times out every December because it is synchronous.',
      category: 'Software Bug',
      author: author._id,
    },
    {
      title: 'Leave tracker disagrees with the HR portal',
      description: 'Two systems show different leave balances and nobody knows which is right.',
      category: 'Process Improvement',
      author: author._id,
    },
  ]);

  const all = await request(app).get('/api/ideas?limit=50');
  assert.equal(all.status, 200);
  assert.equal(all.body.data.length, 2, 'seed should have created 2 ideas');

  const s1 = await request(app).get('/api/ideas/search/suggestions?q=zzzznomatchzzzz&limit=5');
  check('a non-matching term returns an empty list (q is applied as the filter)', () => {
    assert.equal(s1.status, 200);
    assert.equal(s1.body.data.length, 0, `expected 0 results, got ${s1.body.data.length}`);
  });

  const s2 = await request(app).get('/api/ideas/search/suggestions?q=payroll&limit=5');
  check('a matching term filters the list', () => {
    assert.equal(s2.status, 200);
    assert.equal(s2.body.data.length, 1, `expected 1 result, got ${s2.body.data.length}`);
    assert.match(s2.body.data[0].title, /Payroll/);
  });

  const s3 = await request(app).get('/api/ideas/search/suggestions?q=leave&limit=5');
  check('search is case-insensitive', () => {
    assert.equal(s3.status, 200);
    assert.equal(s3.body.data.length, 1);
    assert.match(s3.body.data[0].title, /Leave tracker/);
  });

  const s4 = await request(app).get('/api/ideas/search/suggestions?q=x');
  check('a 1-character term is rejected with 422', () => {
    assert.equal(s4.status, 422);
    assert.equal(s4.body.success, false);
  });

  const s5 = await request(app).get('/api/ideas/search/suggestions');
  check('a missing term is rejected with 422', () => {
    assert.equal(s5.status, 422);
  });

  const s6 = await request(app).get('/api/ideas/search/suggestions?q=payroll&limit=1');
  check('limit is honoured', () => {
    assert.equal(s6.status, 200);
    assert.ok(s6.body.data.length <= 1);
  });

  const s7 = await request(app).get('/api/ideas/search/suggestions?q=payroll&limit=5');
  check('the response keeps the standard pagination envelope', () => {
    assert.equal(s7.body.success, true);
    assert.ok(s7.body.meta && typeof s7.body.meta.totalPages === 'number');
    assert.equal(s7.body.data[0].author.name, 'Suggestion Author');
  });

  const feed = await request(app).get('/api/ideas?search=payroll&limit=5');
  check('the existing ?search= feed filter still works', () => {
    assert.equal(feed.status, 200);
    assert.equal(feed.body.data.length, 1);
  });

  await mongoose.disconnect();
  await mongod.stop();

  console.log('\nSearch suggestions - q/search alias test\n');
  console.log(results.join('\n'));
  console.log(`\n${passed}/${results.length} checks passed\n`);
};

run().catch((err) => {
  console.error('Suggestions test crashed:', err);
  process.exit(1);
});
