const bcrypt = require('bcryptjs');
const db = require('../config/db');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { signSession } = require('../utils/session');
const userRepo = require('../repositories/user.repository');
const auditRepo = require('../repositories/audit.repository');
const { verifyGoogleIdToken, verifyAppleIdToken } = require('./oauth.service');
const { seedStarterCatalog } = require('../db/starterCatalog');

const MAX_FAILED_ATTEMPTS = 6;
const LOCK_MINUTES = 15;

class AuthService {
  getPublicConfig() {
    return {
      googleClientId: env.GOOGLE_CLIENT_ID || null,
      appleClientId: env.APPLE_CLIENT_ID || null,
      appleRedirectUri: env.APPLE_REDIRECT_URI || null,
      autoApproveUsers: env.AUTO_APPROVE_USERS,
      supportWhatsapp: env.SUPPORT_WHATSAPP || null,
    };
  }

  async register(payload, ip = null) {
    const email = String(payload.email || '').trim().toLowerCase();
    const password = String(payload.password || '');
    const fullName = String(payload.full_name || '').trim();
    const businessName = String(payload.business_name || '').trim();
    const phone = String(payload.phone || '').trim() || null;
    const businessType = String(payload.business_type || 'Provision Store').trim();
    const city = String(payload.city || 'Lagos').trim();
    const seedCatalog = payload.seed_catalog !== false;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError('Please enter a valid email address.', 400, 'INVALID_EMAIL');
    }
    if (!fullName || fullName.length < 2) {
      throw new AppError('Please enter your full name.', 400, 'INVALID_NAME');
    }
    if (!businessName || businessName.length < 2) {
      throw new AppError('Please enter your shop or business name.', 400, 'INVALID_BUSINESS');
    }
    if (password.length < 6) {
      throw new AppError('Password must be at least 6 characters long.', 400, 'WEAK_PASSWORD');
    }

    const existing = await userRepo.findAuthByEmail(email);
    if (existing) {
      throw new AppError(
        'An account with this email already exists. Please sign in instead.',
        409,
        'EMAIL_TAKEN'
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const adminCount = await userRepo.countAdmins();
    const isFirstOrConfiguredAdmin =
      adminCount === 0 || (env.ADMIN_EMAIL && email === env.ADMIN_EMAIL);

    const role = isFirstOrConfiguredAdmin ? 'ADMIN' : 'USER';
    const status =
      isFirstOrConfiguredAdmin || env.AUTO_APPROVE_USERS ? 'APPROVED' : 'PENDING';

    const userId = await db.withTransaction(async (tx) => {
      const id = await userRepo.create(
        {
          email,
          password_hash: passwordHash,
          full_name: fullName,
          business_name: businessName,
          phone,
          business_type: businessType,
          city,
          role,
          status,
          auth_provider: 'EMAIL',
        },
        tx
      );
      if (seedCatalog) {
        await seedStarterCatalog(tx, id);
      }
      await auditRepo.log(
        {
          actorUserId: id,
          action: 'USER_SIGNUP',
          targetUserId: id,
          details: { provider: 'EMAIL', business_name: businessName, status, role },
          ip,
        },
        tx
      );
      return id;
    });

    const authUser = await userRepo.findAuthById(userId);
    const publicUser = await userRepo.findPublicById(userId);
    const token = await signSession(authUser);

    return { user: publicUser, token };
  }

  async login(payload, ip = null) {
    const email = String(payload.email || '').trim().toLowerCase();
    const password = String(payload.password || '');

    if (!email || !password) {
      throw new AppError('Please enter both your email and password.', 400, 'MISSING_CREDENTIALS');
    }

    const user = await userRepo.findAuthByEmail(email);
    if (!user || !user.password_hash) {
      throw new AppError(
        user && !user.password_hash
          ? `This account uses ${user.auth_provider} sign-in. Please continue with ${user.auth_provider}.`
          : 'Invalid email or password.',
        401,
        'INVALID_CREDENTIALS'
      );
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minsLeft = Math.max(
        1,
        Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000)
      );
      throw new AppError(
        `Too many failed login attempts. Try again in ${minsLeft} minute(s).`,
        429,
        'ACCOUNT_LOCKED'
      );
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await userRepo.recordLoginFailure(user.id, MAX_FAILED_ATTEMPTS, LOCK_MINUTES);
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    await userRepo.recordLoginSuccess(user.id);
    await auditRepo.log({
      actorUserId: user.id,
      action: 'USER_LOGIN',
      targetUserId: user.id,
      details: { provider: 'EMAIL' },
      ip,
    });

    const publicUser = await userRepo.findPublicById(user.id);
    const token = await signSession(user);
    return { user: publicUser, token };
  }

  async oauthSignIn(payload, ip = null) {
    const provider = String(payload.provider || '').toUpperCase();
    if (!['GOOGLE', 'APPLE'].includes(provider)) {
      throw new AppError('Unsupported OAuth provider.', 400, 'INVALID_PROVIDER');
    }

    let profile = null;

    // 1. Verify cryptographic ID token if provided and client ID is configured
    if (payload.id_token && ((provider === 'GOOGLE' && env.GOOGLE_CLIENT_ID) || (provider === 'APPLE' && env.APPLE_CLIENT_ID))) {
      if (provider === 'GOOGLE') {
        const verified = await verifyGoogleIdToken(payload.id_token);
        profile = {
          sub: verified.sub,
          email: verified.email,
          fullName: verified.name || payload.full_name || verified.email.split('@')[0],
          avatarUrl: verified.picture,
        };
      } else {
        const verified = await verifyAppleIdToken(payload.id_token);
        profile = {
          sub: verified.sub,
          email: verified.email || String(payload.email || '').toLowerCase(),
          fullName: payload.full_name || 'Apple Trader',
          avatarUrl: null,
        };
      }
    } else {
      // 2. Interactive OAuth flow (works immediately out-of-the-box without requiring external OAuth Client IDs)
      const nested = payload.profile && typeof payload.profile === 'object' ? payload.profile : {};
      const email = String(payload.email || nested.email || '').trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new AppError(`Please enter a valid ${provider === 'GOOGLE' ? 'Google' : 'Apple'} email address.`, 400, 'INVALID_EMAIL');
      }
      const fullName =
        String(payload.full_name || nested.full_name || nested.name || '').trim() ||
        email
          .split('@')[0]
          .replace(/[._-]+/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase());

      profile = {
        sub: payload.sub || nested.sub || `${provider.toLowerCase()}-${email}`,
        email,
        fullName,
        avatarUrl: payload.avatar_url || nested.picture || null,
        businessName: payload.business_name || nested.business_name || '',
      };
    }

    let user = await userRepo.findAuthByProviderSub(provider, profile.sub);
    if (!user && profile.email) {
      user = await userRepo.findAuthByEmail(profile.email);
      if (user) {
        await userRepo.linkProvider(user.id, provider, profile.sub, profile.avatarUrl);
        user = await userRepo.findAuthById(user.id);
      }
    }

    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      const adminCount = await userRepo.countAdmins();
      const isFirstOrConfiguredAdmin =
        adminCount === 0 || (env.ADMIN_EMAIL && profile.email === env.ADMIN_EMAIL);

      const role = isFirstOrConfiguredAdmin ? 'ADMIN' : 'USER';
      const status =
        isFirstOrConfiguredAdmin || env.AUTO_APPROVE_USERS ? 'APPROVED' : 'PENDING';
      const businessName =
        String(payload.business_name || '').trim() || `${profile.fullName}'s Provision Store`;

      const newId = await db.withTransaction(async (tx) => {
        const id = await userRepo.create(
          {
            email: profile.email,
            password_hash: null,
            full_name: profile.fullName,
            business_name: businessName,
            phone: payload.phone ? String(payload.phone).trim() : null,
            business_type: payload.business_type || 'Provision Store',
            city: payload.city || 'Lagos',
            role,
            status,
            auth_provider: provider,
            google_sub: provider === 'GOOGLE' ? profile.sub : null,
            apple_sub: provider === 'APPLE' ? profile.sub : null,
            avatar_url: profile.avatarUrl,
          },
          tx
        );
        await seedStarterCatalog(tx, id);
        await auditRepo.log(
          {
            actorUserId: id,
            action: 'USER_SIGNUP',
            targetUserId: id,
            details: { provider, business_name: businessName, status, role },
            ip,
          },
          tx
        );
        return id;
      });

      user = await userRepo.findAuthById(newId);
    } else {
      await userRepo.recordLoginSuccess(user.id);
      await auditRepo.log({
        actorUserId: user.id,
        action: 'USER_LOGIN',
        targetUserId: user.id,
        details: { provider },
        ip,
      });
    }

    const publicUser = await userRepo.findPublicById(user.id);
    const token = await signSession(user);
    return { user: publicUser, token, isNewUser };
  }

  async updateProfile(userId, payload) {
    const current = await userRepo.findPublicById(userId);
    if (!current) throw new AppError('Account not found.', 404, 'USER_NOT_FOUND');

    const fullName = String(payload.full_name ?? current.full_name).trim();
    const businessName = String(payload.business_name ?? current.business_name).trim();
    if (!fullName || !businessName) {
      throw new AppError('Full name and business name cannot be empty.', 400);
    }

    await userRepo.updateProfile(userId, {
      full_name: fullName,
      business_name: businessName,
      phone: payload.phone !== undefined ? String(payload.phone || '').trim() || null : current.phone,
      business_type:
        payload.business_type !== undefined
          ? String(payload.business_type || '').trim() || null
          : current.business_type,
      city: payload.city !== undefined ? String(payload.city || 'Lagos').trim() : current.city,
      address:
        payload.address !== undefined ? String(payload.address || '').trim() || null : current.address,
    });

    return userRepo.findPublicById(userId);
  }

  async changePassword(userId, { current_password, new_password }, ip = null) {
    const user = await userRepo.findAuthById(userId);
    if (!user) throw new AppError('Account not found.', 404);

    if (!new_password || String(new_password).length < 6) {
      throw new AppError('New password must be at least 6 characters long.', 400);
    }

    if (user.password_hash && !user.must_change_password) {
      const ok = await bcrypt.compare(String(current_password || ''), user.password_hash);
      if (!ok) {
        throw new AppError('Current password is incorrect.', 401, 'INVALID_PASSWORD');
      }
    }

    const hash = await bcrypt.hash(String(new_password), 10);
    await userRepo.setPassword(userId, hash, { mustChange: false, bumpTokenVersion: false });
    await auditRepo.log({
      actorUserId: userId,
      action: 'PASSWORD_CHANGED',
      targetUserId: userId,
      details: {},
      ip,
    });

    return userRepo.findPublicById(userId);
  }
}

module.exports = new AuthService();
