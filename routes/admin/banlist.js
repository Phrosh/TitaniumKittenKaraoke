const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../../config/database');

// Get all banned device IDs
router.get('/banlist', async (req, res) => {
  try {
    const bannedDevices = await new Promise((resolve, reject) => {
      db.all(`
        SELECT b.*, au.username as banned_by 
        FROM banlist b 
        LEFT JOIN admin_users au ON b.created_by = au.id 
        ORDER BY b.created_at DESC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({ bannedDevices });
  } catch (error) {
    console.error('Error getting banlist:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add device ID to banlist
router.post('/banlist', [
  body('deviceId').isLength({ min: 3, max: 3 }).withMessage('Device ID muss genau 3 Zeichen lang sein'),
  body('reason').optional().isString().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { deviceId, reason } = req.body;
    const adminId = req.user.id;

    // Check if device is already banned
    const existingBan = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM banlist WHERE device_id = ?', [deviceId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existingBan) {
      return res.status(400).json({ message: 'Device ID ist bereits auf der Banlist' });
    }

    // Add to banlist
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO banlist (device_id, reason, created_by) VALUES (?, ?, ?)',
        [deviceId, reason || null, adminId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ message: 'Device ID erfolgreich zur Banlist hinzugefügt', deviceId });
  } catch (error) {
    console.error('Error adding to banlist:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Remove device ID from banlist
router.delete('/banlist/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;

    if (!deviceId || deviceId.length !== 3) {
      return res.status(400).json({ message: 'Ungültige Device ID' });
    }

    const result = await new Promise((resolve, reject) => {
      db.run('DELETE FROM banlist WHERE device_id = ?', [deviceId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

    if (result === 0) {
      return res.status(404).json({ message: 'Device ID nicht auf der Banlist gefunden' });
    }

    res.json({ message: 'Device ID erfolgreich von der Banlist entfernt', deviceId });
  } catch (error) {
    console.error('Error removing from banlist:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
