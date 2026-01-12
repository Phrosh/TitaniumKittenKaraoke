const express = require('express');
const Song = require('../models/Song');
const PlaylistAlgorithm = require('../utils/playlistAlgorithm');
const { verifyToken } = require('./auth');
const { broadcastSongChange, broadcastShowUpdate, broadcastAdminUpdate, broadcastPlaylistUpdate, broadcastTogglePlayPause, broadcastRestartSong, broadcastSongStart, broadcastPlayPauseStatus } = require('../utils/websocketService');

const router = express.Router();

// // Helper function to find next playable song
// async function findNextPlayableSong(currentSongId = null) {
//   try {
//     const db = require('../config/database');
    
//     // Get all songs after current position, ordered by position
//     const songs = await new Promise((resolve, reject) => {
//       const query = currentSongId 
//         ? `SELECT s.*, u.name as user_name, u.device_id 
//            FROM songs s 
//            JOIN users u ON s.user_id = u.id 
//            WHERE s.position > (
//              SELECT COALESCE(s2.position, 0) 
//              FROM songs s2 
//              WHERE s2.id = ?
//            )
//            ORDER BY s.position ASC`
//         : `SELECT s.*, u.name as user_name, u.device_id 
//            FROM songs s 
//            JOIN users u ON s.user_id = u.id 
//            ORDER BY s.position ASC`;
      
//       db.all(query, currentSongId ? [currentSongId] : [], (err, rows) => {
//         if (err) reject(err);
//         else resolve(rows);
//       });
//     });
    
//     // Find first playable song
//     for (const song of songs) {
//       const validation = validateSongForPlayback(song);
//       if (validation.valid) {
//         return song;
//       }
//     }
    
//     return null; // No playable song found
//   } catch (error) {
//     console.error('Error finding next playable song:', error);
//     return null;
//   }
// }

// Helper function to validate if a song can be played
function validateSongForPlayback(song) {
  if (!song) {
    return { valid: false, reason: 'Song not found' };
  }

  // Check download status - only allow 'finished', 'ready', 'cached', 'none', or null/undefined
  const downloadStatus = song.download_status;
  if (downloadStatus && !['finished', 'ready', 'cached', 'none'].includes(downloadStatus)) {
    return { 
      valid: false, 
      reason: `Song cannot be played. Download status: ${downloadStatus}`,
      reasonTranslationKey: 'toast.downloadStatusReason',
      reasonTranslationParams: { status: downloadStatus },
      songTitle: `${song.artist || 'Unknown'} - ${song.title}`
    };
  }

  // Check YouTube songs without YouTube URL
  if (song.mode === 'youtube' && !song.youtube_url) {
    return { 
      valid: false, 
      reason: 'YouTube song without YouTube URL cannot be played',
      reasonTranslationKey: 'toast.youtubeUrlMissingReason',
      songTitle: `${song.artist || 'Unknown'} - ${song.title}`
    };
  }

  return { valid: true };
}

// Helper function to update song priority based on neighboring songs
async function updateSongPriorityBasedOnPosition(songId, newPosition) {
  try {
    const db = require('../config/database');
    
    // Get the song that was moved
    const movedSong = await Song.getById(songId);
    if (!movedSong) {
      console.error('Song not found for priority update:', songId);
      return;
    }
    
    // Get songs before and after the new position
    const [previousSong, nextSong] = await Promise.all([
      new Promise((resolve, reject) => {
        db.get(
          'SELECT priority FROM songs WHERE position = ? AND id != ? ORDER BY position ASC LIMIT 1',
          [newPosition - 1, songId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      }),
      new Promise((resolve, reject) => {
        db.get(
          'SELECT priority FROM songs WHERE position = ? AND id != ? ORDER BY position ASC LIMIT 1',
          [newPosition + 1, songId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      })
    ]);
    
    let newPriority;
    
    if (previousSong && nextSong) {
      // Song is in the middle - calculate average of neighboring priorities
      newPriority = (previousSong.priority + nextSong.priority) / 2;
    } else if (previousSong) {
      // Song is at the end - copy previous song's priority
      newPriority = previousSong.priority;
    } else if (nextSong) {
      // Song is at the beginning - copy next song's priority
      newPriority = nextSong.priority;
    } else {
      // Song is the only one in playlist - keep current priority
      newPriority = movedSong.priority;
    }
    
    // Update the song's priority
    await Song.updatePriority(songId, newPriority);
    
    console.log(`🎯 Updated priority for song ${songId} (${movedSong.artist} - ${movedSong.title}) to ${newPriority} (position ${newPosition})`);
    
    // Log the calculation details for debugging
    if (previousSong && nextSong) {
      console.log(`   📊 Calculated as average: (${previousSong.priority} + ${nextSong.priority}) / 2 = ${newPriority}`);
    } else if (previousSong) {
      console.log(`   📋 Copied from previous song: ${previousSong.priority}`);
    } else if (nextSong) {
      console.log(`   📋 Copied from next song: ${nextSong.priority}`);
    } else {
      console.log(`   🔒 Kept original priority: ${movedSong.priority}`);
    }
    
  } catch (error) {
    console.error('Error updating song priority based on position:', error);
    // Don't throw error to avoid breaking the reorder operation
  }
}

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
    
    console.log('🔄 Backend reorder:', {
      songId,
      songTitle: song.title,
      oldPosition,
      newPosition,
      direction: newPosition < oldPosition ? 'up' : 'down'
    });
    
    if (oldPosition === newPosition) {
      return res.json({ message: 'Position unchanged' });
    }

    // Get all songs sorted by current position
    const allSongs = await Song.getAll();
    allSongs.sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      // If positions are equal, use created_at as tiebreaker
      return new Date(a.created_at) - new Date(b.created_at);
    });

    // Find the dragged song in the sorted list
    const draggedSongIndex = allSongs.findIndex(s => s.id === songId);
    if (draggedSongIndex === -1) {
      return res.status(404).json({ message: 'Song not found in playlist' });
    }

    // Remove the dragged song from the list
    const [draggedSong] = allSongs.splice(draggedSongIndex, 1);

    // Insert the dragged song at the new position (newPosition is 1-based, so subtract 1 for array index)
    const insertIndex = newPosition - 1;
    allSongs.splice(insertIndex, 0, draggedSong);

    // Renumber all positions sequentially based on the new order
    const db = require('../config/database');
    const updatePromises = [];
    for (let i = 0; i < allSongs.length; i++) {
      const newPos = i + 1;
      if (allSongs[i].position !== newPos) {
        updatePromises.push(Song.updatePosition(allSongs[i].id, newPos));
      }
    }
    await Promise.all(updatePromises);

    // Calculate and update priority based on neighboring songs
    await updateSongPriorityBasedOnPosition(songId, newPosition);

    // Rebuild cache to ensure updated positions are reflected immediately
    const songCache = require('../utils/songCache');
    try {
      // Reload songs from database to update cache with new positions
      const updatedSongs = await Song.getAll();
      // Update cache directly with new sorted songs
      if (songCache.cache) {
        songCache.cache.songs = updatedSongs;
        songCache.cache.lastUpdated = new Date().toISOString();
        console.log('🔄 Cache updated with new positions after reorder');
      }
    } catch (cacheError) {
      console.warn('⚠️ Error updating cache:', cacheError.message);
    }

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

    // Validate song for playback
    const validation = validateSongForPlayback(song);
    if (!validation.valid) {
      // Send toast notification via WebSocket
      const io = req.app.get('io');
      if (io) {
        io.emit('admin-toast', {
          type: 'error',
          translationKey: 'toast.songCannotBePlayed',
          translationParams: { songTitle: validation.songTitle },
          reasonTranslationKey: validation.reasonTranslationKey,
          reasonTranslationParams: validation.reasonTranslationParams,
          timestamp: new Date().toISOString()
        });
      }
      
      return res.status(400).json({ 
        message: 'Song cannot be played', 
        reason: validation.reason,
        songTitle: validation.songTitle
      });
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
      
      // Broadcast song start event with timestamp for admin dashboard
      await broadcastSongStart(io, song, false);
      
      // Broadcast song start event to auto-hide QR overlay
      io.emit('song-action', {
        action: 'song-started',
        timestamp: new Date().toISOString(),
        song: song
      });
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

    // Validate song for playback
    const validation = validateSongForPlayback(nextSong);
    if (!validation.valid) {
      // Send toast notification via WebSocket
      const io = req.app.get('io');
      if (io) {
        io.emit('admin-toast', {
          type: 'error',
          translationKey: 'toast.nextSongCannotBePlayed',
          translationParams: { songTitle: validation.songTitle },
          reasonTranslationKey: validation.reasonTranslationKey,
          reasonTranslationParams: validation.reasonTranslationParams,
          timestamp: new Date().toISOString()
        });
      }
      
      return res.status(400).json({ 
        message: 'Next song cannot be played', 
        reason: validation.reason,
        songTitle: validation.songTitle
      });
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
      
      // Broadcast song start event with timestamp for admin dashboard
      await broadcastSongStart(io, nextSong, false);
      
      // Broadcast song start event to auto-hide QR overlay
      io.emit('song-action', {
        action: 'song-started',
        timestamp: new Date().toISOString(),
        song: nextSong
      });
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

    // Validate song for playback
    const validation = validateSongForPlayback(previousSong);
    if (!validation.valid) {
      // Send toast notification via WebSocket
      const io = req.app.get('io');
      if (io) {
        io.emit('admin-toast', {
          type: 'error',
          translationKey: 'toast.previousSongCannotBePlayed',
          translationParams: { songTitle: validation.songTitle },
          reasonTranslationKey: validation.reasonTranslationKey,
          reasonTranslationParams: validation.reasonTranslationParams,
          timestamp: new Date().toISOString()
        });
      }
      
      return res.status(400).json({ 
        message: 'Previous song cannot be played', 
        reason: validation.reason,
        songTitle: validation.songTitle
      });
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
      
      // Broadcast song start event to auto-hide QR overlay
      io.emit('song-action', {
        action: 'song-started',
        timestamp: new Date().toISOString(),
        song: previousSong
      });
    }
    
    res.json({ message: 'Moved to previous song', song: previousSong });
  } catch (error) {
    console.error('Previous song error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle play/pause (implementation depends on media type)
router.post('/toggle-play-pause', verifyToken, async (req, res) => {
  try {
    // Get current song to determine media type
    const currentSong = await Song.getCurrentSong();
    
    const io = req.app.get('io');
    if (io) {
      // Get current playing state from ShowView (we'll need to track this)
      // For now, we'll emit the toggle and let ShowView report back the state
      if (currentSong && currentSong.mode === 'ultrastar') {
        // For Ultrastar songs, we need to handle audio playback
        // The ShowView will handle the actual audio element control
        await broadcastTogglePlayPause(io);
        console.log(`⏯️ Ultrastar play/pause toggle for: ${currentSong.artist} - ${currentSong.title}`);
      } else {
        // For other media types (YouTube, server_video, file), broadcast generic toggle
        await broadcastTogglePlayPause(io);
        console.log(`⏯️ Generic play/pause toggle for: ${currentSong?.artist || 'unknown'} - ${currentSong?.title || 'unknown'}`);
      }
      
      // Note: The actual play/pause status will be sent by ShowView via 'show-action' event
      // We'll handle it in the frontend
    }
    
    res.json({ 
      message: 'Play/pause toggled',
      currentSong: currentSong ? {
        id: currentSong.id,
        artist: currentSong.artist,
        title: currentSong.title,
        mode: currentSong.mode
      } : null
    });
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

    // Automatically hide QR overlay when song restarts
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
    
    if (showQRCodeOverlay) {
      // Hide QR overlay in database
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
      
      console.log('📱 QR overlay automatically hidden on song restart');
    }

    // Broadcast restart event
    const io = req.app.get('io');
    if (io) {
      await broadcastRestartSong(io, currentSong);
      
      // Broadcast song restart with timestamp for admin dashboard
      await broadcastSongStart(io, currentSong, true);
      
      // Broadcast QR overlay change if it was hidden
      if (showQRCodeOverlay) {
        const { broadcastQRCodeToggle } = require('../utils/websocketService');
        await broadcastQRCodeToggle(io, false);
        await broadcastAdminUpdate(io);
      }
      
      // Broadcast song restart event
      io.emit('song-action', {
        action: 'song-restarted',
        timestamp: new Date().toISOString(),
        song: currentSong
      });
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
    
    // Renumber all remaining songs to ensure positions are continuous (1, 2, 3, ...)
    const allSongsAfterDelete = await Song.getAll();
    // Sort by current position to maintain order
    allSongsAfterDelete.sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      // If positions are equal, use created_at as tiebreaker
      return new Date(a.created_at) - new Date(b.created_at);
    });
    
    // Renumber positions sequentially
    const db = require('../config/database');
    const updatePromises = [];
    for (let i = 0; i < allSongsAfterDelete.length; i++) {
      const expectedPosition = i + 1;
      if (allSongsAfterDelete[i].position !== expectedPosition) {
        updatePromises.push(Song.updatePosition(allSongsAfterDelete[i].id, expectedPosition));
      }
    }
    await Promise.all(updatePromises);

    // Update cache to ensure deleted song is removed and positions are correct
    const songCache = require('../utils/songCache');
    try {
      // Reload songs from database to update cache
      const updatedSongs = await Song.getAll();
      // Update cache directly with new sorted songs
      if (songCache.cache) {
        songCache.cache.songs = updatedSongs;
        songCache.cache.lastUpdated = new Date().toISOString();
        console.log('🔄 Cache updated after song deletion');
      }
    } catch (cacheError) {
      console.warn('⚠️ Error updating cache after deletion:', cacheError.message);
    }

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