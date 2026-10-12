'use strict';

// Apply the DNS fallback before any connection attempt, so every entry point
// (server.js, scripts/seed.js, ...) resolves `mongodb+srv://` records correctly.
require('./dns');

const mongoose = require('mongoose');
const logger = require('../utils/logger');

/** Canonical database for this project. */
const DEFAULT_DB_NAME = 'hr_vip_ideaforge';

// Persist the in-flight/active connection across warm serverless invocations.
// Node already caches this module between warm Vercel requests, but caching on
// `global` also protects the pool if the module is re-evaluated in a fresh
// bundle - so a cold start opens exactly one connection, never a second pool.
if (!global.__hrvipMongo) global.__hrvipMongo = { promise: null, dbName: null };
const cache = global.__hrvipMongo;

// Register listeners once (not per attempt) so repeated cold-start retries can
// never trip the MaxListeners warning. Wrapped defensively so attaching a
// listener can never throw while the module is being evaluated on Vercel.
let listenersRegistered = false;
const registerConnectionListeners = () => {
  if (listenersRegistered) return;
  listenersRegistered = true;
  try {
    mongoose.connection.on('error', (err) => logger.error(`MongoDB error: ${err.message}`));
    mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
    mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  } catch (err) {
    logger.warn(`Could not attach MongoDB connection listeners: ${err.message}`);
  }
};
registerConnectionListeners();

/**
 * Resolve which database the app must read/write.
 *
 * Priority:
 *   1. MONGO_DB_NAME             - explicit override (recommended on Vercel).
 *   2. the database in MONGO_URI - e.g. `.../hr_vip_ideaforge?retryWrites=...`.
 *   3. `hr_vip_ideaforge`        - canonical name for this project.
 *
 * The resolved name is passed to `mongoose.connect`, so every model (`ideas`,
 * `users`, `comments`, `projects`) is bound to the same database even when the
 * MongoDB Atlas URI omits the path segment.
 */
const resolveDbName = (uri) => {
  const explicit = String(process.env.MONGO_DB_NAME || '').trim();
  if (explicit) return explicit;

  const match = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^/?]+)/.exec(uri || '');
  if (match && match[1]) return decodeURIComponent(match[1]);

  return DEFAULT_DB_NAME;
};

/** Transient failures worth retrying during a cold start. */
const NETWORK_ERROR =
  /querySrv|ENOTFOUND|ECONNREFUSED|EAI_AGAIN|ETIMEDOUT|ECONNRESET|MongoNetwork|serverSelection/i;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Connect with a short exponential backoff. The first request on a cold Vercel
 * instance can race DNS/server selection, so a couple of fast retries make the
 * difference between a flaky 500 and a successful warm-up.
 */
const connectWithRetry = async (uri, options, attempts = 3) => {
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await mongoose.connect(uri, options);
    } catch (err) {
      lastErr = err;
      if (attempt === attempts || !NETWORK_ERROR.test(err.message)) throw err;
      const backoff = 400 * attempt;
      logger.warn(
        `MongoDB connect attempt ${attempt}/${attempts} failed (${err.message}); retrying in ${backoff}ms`
      );
      await sleep(backoff);
    }
  }
  throw lastErr;
};

/**
 * Assemble Mongoose/driver connection options, dropping anything empty so we
 * never hand the driver an invalid value (which is what turns a typo'd env var
 * into a `MongoParseError` at cold start).
 */
const buildConnectionOptions = (dbName) => {
  const int = (value, fallback) => {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  const options = {
    dbName,
    serverSelectionTimeoutMS: int(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS, 10000),
    connectTimeoutMS: int(process.env.MONGO_CONNECT_TIMEOUT_MS, 10000),
    socketTimeoutMS: int(process.env.MONGO_SOCKET_TIMEOUT_MS, 45000),
    maxPoolSize: int(process.env.MONGO_MAX_POOL_SIZE, 20),
    minPoolSize: int(process.env.MONGO_MIN_POOL_SIZE, 2),
    autoIndex: process.env.NODE_ENV !== 'production',
    // Callers always `await connectDB()` first, so never silently buffer queries
    // while disconnected - fail fast instead of hanging until the socket times out.
    bufferCommands: false,
  };

  // Only force an IP family when explicitly configured. DNS is already ordered
  // ipv4first in ./dns, and an unconditional value can be rejected by the driver
  // or the serverless network on some hosts.
  const family = Number.parseInt(process.env.MONGO_IP_FAMILY, 10);
  if (family === 4 || family === 6) options.family = family;

  return options;
};

/**
 * Connect to MongoDB using `process.env.MONGO_URI`, bound explicitly to the
 * `hr_vip_ideaforge` database. Reuses an active/in-flight connection so Vercel
 * cold starts are cheap and later invocations hit the same pool.
 * @returns {Promise<import('mongoose').Mongoose>}
 */
const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error('MONGO_URI is missing. Copy backend/.env.example to backend/.env and set it.');
  }

  if (!/^mongodb(\+srv)?:\/\//.test(uri)) {
    throw new Error('MONGO_URI must start with mongodb:// or mongodb+srv://');
  }

  // Already connected / connecting on this instance - reuse, do not re-open.
  if (mongoose.connection.readyState === 1) return mongoose;
  if (cache.promise) return cache.promise;

  mongoose.set('strictQuery', true);

  const dbName = resolveDbName(uri);
  cache.dbName = dbName;

  cache.promise = connectWithRetry(uri, buildConnectionOptions(dbName))
    .then((connection) => {
      logger.info(
        `MongoDB connected to database "${connection.connection.name}" at ${connection.connection.host}`
      );
      return connection;
    })
    .catch((err) => {
      cache.promise = null;
      if (NETWORK_ERROR.test(err.message)) {
        logger.error(
          'MongoDB DNS/network resolution failed. Check your network/VPN, or verify the cluster hostname in MONGO_URI.'
        );
      }
      throw err;
    });

  return cache.promise;
};

/** Close the Mongoose connection during graceful shutdown. */
const disconnectDB = async () => {
  cache.promise = null;
  cache.dbName = null;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close(false);
    logger.info('MongoDB connection closed');
  }
};

/** The database every model is currently bound to (useful for diagnostics). */
const currentDbName = () => mongoose.connection.name || cache.dbName || DEFAULT_DB_NAME;

module.exports = { connectDB, disconnectDB, resolveDbName, currentDbName, DEFAULT_DB_NAME };
