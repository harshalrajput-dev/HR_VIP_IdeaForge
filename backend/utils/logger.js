'use strict';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL] ?? (process.env.NODE_ENV === 'production' ? LEVELS.info : LEVELS.debug);

const ts = () => new Date().toISOString();

const write = (stream, level, args) => {
  if ((LEVELS[level] ?? 99) > currentLevel) return;
  stream(`${ts()} [${level.toUpperCase()}]`, ...args);
};

/* eslint-disable no-console */
const logger = {
  error: (...args) => write(console.error, 'error', args),
  warn: (...args) => write(console.warn, 'warn', args),
  info: (...args) => write(console.log, 'info', args),
  debug: (...args) => write(console.log, 'debug', args),
};

module.exports = logger;
