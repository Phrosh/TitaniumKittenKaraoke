const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Song = require('../../models/Song');
const db = require('../../config/database');
const { broadcastSongChange, broadcastAdminUpdate, broadcastPlaylistUpdate } = require('../../utils/websocketService');

// Helper function to insert test song before current song
async function insertTestSongBeforeCurrent(testSongId) {
  const db = require('../../config/database');
  
  // Get current song position
  const currentSong = await Song.getCurrentSong();
  let insertPosition = 1; // Default to beginning if no current song
  
  if (currentSong) {
    insertPosition = currentSong.position;
  }
  
  // Shift all songs at and after insert position to make room
  await new Promise((resolve, reject) => {
    db.run(
      'UPDATE songs SET position = position + 1 WHERE position >= ?',
      [insertPosition],
      function(err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
  
  // Set test song position
  await new Promise((resolve, reject) => {
    db.run(
      'UPDATE songs SET position = ? WHERE id = ?',
      [insertPosition, testSongId],
      function(err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

// Helper function to clean up test songs when switching songs
async function cleanupTestSongs() {
  const db = require('../../config/database');
  
  // Get current song to avoid deleting it
  const currentSong = await Song.getCurrentSong();
  const currentSongId = currentSong ? currentSong.id : null;
  
  // Find all test songs (songs with users that have device_id='TEST')
  const testSongs = await new Promise((resolve, reject) => {
    db.all(`
      SELECT s.id, s.position, s.user_id
      FROM songs s
      JOIN users u ON s.user_id = u.id
      WHERE u.device_id = 'TEST'
    `, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  
  // Filter out current song if it's a test song
  const songsToDelete = testSongs.filter(song => song.id !== currentSongId);
  
  if (songsToDelete.length > 0) {
    console.log(`🧹 Cleaning up ${songsToDelete.length} test song(s) (excluding current song)`);
    
    // Delete test songs (except current one)
    for (const testSong of songsToDelete) {
      await new Promise((resolve, reject) => {
        db.run('DELETE FROM songs WHERE id = ?', [testSong.id], function(err) {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // Delete test user
      await new Promise((resolve, reject) => {
        db.run('DELETE FROM users WHERE id = ?', [testSong.user_id], function(err) {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    
    // Reorder remaining songs to fill gaps
    await new Promise((resolve, reject) => {
      db.all('SELECT id FROM songs ORDER BY position ASC', (err, songs) => {
        if (err) {
          reject(err);
          return;
        }
        
        let position = 1;
        const updatePromises = songs.map(song => {
          return new Promise((resolveUpdate, rejectUpdate) => {
            db.run(
              'UPDATE songs SET position = ? WHERE id = ?',
              [position++, song.id],
              function(err) {
                if (err) rejectUpdate(err);
                else resolveUpdate();
              }
            );
          });
        });
        
        Promise.all(updatePromises)
          .then(() => resolve())
          .catch(reject);
      });
    });
  }
}

// Test a song - start it immediately as current song with admin as singer
router.post('/song/test', async (req, res) => {
  try {
    const { artist, title, mode, youtubeUrl } = req.body;
    const adminUsername = req.user.username; // Get admin username from JWT token
    
    if (!artist || !title) {
      return res.status(400).json({ message: 'Artist and title are required' });
    }

    // Store the current song ID to restore later
    const currentSong = await Song.getCurrentSong();
    const originalCurrentSongId = currentSong ? currentSong.id : null;
    
    // Store original song ID in settings for restoration
    if (originalCurrentSongId) {
      await new Promise((resolve, reject) => {
        const db = require('../../config/database');
        db.run(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          ['test_mode_original_song_id', originalCurrentSongId.toString()],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    } else {
      // Clear the setting if no original song
      await new Promise((resolve, reject) => {
        const db = require('../../config/database');
        db.run(
          'DELETE FROM settings WHERE key = ?',
          ['test_mode_original_song_id'],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    // Create a temporary test user for the admin
    const testUser = await new Promise((resolve, reject) => {
      const db = require('../../config/database');
      db.run(
        'INSERT INTO users (device_id, name) VALUES (?, ?)',
        ['TEST', adminUsername],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });

    // Clean up any existing test songs first (before creating new one)
    await cleanupTestSongs();

    // Verwende zentrale Video-Modi-Konfiguration für Test-Song
    const { findBestVideoMode } = require('../../config/videoModes');
    let finalMode = mode || 'youtube';
    let finalYoutubeUrl = youtubeUrl;
    
    if (!youtubeUrl) {
      // Finde den besten verfügbaren Video-Modus
      const result = await findBestVideoMode(artist, title, youtubeUrl, req);
      finalMode = result.mode;
      finalYoutubeUrl = result.url;
      console.log(`🎵 Test song classified as ${finalMode}: ${finalYoutubeUrl}`);
    } else {
      // If youtubeUrl is provided, fix server_video URLs that might be missing file extension
      if (mode === 'server_video' && youtubeUrl && !youtubeUrl.includes('.')) {
        const { findLocalVideo } = require('../../utils/localVideos');
        const localVideo = findLocalVideo(artist, title);
        if (localVideo) {
          finalYoutubeUrl = `/api/videos/${encodeURIComponent(localVideo.filename)}`;
          console.log(`🔧 Fixed server_video URL for test song: ${youtubeUrl} -> ${finalYoutubeUrl}`);
        }
      }
    }

    // Create a temporary test song in the database
    const testSong = await Song.create(
      testUser.id, // Use the test user ID
      title,
      artist,
      finalYoutubeUrl || null,
      1.0, // Priority
      null, // Duration
      finalMode,
      false // withBackgroundVocals
    );

    // Insert test song before current song instead of at the end
    await insertTestSongBeforeCurrent(testSong.id);

    // Set the test song as current song
    await Song.setCurrentSong(testSong.id);

    // Broadcast song change via WebSocket
    const io = req.app.get('io');
    if (io) {
      await broadcastSongChange(io, testSong);
      await broadcastAdminUpdate(io);
      await broadcastPlaylistUpdate(io);
    }

    console.log(`🎤 Test song started: ${artist} - ${title} (Admin: ${adminUsername})`);
    
    res.json({ 
      message: 'Test-Song erfolgreich gestartet',
      song: {
        id: testSong.id,
        title: title,
        artist: artist,
        user_name: adminUsername
      }
    });
  } catch (error) {
    console.error('Test song error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Restore original song after test
router.post('/restore-original-song', async (req, res) => {
  try {
    // First, delete the current test song and test user if they exist
    const currentSong = await Song.getCurrentSong();
    if (currentSong) {
      // Check if this is a test song by looking at the user
      const user = await new Promise((resolve, reject) => {
        const db = require('../../config/database');
        db.get(
          'SELECT * FROM users WHERE id = ?',
          [currentSong.user_id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
      
      if (user && user.device_id === 'TEST') {
        // This is a test song, delete both song and user
        await new Promise((resolve, reject) => {
          const db = require('../../config/database');
          db.run(
            'DELETE FROM songs WHERE id = ?',
            [currentSong.id],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
        
        await new Promise((resolve, reject) => {
          const db = require('../../config/database');
          db.run(
            'DELETE FROM users WHERE id = ?',
            [currentSong.user_id],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
        
        console.log(`🎤 Deleted test song and user: ${currentSong.id}`);
      }
    }
    
    const originalSongId = await Song.restoreOriginalSong();
    
    if (originalSongId) {
      console.log(`🎤 Restored original song: ${originalSongId}`);
      res.json({ 
        message: 'Ursprünglicher Song erfolgreich wiederhergestellt',
        originalSongId 
      });
    } else {
      console.log(`🎤 No original song to restore`);
      res.json({ 
        message: 'Kein ursprünglicher Song zu wiederherstellen',
        originalSongId: null 
      });
    }
  } catch (error) {
    console.error('Restore original song error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
