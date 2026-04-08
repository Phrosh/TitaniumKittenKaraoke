/**
 * Entfernt sensible Werte aus dem Settings-Objekt für API-/WebSocket-Antworten.
 * @param {Record<string, string>} settingsObj
 * @returns {Record<string, string>}
 */
function sanitizeSettingsForClient(settingsObj) {
  if (!settingsObj || typeof settingsObj !== 'object') return settingsObj;
  const out = { ...settingsObj };
  if (out.paypal_client_secret) {
    out.paypal_client_secret_configured = 'true';
  } else {
    out.paypal_client_secret_configured = 'false';
  }
  delete out.paypal_client_secret;
  return out;
}

module.exports = {
  sanitizeSettingsForClient,
};
