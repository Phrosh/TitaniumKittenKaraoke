const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const donationsStore = require('../utils/donationsStore');
const { broadcastShowUpdate } = require('../utils/websocketService');
const paypalSettings = require('../utils/paypalSettings');

function formatAmount(val) {
  const n = Number(val);
  if (!Number.isFinite(n) || n < 1 || n > 500) return null;
  return n.toFixed(2);
}

async function getRuntime() {
  const s = await paypalSettings.loadPayPalSettings();
  const configured = !!(s.publicUrl && s.clientId && s.clientSecret);
  const apiBase = s.isSandbox
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';
  return { ...s, configured, apiBase };
}

async function getAccessToken(runtime) {
  const auth = Buffer.from(`${runtime.clientId}:${runtime.clientSecret}`).toString('base64');
  const { data } = await axios.post(
    `${runtime.apiBase}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 20000,
    }
  );
  return data.access_token;
}

async function verifyWebhookSignature(runtime, accessToken, headers, webhookEvent) {
  const webhookId = runtime.webhookId;
  if (!webhookId) return true;

  const verifyPayload = {
    transmission_id: headers['paypal-transmission-id'],
    transmission_time: headers['paypal-transmission-time'],
    cert_url: headers['paypal-cert-url'],
    auth_algo: headers['paypal-auth-algo'],
    transmission_sig: headers['paypal-transmission-sig'],
    webhook_id: webhookId,
    webhook_event: webhookEvent,
  };

  if (!verifyPayload.transmission_id || !verifyPayload.transmission_sig) {
    return false;
  }

  const { data } = await axios.post(
    `${runtime.apiBase}/v1/notifications/verify-webhook-signature`,
    verifyPayload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    }
  );
  return data.verification_status === 'SUCCESS';
}

function extractCaptureMeta(capturePayload) {
  const purchaseUnits = capturePayload?.purchase_units || capturePayload?.purchaseUnits;
  const unit0 = Array.isArray(purchaseUnits) ? purchaseUnits[0] : null;
  const payments = unit0?.payments;
  const captures = payments?.captures;
  const cap0 = Array.isArray(captures) ? captures[0] : null;
  if (!cap0?.id) return null;
  const customId = cap0.custom_id || unit0?.custom_id || '';
  const amt = cap0.amount || {};
  const amount =
    amt.value != null && String(amt.value).trim() !== '' ? String(amt.value).trim() : null;
  const currency = amt.currency_code ? String(amt.currency_code).toUpperCase() : null;
  return {
    captureId: cap0.id,
    customId: String(customId || ''),
    amount,
    currency,
  };
}

function extractWebhookPayment(resource) {
  const a = resource?.amount;
  if (!a) return { amount: null, currency: null };
  return {
    amount: a.value != null && String(a.value).trim() !== '' ? String(a.value).trim() : null,
    currency: a.currency_code ? String(a.currency_code).toUpperCase() : null,
  };
}

function emitAfterDonation(getIo, name) {
  const io = getIo();
  if (!io) return;
  io.to('show').emit('donation-thanks', {
    name,
    timestamp: new Date().toISOString(),
  });
  io.to('admin').emit('donations-session-update', donationsStore.getSessionDonationsReport());
}

module.exports = function createDonationsRouter(getIo) {
  const router = express.Router();

  router.get('/config', async (req, res) => {
    try {
      const rt = await getRuntime();
      res.json({
        enabled: rt.configured,
        currency: rt.currency || 'EUR',
        defaultAmount: formatAmount(rt.defaultAmount) || '5.00',
        mode: rt.isSandbox ? 'sandbox' : 'live',
      });
    } catch (e) {
      console.error('donations /config:', e);
      res.status(500).json({ enabled: false, currency: 'EUR', defaultAmount: '5.00', mode: 'sandbox' });
    }
  });

  router.get('/session-donors', (req, res) => {
    res.json({ donors: donationsStore.getSessionDonors() });
  });

  router.get('/status/:ref', (req, res) => {
    const { ref } = req.params;
    if (!ref || donationsStore.isRefCompleted(ref)) {
      return res.json({ status: 'completed' });
    }
    const name = donationsStore.getPendingName(ref);
    if (name !== undefined) return res.json({ status: 'pending' });
    return res.json({ status: 'unknown' });
  });

  router.post('/create-order', async (req, res) => {
    let rt;
    try {
      rt = await getRuntime();
    } catch (e) {
      return res.status(500).json({ message: 'Konfiguration konnte nicht geladen werden.' });
    }
    if (!rt.configured) {
      return res.status(503).json({ message: 'Spenden sind nicht konfiguriert.' });
    }
    const { donorName, amount, currency } = req.body || {};
    const name = String(donorName || '').trim();
    if (!name) {
      return res.status(400).json({ message: 'Name fehlt.' });
    }
    const cur = String(currency || rt.currency || 'EUR').toUpperCase();
    const amt = formatAmount(amount ?? rt.defaultAmount ?? '5.00');
    if (!amt) {
      return res.status(400).json({ message: 'Ungültiger Betrag (1–500).' });
    }

    const ref = crypto.randomUUID();
    donationsStore.registerPending(ref, name);
    const customId = donationsStore.buildCustomId(ref, name);

    const basePublic = rt.publicUrl;
    const returnUrl = `${basePublic}/api/donations/paypal/return?ref=${encodeURIComponent(ref)}`;
    const cancelUrl = `${basePublic}/new?donation=cancel`;

    try {
      const token = await getAccessToken(rt);
      const { data } = await axios.post(
        `${rt.apiBase}/v2/checkout/orders`,
        {
          intent: 'CAPTURE',
          purchase_units: [
            {
              reference_id: ref.slice(0, 22),
              custom_id: customId,
              amount: { currency_code: cur, value: amt },
              description: 'Karaoke-Spende',
            },
          ],
          application_context: {
            return_url: returnUrl,
            cancel_url: cancelUrl,
            brand_name: rt.brandName || 'Karaoke',
            user_action: 'PAY_NOW',
            /* Keine Lieferadresse: reine Spende / digital — reduziert PayPal-Formularfelder.
               Rechnungsadresse & Telefon kann PayPal dennoch z. B. bei Gastzahlung oder aus regulatorischen Gründen abfragen. */
            shipping_preference: 'NO_SHIPPING',
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'PayPal-Request-Id': ref,
          },
          timeout: 30000,
        }
      );

      const approve = (data.links || []).find((l) => l.rel === 'approve');
      if (!approve?.href) {
        return res.status(502).json({ message: 'Keine PayPal-Zustimmungs-URL erhalten.' });
      }

      return res.json({
        ref,
        approvalUrl: approve.href,
        orderId: data.id,
      });
    } catch (err) {
      console.error('PayPal create-order:', err.response?.data || err.message);
      return res.status(502).json({
        message: 'PayPal-Auftrag konnte nicht erstellt werden.',
        detail: err.response?.data?.message || err.message,
      });
    }
  });

  router.get('/paypal/return', async (req, res) => {
    const ref = req.query.ref ? String(req.query.ref) : '';
    const orderId = req.query.token ? String(req.query.token) : '';
    let rt;
    try {
      rt = await getRuntime();
    } catch (e) {
      return res.redirect('/new?donation=error');
    }
    const basePublic = rt.publicUrl || '';

    if (!rt.configured || !ref || !orderId || !basePublic) {
      const errTarget = basePublic ? `${basePublic}/new?donation=error` : '/new?donation=error';
      return res.redirect(errTarget);
    }

    try {
      const accessToken = await getAccessToken(rt);
      const { data } = await axios.post(
        `${rt.apiBase}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const meta = extractCaptureMeta(data);
      if (!meta || !meta.customId.startsWith(ref)) {
        console.warn('PayPal capture: custom_id/ref Prüfung', { ref, meta });
      }
      if (meta?.captureId) {
        const { added, name } = donationsStore.finalizeDonation(meta.customId, meta.captureId, {
          amount: meta.amount,
          currency: meta.currency,
        });
        if (added) {
          const io = getIo();
          if (io) {
            await broadcastShowUpdate(io);
            emitAfterDonation(getIo, name);
          }
        }
      }

      return res.redirect(`${basePublic}/new?donation=ok&ref=${encodeURIComponent(ref)}`);
    } catch (err) {
      const details = err.response?.data?.details;
      const already =
        Array.isArray(details) &&
        details.some((d) => d.issue === 'ORDER_ALREADY_CAPTURED');
      if (already) {
        try {
          const accessToken = await getAccessToken(rt);
          const { data: orderData } = await axios.get(
            `${rt.apiBase}/v2/checkout/orders/${encodeURIComponent(orderId)}`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              timeout: 20000,
            }
          );
          const meta = extractCaptureMeta(orderData);
          if (meta?.captureId) {
            const { added, name } = donationsStore.finalizeDonation(meta.customId, meta.captureId, {
              amount: meta.amount,
              currency: meta.currency,
            });
            if (added) {
              const io = getIo();
              if (io) {
                await broadcastShowUpdate(io);
                emitAfterDonation(getIo, name);
              }
            }
          }
        } catch (e) {
          console.warn('PayPal ORDER_ALREADY_CAPTURED Nachbearbeitung:', e.message);
        }
        return res.redirect(`${basePublic}/new?donation=ok&ref=${encodeURIComponent(ref)}`);
      }
      console.error('PayPal capture error:', err.response?.data || err.message);
      return res.redirect(`${basePublic}/new?donation=error`);
    }
  });

  router.post('/paypal-webhook', async (req, res) => {
    let rt;
    try {
      rt = await getRuntime();
    } catch (e) {
      return res.status(503).send('disabled');
    }
    if (!rt.configured) {
      return res.status(503).send('disabled');
    }

    let eventObj;
    try {
      eventObj = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(req.rawBody || '{}');
    } catch (e) {
      return res.status(400).send('bad json');
    }

    try {
      const accessToken = await getAccessToken(rt);
      const ok = await verifyWebhookSignature(rt, accessToken, req.headers, eventObj);
      if (!ok) {
        console.warn('PayPal Webhook: Signaturprüfung fehlgeschlagen');
        return res.status(400).send('invalid signature');
      }
    } catch (e) {
      console.error('PayPal Webhook verify error:', e.message);
      return res.status(500).send('verify error');
    }

    const eventType = eventObj.event_type;
    if (eventType !== 'PAYMENT.CAPTURE.COMPLETED') {
      return res.json({ received: true });
    }

    const resource = eventObj.resource || {};
    const captureId = resource.id;
    const customIdRaw = String(resource.custom_id || '');

    if (!captureId || !customIdRaw) {
      return res.json({ received: true });
    }

    const pay = extractWebhookPayment(resource);
    const { added, name } = donationsStore.finalizeDonation(customIdRaw, captureId, pay);
    if (added) {
      try {
        const io = getIo();
        if (io) {
          await broadcastShowUpdate(io);
          emitAfterDonation(getIo, name);
        }
      } catch (e) {
        console.error('Donation broadcast error:', e);
      }
    }

    return res.json({ received: true });
  });

  return router;
};
