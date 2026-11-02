const path = require('path');
const crypto = require('crypto');

// Load server/.env first (local dev), then any root .env. Hosted platforms inject real env vars.
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config();

const IS_PROD = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

const bool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const defaultSecret = `sf-lagos-prod-${crypto
  .createHash('sha256')
  .update(process.env.VERCEL_PROJECT_PRODUCTION_URL || 'stockflow-lagos-secret-key-2026')
  .digest('hex')}`;

const jwtSecret =
  process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16
    ? process.env.JWT_SECRET
    : defaultSecret;

const env = {
  IS_PROD,
  PORT: Number(process.env.PORT) || 5000,
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: jwtSecret,
  JWT_SECRET_MISSING: false,
  SESSION_DAYS: Number(process.env.SESSION_DAYS) || 7,

  ADMIN_EMAIL: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
  ADMIN_NAME: process.env.ADMIN_NAME || 'Administrator',

  AUTO_APPROVE_USERS: bool(process.env.AUTO_APPROVE_USERS, false),

  GOOGLE_CLIENT_ID: (process.env.GOOGLE_CLIENT_ID || '').trim(),
  APPLE_CLIENT_ID: (process.env.APPLE_CLIENT_ID || '').trim(),
  APPLE_REDIRECT_URI: (process.env.APPLE_REDIRECT_URI || '').trim(),

  SUPPORT_WHATSAPP: (process.env.SUPPORT_WHATSAPP || '2348000000000').replace(/[^\d]/g, ''),
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || '',
};

module.exports = env;
