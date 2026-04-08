/**
 * Texte für Spender-Marquee und Dankes-Overlay auf /show (Settings / DB).
 */
const db = require('../config/database');

const KEYS = {
  marqueeTemplate: 'donation_marquee_template',
  notificationTemplate: 'donation_notification_template',
  marqueeSeparator: 'donation_marquee_separator',
  /** Gastseite /new: Dankeschön nach Spende; leer = Standard aus Übersetzung */
  newPageThankYou: 'donation_new_page_thankyou',
};

const DEFAULTS = {
  donationMarqueeTemplate: 'Vielen Dank an die Spender: {names}',
  donationNotificationTemplate: 'Danke an {name} für diese Spende!',
  donationMarqueeSeparator: '+++',
};

const ALL_KEYS = Object.values(KEYS);

function mapRowsToDisplay(rows) {
  const map = {};
  (rows || []).forEach((row) => {
    map[row.key] = row.value;
  });
  const rawNewThank = map[KEYS.newPageThankYou];
  const donationNewPageThankYou =
    rawNewThank !== undefined && rawNewThank !== null ? String(rawNewThank) : '';

  return {
    donationMarqueeTemplate: map[KEYS.marqueeTemplate] || DEFAULTS.donationMarqueeTemplate,
    donationNotificationTemplate:
      map[KEYS.notificationTemplate] || DEFAULTS.donationNotificationTemplate,
    donationMarqueeSeparator: map[KEYS.marqueeSeparator] || DEFAULTS.donationMarqueeSeparator,
    donationNewPageThankYou,
  };
}

async function loadDonationDisplaySettings() {
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
  return mapRowsToDisplay(rows);
}

function applyNotificationTemplate(template, name) {
  const n = String(name || '').trim();
  const t = String(template || DEFAULTS.donationNotificationTemplate);
  return t.replace(/\{name\}/gi, n || '…');
}

function buildMarqueeSegment(template, separator, donorNames) {
  const namesList = donorNames.map((x) => String(x).trim()).filter(Boolean);
  const sep = String(separator ?? DEFAULTS.donationMarqueeSeparator).trim() || '+++';
  const namesJoined = namesList.join(` ${sep} `);
  const tpl = String(template || DEFAULTS.donationMarqueeTemplate);
  return tpl.replace(/\{names\}/gi, namesJoined);
}

module.exports = {
  KEYS,
  DEFAULTS,
  loadDonationDisplaySettings,
  applyNotificationTemplate,
  buildMarqueeSegment,
};
