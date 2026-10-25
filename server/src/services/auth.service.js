const db = require('../config/db');
const AppError = require('../utils/AppError');

let cachedPin = null;
let settingsTableReady = false;

async function ensureSettingsTable() {
  if (settingsTableReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS store_settings (
      key VARCHAR(64) PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  const defaultPin = process.env.STORE_PIN || '1234';
  await db.query(
    `INSERT INTO store_settings (key, value)
     VALUES ('store_pin', $1)
     ON CONFLICT (key) DO NOTHING;`,
    [defaultPin]
  );
  settingsTableReady = true;
}

class AuthService {
  async getStorePin() {
    if (cachedPin) return cachedPin;
    await ensureSettingsTable();
    const res = await db.query(`SELECT value FROM store_settings WHERE key = 'store_pin' LIMIT 1;`);
    cachedPin = res.rows[0]?.value || process.env.STORE_PIN || '1234';
    return cachedPin;
  }

  async getPinStatus() {
    const activePin = await this.getStorePin();
    return {
      locked: true,
      isDefaultPin: activePin === '1234',
    };
  }

  async verifyPin(inputPin) {
    const cleanInput = String(inputPin || '').trim();
    const activePin = await this.getStorePin();
    if (!cleanInput || cleanInput !== activePin) {
      throw new AppError('Incorrect Store PIN. Please try again.', 401, 'INVALID_PIN');
    }
    return {
      authenticated: true,
      isDefaultPin: activePin === '1234',
    };
  }

  async changePin(currentPin, newPin) {
    const cleanCurrent = String(currentPin || '').trim();
    const cleanNew = String(newPin || '').trim();
    const activePin = await this.getStorePin();

    if (cleanCurrent !== activePin) {
      throw new AppError('Current Store PIN is incorrect.', 401, 'INVALID_PIN');
    }

    if (!/^\d{4,8}$/.test(cleanNew)) {
      throw new AppError('New PIN must be 4 to 8 digits (numbers only).', 400, 'VALIDATION_ERROR');
    }

    await ensureSettingsTable();
    await db.query(
      `UPDATE store_settings SET value = $1, updated_at = NOW() WHERE key = 'store_pin';`,
      [cleanNew]
    );
    cachedPin = cleanNew;

    return {
      updated: true,
      isDefaultPin: cleanNew === '1234',
    };
  }
}

module.exports = new AuthService();
