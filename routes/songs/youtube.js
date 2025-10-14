const express = require('express');
const router = express.Router();

// Get YouTube enabled setting (public)
router.get('/youtube-enabled', async (req, res) => {
  try {
    const db = require('../../config/database');
    const youtubeSetting = await new Promise((resolve, reject) => {
      db.get('SELECT value FROM settings WHERE key = ?', ['youtube_enabled'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    const youtubeEnabled = youtubeSetting ? youtubeSetting.value === 'true' : true; // Default to true if not set
    
    res.json({ 
      settings: { 
        youtube_enabled: youtubeEnabled.toString() 
      } 
    });
  } catch (error) {
    console.error('Error getting YouTube setting:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
