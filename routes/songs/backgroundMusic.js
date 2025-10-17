const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../../config/database');

// Public endpoint to get background music songs
router.get('/background-music/songs', async (req, res) => {
  try {
    const bgSongsPath = path.join(__dirname, '../../client/public/bg-songs');
    
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

// Public endpoint to get background music settings
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

module.exports = router;
