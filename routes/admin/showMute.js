const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../../config/database');
const {
  broadcastShowMuteToggle,
  broadcastShowUpdate,
  broadcastAdminUpdate,
} = require('../../utils/websocketService');

router.put('/show-mute', [
  body('muted').isBoolean().withMessage('muted muss ein Boolean sein'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { muted } = req.body;

    await new Promise((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['show_muted', muted.toString()],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    const io = req.app.get('io');
    if (io) {
      await broadcastShowMuteToggle(io, muted);
      await broadcastShowUpdate(io);
      await broadcastAdminUpdate(io);
    }

    res.json({ message: 'Show-Stummschaltung aktualisiert', muted });
  } catch (error) {
    console.error('Error setting show mute:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
