const QRCode = require('qrcode');

/**
 * Generates QR code data URL for the /new endpoint
 * @param {string} customUrl - Custom URL from settings (optional)
 * @param {Object} req - Express request object
 * @returns {Promise<string>} QR code data URL
 */
async function generateQRCodeForNew(customUrl, req) {
  let qrUrl;
  
  if (customUrl && customUrl.trim()) {
    // Use custom URL + /new
    qrUrl = customUrl.trim().replace(/\/$/, '') + '/new';
  } else {
    // Use current domain + /new
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('host');
    qrUrl = `${protocol}://${host}/new`;
  }
  
  try {
    return await QRCode.toDataURL(qrUrl, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
}

/**
 * Generates QR code data URL for the /show endpoint
 * @param {string} customUrl - Custom URL from settings (optional)
 * @param {Object} req - Express request object
 * @returns {Promise<string>} QR code data URL
 */
async function generateQRCodeForShow(customUrl, req) {
  let qrUrl;
  
  if (customUrl && customUrl.trim()) {
    // Use custom URL + /new
    qrUrl = customUrl.trim().replace(/\/$/, '') + '/new';
  } else {
    // Replace 'show' with 'new' in current URL
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('host');
    const originalUrl = req.originalUrl || '/show';
    const newUrl = originalUrl.replace('/show', '/new');
    qrUrl = `${protocol}://${host}${newUrl}`;
  }
  
  try {
    return await QRCode.toDataURL(qrUrl, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
}

module.exports = {
  generateQRCodeForNew,
  generateQRCodeForShow
};
