const express = require('express');
const Song = require('../models/Song');
const PlaylistAlgorithm = require('../utils/playlistAlgorithm');
const { verifyToken } = require('./auth');
const { broadcastSongChange, broadcastShowUpdate, broadcastAdminUpdate, broadcastPlaylistUpdate, broadcastTogglePlayPause, broadcastRestartSong } = require('../utils/websocketService');

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

    // Broadcast playlist update via WebSocket
    const io = req.app.get('io');
    if (io) {
      await broadcastShowUpdate(io);
      await broadcastAdminUpdate(io);
      await broadcastPlaylistUpdate(io);
    }

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
    
    // Automatically hide QR overlay when song changes
    const db = require('../config/database');
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['show_qr_overlay', 'false'],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    // Broadcast song change via WebSocket
    const io = req.app.get('io');
    if (io) {
      await broadcastSongChange(io, song);
      await broadcastAdminUpdate(io);
      await broadcastPlaylistUpdate(io);
    }
    
    res.json({ message: 'Current song updated', song });
  } catch (error) {
    console.error('Set current song error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Go to next song
router.post('/next', verifyToken, async (req, res) => {
  try {
    const currentSong = await Song.getCurrentSong();
    let nextSong;
    
    if (currentSong) {
      // Get next song after current one
      nextSong = await Song.getNextSong();
    } else {
      // No current song, get first song
      nextSong = await Song.getFirstSong();
    }
    
    if (!nextSong) {
      return res.status(404).json({ message: 'No next song found' });
    }

    await Song.setCurrentSong(nextSong.id);
    
    // Automatically hide QR overlay when song changes
    const db = require('../config/database');
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['show_qr_overlay', 'false'],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    // Broadcast song change via WebSocket
    const io = req.app.get('io');
    if (io) {
      await broadcastSongChange(io, nextSong);
      await broadcastAdminUpdate(io);
      await broadcastPlaylistUpdate(io);
    }
    
    res.json({ message: 'Moved to next song', song: nextSong });
  } catch (error) {
    console.error('Next song error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Go to previous song
router.post('/previous', verifyToken, async (req, res) => {
  try {
    const currentSong = await Song.getCurrentSong();
    let previousSong;
    
    if (currentSong) {
      // Get previous song before current one
      previousSong = await Song.getPreviousSong();
    } else {
      // No current song, get last song
      previousSong = await Song.getLastSong();
    }
    
    if (!previousSong) {
      return res.status(404).json({ message: 'No previous song found' });
    }

    await Song.setCurrentSong(previousSong.id);
    
    // Automatically hide QR overlay when song changes
    const db = require('../config/database');
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['show_qr_overlay', 'false'],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    // Broadcast song change via WebSocket
    const io = req.app.get('io');
    if (io) {
      await broadcastSongChange(io, previousSong);
      await broadcastAdminUpdate(io);
      await broadcastPlaylistUpdate(io);
    }
    
    res.json({ message: 'Moved to previous song', song: previousSong });
  } catch (error) {
    console.error('Previous song error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle play/pause (placeholder - actual implementation depends on media type)
router.post('/toggle-play-pause', verifyToken, async (req, res) => {
  try {
    // This is a placeholder implementation
    // The actual play/pause logic would depend on the media type (YouTube, local video, audio, etc.)
    // For now, we'll just broadcast a toggle event
    
    const io = req.app.get('io');
    if (io) {
      await broadcastTogglePlayPause(io);
    }
    
    res.json({ message: 'Play/pause toggled' });
  } catch (error) {
    console.error('Toggle play/pause error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Restart current song
router.post('/restart', verifyToken, async (req, res) => {
  try {
    const currentSong = await Song.getCurrentSong();
    
    if (!currentSong) {
      return res.status(404).json({ message: 'No current song to restart' });
    }

    // Broadcast restart event
    const io = req.app.get('io');
    if (io) {
      await broadcastRestartSong(io, currentSong);
    }
    
    res.json({ message: 'Song restarted', song: currentSong });
  } catch (error) {
    console.error('Restart song error:', error);
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

    // Broadcast playlist update via WebSocket
    const io = req.app.get('io');
    if (io) {
      await broadcastShowUpdate(io);
      await broadcastAdminUpdate(io);
      await broadcastPlaylistUpdate(io);
    }

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