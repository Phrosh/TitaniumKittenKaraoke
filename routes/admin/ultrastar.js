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

// Admin endpoint to set ultrastar audio settings (optional pre/post gap in seconds)
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

    const existing = await new Promise((resolve, reject) => {
      db.get(
        'SELECT pre_gap_seconds, post_gap_seconds FROM ultrastar_audio_settings WHERE artist = ? AND title = ?',
        [artist, title],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });

    let preGap = existing && existing.pre_gap_seconds != null ? Number(existing.pre_gap_seconds) : 0;
    let postGap = existing && existing.post_gap_seconds != null ? Number(existing.post_gap_seconds) : 0;
    if (!Number.isFinite(preGap) || preGap < 0) preGap = 0;
    if (!Number.isFinite(postGap) || postGap < 0) postGap = 0;

    const maxGap = 3600;
    if (req.body.preGapSeconds !== undefined && req.body.preGapSeconds !== null && req.body.preGapSeconds !== '') {
      const v = Number(req.body.preGapSeconds);
      if (Number.isFinite(v) && v >= 0 && v <= maxGap) preGap = v;
    }
    if (req.body.postGapSeconds !== undefined && req.body.postGapSeconds !== null && req.body.postGapSeconds !== '') {
      const v = Number(req.body.postGapSeconds);
      if (Number.isFinite(v) && v >= 0 && v <= maxGap) postGap = v;
    }

    await new Promise((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO ultrastar_audio_settings (artist, title, audio_preference, pre_gap_seconds, post_gap_seconds, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [artist, title, audioPreference, preGap, postGap, req.user.id],
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
