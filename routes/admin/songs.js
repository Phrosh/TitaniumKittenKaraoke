const express = require('express');
const { body, validationResult } = require('express-validator');
const Song = require('../../models/Song');
const db = require('../../config/database');
const { downloadYouTubeVideo, findYouTubeSong } = require('../../utils/youtubeSongs');
const { broadcastSongChange, broadcastAdminUpdate, broadcastPlaylistUpdate, broadcastProcessingStatus } = require('../../utils/websocketService');
const { cleanYouTubeUrl } = require('../../utils/youtubeUrlCleaner');

const router = express.Router();

// Update YouTube URL for a song
router.put('/:songId/youtube', [
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

    // Clean the YouTube URL before saving
    const cleanedUrl = cleanYouTubeUrl(youtubeUrl);
    
    // Update the YouTube URL in database
    await Song.updateYoutubeUrl(songId, cleanedUrl);
    
    // Check if this is a YouTube URL and try to download it
    if (youtubeUrl && (youtubeUrl.includes('youtube.com') || youtubeUrl.includes('youtu.be'))) {
      try {
        console.log(`📥 Admin YouTube URL update - attempting download: ${song.artist} - ${song.title}`);
        
        // Set download status to downloading
        await Song.updateDownloadStatus(songId, 'downloading', new Date().toISOString());
        
        // Check if song is already in YouTube cache
        const existingCache = findYouTubeSong(song.artist, song.title, cleanedUrl);
        if (existingCache) {
          console.log(`✅ Song already in YouTube cache: ${song.artist} - ${song.title}`);
          await Song.updateDownloadStatus(songId, 'cached');
        } else {
          // Fire-and-forget download; respond immediately
          const io = req.app.get('io');
          (async () => {
            try {
              const downloadResult = await downloadYouTubeVideo(youtubeUrl, song.artist, song.title);
              if (downloadResult.success) {
                console.log(`✅ YouTube video downloaded successfully: ${downloadResult.folderName}`);
                await Song.updateDownloadStatus(songId, 'ready').catch(() => {});
                // Add to invisible songs list
                try {
                  await new Promise((resolve, reject) => {
                    db.run(
                      'INSERT OR IGNORE INTO invisible_songs (artist, title) VALUES (?, ?)',
                      [song.artist, song.title],
                      function(err) { if (err) reject(err); else resolve(); }
                    );
                  });
                  console.log(`📝 Added to invisible songs: ${song.artist} - ${song.title}`);
                } catch (error) {
                  console.error('Error adding to invisible songs:', error);
                }
                if (io) {
                  try { broadcastProcessingStatus(io, { id: Number(songId), artist: song.artist, title: song.title, status: 'finished' }); } catch {}
                }
              } else {
                console.log(`⚠️ YouTube download failed: ${downloadResult.error}`);
                await Song.updateDownloadStatus(songId, 'failed').catch(() => {});
                if (io) {
                  try { broadcastProcessingStatus(io, { id: Number(songId), artist: song.artist, title: song.title, status: 'failed' }); } catch {}
                }
              }
            } catch (err) {
              console.error('❌ Async YouTube download error (admin youtube update):', err?.message || err);
              await Song.updateDownloadStatus(songId, 'failed').catch(() => {});
              if (io) {
                try { broadcastProcessingStatus(io, { id: Number(songId), artist: song.artist, title: song.title, status: 'failed' }); } catch {}
              }
            }
          })();
        }
      } catch (error) {
        console.error('Error downloading YouTube video from admin update:', error);
        await Song.updateDownloadStatus(songId, 'failed');
        // Don't fail the request if download fails
      }
    } else {
      // No YouTube URL, reset download status
      await Song.updateDownloadStatus(songId, 'none');
    }
    
    res.json({ message: 'YouTube URL updated successfully' });
  } catch (error) {
    console.error('Update YouTube URL error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Process Magic YouTube for a song
router.post('/:songId/magic-youtube', [
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

    // Clean the YouTube URL before saving
    const cleanedUrl = cleanYouTubeUrl(youtubeUrl);
    
    // Update the YouTube URL in database
    await Song.updateYoutubeUrl(songId, cleanedUrl);
    
    // Set magic processing status
    await Song.updateDownloadStatus(songId, 'downloading', new Date().toISOString());
    
    // Start magic YouTube processing via AI services
    try {
      const https = require('http');
      const url = require('url');
      
      const pythonServerUrl = 'http://localhost:6000';
      const magicUrl = `${pythonServerUrl}/process_magic_youtube/${encodeURIComponent(song.artist)} - ${encodeURIComponent(song.title)}`;
      
      console.log('✨ Starting Magic YouTube processing:', {
        songId,
        artist: song.artist,
        title: song.title,
        youtubeUrl: cleanedUrl,
        magicUrl
      });
      
      const parsedUrl = url.parse(magicUrl);
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      const proxyReq = https.request(options, (proxyRes) => {
        let data = '';
        
        proxyRes.on('data', (chunk) => {
          data += chunk;
        });
        
        proxyRes.on('end', () => {
          try {
            const responseData = JSON.parse(data);
            console.log('✨ Magic YouTube processing response:', {
              statusCode: proxyRes.statusCode,
              responseData,
              timestamp: new Date().toISOString()
            });
            
            if (proxyRes.statusCode === 200) {
              // Update song mode to ultrastar (magic-youtube)
              Song.updateMode(songId, 'ultrastar').catch(console.error);
              Song.updateDownloadStatus(songId, 'ready').catch(console.error);
              
              // Add to invisible songs list
              db.run(
                'INSERT OR IGNORE INTO invisible_songs (artist, title) VALUES (?, ?)',
                [song.artist, song.title],
                function(err) {
                  if (err) {
                    console.error('Error adding Magic-YouTube song to invisible songs:', err);
                  } else {
                    console.log(`📝 Added Magic-YouTube song to invisible songs: ${song.artist} - ${song.title}`);
                  }
                }
              );
              
              // Broadcast finished
              const io = require('../../server').io;
              if (io) {
                broadcastProcessingStatus(io, { id: Number(songId), artist: song.artist, title: song.title, status: 'finished' });
              }
            } else {
              Song.updateDownloadStatus(songId, 'magic-failed').catch(console.error);
              const io = require('../../server').io;
              if (io) {
                broadcastProcessingStatus(io, { id: Number(songId), artist: song.artist, title: song.title, status: 'failed' });
              }
            }
          } catch (error) {
            console.error('✨ Error parsing Magic YouTube response:', error);
            Song.updateDownloadStatus(songId, 'magic-failed').catch(console.error);
            const io = require('../../server').io;
            if (io) {
              broadcastProcessingStatus(io, { id: Number(songId), artist: song.artist, title: song.title, status: 'failed' });
            }
          }
        });
      });
      
      proxyReq.on('error', (error) => {
        console.error('✨ Error processing Magic YouTube:', error);
        Song.updateDownloadStatus(songId, 'magic-failed').catch(console.error);
        const io = require('../../server').io;
        if (io) {
          broadcastProcessingStatus(io, { id: Number(songId), artist: song.artist, title: song.title, status: 'failed' });
        }
      });
      
      // Send the YouTube URL and song ID in the request body
      proxyReq.write(JSON.stringify({ youtubeUrl: cleanedUrl, songId: Number(songId) }));
      proxyReq.setTimeout(300000); // 5 minutes timeout for magic processing
      proxyReq.end();
      
    } catch (error) {
      console.error('✨ Error starting Magic YouTube processing:', error);
      await Song.updateDownloadStatus(songId, 'magic-failed');
      const io = require('../../server').io;
      if (io) {
        broadcastProcessingStatus(io, { id: Number(songId), artist: song.artist, title: song.title, status: 'failed' });
      }
    }
    
    res.json({ message: 'Magic YouTube processing started successfully' });
  } catch (error) {
    console.error('Magic YouTube processing error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get song details for editing
router.get('/:songId', async (req, res) => {
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
router.put('/:songId', [
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

    // Clean the YouTube URL before saving
    const cleanedUrl = cleanYouTubeUrl(youtubeUrl);
    
    // Update song details
    await new Promise((resolve, reject) => {
      const db = require('../../config/database');
      db.run(
        'UPDATE songs SET title = ?, artist = ?, youtube_url = ? WHERE id = ?',
        [title, artist || null, cleanedUrl || null, songId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Check if this is a YouTube URL and try to download it
    if (youtubeUrl && (youtubeUrl.includes('youtube.com') || youtubeUrl.includes('youtu.be'))) {
      try {
        console.log(`📥 Admin song update - attempting YouTube download: ${artist} - ${title}`);
        
        // Set download status to downloading
        await Song.updateDownloadStatus(songId, 'downloading', new Date().toISOString());
        
        // Check if song is already in YouTube cache
        const existingCache = findYouTubeSong(artist, title, cleanedUrl);
        if (existingCache) {
          console.log(`✅ Song already in YouTube cache: ${artist} - ${title}`);
          await Song.updateDownloadStatus(songId, 'cached');
        } else {
          // Fire-and-forget download; respond immediately
          const io = req.app.get('io');
          (async () => {
            try {
              const downloadResult = await downloadYouTubeVideo(youtubeUrl, artist, title);
              if (downloadResult.success) {
                console.log(`✅ YouTube video downloaded successfully: ${downloadResult.folderName}`);
                await Song.updateDownloadStatus(songId, 'ready').catch(() => {});
                // Add to invisible songs list
                try {
                  await new Promise((resolve, reject) => {
                    db.run(
                      'INSERT OR IGNORE INTO invisible_songs (artist, title) VALUES (?, ?)',
                      [artist, title],
                      function(err) { if (err) reject(err); else resolve(); }
                    );
                  });
                  console.log(`📝 Added to invisible songs: ${artist} - ${title}`);
                } catch (error) {
                  console.error('Error adding to invisible songs:', error);
                }
                if (io) {
                  try { broadcastProcessingStatus(io, { id: Number(songId), artist, title, status: 'finished' }); } catch {}
                }
              } else {
                console.log(`⚠️ YouTube download failed: ${downloadResult.error}`);
                await Song.updateDownloadStatus(songId, 'failed').catch(() => {});
                if (io) {
                  try { broadcastProcessingStatus(io, { id: Number(songId), artist, title, status: 'failed' }); } catch {}
                }
              }
            } catch (err) {
              console.error('❌ Async YouTube download error (admin song update):', err?.message || err);
              await Song.updateDownloadStatus(songId, 'failed').catch(() => {});
              if (io) {
                try { broadcastProcessingStatus(io, { id: Number(songId), artist, title, status: 'failed' }); } catch {}
              }
            }
          })();
        }
      } catch (error) {
        console.error('Error downloading YouTube video from admin song update:', error);
        await Song.updateDownloadStatus(songId, 'failed');
        // Don't fail the request if download fails
      }
    } else {
      // No YouTube URL, reset download status
      await Song.updateDownloadStatus(songId, 'none');
    }

    // Trigger automatic USDB search if artist or title changed and it's a YouTube song
    if (song.mode === 'youtube' && artist && title && artist !== 'Unknown Artist' && title !== 'YouTube Song') {
      // Import the function from songs.js
      const songsModule = require('../songs');
      if (songsModule.triggerAutomaticUSDBSearch) {
        songsModule.triggerAutomaticUSDBSearch(songId, artist, title);
      }
    }

    res.json({ message: 'Song updated successfully' });
  } catch (error) {
    console.error('Update song error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Refresh song classification - check if song is now available locally
router.put('/:songId/refresh-classification', async (req, res) => {
  try {
    const { songId } = req.params;
    
    const song = await Song.getById(songId);
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    const { artist, title } = song;
    let newMode = 'youtube';
    let newYoutubeUrl = song.youtube_url;
    let updated = false;

    // Verwende zentrale Video-Modi-Konfiguration
    const { findBestVideoMode } = require('../../config/videoModes');

    // Finde den besten verfügbaren Video-Modus
    const result = await findBestVideoMode(artist, title, song.youtube_url, req);
    
    if (result.mode !== song.mode || result.url !== song.youtube_url) {
      newMode = result.mode;
      newYoutubeUrl = result.url;
      updated = true;
      console.log(`🔄 Song classification updated: ${artist} - ${title} -> ${newMode} (${newYoutubeUrl})`);
    }

    // Update song in database if classification changed
    if (updated) {
      try {
        await new Promise((resolve, reject) => {
          db.run(
            'UPDATE songs SET youtube_url = ?, mode = ? WHERE id = ?',
            [newYoutubeUrl, newMode, songId],
            function(err) {
              if (err) {
                console.error('Error updating song classification:', err);
                reject(err);
              } else {
                console.log(`✅ Song classification updated successfully: ${artist} - ${title} -> ${newMode}`);
                resolve();
              }
            }
          );
        });
      } catch (updateError) {
        console.error('Failed to update song classification:', updateError);
        throw updateError;
      }
    }

    res.json({ 
      message: updated ? 'Song classification updated successfully' : 'No local files found, song remains as YouTube',
      updated,
      newMode: updated ? newMode : song.mode,
      newYoutubeUrl: updated ? newYoutubeUrl : song.youtube_url
    });
  } catch (error) {
    console.error('Refresh song classification error:', error);
    console.error('Error details:', {
      songId: req.params.songId,
      artist: song?.artist,
      title: song?.title,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Test a song - start it immediately as current song with admin as singer
router.post('/test', async (req, res) => {
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

module.exports = router;
