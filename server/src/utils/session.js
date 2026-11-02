const { SignJWT, jwtVerify } = require('jose');
const env = require('../config/env');
const AppError = require('./AppError');

const COOKIE_NAME = 'sf_session';
const secretKey = () => {
  if (env.JWT_SECRET_MISSING) {
    throw new AppError(
      'Server authentication is not configured (JWT_SECRET missing). Contact the administrator.',
      503,
      'AUTH_NOT_CONFIGURED'
    );
  }
  return new TextEncoder().encode(env.JWT_SECRET);
};

async function signSession(user) {
  return new SignJWT({ tv: user.token_version || 0 })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setIssuer('stockflow')
    .setExpirationTime(`${env.SESSION_DAYS}d`)
    .sign(secretKey());
}

async function verifySession(token) {
  const { payload } = await jwtVerify(token, secretKey(), { issuer: 'stockflow' });
  return { userId: Number(payload.sub), tokenVersion: Number(payload.tv || 0) };
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.IS_PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: env.SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
}

async function issueSessionCookie(res, user) {
  const token = await signSession(user);
  res.cookie(COOKIE_NAME, token, cookieOptions());
  return token;
}

function clearSessionCookie(res) {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie(COOKIE_NAME, opts);
}

function readToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === COOKIE_NAME) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

module.exports = { signSession, verifySession, issueSessionCookie, clearSessionCookie, readToken };
