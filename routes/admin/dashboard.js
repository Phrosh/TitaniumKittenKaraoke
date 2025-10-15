const express = require('express');
const router = express.Router();
const Song = require('../../models/Song');
const User = require('../../models/User');
const { scanYouTubeSongs } = require('../../utils/youtubeSongs');

// Get admin dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    const db = require('../../config/database');
    
    const playlist = await Song.getAll();
    
    const pendingSongs = await Song.getPending();
    
    const users = await User.getAll();
    
    const currentSong = await Song.getCurrentSong();
    
    // Load YouTube songs from cache
    const youtubeSongs = scanYouTubeSongs();
    
    // Load settings
    const settings = await new Promise((resolve, reject) => {
      db.all('SELECT key, value FROM settings', (err, rows) => {
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
    
    // Statistics
    const stats = {
      totalSongs: playlist.length,
      pendingSongs: pendingSongs.length,
      totalUsers: users.length,
      songsWithYoutube: playlist.filter(s => s.youtube_url).length,
      songsWithoutYoutube: playlist.filter(s => !s.youtube_url).length,
      youtubeCacheSongs: youtubeSongs.length
    };

    res.json({
      playlist,
      pendingSongs,
      users,
      currentSong,
      youtubeSongs,
      stats,
      settings
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
