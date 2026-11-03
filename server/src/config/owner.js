const bcrypt = require('bcryptjs');

/**
 * Platform Owner (sole administrator) configuration.
 *
 * Exactly ONE account may ever hold the ADMIN role: the platform owner.
 * - No one can register, sign in with OAuth, or be promoted into the ADMIN role.
 * - The owner account is provisioned automatically on boot.
 * - Override via environment variables (recommended):
 *     OWNER_EMAIL / ADMIN_EMAIL           -> owner email address
 *     OWNER_PASSWORD_HASH                 -> bcrypt hash of the owner password (preferred)
 *     OWNER_PASSWORD / ADMIN_PASSWORD     -> plaintext password (hashed at boot)
 * The plaintext password is never stored in source control; only a bcrypt hash.
 */
const DEFAULT_OWNER_EMAIL = 'lanresanni0@gmail.com';
const DEFAULT_OWNER_PASSWORD_HASH =
  '$2a$12$/z//YVO7ij8GRi4eJ7OzsuVdFGR/VwCwEj0voptj2jQd6jU28dKta';

const OWNER_EMAIL = String(
  process.env.OWNER_EMAIL || process.env.ADMIN_EMAIL || DEFAULT_OWNER_EMAIL
)
  .trim()
  .toLowerCase();

const OWNER_NAME = process.env.OWNER_NAME || process.env.ADMIN_NAME || 'Platform Owner';

let cachedHash = null;
function getOwnerPasswordHash() {
  if (cachedHash) return cachedHash;
  const plain = process.env.OWNER_PASSWORD || process.env.ADMIN_PASSWORD || '';
  if (process.env.OWNER_PASSWORD_HASH) {
    cachedHash = process.env.OWNER_PASSWORD_HASH;
  } else if (plain) {
    cachedHash = bcrypt.hashSync(plain, 12);
  } else {
    cachedHash = DEFAULT_OWNER_PASSWORD_HASH;
  }
  return cachedHash;
}

function isOwnerEmail(email) {
  return Boolean(email) && String(email).trim().toLowerCase() === OWNER_EMAIL;
}

function isOwnerUser(user) {
  return Boolean(user) && user.role === 'ADMIN' && isOwnerEmail(user.email);
}

module.exports = {
  OWNER_EMAIL,
  OWNER_NAME,
  getOwnerPasswordHash,
  isOwnerEmail,
  isOwnerUser,
};
