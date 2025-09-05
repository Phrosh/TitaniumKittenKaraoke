const express = require('express');
const Song = require('../models/Song');
const PlaylistAlgorithm = require('../utils/playlistAlgorithm');
const { verifyToken } = require('./auth');

const router = express.Router();

// Get full playlist with admin details
router.get('/', verifyToken, async (req, res) => {
  try {
    const playlist = await Song.getAll();
    const currentSong = await Song.getCurrentSong();
    const maxDelay = await PlaylistAlgorithm.getMaxDelaySetting();
    
    res.json({
      playlist,
      currentSong,
      maxDelay,
      total: playlist.length
    });
  } catch (error) {
    console.error('Get playlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update song position (admin only)
router.put('/reorder', verifyToken, async (req, res) => {
  try {
    const { songId, newPosition } = req.body;
    
    if (!songId || !newPosition) {
      return res.status(400).json({ message: 'Song ID and new position required' });
    }

    // Get current playlist
    const playlist = await Song.getAll();
    const song = playlist.find(s => s.id === songId);
    
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    const oldPosition = song.position;
    
    if (oldPosition === newPosition) {
      return res.json({ message: 'Position unchanged' });
    }

    // Update positions
    if (newPosition < oldPosition) {
      // Moving up - shift songs down
      await new Promise((resolve, reject) => {
        const db = require('../config/database');
        db.run(
          'UPDATE songs SET position = position + 1 WHERE position >= ? AND position < ?',
          [newPosition, oldPosition],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    } else {
      // Moving down - shift songs up
      await new Promise((resolve, reject) => {
        const db = require('../config/database');
        db.run(
          'UPDATE songs SET position = position - 1 WHERE position > ? AND position <= ?',
          [oldPosition, newPosition],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    // Update the song's position
    await Song.updatePosition(songId, newPosition);

    res.json({ message: 'Playlist reordered successfully' });
  } catch (error) {
    console.error('Reorder playlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Set current song
router.put('/current', verifyToken, async (req, res) => {
  try {
    const { songId } = req.body;
    
    if (!songId) {
      return res.status(400).json({ message: 'Song ID required' });
    }

    const song = await Song.getById(songId);
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    await Song.setCurrentSong(songId);
    
    res.json({ message: 'Current song updated', song });
  } catch (error) {
    console.error('Set current song error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Go to next song
router.post('/next', verifyToken, async (req, res) => {
  try {
    const nextSong = await Song.getNextSong();
    
    if (!nextSong) {
      return res.status(404).json({ message: 'No next song found' });
    }

    await Song.setCurrentSong(nextSong.id);
    
    res.json({ message: 'Moved to next song', song: nextSong });
  } catch (error) {
    console.error('Next song error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete song
router.delete('/:songId', verifyToken, async (req, res) => {
  try {
    const { songId } = req.params;
    
    const song = await Song.getById(songId);
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    // Delete the song
    await Song.delete(songId);
    
    // Reorder remaining songs
    await new Promise((resolve, reject) => {
      const db = require('../config/database');
      db.run(
        'UPDATE songs SET position = position - 1 WHERE position > ?',
        [song.position],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ message: 'Song deleted successfully' });
  } catch (error) {
    console.error('Delete song error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update max delay setting
router.put('/max-delay', verifyToken, async (req, res) => {
  try {
    const { maxDelay } = req.body;
    
    if (!maxDelay || maxDelay < 1 || maxDelay > 100) {
      return res.status(400).json({ message: 'Max delay must be between 1 and 100' });
    }

    await PlaylistAlgorithm.updateMaxDelaySetting(maxDelay);
    
    res.json({ message: 'Max delay setting updated', maxDelay });
  } catch (error) {
    console.error('Update max delay error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;