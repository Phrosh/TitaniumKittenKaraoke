const express = require('express');
const router = express.Router();
const Song = require('../models/Song');

// GET /show - Zeige aktuelles Video und nächste Songs
router.get('/', async (req, res) => {
  try {
    const currentSong = await Song.getCurrentSong();
    const allSongs = await Song.getAll();
    
    // Nächste 3 Songs nach dem aktuellen Song
    let nextSongs = [];
    if (currentSong) {
      nextSongs = allSongs
        .filter(song => song.position > currentSong.position)
        .sort((a, b) => a.position - b.position)
        .slice(0, 3)
        .map(song => ({
          id: song.id,
          user_name: song.user_name,
          artist: song.artist,
          title: song.title,
          position: song.position
        }));
    }

    // Get QR overlay status from settings
    const db = require('../config/database');
    const overlaySetting = await new Promise((resolve, reject) => {
      db.get(
        'SELECT value FROM settings WHERE key = ?',
        ['show_qr_overlay'],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    const showQRCodeOverlay = overlaySetting ? overlaySetting.value === 'true' : false;

    res.json({
      currentSong: currentSong ? {
        id: currentSong.id,
        user_name: currentSong.user_name,
        artist: currentSong.artist,
        title: currentSong.title,
        youtube_url: currentSong.youtube_url,
        position: currentSong.position,
        duration_seconds: currentSong.duration_seconds
      } : null,
      nextSongs,
      showQRCodeOverlay
    });
  } catch (error) {
    console.error('Error fetching show data:', error);
    res.status(500).json({ 
      message: 'Fehler beim Laden der Show-Daten',
      error: error.message 
    });
  }
});

module.exports = router;
