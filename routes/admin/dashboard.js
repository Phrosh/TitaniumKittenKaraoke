const express = require('express');
const router = express.Router();
const Song = require('../../models/Song');
const User = require('../../models/User');
const songCache = require('../../utils/songCache');

// Get admin dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    const db = require('../../config/database');
    const { rebuild_cache } = req.query;
    
    // Verwende Cache für Songs (außer bei explizitem Rebuild)
    const playlist = await songCache.getSongs(rebuild_cache === 'true');
    
    const pendingSongs = await Song.getPending();
    
    const users = await User.getAll();
    
    const currentSong = await Song.getCurrentSong();
    
    // Load YouTube songs from cache
    const youtubeSongs = await songCache.getYouTubeSongs(rebuild_cache === 'true');
    
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
      settings,
      cacheStatus: songCache.getCacheStatus()
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Cache management endpoints
router.get('/cache/status', (req, res) => {
  try {
    const cacheStatus = songCache.getCacheStatus();
    res.json(cacheStatus);
  } catch (error) {
    console.error('Cache status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/cache/rebuild', async (req, res) => {
  try {
    console.log('🔄 Cache-Rebuild angefordert');
    await songCache.buildCache(true);
    const cacheStatus = songCache.getCacheStatus();
    res.json({ 
      message: 'Cache erfolgreich neu aufgebaut',
      cacheStatus 
    });
  } catch (error) {
    console.error('Cache rebuild error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/cache/clear', (req, res) => {
  try {
    songCache.clearCache();
    res.json({ message: 'Cache erfolgreich gelöscht' });
  } catch (error) {
    console.error('Cache clear error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
