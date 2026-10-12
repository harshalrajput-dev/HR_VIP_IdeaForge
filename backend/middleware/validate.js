'use strict';

const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/**
 * Terminates the express-validator chain and forwards a 422 to the error handler.
 * @type {import('express').RequestHandler}
 */
const validate = (req, _res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const details = result.array({ onlyFirstError: true }).map((error) => ({
    field: error.path ?? error.param,
    message: error.msg,
  }));

  return next(ApiError.unprocessable('Please correct the highlighted fields', details));
};

module.exports = validate;
