const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { broadcastQRCodeToggle, broadcastAdminUpdate } = require('../../utils/websocketService');

// Generate QR code data
router.get('/qr-data', async (req, res) => {
  try {
    // Get custom URL from settings
    const db = require('../../config/database');
    const customUrlSetting = await new Promise((resolve, reject) => {
      db.get(
        'SELECT value FROM settings WHERE key = ?',
        ['custom_url'],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    const customUrl = customUrlSetting ? customUrlSetting.value : '';
    
    // Use same domain for QR code generation as fallback
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('host');
    const fallbackUrl = `${protocol}://${host}/new`;
    
    // Use centralized QR code generation function
    const { generateQRCodeDataUrl } = require('../../utils/qrCodeGenerator');
    const qrCodeDataUrl = await generateQRCodeDataUrl(customUrl, fallbackUrl);
    

    const qrData = {
      url: customUrl && customUrl.trim() ? customUrl.trim().replace(/\/$/, '') + '/new' : fallbackUrl,
      qrCodeDataUrl: qrCodeDataUrl,
      timestamp: new Date().toISOString()
    };
    
    res.json(qrData);
  } catch (error) {
    console.error('Error generating QR data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Public route to toggle QR overlay (for automatic overlay when videos end)
router.put('/qr-overlay', [
  body('show').isBoolean().withMessage('Show muss ein Boolean sein')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { show } = req.body;
    const db = require('../../config/database');

    // Store overlay status in settings
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['show_qr_overlay', show.toString()],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Broadcast QR code toggle via WebSocket
    const io = req.app.get('io');
    if (io) {
      console.log('📱 Songs route: Broadcasting QR overlay toggle:', show);
      await broadcastQRCodeToggle(io, show);
      await broadcastAdminUpdate(io);
    }

    res.json({ message: 'QR Overlay Status erfolgreich aktualisiert', show });
  } catch (error) {
    console.error('Error updating QR overlay status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
