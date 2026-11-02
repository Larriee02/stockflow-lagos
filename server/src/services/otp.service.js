const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const notificationService = require('./notification.service');

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const COOLDOWN_MS = 30 * 1000; // 30 seconds between requests
const MAX_ATTEMPTS = 5;

// In-memory challenge store with periodic garbage collection
const challengeStore = new Map();

function cleanExpired() {
  const now = Date.now();
  for (const [key, value] of challengeStore.entries()) {
    if (value.expiresAt < now) {
      challengeStore.delete(key);
    }
  }
}
setInterval(cleanExpired, 60 * 1000).unref?.();

function generateCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}

function maskPhone(phone) {
  if (!phone) return null;
  const cleaned = String(phone).replace(/\s+/g, '');
  if (cleaned.length <= 4) return cleaned;
  return `${cleaned.slice(0, 4)}***${cleaned.slice(-3)}`;
}

class OtpService {
  /**
   * Request an OTP for SIGNUP or LOGIN
   */
  async requestOtp({
    purpose = 'LOGIN',
    email,
    phone = null,
    channel = 'EMAIL',
    recipientName = '',
    payload = null, // e.g. temporary signup data or userId
  }) {
    const cleanEmail = email ? String(email).trim().toLowerCase() : null;
    const cleanPhone = phone ? String(phone).trim() : null;

    if (!cleanEmail && !cleanPhone) {
      throw new AppError('An email address or phone number is required for verification.', 400);
    }

    const key = `${purpose}:${cleanEmail || cleanPhone}`;
    const existing = challengeStore.get(key);

    if (existing && Date.now() - existing.lastRequestedAt < COOLDOWN_MS) {
      const waitSec = Math.ceil((COOLDOWN_MS - (Date.now() - existing.lastRequestedAt)) / 1000);
      throw new AppError(
        `Please wait ${waitSec} second(s) before requesting another verification code.`,
        429,
        'COOLDOWN_ACTIVE'
      );
    }

    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 8);
    const expiresAt = Date.now() + OTP_EXPIRY_MS;

    challengeStore.set(key, {
      codeHash,
      purpose,
      email: cleanEmail,
      phone: cleanPhone,
      channel,
      payload,
      recipientName,
      attempts: 0,
      createdAt: Date.now(),
      lastRequestedAt: Date.now(),
      expiresAt,
    });

    const deliveries = [];

    // Send via Email
    if (cleanEmail && (channel === 'EMAIL' || channel === 'BOTH')) {
      deliveries.push(
        notificationService
          .sendEmailOtp({
            to: cleanEmail,
            code,
            recipientName,
            purpose,
          })
          .then((res) => ({ channel: 'EMAIL', ...res }))
          .catch((err) => {
            console.warn('[OtpService] Email notification error:', err.message);
            return { channel: 'EMAIL', error: err.message };
          })
      );
    }

    // Send via SMS
    if (cleanPhone && (channel === 'SMS' || channel === 'BOTH')) {
      deliveries.push(
        notificationService
          .sendSmsOtp({
            phone: cleanPhone,
            code,
            purpose,
          })
          .then((res) => ({ channel: 'SMS', ...res }))
          .catch((err) => {
            console.warn('[OtpService] SMS notification error:', err.message);
            return { channel: 'SMS', error: err.message };
          })
      );
    }

    const deliveryResults = await Promise.all(deliveries);

    const maskedDestination =
      channel === 'BOTH'
        ? `${maskEmail(cleanEmail)} and ${maskPhone(cleanPhone)}`
        : channel === 'SMS'
        ? maskPhone(cleanPhone)
        : maskEmail(cleanEmail);

    const response = {
      success: true,
      purpose,
      channel,
      maskedDestination,
      expiresInSeconds: Math.floor(OTP_EXPIRY_MS / 1000),
      message: `Verification code sent to ${maskedDestination}.`,
      deliveryResults,
    };

    if (env.ALLOW_OTP_PREVIEW) {
      response.otpPreview = code;
    }

    return response;
  }

  /**
   * Verify an OTP challenge
   */
  async verifyOtp({ purpose, email, phone = null, code }) {
    const cleanEmail = email ? String(email).trim().toLowerCase() : null;
    const cleanPhone = phone ? String(phone).trim() : null;
    const cleanCode = String(code || '').trim();

    if (!cleanCode) {
      throw new AppError('Please enter the 6-digit verification code.', 400, 'OTP_REQUIRED');
    }

    const key = `${purpose}:${cleanEmail || cleanPhone}`;
    const challenge = challengeStore.get(key);

    if (!challenge) {
      throw new AppError(
        'Verification code has expired or was not requested. Please request a new code.',
        400,
        'OTP_NOT_FOUND'
      );
    }

    if (challenge.expiresAt < Date.now()) {
      challengeStore.delete(key);
      throw new AppError(
        'Verification code has expired. Please request a new code.',
        400,
        'OTP_EXPIRED'
      );
    }

    if (challenge.attempts >= MAX_ATTEMPTS) {
      challengeStore.delete(key);
      throw new AppError(
        'Too many incorrect attempts. Please request a new verification code.',
        429,
        'TOO_MANY_ATTEMPTS'
      );
    }

    const valid = await bcrypt.compare(cleanCode, challenge.codeHash);
    if (!valid) {
      challenge.attempts += 1;
      const remaining = MAX_ATTEMPTS - challenge.attempts;
      throw new AppError(
        `Incorrect verification code. ${remaining} attempt(s) remaining.`,
        400,
        'INVALID_OTP'
      );
    }

    // OTP Verified! Consume the challenge so it cannot be re-used.
    challengeStore.delete(key);

    return {
      verified: true,
      purpose: challenge.purpose,
      email: challenge.email,
      phone: challenge.phone,
      payload: challenge.payload,
    };
  }
}

module.exports = new OtpService();
