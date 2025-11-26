const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../../config/database');
const { broadcastBackgroundVideoToggle, broadcastAdminUpdate } = require('../../utils/websocketService');

// Set Background Video Status (for Ultrastar and Magic-* songs)
router.put('/background-video', [
  body('enabled').isBoolean().withMessage('Enabled muss ein Boolean sein')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { enabled } = req.body;

    // Store background video status in settings (default is true)
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['background_video_enabled', enabled.toString()],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Broadcast background video toggle via WebSocket
    const io = req.app.get('io');
    if (io) {
      await broadcastBackgroundVideoToggle(io, enabled);
      
      // If video is being enabled, send a sync event to ensure video plays correctly
      if (enabled) {
        io.emit('background-video-sync', { enabled: true });
        console.log('🎬 Sent background-video-sync event');
      }
      
      await broadcastAdminUpdate(io);
    }

    res.json({ message: 'Hintergrundvideo Status aktualisiert', enabled });
  } catch (error) {
    console.error('Error setting background video status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

