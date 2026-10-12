'use strict';

const jwt = require('jsonwebtoken');
const ApiError = require('./ApiError');
const { ROLES } = require('../config/constants');

const JWT_ISSUER = 'hr-vip-ideaforge';
const JWT_AUDIENCE = 'hr-vip-ideaforge-clients';

/**
 * Sign an access token for a user document.
 * @param {{ _id: any, role: string }} user
 * @returns {string}
 */
const generateToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is missing. Refusing to issue tokens with an insecure secret.');
  }
  return jwt.sign(
    { sub: String(user._id), role: user.role || ROLES.USER },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }
  );
};

/**
 * Verify an access token.
 * @param {string} token
 * @returns {import('jsonwebtoken').JwtPayload}
 */
const verifyToken = (token) =>
  jwt.verify(token, process.env.JWT_SECRET, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE });

/** Extract a bearer token from the Authorization header (or an httpOnly cookie). */
const extractToken = (req) => {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  if (req.cookies && req.cookies.token) return req.cookies.token;
  return null;
};

const unauthorized = (message) => ApiError.unauthorized(message);

module.exports = { generateToken, verifyToken, extractToken, unauthorized };
