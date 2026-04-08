/**
 * In-Memory Spendenliste für die aktuelle Server-Session.
 * Geht nach Neustart des Node-Prozesses verloren (gewollt).
 */

const donors = [];
/** @type {Map<string, { name: string, createdAt: number }>} */
const pending = new Map();
const completedRefs = new Set();
const processedCaptureIds = new Set();

const PENDING_TTL_MS = 60 * 60 * 1000;

function prunePending() {
  const now = Date.now();
  for (const [ref, data] of pending.entries()) {
    if (now - data.createdAt > PENDING_TTL_MS) pending.delete(ref);
  }
}

/**
 * @param {string} rawCustomId Format ref|encodeURIComponent(name) oder nur ref
 * @returns {{ ref: string | null, embeddedName: string | null }}
 */
function parseCustomId(rawCustomId) {
  const s = String(rawCustomId || '');
  const i = s.indexOf('|');
  if (i === -1) {
    return { ref: s || null, embeddedName: null };
  }
  const ref = s.slice(0, i) || null;
  let embeddedName = null;
  try {
    embeddedName = decodeURIComponent(s.slice(i + 1));
  } catch (_) {
    embeddedName = null;
  }
  return { ref, embeddedName };
}

function buildCustomId(ref, name) {
  const safeName = String(name || '')
    .trim()
    .slice(0, 40);
  const enc = encodeURIComponent(safeName || 'Gast');
  const combined = `${ref}|${enc}`;
  if (combined.length > 127) {
    const maxEnc = 127 - ref.length - 1;
    const shortEnc = enc.slice(0, Math.max(0, maxEnc));
    return `${ref}|${shortEnc}`;
  }
  return combined;
}

function registerPending(ref, name) {
  prunePending();
  const trimmed = String(name || '').trim().slice(0, 80);
  pending.set(ref, { name: trimmed || 'Gast', createdAt: Date.now() });
}

/**
 * @param {string} rawCustomId
 * @param {string} captureId
 * @param {{ amount?: string | null, currency?: string | null }} [paymentMeta]
 * @returns {{ added: boolean, name?: string }}
 */
function finalizeDonation(rawCustomId, captureId, paymentMeta = {}) {
  if (!captureId || processedCaptureIds.has(captureId)) return { added: false };

  const { ref, embeddedName } = parseCustomId(rawCustomId);
  if (!ref || completedRefs.has(ref)) return { added: false };

  prunePending();
  const p = pending.get(ref);
  let name = (p?.name || embeddedName || 'Gast').trim().slice(0, 80);
  if (!name) name = 'Gast';

  let amount =
    paymentMeta.amount != null && String(paymentMeta.amount).trim() !== ''
      ? String(paymentMeta.amount).trim()
      : '0.00';
  let currency = String(paymentMeta.currency || 'EUR')
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) currency = 'EUR';

  processedCaptureIds.add(captureId);
  completedRefs.add(ref);
  pending.delete(ref);
  donors.push({
    name,
    at: new Date().toISOString(),
    amount,
    currency,
  });
  return { added: true, name };
}

function getSessionDonors() {
  return donors.map((d) => ({
    name: d.name,
    at: d.at,
    amount: d.amount,
    currency: d.currency,
  }));
}

/**
 * Neueste Spenden zuerst, Summen pro Währung.
 * @returns {{ donations: Array<{ name: string, at: string, amount: string, currency: string }>, totals: Record<string, string>, count: number }}
 */
function getSessionDonationsReport() {
  const totalsNum = {};
  for (const d of donors) {
    const c = d.currency || 'EUR';
    const v = parseFloat(d.amount || '0');
    if (!Number.isFinite(v)) continue;
    totalsNum[c] = (totalsNum[c] || 0) + v;
  }
  const totals = {};
  for (const [c, sum] of Object.entries(totalsNum)) {
    totals[c] = sum.toFixed(2);
  }

  const donations = [...donors]
    .map((d) => ({
      name: d.name,
      at: d.at,
      amount: d.amount,
      currency: d.currency,
    }))
    .reverse();

  return { donations, totals, count: donors.length };
}

function getPendingName(ref) {
  return pending.get(ref)?.name;
}

function isRefCompleted(ref) {
  return completedRefs.has(ref);
}

module.exports = {
  registerPending,
  finalizeDonation,
  getSessionDonors,
  getSessionDonationsReport,
  getPendingName,
  isRefCompleted,
  buildCustomId,
};
