/**
 * Zentrale QR-Code-Generierung für konsistente URLs
 */

const QRCode = require('qrcode');

/**
 * Generiert einen QR-Code für die /new URL
 * @param {string} customUrl - Optionale custom URL aus Settings
 * @param {string} fallbackUrl - Fallback URL wenn keine custom URL gesetzt ist
 * @returns {Promise<string|null>} - QR-Code als Data URL
 */
const generateQRCodeDataUrl = async (customUrl, fallbackUrl = 'http://localhost:5000/new') => {
  try {
    let qrUrl;
    
    if (customUrl && customUrl.trim()) {
      // Use custom URL + /new
      qrUrl = customUrl.trim().replace(/\/$/, '') + '/new';
    } else {
      // Use fallback URL
      qrUrl = fallbackUrl;
    }
    
    const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 300
    });
    
    return qrCodeDataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    return null;
  }
};

module.exports = {
  generateQRCodeDataUrl
};