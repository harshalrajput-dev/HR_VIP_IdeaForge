'use strict';

/**
 * Seeds HR VIP IdeaForge with a realistic demo dataset.
 *   npm run seed          -> upsert (idempotent)
 *   npm run seed:fresh    -> wipe first
 *
 * Demo accounts (password for all: Password123)
 *   admin@hrvip.com       HR VIP employee (reviewer / publisher)
 *   maya@hrvip.com        standard user, top contributor
 *   dev@hrvip.com         standard user
 *   analyst@hrvip.com     standard user
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Idea = require('../models/Idea');
const Comment = require('../models/Comment');
const ProjectCredit = require('../models/ProjectCredit');
const { IDEA_STATUS, DEVELOPED_BY_DEFAULT } = require('../config/constants');

const PASSWORD = 'Password123';
// findOneAndUpdate() does not trigger the `pre('save')` hashing hook, so the
// seed must hash explicitly or it would write plaintext passwords.
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;

const users = [
  {
    key: 'admin',
    name: 'Rohan Mehta',
    email: 'admin@hrvip.com',
    role: 'hr_vip_employee',
    department: 'HR VIP',
    jobTitle: 'HR Business Partner',
    points: 0,
    bio: 'Owns the IdeaForge review board and ships the winning projects.',
  },
  {
    key: 'maya',
    name: 'Maya Iyer',
    email: 'maya@hrvip.com',
    role: 'user',
    department: 'Engineering',
    jobTitle: 'Senior Software Engineer',
    points: 0,
    bio: 'Automation enthusiast. I fix the boring things.',
  },
  {
    key: 'dev',
    name: 'Dev Patel',
    email: 'dev@hrvip.com',
    role: 'user',
    department: 'Engineering',
    jobTitle: 'Full-Stack Developer',
    points: 0,
  },
  {
    key: 'analyst',
    name: 'Ananya Rao',
    email: 'analyst@hrvip.com',
    role: 'user',
    department: 'Data & Analytics',
    jobTitle: 'Data Analyst',
    points: 0,
  },
];

const ideas = [
  {
    key: 'leaveSync',
    author: 'analyst',
    title: 'Leave tracker and the HR portal show different balances',
    description:
      'Every month HR receives 15+ tickets claiming the leave portal balance is wrong. The HR portal reads from a nightly CSV export while the employee tracker reads live from the HRMS, so approved leave never shows up. We need a single source of truth, or at least a reconciliation job that flags mismatches before payday.',
    category: 'Software Bug',
    priority: 'High',
    status: IDEA_STATUS.COMPLETED,
    tags: ['hr-portal', 'data-sync', 'payroll'],
    upvotes: ['maya', 'dev'],
    bestComment: {
      author: 'maya',
      text:
        'I built a reconciliation service: it pulls live HRMS balances every 15 minutes, diffs them against the HR portal snapshot, and opens a Jira ticket per mismatch with the employee, the delta and the approval chain. Implemented as a small Node worker + a cron job. Ran in staging for a week with zero false positives and it cut the ticket queue from 15 to 2.',
    },
    project: {
      summary: 'Nightly reconciliation between the HR portal snapshot and live HRMS balances, with auto-filed mismatch tickets.',
      impact: 'Leave-related HR tickets dropped ~85% in the first month after rollout.',
      techStack: ['Node.js', 'MongoDB', 'Jira Automation', 'React'],
      projectLink: 'https://intranet.hrvip.local/leave-reconciliation',
      contributors: [{ key: 'maya', role: 'Solution Author' }, { key: 'dev', role: 'Co-Solver' }],
    },
  },
  {
    key: 'onboarding',
    author: 'dev',
    title: 'Onboarding checklists live in a spreadsheet nobody can edit safely',
    description:
      'New joiners wait an average of 3 days for laptop and access requests because onboarding is tracked in a shared sheet. Two people edited it at once last month and half the access tasks vanished. We should move this into a real workflow with owners, due dates and an audit trail.',
    category: 'Process Improvement',
    priority: 'Critical',
    status: IDEA_STATUS.APPROVED,
    tags: ['onboarding', 'access', 'audit'],
    upvotes: ['maya', 'analyst'],
    comments: [
      {
        author: 'analyst',
        text:
          'Agreed - I can pull last quarter numbers to justify the effort. Roughly 40 hires per quarter and every delay costs the team a full day of ramp-up time.',
      },
      {
        author: 'maya',
        text:
          'I can prototype a task-based flow this sprint. Suggested split: IT owns device + SSO, HR owns documents, and the hiring manager owns buddy assignment. Each task auto-escalates after 24h.',
      },
    ],
  },
  {
    key: 'expense',
    author: 'maya',
    title: 'Expense reimbursement takes 21 days - automate the approval chain',
    description:
      'The expense tool works, but every claim sits in an approver inbox with no reminder. Small claims under 2,000 are approved by one manager; let us auto-approve anything under 500 that has a valid receipt and no policy flag. That alone should clear 60% of the queue.',
    category: 'Automation',
    priority: 'High',
    status: IDEA_STATUS.UNDER_REVIEW,
    tags: ['expense', 'automation', 'approvals'],
    upvotes: ['dev', 'analyst'],
    comments: [
      {
        author: 'dev',
        text:
          'We have a policy engine we can reuse from the procurement module. Dry run against 3 months of history suggests 58% of claims would auto-clear with a false-positive rate under 2%.',
      },
    ],
  },
  {
    key: 'payroll',
    author: 'analyst',
    title: 'Payroll dashboard crashes on the December bonus run',
    description:
      'Every December the payroll dashboard throws a 504 gateway timeout because it aggregates 11 months of payslips in a single synchronous request. It only happens under December volume. We should pre-aggregate or move the computation off the request path.',
    category: 'Software Limitation',
    priority: 'Critical',
    status: IDEA_STATUS.IN_DISCUSSION,
    tags: ['payroll', 'performance'],
    upvotes: ['maya'],
    comments: [
      {
        author: 'maya',
        text:
          'Reproduced locally with 11 months of synthetic data. The query plan does a collection scan per employee. Moving the aggregation into a nightly materialized view drops the endpoint to ~120ms.',
      },
      {
        author: 'dev',
        text: 'Happy to pair on this. Can we also add a load test so we never regress into December mode again?',
      },
    ],
  },
  {
    key: 'training',
    author: 'dev',
    title: 'No searchable archive of past training sessions and their recordings',
    description:
      'Every quarter we record the same onboarding and compliance sessions, and the recordings die in a SharePoint folder. New joiners should be able to search past sessions by topic, and HR should be able to prove who attended what.',
    category: 'Training & Culture',
    priority: 'Medium',
    status: IDEA_STATUS.SUBMITTED,
    tags: ['training', 'knowledge-base'],
    upvotes: [],
    comments: [],
  },
  {
    key: 'meetingRooms',
    author: 'maya',
    title: 'Meeting room booking shows phantom availability at HQ',
    description:
      'The room panel at HQ 3rd floor shows rooms as free while they are occupied. We think the sensor feed and the booking system write to different tables and never reconcile. Half the complaints are about the same two rooms on the 3rd floor.',
    category: 'Software Bug',
    priority: 'Medium',
    status: IDEA_STATUS.SUBMITTED,
    tags: ['facilities', 'iot'],
    upvotes: ['analyst'],
    comments: [],
  },
];

/**
 * Idempotently seed the database with the demo dataset.
 * Safe to call from a running server (does not disconnect afterwards).
 * @param {{ fresh?: boolean }} [options]
 * @returns {Promise<{users:number, ideas:number, comments:number, projects:number}>}
 */
const seedDatabase = async ({ fresh = false } = {}) => {
  await connectDB();

  if (fresh) {
    await Promise.all([
      ProjectCredit.deleteMany({}),
      Comment.deleteMany({}),
      Idea.deleteMany({}),
      User.deleteMany({}),
    ]);
    console.log('Cleared existing data (--fresh)');
  }

  const userMap = {};
  const passwordHash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);
  for (const u of users) {
    const doc = await User.findOneAndUpdate(
      { email: u.email },
      { $set: { ...u, password: passwordHash, isActive: true, lastLoginAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    delete userMap[u.key];
    userMap[u.key] = doc;
  }
  console.log(`Seeded ${users.length} users (password: ${PASSWORD}, bcrypt-hashed)`);

  const admin = userMap.admin;
  let commentCount = 0;
  let projectCount = 0;

  for (const [index, spec] of ideas.entries()) {
    const author = userMap[spec.author];
    const upvotes = (spec.upvotes || []).map((k) => userMap[k]._id);

    const idea = await Idea.findOneAndUpdate(
      { title: spec.title },
      {
        $set: {
          title: spec.title,
          description: spec.description,
          category: spec.category,
          priority: spec.priority,
          status: spec.status,
          tags: spec.tags,
          author: author._id,
          upvotes,
          reviewedBy: admin._id,
          reviewedAt: new Date(Date.now() - (index + 1) * 86400000),
          completedAt: spec.status === IDEA_STATUS.COMPLETED ? new Date() : null,
          statusHistory: [
            { status: IDEA_STATUS.SUBMITTED, changedBy: author._id, changedByName: author.name, note: 'Idea submitted' },
            ...(spec.status !== IDEA_STATUS.SUBMITTED
              ? [
                  { status: IDEA_STATUS.IN_DISCUSSION, changedBy: userMap.maya._id, changedByName: userMap.maya.name, note: 'Discussion started' },
                  { status: IDEA_STATUS.UNDER_REVIEW, changedBy: admin._id, changedByName: admin.name, note: 'Picked up for HR VIP review' },
                  ...(spec.status === IDEA_STATUS.APPROVED
                    ? [{ status: IDEA_STATUS.APPROVED, changedBy: admin._id, changedByName: admin.name, note: 'Approved for development' }]
                    : []),
                  ...(spec.status === IDEA_STATUS.COMPLETED
                    ? [{ status: IDEA_STATUS.APPROVED, changedBy: admin._id, changedByName: admin.name, note: 'Approved for development' },
                       { status: IDEA_STATUS.COMPLETED, changedBy: admin._id, changedByName: admin.name, note: 'Project shipped' }]
                    : []),
                ]
              : []),
          ],
        },
        $setOnInsert: { commentCount: 0, bestSolution: null },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await Comment.deleteMany({ ideaId: idea._id });

    for (const c of spec.comments || []) {
      await Comment.create({ ideaId: idea._id, userId: userMap[c.author]._id, text: c.text });
      commentCount += 1;
    }

    if (spec.bestComment) {
      const best = await Comment.create({
        ideaId: idea._id,
        userId: userMap[spec.bestComment.author]._id,
        text: spec.bestComment.text,
        isBestSolution: true,
        bestMarkedBy: admin._id,
        bestMarkedAt: new Date(),
      });
      idea.bestSolution = best._id;
      commentCount += 1;
    }

    await idea.save();

    if (spec.project) {
      const resolvedContributors = [];
      for (const c of spec.project.contributors) {
        const u = userMap[c.key];
        const best = await Comment.findOne({ ideaId: idea._id, userId: u._id, isBestSolution: true });
        resolvedContributors.push({
          user: u._id,
          name: u.name,
          role: c.role,
          solutionComment: best?._id || null,
          note: c.role === 'Solution Author' ? 'Crowned best solution' : 'Supported the rollout',
          pointsAwarded: 40,
        });
      }

      const credit = await ProjectCredit.findOneAndUpdate(
        { idea: idea._id },
        {
          idea: idea._id,
          title: spec.title,
          summary: spec.project.summary,
          impact: spec.project.impact,
          originalIdeaBy: author._id,
          originalIdeaByName: author.name,
          contributors: resolvedContributors,
          developedBy: DEVELOPED_BY_DEFAULT,
          projectLink: spec.project.projectLink,
          techStack: spec.project.techStack,
          metrics: { ticketsReducedWeekly: 13 },
          isFeatured: index === 0,
          publishedBy: admin._id,
          publishedAt: new Date(Date.now() - 86400000),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      idea.credits = credit._id;
      await idea.save();
      projectCount += 1;
    }
  }

  const counts = {
    users: await User.countDocuments(),
    ideas: await Idea.countDocuments(),
    comments: await Comment.countDocuments(),
    projects: await ProjectCredit.countDocuments(),
  };

  console.log(`Seeded ${counts.ideas} ideas, ${commentCount} comments, ${projectCount} published projects`);
  console.log('Totals in DB:', counts);
  console.log('\nLog in with:');
  console.log('  HR VIP employee : admin@hrvip.com  /', PASSWORD);
  console.log('  Standard user   : maya@hrvip.com   /', PASSWORD);

  return counts;
};

module.exports = { seedDatabase, DEMO_PASSWORD: PASSWORD, DEMO_ACCOUNTS: users.map((u) => ({ email: u.email, role: u.role })) };

// CLI entry point: `node scripts/seed.js [--fresh]`
if (require.main === module) {
  require('dotenv').config();

  seedDatabase({ fresh: process.argv.includes('--fresh') })
    .then(async () => {
      await disconnectDB();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Seed failed:', err.message);
      await mongoose.connection.close().catch(() => {});
      process.exit(1);
    });
}
