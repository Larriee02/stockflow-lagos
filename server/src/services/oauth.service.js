const { createRemoteJWKSet, jwtVerify } = require('jose');
const env = require('../config/env');
const AppError = require('../utils/AppError');

// JWKS sets are cached and refreshed automatically by jose.
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

/**
 * Verifies a Google Identity Services ID token (the `credential` returned by the GIS button).
 */
async function verifyGoogleIdToken(idToken) {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new AppError('Google sign-in is not enabled yet. Please use email and password.', 503, 'GOOGLE_NOT_CONFIGURED');
  }
  if (!idToken || typeof idToken !== 'string') {
    throw new AppError('Missing Google credential.', 400, 'INVALID_GOOGLE_TOKEN');
  }
  try {
    const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: env.GOOGLE_CLIENT_ID,
    });
    if (!payload.email) throw new Error('No email in token');
    return {
      sub: String(payload.sub),
      email: String(payload.email).toLowerCase(),
      emailVerified: payload.email_verified === true || payload.email_verified === 'true',
      name: payload.name || '',
      picture: payload.picture || null,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Google sign-in could not be verified. Please try again.', 401, 'INVALID_GOOGLE_TOKEN');
  }
}

/**
 * Verifies a Sign in with Apple ID token (from AppleID.auth.signIn()).
 * Apple only sends the user's name on the very first authorization, via the `user` object.
 */
async function verifyAppleIdToken(idToken) {
  if (!env.APPLE_CLIENT_ID) {
    throw new AppError('Apple sign-in is not enabled yet. Please use email and password.', 503, 'APPLE_NOT_CONFIGURED');
  }
  if (!idToken || typeof idToken !== 'string') {
    throw new AppError('Missing Apple credential.', 400, 'INVALID_APPLE_TOKEN');
  }
  try {
    const { payload } = await jwtVerify(idToken, APPLE_JWKS, {
      issuer: 'https://appleid.apple.com',
      audience: env.APPLE_CLIENT_ID,
    });
    return {
      sub: String(payload.sub),
      email: payload.email ? String(payload.email).toLowerCase() : null,
      emailVerified: payload.email_verified === true || payload.email_verified === 'true',
    };
  } catch (err) {
    throw new AppError('Apple sign-in could not be verified. Please try again.', 401, 'INVALID_APPLE_TOKEN');
  }
}

module.exports = { verifyGoogleIdToken, verifyAppleIdToken };
