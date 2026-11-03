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

  AUTO_APPROVE_USERS: bool(process.env.AUTO_APPROVE_USERS, true),

  GOOGLE_CLIENT_ID: (process.env.GOOGLE_CLIENT_ID || '').trim(),
  APPLE_CLIENT_ID: (process.env.APPLE_CLIENT_ID || '').trim(),
  APPLE_REDIRECT_URI: (process.env.APPLE_REDIRECT_URI || '').trim(),

  // Email Notification Config (Resend, SendGrid, or SMTP)
  RESEND_API_KEY: (process.env.RESEND_API_KEY || '').trim(),
  SENDGRID_API_KEY: (process.env.SENDGRID_API_KEY || '').trim(),
  EMAIL_FROM: process.env.EMAIL_FROM || 'StockFlow <notifications@stockflowlagos.com>',
  SMTP_HOST: (process.env.SMTP_HOST || '').trim(),
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  SMTP_USER: (process.env.SMTP_USER || '').trim(),
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_SECURE: bool(process.env.SMTP_SECURE, false),

  // SMS Notification Config (Twilio, Termii, or Webhook)
  TWILIO_ACCOUNT_SID: (process.env.TWILIO_ACCOUNT_SID || '').trim(),
  TWILIO_AUTH_TOKEN: (process.env.TWILIO_AUTH_TOKEN || '').trim(),
  TWILIO_PHONE_NUMBER: (process.env.TWILIO_PHONE_NUMBER || '').trim(),
  TERMII_API_KEY: (process.env.TERMII_API_KEY || '').trim(),
  TERMII_SENDER_ID: (process.env.TERMII_SENDER_ID || 'StockFlow').trim(),
  SMS_WEBHOOK_URL: (process.env.SMS_WEBHOOK_URL || '').trim(),

  // Allow preview of OTP in response for development / sandbox testing only.
  // Defaults to FALSE in production so codes are never exposed over the wire.
  ALLOW_OTP_PREVIEW: bool(process.env.ALLOW_OTP_PREVIEW, !IS_PROD),

  SUPPORT_WHATSAPP: (process.env.SUPPORT_WHATSAPP || '2348000000000').replace(/[^\d]/g, ''),
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || '',
};

module.exports = env;
