const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../../config/database');

// Admin endpoint to get all invisible song combinations
router.get('/invisible-songs', async (req, res) => {
  try {
    const invisibleSongs = await new Promise((resolve, reject) => {
      db.all(`
        SELECT i.*, au.username as hidden_by 
        FROM invisible_songs i 
        LEFT JOIN admin_users au ON i.created_by = au.id 
        ORDER BY i.created_at DESC
      `, (err, rows) => {
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

// Admin endpoint to add song combination to invisible list
router.post('/invisible-songs', [
  body('artist').isString().trim().notEmpty().withMessage('Artist ist erforderlich'),
  body('title').isString().trim().notEmpty().withMessage('Title ist erforderlich')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { artist, title } = req.body;
    const adminId = req.user.id;

    // Check if combination is already invisible
    const existingInvisible = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM invisible_songs WHERE artist = ? AND title = ?', [artist, title], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existingInvisible) {
      return res.status(400).json({ message: 'Song-Kombination ist bereits unsichtbar' });
    }

    // Add to invisible songs
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO invisible_songs (artist, title, created_by) VALUES (?, ?, ?)',
        [artist, title, adminId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ message: 'Song-Kombination erfolgreich unsichtbar gemacht', artist, title });
  } catch (error) {
    console.error('Error adding to invisible songs:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin endpoint to remove song combination from invisible list
router.delete('/invisible-songs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await new Promise((resolve, reject) => {
      db.run('DELETE FROM invisible_songs WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

    if (result === 0) {
      return res.status(404).json({ message: 'Unsichtbare Song-Kombination nicht gefunden' });
    }

    res.json({ message: 'Song-Kombination erfolgreich wieder sichtbar gemacht' });
  } catch (error) {
    console.error('Error removing from invisible songs:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
