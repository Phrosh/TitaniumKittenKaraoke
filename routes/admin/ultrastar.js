const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../../config/database');

// Admin endpoint to get ultrastar audio settings
router.get('/ultrastar-audio-settings', async (req, res) => {
  try {
    const settings = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM ultrastar_audio_settings', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({ ultrastarAudioSettings: settings });
  } catch (error) {
    console.error('Error fetching ultrastar audio settings:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin endpoint to set ultrastar audio settings
router.post('/ultrastar-audio-settings', [
  body('artist').notEmpty().trim(),
  body('title').notEmpty().trim(),
  body('audioPreference').isIn(['hp2', 'hp5', 'choice'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { artist, title, audioPreference } = req.body;

    await new Promise((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO ultrastar_audio_settings (artist, title, audio_preference, created_by) VALUES (?, ?, ?, ?)',
        [artist, title, audioPreference, req.user.id],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    res.json({ message: 'Ultrastar Audio-Einstellung erfolgreich gespeichert' });
  } catch (error) {
    console.error('Error setting ultrastar audio setting:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin endpoint to remove ultrastar audio settings
router.delete('/ultrastar-audio-settings', [
  body('artist').notEmpty().trim(),
  body('title').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { artist, title } = req.body;

    await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM ultrastar_audio_settings WHERE artist = ? AND title = ?',
        [artist, title],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });

    res.json({ message: 'Ultrastar Audio-Einstellung erfolgreich entfernt' });
  } catch (error) {
    console.error('Error removing ultrastar audio setting:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
