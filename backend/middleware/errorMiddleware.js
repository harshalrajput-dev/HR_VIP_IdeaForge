'use strict';

const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

/** 404 handler for unmatched routes. */
const notFound = (req, _res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

/* eslint-disable no-unused-vars */
// Central error handler. Translates known library errors into clean JSON.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details || [];

  // --- Mongoose: bad ObjectId -------------------------------------------
  if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid value "${err.value}" for field "${err.path}"`;
  }

  // --- Mongoose: schema validation ---------------------------------------
  if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 422;
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    message = 'Please correct the highlighted fields';
  }

  // --- MongoDB: duplicate key --------------------------------------------
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message =
      field === 'email'
        ? 'An account with that email already exists'
        : `Duplicate value for "${field}"`;
  }

  // --- Body parser / payload errors ---------------------------------------
  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Malformed JSON payload';
  }
  if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request payload too large';
  }

  // --- Rate limiter -------------------------------------------------------
  if (err.status === 429) {
    statusCode = 429;
    message = 'Too many requests, please try again later';
  }

  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${statusCode}: ${err.stack || err.message}`);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} -> ${statusCode}: ${message}`);
  }

  const body = {
    success: false,
    message: statusCode >= 500 && process.env.NODE_ENV === 'production' ? 'Something went wrong' : message,
    ...(details.length ? { errors: details } : {}),
  };

  if (process.env.NODE_ENV !== 'production' && statusCode >= 500) {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
};

module.exports = { notFound, errorHandler };
