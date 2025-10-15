const express = require('express');
const db = require('../../config/database');
const { broadcastQRCodeToggle } = require('../../utils/websocketService');

const router = express.Router();

// Update QR overlay status (public)
router.put('/qr-overlay', async (req, res) => {
  try {
    const { show } = req.body;
    
    // Update QR overlay status
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['qr_overlay_status', show.toString()],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    console.log(`📱 QR overlay status updated: ${show}`);
    
    // Broadcast QR overlay status change
    const io = req.app.get('io');
    if (io) {
      broadcastQRCodeToggle(io, show);
    }
    
    res.json({ 
      success: true, 
      qrOverlayStatus: show,
      message: `QR Overlay ${show ? 'aktiviert' : 'deaktiviert'}`
    });
  } catch (error) {
    console.error('Error updating QR overlay status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Removed: POST /songs/qr-overlay-toggle (unused)

// Removed: GET /songs/qr-overlay-status (unused)

// Note: GET /songs/invisible-songs is defined in routes/songs/list.js

// Get Ultrastar audio settings (public)
router.get('/ultrastar-audio-settings', async (req, res) => {
  try {
    const db = require('../../config/database');
    
    const ultrastarAudioSettings = await new Promise((resolve, reject) => {
      db.all('SELECT key, value FROM settings WHERE key LIKE "ultrastar_audio_%" ORDER BY key', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    const settings = {};
    ultrastarAudioSettings.forEach(setting => {
      settings[setting.key] = setting.value;
    });
    
    res.json({ settings });
  } catch (error) {
    console.error('Error getting Ultrastar audio settings:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

