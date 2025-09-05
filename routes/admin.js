const express = require('express');
const { body, validationResult } = require('express-validator');
const Song = require('../models/Song');
const User = require('../models/User');
const { verifyToken } = require('./auth');

const router = express.Router();

// All admin routes require authentication
router.use(verifyToken);

// Get admin dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    const playlist = await Song.getAll();
    const pendingSongs = await Song.getPending();
    const users = await User.getAll();
    const currentSong = await Song.getCurrentSong();
    
    // Statistics
    const stats = {
      totalSongs: playlist.length,
      pendingSongs: pendingSongs.length,
      totalUsers: users.length,
      songsWithYoutube: playlist.filter(s => s.youtube_url).length,
      songsWithoutYoutube: playlist.filter(s => !s.youtube_url).length
    };

    res.json({
      playlist,
      pendingSongs,
      users,
      currentSong,
      stats
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update YouTube URL for a song
router.put('/song/:songId/youtube', [
  body('youtubeUrl').isURL().withMessage('Valid YouTube URL required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { songId } = req.params;
    const { youtubeUrl } = req.body;

    const song = await Song.getById(songId);
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    await Song.updateYoutubeUrl(songId, youtubeUrl);
    
    res.json({ message: 'YouTube URL updated successfully' });
  } catch (error) {
    console.error('Update YouTube URL error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get song details for editing
router.get('/song/:songId', async (req, res) => {
  try {
    const { songId } = req.params;
    
    const song = await Song.getById(songId);
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    res.json({ song });
  } catch (error) {
    console.error('Get song error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update song details
router.put('/song/:songId', [
  body('title').notEmpty().trim(),
  body('artist').optional().trim(),
  body('youtubeUrl').optional().isURL()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { songId } = req.params;
    const { title, artist, youtubeUrl } = req.body;

    const song = await Song.getById(songId);
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    // Update song details
    await new Promise((resolve, reject) => {
      const db = require('../config/database');
      db.run(
        'UPDATE songs SET title = ?, artist = ?, youtube_url = ? WHERE id = ?',
        [title, artist || null, youtubeUrl || null, songId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ message: 'Song updated successfully' });
  } catch (error) {
    console.error('Update song error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.getAll();
    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's songs
router.get('/user/:userId/songs', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const songs = await new Promise((resolve, reject) => {
      const db = require('../config/database');
      db.all(
        'SELECT * FROM songs WHERE user_id = ? ORDER BY position ASC',
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({ songs });
  } catch (error) {
    console.error('Get user songs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Clear all songs (admin only)
router.delete('/clear-all', async (req, res) => {
  try {
    await new Promise((resolve, reject) => {
      const db = require('../config/database');
      db.run('DELETE FROM songs', function(err) {
        if (err) reject(err);
        else resolve();
      });
    });

    // Reset current song
    await Song.setCurrentSong(0);

    res.json({ message: 'All songs cleared successfully' });
  } catch (error) {
    console.error('Clear all songs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get system settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await new Promise((resolve, reject) => {
      const db = require('../config/database');
      db.all('SELECT * FROM settings', (err, rows) => {
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

    res.json({ settings });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;