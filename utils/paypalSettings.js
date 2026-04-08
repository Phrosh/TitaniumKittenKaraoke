/**
 * PayPal-/Spenden-Konfiguration aus settings (SQLite) mit Fallback auf Umgebungsvariablen.
 */

const db = require('../config/database');

const KEYS = {
  publicUrl: 'paypal_public_url',
  clientId: 'paypal_client_id',
  clientSecret: 'paypal_client_secret',
  webhookId: 'paypal_webhook_id',
  currency: 'paypal_currency',
  defaultAmount: 'paypal_default_amount',
  brandName: 'paypal_brand_name',
  sandboxEnabled: 'paypal_sandbox_enabled',
};

const ALL_KEYS = Object.values(KEYS);

function stripTrailingSlash(url) {
  return String(url || '').replace(/\/$/, '');
}

/**
 * Liest alle PayPal-relevanten Keys aus der DB und kombiniert sie mit Env-Fallbacks.
 * @returns {Promise<{
 *   publicUrl: string,
 *   clientId: string,
 *   clientSecret: string,
 *   webhookId: string,
 *   currency: string,
 *   defaultAmount: string,
 *   brandName: string,
 *   isSandbox: boolean
 * }>}
 */
async function loadPayPalSettings() {
  const rows = await new Promise((resolve, reject) => {
    db.all(
      `SELECT key, value FROM settings WHERE key IN (${ALL_KEYS.map(() => '?').join(',')})`,
      ALL_KEYS,
      (err, r) => {
        if (err) reject(err);
        else resolve(r || []);
      }
    );
  });

  const map = {};
  rows.forEach((row) => {
    map[row.key] = row.value;
  });

  const dbPublic = stripTrailingSlash(map[KEYS.publicUrl] || '');
  const dbClientId = String(map[KEYS.clientId] || '').trim();
  const dbSecret = String(map[KEYS.clientSecret] || '').trim();
  const dbWebhook = String(map[KEYS.webhookId] || '').trim();
  let dbCurrency = String(map[KEYS.currency] || 'EUR')
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{3}$/.test(dbCurrency)) dbCurrency = 'EUR';

  let dbAmount = String(map[KEYS.defaultAmount] || '5.00').trim();
  const dbBrand = String(map[KEYS.brandName] || '').trim();

  let isSandbox;
  if (map[KEYS.sandboxEnabled] === undefined || map[KEYS.sandboxEnabled] === '') {
    isSandbox = process.env.PAYPAL_MODE !== 'live';
  } else {
    isSandbox = map[KEYS.sandboxEnabled] === 'true';
  }

  return {
    publicUrl: dbPublic || stripTrailingSlash(process.env.PUBLIC_URL || ''),
    clientId: dbClientId || String(process.env.PAYPAL_CLIENT_ID || '').trim(),
    clientSecret: dbSecret || String(process.env.PAYPAL_CLIENT_SECRET || '').trim(),
    webhookId: dbWebhook || String(process.env.PAYPAL_WEBHOOK_ID || '').trim(),
    currency: dbCurrency || (process.env.PAYPAL_CURRENCY || 'EUR').toUpperCase(),
    defaultAmount: dbAmount || String(process.env.PAYPAL_DEFAULT_AMOUNT || '5.00'),
    brandName: dbBrand || String(process.env.PAYPAL_BRAND_NAME || 'Karaoke').trim() || 'Karaoke',
    isSandbox,
  };
}

module.exports = {
  KEYS,
  loadPayPalSettings,
};
