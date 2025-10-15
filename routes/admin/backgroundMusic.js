const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');
const db = require('../../config/database');

// Get background music songs
router.get('/background-music/songs', async (req, res) => {
  try {
    const bgSongsPath = path.join(__dirname, '../client/public/bg-songs');
    
    if (!fs.existsSync(bgSongsPath)) {
      return res.json({ songs: [] });
    }
    
    const files = fs.readdirSync(bgSongsPath);
    const mp3Files = files.filter(file => file.toLowerCase().endsWith('.mp3'));
    
    const songs = mp3Files.map(file => ({
      filename: file,
      name: file.replace('.mp3', ''),
      url: `/bg-songs/${file}`
    }));
    
    res.json({ songs });
  } catch (error) {
    console.error('Error loading background music songs:', error);
    res.status(500).json({ error: 'Failed to load background music songs' });
  }
});

// Get background music settings
router.get('/background-music/settings', async (req, res) => {
  try {
    const settings = await new Promise((resolve, reject) => {
      db.all('SELECT key, value FROM settings WHERE key LIKE "bg_music_%"', (err, rows) => {
        if (err) reject(err);
        else {
          const settingsObj = {};
          rows.forEach(row => {
            settingsObj[row.key] = row.value;
          });
          resolve(settingsObj);
        }
      });
    });
    
    // Default values
    const defaultSettings = {
      bg_music_enabled: 'true',
      bg_music_volume: '0.3',
      bg_music_selected_songs: JSON.stringify([]) // Empty array means all songs selected
    };
    
    const result = {
      enabled: settings.bg_music_enabled === 'true',
      volume: parseFloat(settings.bg_music_volume) || 0.3,
      selectedSongs: settings.bg_music_selected_songs ? JSON.parse(settings.bg_music_selected_songs) : []
    };
    
    res.json({ settings: result });
  } catch (error) {
    console.error('Error loading background music settings:', error);
    res.status(500).json({ error: 'Failed to load background music settings' });
  }
});

// Update background music settings
router.put('/background-music/settings', [
  body('enabled').optional().isBoolean(),
  body('volume').optional().isFloat({ min: 0, max: 1 }),
  body('selectedSongs').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { enabled, volume, selectedSongs } = req.body;
    
    // Update settings in database
    const updates = [];
    const values = [];
    
    if (enabled !== undefined) {
      updates.push('bg_music_enabled = ?');
      values.push(enabled ? 'true' : 'false');
    }
    
    if (volume !== undefined) {
      updates.push('bg_music_volume = ?');
      values.push(volume.toString());
    }
    
    if (selectedSongs !== undefined) {
      updates.push('bg_music_selected_songs = ?');
      values.push(JSON.stringify(selectedSongs));
    }
    
    if (updates.length > 0) {
      for (let i = 0; i < updates.length; i++) {
        const key = updates[i].split(' = ')[0];
        const value = values[i];
        
        await new Promise((resolve, reject) => {
          db.run(
            'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            [key, value],
            function(err) {
              if (err) reject(err);
              else resolve(this.lastID);
            }
          );
        });
      }
    }
    
    // Broadcast update to all connected clients
    const io = require('../../server').io;
    if (io) {
      io.emit('background-music-settings-updated', {
        enabled: enabled !== undefined ? enabled : (await new Promise((resolve) => {
          db.get('SELECT value FROM settings WHERE key = "bg_music_enabled"', (err, row) => {
            resolve(row ? row.value === 'true' : true);
          });
        })),
        volume: volume !== undefined ? volume : (await new Promise((resolve) => {
          db.get('SELECT value FROM settings WHERE key = "bg_music_volume"', (err, row) => {
            resolve(row ? parseFloat(row.value) : 0.3);
          });
        })),
        selectedSongs: selectedSongs !== undefined ? selectedSongs : (await new Promise((resolve) => {
          db.get('SELECT value FROM settings WHERE key = "bg_music_selected_songs"', (err, row) => {
            resolve(row ? JSON.parse(row.value) : []);
          });
        }))
      });
    }
    
    res.json({ success: true, message: 'Background music settings updated' });
  } catch (error) {
    console.error('Error updating background music settings:', error);
    res.status(500).json({ error: 'Failed to update background music settings' });
  }
});

module.exports = router;
