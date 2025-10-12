const express = require('express');
const db = require('../../config/database');
const { broadcastQRCodeToggle } = require('../../utils/websocketService');

const router = express.Router();

// Toggle QR overlay status (public)
router.post('/qr-overlay-toggle', async (req, res) => {
  try {
    const db = require('../../config/database');
    
    // Get current QR overlay status
    const currentSetting = await new Promise((resolve, reject) => {
      db.get('SELECT value FROM settings WHERE key = ?', ['qr_overlay_status'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    const currentStatus = currentSetting ? currentSetting.value === 'true' : false;
    const newStatus = !currentStatus;
    
    // Update QR overlay status
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['qr_overlay_status', newStatus.toString()],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    console.log(`📱 QR overlay status toggled: ${currentStatus} → ${newStatus}`);
    
    // Broadcast QR overlay status change
    const io = req.app.get('io');
    if (io) {
      broadcastQRCodeToggle(io, newStatus);
    }
    
    res.json({ 
      success: true, 
      qrOverlayStatus: newStatus,
      message: `QR Overlay ${newStatus ? 'aktiviert' : 'deaktiviert'}`
    });
  } catch (error) {
    console.error('Error toggling QR overlay status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get QR overlay status (public)
router.get('/qr-overlay-status', async (req, res) => {
  try {
    const db = require('../../config/database');
    
    const qrOverlaySetting = await new Promise((resolve, reject) => {
      db.get('SELECT value FROM settings WHERE key = ?', ['qr_overlay_status'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    const qrOverlayStatus = qrOverlaySetting ? qrOverlaySetting.value === 'true' : false; // Default to false if not set
    
    res.json({ 
      settings: { 
        qr_overlay_status: qrOverlayStatus.toString() 
      } 
    });
  } catch (error) {
    console.error('Error getting QR overlay status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get invisible songs (public)
router.get('/invisible-songs', async (req, res) => {
  try {
    const db = require('../../config/database');
    
    const invisibleSongs = await new Promise((resolve, reject) => {
      db.all('SELECT artist, title FROM invisible_songs ORDER BY artist, title', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    res.json({ invisibleSongs });
  } catch (error) {
    console.error('Error getting invisible songs:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

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
