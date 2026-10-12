'use strict';

// Must run before any DNS lookup, including the MongoDB SRV bootstrap.
// Applies ipv4first result ordering and a public fallback resolver.
require('./config/dns');

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

const { connectDB, disconnectDB, currentDbName } = require('./config/db');
const logger = require('./utils/logger');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const authRoutes = require('./routes/authRoutes');
const ideaRoutes = require('./routes/ideaRoutes');
const commentRoutes = require('./routes/commentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const seedRoutes = require('./routes/seedRoutes');

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const API_PREFIX = process.env.API_PREFIX || '/api';
const IS_PROD = process.env.NODE_ENV === 'production';

// --- Security & parsing ----------------------------------------------------
if (Number(process.env.TRUST_PROXY_HOPS) > 0) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS));
}
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    // Reflects the caller's origin so credentialed requests work, while
    // allowing every origin by default (set CORS_ORIGIN to a comma-separated
    // allow-list to lock it down in production).
    origin(origin, callback) {
      const allowed = (process.env.CORS_ORIGIN || '*')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
      // Always permit the local Vite dev/preview servers in development so the
      // frontend at http://localhost:5173 can call this API out of the box.
      const isLocalDevOrigin =
        !IS_PROD && /^https?:\/\/(localhost|127\.0\.0\.1):(5173|4173)$/.test(origin || '');
      // Allow same-origin / curl / mobile clients that send no Origin header.
      if (!origin || allowed.includes('*') || allowed.includes(origin) || isLocalDevOrigin)
        return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(compression());

if (!IS_PROD) app.use(morgan('dev'));
else app.use(morgan('combined'));

// --- Global rate limit -----------------------------------------------------
app.use(
  API_PREFIX,
  rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MINUTES || 15) * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX || 1000),
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later' },
  })
);

// On Vercel the exported app runs as a serverless function, so `start()` (which
// normally opens the MongoDB pool) never runs. Lazily connect on first request;
// `connectDB()` reuses an active/in-flight connection, so this is a no-op on a
// long-running server or after the first warm invocation.
let seededChecked = false;
const ensureSeeded = async () => {
  if (seededChecked || process.env.AUTO_SEED === 'false') return;
  seededChecked = true;
  try {
    const User = require('./models/User');
    if ((await User.estimatedDocumentCount()) === 0) {
      const { seedDatabase } = require('./scripts/seed');
      const counts = await seedDatabase();
      logger.info(`Auto-seeded empty database with demo data: ${JSON.stringify(counts)}`);
    }
  } catch (err) {
    logger.error(`Auto-seed skipped: ${err.message}`);
  }
};

// Warm the MongoDB pool (and seed when empty) before any API route runs. On
// Vercel the first request of a cold instance pays the connection cost once;
// `connectDB()` then reuses the pool for the rest of that instance's lifetime.
const ensureDatabase = async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
};

const ensureDatabaseAndSeed = async (_req, _res, next) => {
  try {
    await connectDB();
    await ensureSeeded();
    next();
  } catch (err) {
    next(err);
  }
};

app.use('/health', ensureDatabase);
app.use(API_PREFIX, ensureDatabaseAndSeed);

// --- Routes ----------------------------------------------------------------
app.get('/health', (_req, res) =>
  res.json({
    success: true,
    data: {
      service: 'hr-vip-ideaforge-api',
      status: 'ok',
      env: process.env.NODE_ENV,
      db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      database: currentDbName(),
      uptime: Math.round(process.uptime()),
    },
  })
);

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/ideas`, ideaRoutes);
app.use(`${API_PREFIX}/comments`, commentRoutes);
app.use(`${API_PREFIX}/projects`, adminRoutes.publicProjectRouter); // public Wall of Fame
app.use(`${API_PREFIX}/admin`, adminRoutes.adminRouter); // HR VIP only
app.use(`${API_PREFIX}/seed`, seedRoutes); // demo-data seeding (guarded by SEED_SECRET)
app.use(API_PREFIX, notFound);

// --- Error handling --------------------------------------------------------
app.use(errorHandler);

// Surface async/cold-start failures instead of letting them crash the process.
// On Vercel `start()` never runs, so this must be registered at module scope.
process.on('unhandledRejection', (reason) => logger.error(`Unhandled rejection: ${reason}`));

// --- Boot ------------------------------------------------------------------
const start = async () => {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      logger.info(`HR VIP IdeaForge API listening on http://localhost:${PORT}${API_PREFIX} [${process.env.NODE_ENV}]`);
    });

    const shutdown = async (signal) => {
      logger.warn(`${signal} received - shutting down gracefully`);
      server.close(async () => {
        await disconnectDB();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000).unref();
    };

    ['SIGINT', 'SIGTERM'].forEach((sig) => process.on(sig, () => shutdown(sig)));
    process.on('uncaughtException', (err) => {
      logger.error(`Uncaught exception: ${err.message}`);
      shutdown('uncaughtException');
    });

    return server;
  } catch (err) {
    logger.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  }
}

// Long-running processes (local dev, containers) boot a listener here. On Vercel
// the module is imported as a serverless function instead, so we only export the
// Express app - and never call `listen()`/`process.exit()` - during cold start.
if (require.main === module) {
  start();
}

module.exports = app;
// Alias for runtimes that look for a named handler export.
module.exports.handler = app;
