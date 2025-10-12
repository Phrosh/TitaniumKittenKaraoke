const express = require('express');
const { body, validationResult } = require('express-validator');
const axios = require('axios');
const User = require('../../models/User');
const Song = require('../../models/Song');
const PlaylistAlgorithm = require('../../utils/playlistAlgorithm');
const YouTubeMetadataService = require('../../utils/youtubeMetadata');
const { downloadYouTubeVideo } = require('../../utils/youtubeSongs');
const { broadcastShowUpdate, broadcastAdminUpdate, broadcastPlaylistUpdate, broadcastProcessingStatus } = require('../../utils/websocketService');
const { cleanYouTubeUrl } = require('../../utils/youtubeUrlCleaner');
const path = require('path');
const fs = require('fs');

const router = express.Router();

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

// Public USDB search endpoint
router.post('/usdb-search', async (req, res) => {
  try {
    const { interpret, title, limit = 20 } = req.body;
    console.log('🔍 Public USDB search called with:', { interpret, title, limit });
    
    // Check if USDB search is enabled
    const db = require('../../config/database');
    const usdbSearchSetting = await new Promise((resolve, reject) => {
      db.get('SELECT value FROM settings WHERE key = ?', ['usdb_search_enabled'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    const usdbSearchEnabled = usdbSearchSetting ? usdbSearchSetting.value === 'true' : false;
    console.log('⚙️ USDB search enabled setting:', usdbSearchEnabled);
    
    if (!usdbSearchEnabled) {
      console.log('❌ USDB search disabled, returning empty results');
      return res.json({ songs: [] });
    }
    
    // Get USDB credentials from database
    const credentials = await new Promise((resolve, reject) => {
      db.get('SELECT username, password FROM usdb_credentials ORDER BY created_at DESC LIMIT 1', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!credentials) {
      console.log('❌ No USDB credentials found, returning empty results');
      return res.json({ songs: [] });
    }
    
    const usdbCredentials = credentials;
    
    // Call Python AI service for USDB search
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:6000';
    
    try {
      // First check if AI service is reachable
      try {
        await axios.get(`${aiServiceUrl}/health`, { timeout: 5000 });
      } catch (healthError) {
        console.error('AI Service health check failed:', healthError.message);
        return res.json({ songs: [] }); // Return empty results instead of error
      }

      const searchData = {
        interpret: interpret || '',
        title: title || '',
        limit: limit,
        username: usdbCredentials.username,
        password: usdbCredentials.password
      };

      console.log('🌐 Performing USDB search via AI service...');
      const response = await axios.post(`${aiServiceUrl}/usdb/search`, searchData, {
        timeout: 30000 // 30 seconds timeout for search
      });

      if (response.data.success) {
        console.log('🎯 USDB search returned', response.data.songs.length, 'songs');
        res.json({ songs: response.data.songs });
      } else {
        console.log('❌ USDB search failed:', response.data.error);
        res.json({ songs: [] });
      }
    } catch (aiServiceError) {
      console.error('AI Service Search Error:', aiServiceError.message);
      res.json({ songs: [] }); // Return empty results instead of error
    }
    
  } catch (error) {
    console.error('💥 Error in public USDB search:', error);
    res.json({ songs: [] }); // Return empty results instead of error
  }
});

// Get USDB search enabled setting (public)
router.get('/usdb-search-enabled', async (req, res) => {
  try {
    const db = require('../../config/database');
    const usdbSearchSetting = await new Promise((resolve, reject) => {
      db.get('SELECT value FROM settings WHERE key = ?', ['usdb_search_enabled'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    const usdbSearchEnabled = usdbSearchSetting ? usdbSearchSetting.value === 'true' : false; // Default to false if not set
    
    res.json({ 
      settings: { 
        usdb_search_enabled: usdbSearchEnabled.toString() 
      } 
    });
  } catch (error) {
    console.error('Error getting USDB search setting:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get file songs (public)
router.get('/file-songs', async (req, res) => {
  try {
    const db = require('../../config/database');
    
    // Get file songs folder and port from settings
    const folderSetting = await new Promise((resolve, reject) => {
      db.get('SELECT value FROM settings WHERE key = ?', ['file_songs_folder'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    const portSetting = await new Promise((resolve, reject) => {
      db.get('SELECT value FROM settings WHERE key = ?', ['file_songs_port'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    const folderPath = folderSetting ? folderSetting.value : '';
    const port = portSetting ? parseInt(portSetting.value) : 4000;
    
    if (!folderPath) {
      return res.json({ fileSongs: [] });
    }
    
    // Scan the folder for video files
    const { scanFileSongs } = require('../../utils/fileSongs');
    const fileSongs = await scanFileSongs(folderPath);
    
    res.json({ 
      fileSongs: fileSongs.map(song => ({
        ...song,
        port: port
      }))
    });
  } catch (error) {
    console.error('Error getting file songs:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Submit new song request
router.post('/request', [
  body('name').notEmpty().trim().isLength({ min: 1, max: 100 }),
  body('songInput').notEmpty().trim().isLength({ min: 1, max: 500 }),
  body('deviceId').optional().isLength({ min: 3, max: 10 }),
  body('withBackgroundVocals').optional().isBoolean(),
  body('youtubeMode').optional().isIn(['karaoke', 'magic'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, songInput, deviceId, youtubeMode } = req.body;
    let { withBackgroundVocals } = req.body;

    // Check if YouTube is enabled
    const db = require('../../config/database');
    const youtubeSetting = await new Promise((resolve, reject) => {
      db.get('SELECT value FROM settings WHERE key = ?', ['youtube_enabled'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    const youtubeEnabled = youtubeSetting ? youtubeSetting.value === 'true' : true; // Default to true if not set

    // Check if device ID is banned
    const banCheck = await new Promise((resolve, reject) => {
      db.get('SELECT device_id FROM banlist WHERE device_id = ?', [deviceId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (banCheck) {
      // Device is banned - return success response but don't actually add the song
      console.log(`🚫 Song request blocked due to banlist - Device ID: ${deviceId}, Song: ${songInput}, User: ${name}`);
      
      // Return fake success response to user
      return res.json({
        success: true,
        song: {
          id: 0, // Fake ID
          title: songInput.includes(' - ') ? songInput.split(' - ')[1] : songInput,
          artist: songInput.includes(' - ') ? songInput.split(' - ')[0] : 'Unknown',
          position: 0
        },
        message: 'Song wurde erfolgreich zur Playlist hinzugefügt!'
      });
    }

    // Parse song input (could be "Artist - Title" or YouTube URL)
    let title, artist, youtubeUrl = null;
    let downloadStatus = 'none';
    
    if (songInput.includes('youtube.com') || songInput.includes('youtu.be')) {
      // Check if YouTube is enabled
      if (!youtubeEnabled) {
        return res.status(400).json({ 
          error: 'YouTube-Links sind derzeit nicht erlaubt. Bitte wähle einen Song aus der lokalen Songliste.' 
        });
      }
      
      // It's a YouTube URL - clean it and try to extract metadata
      youtubeUrl = cleanYouTubeUrl(songInput);
      
      try {
        const metadata = await YouTubeMetadataService.getMetadata(youtubeUrl);
        title = metadata.title;
        artist = metadata.artist || 'Unknown Artist';
        
        // Try to download YouTube video to songs/youtube folder (skip for magic mode)
        if (youtubeMode !== 'magic') {
          console.log(`📥 Attempting to download YouTube video (async): ${artist} - ${title}`);
          downloadStatus = 'downloading';
          // Start async download without awaiting to allow immediate response and UI closing
          try {
            const io = req.app.get('io');
            // Kick off download in background
            downloadYouTubeVideo(youtubeUrl, artist, title)
              .then(async (downloadResult) => {
                if (downloadResult && downloadResult.success) {
                  console.log(`✅ YouTube video downloaded successfully: ${downloadResult.folderName}`);
                  try {
                    await Song.updateDownloadStatus(song.id, 'ready');
                  } catch {}
                  // Add to invisible songs list
                  try {
                    const db = require('../../config/database');
                    await new Promise((resolve, reject) => {
                      db.run(
                        'INSERT OR IGNORE INTO invisible_songs (artist, title) VALUES (?, ?)',
                        [artist, title],
                        function(err) {
                          if (err) reject(err);
                          else resolve();
                        }
                      );
                    });
                    console.log(`📝 Added to invisible songs: ${artist} - ${title}`);
                  } catch (error) {
                    console.error('Error adding to invisible songs:', error);
                  }
                  // Broadcast finished to update badge
                  try {
                    if (io) {
                      broadcastProcessingStatus(io, { id: song.id, artist, title, status: 'finished' });
                    }
                  } catch {}
                } else {
                  console.log(`⚠️ YouTube download failed: ${downloadResult?.error}`);
                  try {
                    await Song.updateDownloadStatus(song.id, 'failed');
                  } catch {}
                  try {
                    if (io) {
                      broadcastProcessingStatus(io, { id: song.id, artist, title, status: 'failed' });
                    }
                  } catch {}
                }
              })
              .catch(async (err) => {
                console.error('❌ Async YouTube download error:', err?.message || err);
                try { await Song.updateDownloadStatus(song.id, 'failed'); } catch {}
                try {
                  const io2 = req.app.get('io');
                  if (io2) {
                    broadcastProcessingStatus(io2, { id: song.id, artist, title, status: 'failed' });
                  }
                } catch {}
              });
          } catch (kickErr) {
            console.error('❌ Failed to kick off async YouTube download:', kickErr?.message || kickErr);
          }
        } else {
          console.log(`✨ Skipping normal YouTube download for magic mode: ${artist} - ${title}`);
        }
      } catch (error) {
        console.error('Failed to extract YouTube metadata:', error.message);
        // Fallback to generic values
        title = 'YouTube Song';
        artist = 'Unknown Artist';
      }
    } else if (songInput.includes(' - ')) {
      // It's "Artist - Title" format
      const parts = songInput.split(' - ');
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    } else {
      // Treat as title only
      title = songInput;
      artist = 'Unknown Artist';
    }

    // Always create a new user for each song request
    // Device ID is only used as additional information
    const user = await User.create(name, deviceId);

    // Verwende zentrale Video-Modi-Konfiguration
    const { findBestVideoMode } = require('../../config/videoModes');
    let mode = 'youtube';
    let durationSeconds = null;
    let ultrastarSong = null;
    
    if (!youtubeUrl) {
      // Finde den besten verfügbaren Video-Modus
      const result = await findBestVideoMode(artist, title, youtubeUrl, req);
      mode = result.mode;
      youtubeUrl = result.url;
      
      // Spezielle Behandlung für Ultrastar-Songs
      if (mode === 'ultrastar' && result.foundItem) {
        ultrastarSong = result.foundItem;
        
        // For automatically detected ultrastar songs, set withBackgroundVocals based on available files
        if (withBackgroundVocals === undefined || withBackgroundVocals === null) {
          const folderPath = path.join(require('../../utils/ultrastarSongs').ULTRASTAR_DIR, ultrastarSong.folderName);
          if (fs.existsSync(folderPath)) {
            const files = fs.readdirSync(folderPath);
            const hasHp5File = files.some(file => file.toLowerCase().includes('.hp5.mp3'));
            const hasHp2File = files.some(file => file.toLowerCase().includes('.hp2.mp3'));
            
            // Default to HP5 (with background vocals) if available, otherwise HP2
            withBackgroundVocals = hasHp5File || !hasHp2File;
            console.log(`Auto-detected ultrastar song background vocals preference: ${withBackgroundVocals} (HP5 available: ${hasHp5File}, HP2 available: ${hasHp2File})`);
          } else {
            // If folder doesn't exist, default to false
            withBackgroundVocals = false;
            console.log(`Ultrastar folder not found, defaulting withBackgroundVocals to false`);
          }
        }
      }
      
      // Trigger video conversion for ultrastar song
      if (ultrastarSong) {
        try {
            const { ULTRASTAR_DIR } = require('../../utils/ultrastarSongs');
            const folderPath = path.join(ULTRASTAR_DIR, ultrastarSong.folderName);
            
            // Check if folder exists and find video files
            if (fs.existsSync(folderPath)) {
              const files = fs.readdirSync(folderPath);
              
              // Check for audio sources (audio files or video files)
              const audioFiles = files.filter(file => {
                const ext = path.extname(file).toLowerCase();
                const name = path.basename(file, ext).toLowerCase();
                return ['.mp3', '.flac', '.ogg', '.wav', '.m4a', '.aac'].includes(ext) &&
                       !name.includes('hp2') && !name.includes('hp5') && 
                       !name.includes('vocals') && !name.includes('instrumental') &&
                       !name.includes('extracted');
              });
              
              const videoFiles = files.filter(file => {
                const ext = path.extname(file).toLowerCase();
                return ['.webm', '.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.xvid', '.mpeg', '.mpg'].includes(ext);
              });
              
              if (videoFiles.length > 0) {
                const videoFile = videoFiles[0]; // Use first video file found
                const videoExt = path.extname(videoFile).toLowerCase();
                
                // Check if video needs conversion (not .webm or .mp4)
                if (videoExt !== '.webm' && videoExt !== '.mp4') {
                  console.log('🎬 Triggering video conversion on song request:', {
                    folderName: ultrastarSong.folderName,
                    videoFile,
                    timestamp: new Date().toISOString()
                  });
                  
                  // Use internal proxy endpoint instead of direct call
                  triggerVideoConversionViaProxy(ultrastarSong.folderName);
                } else {
                  console.log('🎬 Video already in preferred format:', {
                    folderName: ultrastarSong.folderName,
                    videoFile,
                    extension: videoExt
                  });
                }
              }
              
              // Check if HP2/HP5 instrumental files exist and trigger audio separation if needed
              const hp2File = files.find(file => file.toLowerCase().includes('.hp2.mp3'));
              const hp5File = files.find(file => file.toLowerCase().includes('.hp5.mp3'));
              
              const hasAudioSource = audioFiles.length > 0 || videoFiles.length > 0;
              
              if ((!hp2File || !hp5File) && hasAudioSource) {
                console.log('🎵 Triggering audio separation on song request:', {
                  folderName: ultrastarSong.folderName,
                  missingFiles: {
                    hp2: !hp2File,
                    hp5: !hp5File
                  },
                  hasAudioFiles: audioFiles.length > 0,
                  hasVideoFiles: videoFiles.length > 0,
                  hasAudioSource,
                  timestamp: new Date().toISOString()
                });
                
                // Use internal proxy endpoint instead of direct call
                triggerAudioSeparationViaProxy(ultrastarSong.folderName);
              } else if (hp2File && hp5File) {
                console.log('🎵 HP2/HP5 instrumental files already exist:', {
                  folderName: ultrastarSong.folderName,
                  hp2File,
                  hp5File
                });
              } else {
                console.log('🎵 No audio source available for separation:', {
                  folderName: ultrastarSong.folderName,
                  hasAudioFiles: audioFiles.length > 0,
                  hasVideoFiles: videoFiles.length > 0,
                  hasAudioSource
                });
              }
            }
        } catch (error) {
          console.error('🎬🎵 Error triggering video conversion or audio separation:', error);
        }
      }
      
      // YouTube cache wird jetzt in der zentralen Konfiguration behandelt
    }

    // Get duration if it's a YouTube URL
    if (mode === 'youtube' && youtubeUrl && (songInput.includes('youtube.com') || songInput.includes('youtu.be'))) {
      try {
        const metadata = await YouTubeMetadataService.getMetadata(youtubeUrl);
        durationSeconds = metadata.duration_seconds;
      } catch (error) {
        console.error('Failed to get duration:', error.message);
      }
    }

    // Clean up any existing test songs when adding new songs
    await cleanupTestSongs();

    // Check if this is an admin request (no deviceId or deviceId is 'ADMIN')
    const isAdminRequest = !deviceId || deviceId === 'ADMIN' || name === 'Admin';
    console.log(`🔍 Request source: ${isAdminRequest ? 'Admin' : 'User'} (deviceId: ${deviceId}, name: ${name})`);
    
    // For admin requests, always add directly (no approval needed)
    if (isAdminRequest) {
      console.log(`✅ Admin request, adding song directly: ${artist} - ${title}`);
    } else {
      // Check if song requires approval (only for user requests)
      const requiresApproval = await checkIfSongRequiresApproval(artist, title, mode, youtubeUrl);
      console.log(`🔍 Song requires approval: ${requiresApproval}`);
      
      if (requiresApproval) {
        // Check if auto-approve is enabled
        const autoApproveSetting = await new Promise((resolve, reject) => {
          db.get('SELECT value FROM settings WHERE key = ?', ['auto_approve_songs'], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
        
        const autoApproveEnabled = autoApproveSetting && autoApproveSetting.value === 'true';
        console.log(`🔍 Auto-approve setting: ${autoApproveSetting?.value}, enabled: ${autoApproveEnabled}`);
        
        if (!autoApproveEnabled) {
          console.log(`📝 Storing song for approval: ${artist} - ${title}`);
          // Store song request for approval
          await storeSongRequestForApproval(user.id, name, artist, title, youtubeUrl, songInput, deviceId, withBackgroundVocals || false);
          
          // Send WebSocket notification to admin dashboard
          const { broadcastSongApprovalNotification } = require('../../utils/websocketService');
          const io = require('../../server').io;
          if (io) {
            await broadcastSongApprovalNotification(io, {
              singer_name: name,
              artist: artist,
              title: title,
              youtube_url: youtubeUrl,
              song_input: songInput,
              device_id: deviceId,
              with_background_vocals: withBackgroundVocals || false
            });
          }
          
          return res.json({ 
            message: 'Songwunsch wurde zur Bestätigung eingereicht',
            requiresApproval: true 
          });
        } else {
          console.log(`✅ Auto-approve enabled, adding song directly: ${artist} - ${title}`);
        }
      } else {
        console.log(`✅ Song does not require approval, adding directly: ${artist} - ${title}`);
      }
    }

    // Create song with priority, duration, mode and background vocals preference
    // For magic YouTube mode, use ultrastar mode to avoid creating in songs/youtube
    const finalMode = (mode === 'youtube' && youtubeMode === 'magic') ? 'ultrastar' : mode;
    
    // For magic YouTube mode, set the correct youtube_url to magic-youtube API endpoint
    let finalYoutubeUrl = youtubeUrl;
    if (mode === 'youtube' && youtubeMode === 'magic') {
      finalYoutubeUrl = `/api/magic-youtube/${encodeURIComponent(`${artist} - ${title}`)}`;
      console.log(`✨ Magic YouTube mode: Setting youtube_url to ${finalYoutubeUrl}`);
    }
    
    const song = await Song.create(user.id, title, artist, finalYoutubeUrl, 1, durationSeconds, finalMode, withBackgroundVocals || false);
    
    // Update download status if this was a YouTube download
    if (mode === 'youtube' && youtubeUrl && (songInput.includes('youtube.com') || songInput.includes('youtu.be'))) {
      if (youtubeMode === 'magic') {
        // Set magic processing status
        await Song.updateDownloadStatus(song.id, 'downloading', new Date().toISOString());
        // Broadcast processing started
        try {
          const io = req.app.get('io');
          if (io) {
            broadcastProcessingStatus(io, { id: song.id, artist, title, status: 'downloading' });
          }
        } catch {}
        
        // Start magic YouTube processing via AI services
        try {
          const https = require('http');
          const url = require('url');
          
          const pythonServerUrl = 'http://localhost:6000';
          const magicUrl = `${pythonServerUrl}/process_magic_youtube/${encodeURIComponent(artist)} - ${encodeURIComponent(title)}`;
          
          console.log('✨ Starting Magic YouTube processing from song request:', {
            songId: song.id,
            artist,
            title,
            youtubeUrl,
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
                console.log('✨ Magic YouTube processing response from song request:', {
                  statusCode: proxyRes.statusCode,
                  responseData,
                  timestamp: new Date().toISOString()
                });
                
                if (proxyRes.statusCode === 200) {
                  // Magic processing completed successfully
                  Song.updateDownloadStatus(song.id, 'ready').catch(console.error);
                  
                  // Add to invisible songs list
                  const db = require('../../config/database');
                  db.run(
                    'INSERT OR IGNORE INTO invisible_songs (artist, title) VALUES (?, ?)',
                    [artist, title],
                    function(err) {
                      if (err) {
                        console.error('Error adding Magic-YouTube song to invisible songs:', err);
                      } else {
                        console.log(`📝 Added Magic-YouTube song to invisible songs: ${artist} - ${title}`);
                      }
                    }
                  );
                  
                  try {
                    const io = req.app.get('io');
                    if (io) {
                      broadcastProcessingStatus(io, { id: song.id, artist, title, status: 'finished' });
                    }
                  } catch {}
                } else {
                  Song.updateDownloadStatus(song.id, 'magic-failed').catch(console.error);
                  try {
                    const io = req.app.get('io');
                    if (io) {
                      broadcastProcessingStatus(io, { id: song.id, artist, title, status: 'failed' });
                    }
                  } catch {}
                }
              } catch (error) {
                console.error('✨ Error parsing Magic YouTube response from song request:', error);
                Song.updateDownloadStatus(song.id, 'magic-failed').catch(console.error);
              }
            });
          });
          
          proxyReq.on('error', (error) => {
            console.error('✨ Error processing Magic YouTube from song request:', error);
            Song.updateDownloadStatus(song.id, 'magic-failed').catch(console.error);
            try {
              const io = req.app.get('io');
          if (io) {
            broadcastProcessingStatus(io, { id: song.id, artist, title, status: 'failed' });
          }
            } catch {}
          });
          
          // Send the YouTube URL and song ID in the request body
          proxyReq.write(JSON.stringify({ youtubeUrl, songId: song.id }));
          proxyReq.setTimeout(300000); // 5 minutes timeout for magic processing
          proxyReq.end();
          
        } catch (error) {
          console.error('✨ Error starting Magic YouTube processing from song request:', error);
          await Song.updateDownloadStatus(song.id, 'magic-failed');
          try {
            const io = req.app.get('io');
            if (io) {
              broadcastProcessingStatus(io, { id: song.id, artist, title, status: 'failed' });
            }
          } catch {}
        }
      } else {
        // Regular YouTube processing
        await Song.updateDownloadStatus(song.id, downloadStatus);
        try {
          const io = req.app.get('io');
          if (io) {
            broadcastProcessingStatus(io, { id: song.id, artist, title, status: downloadStatus });
          }
        } catch {}
      }
    }
    
    // Trigger automatic USDB search and download for YouTube songs
    console.log('🔍 Checking conditions for automatic USDB search:', {
      mode,
      artist,
      title,
      artistNotUnknown: artist !== 'Unknown Artist',
      titleNotYouTubeSong: title !== 'YouTube Song',
      shouldTrigger: (mode === 'youtube' || mode === 'youtube_cache' || (!youtubeUrl && artist && title && artist !== 'Unknown Artist' && title !== 'YouTube Song')) && youtubeMode !== 'magic',
      timestamp: new Date().toISOString()
    });
    
    // Trigger automatic USDB search for songs that could benefit from it (but not for magic mode)
    const shouldTriggerUSDB = (mode === 'youtube' || mode === 'youtube_cache' || (!youtubeUrl && artist && title && artist !== 'Unknown Artist' && title !== 'YouTube Song')) && youtubeMode !== 'magic';
    
    console.log('🔍 USDB trigger conditions:', {
      mode,
      youtubeUrl,
      youtubeMode,
      artist,
      title,
      artistNotUnknown: artist !== 'Unknown Artist',
      titleNotYouTubeSong: title !== 'YouTube Song',
      shouldTrigger: shouldTriggerUSDB,
      timestamp: new Date().toISOString()
    });
    
    if (shouldTriggerUSDB) {
      console.log('✅ Conditions met, triggering automatic USDB search');
      
      // Set song status to "downloading" to show loading state in UI
      try {
        const Song = require('../../models/Song');
        await Song.updateStatus(song.id, 'downloading');
        await Song.updateDownloadStartTime(song.id, new Date().toISOString());
        console.log('🔄 Song status set to downloading:', { songId: song.id, artist, title });
      } catch (statusError) {
        console.error('❌ Failed to set song status to downloading:', statusError);
      }
      
      triggerAutomaticUSDBSearch(song.id, artist, title);
    } else {
      console.log('❌ Conditions not met for automatic USDB search');
    }
    
    // Insert into playlist using algorithm
    const position = await PlaylistAlgorithm.insertSong(song.id);

    // Broadcast playlist update via WebSocket
    const io = req.app.get('io');
    if (io) {
      await broadcastShowUpdate(io);
      await broadcastAdminUpdate(io);
      await broadcastPlaylistUpdate(io);
    }

    res.json({
      success: true,
      song: {
        id: song.id,
        title,
        artist,
        youtubeUrl,
        position,
        deviceId: user.device_id
      },
      user: {
        id: user.id,
        name: user.name,
        deviceId: user.device_id
      }
    });
  } catch (error) {
    console.error('Song request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current playlist (public endpoint)
router.get('/playlist', async (req, res) => {
  try {
    const playlist = await Song.getAll();
    const currentSong = await Song.getCurrentSong();
    
    res.json({
      playlist,
      currentSong,
      total: playlist.length
    });
  } catch (error) {
    console.error('Get playlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get pending songs (songs without YouTube URLs)
router.get('/pending', async (req, res) => {
  try {
    const pendingSongs = await Song.getPending();
    res.json({ pendingSongs });
  } catch (error) {
    console.error('Get pending songs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Generate QR code data
router.get('/qr-data', async (req, res) => {
  try {
    // Get custom URL from settings
    const db = require('../../config/database');
    const customUrlSetting = await new Promise((resolve, reject) => {
      db.get(
        'SELECT value FROM settings WHERE key = ?',
        ['custom_url'],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    const customUrl = customUrlSetting ? customUrlSetting.value : '';
    
    let qrUrl;
    if (customUrl && customUrl.trim()) {
      // Use custom URL + /new
      qrUrl = customUrl.trim().replace(/\/$/, '') + '/new';
    } else {
      // Use same domain for QR code generation
      const protocol = req.get('x-forwarded-proto') || req.protocol;
      const host = req.get('host');
      qrUrl = `${protocol}://${host}/new`;
    }


    // Generate QR code data URL using local library
    const QRCode = require('qrcode');
    const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 300
    });
    

    const qrData = {
      url: qrUrl,
      qrCodeDataUrl: qrCodeDataUrl,
      timestamp: new Date().toISOString()
    };
    
    res.json(qrData);
  } catch (error) {
    console.error('Error generating QR data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to trigger video conversion via internal proxy
function triggerVideoConversionViaProxy(folderName) {
  try {
    const axios = require('axios');
    const proxyUrl = `http://localhost:5000/api/songs/ai-services/convert_video/ultrastar/${encodeURIComponent(folderName)}`;
    
    console.log('🎬 Triggering video conversion via proxy:', {
      folderName,
      proxyUrl,
      timestamp: new Date().toISOString()
    });
    
    // Make async request to internal proxy (don't wait for completion)
    axios.post(proxyUrl, {}, { timeout: 30000 })
      .then(response => {
        console.log('🎬 Video conversion proxy response:', {
          status: response.status,
          data: response.data,
          timestamp: new Date().toISOString()
        });
      })
      .catch(error => {
        console.error('🎬 Video conversion proxy error:', {
          message: error.message,
          code: error.code,
          timestamp: new Date().toISOString()
        });
      });
  } catch (error) {
    console.error('🎬 Error in triggerVideoConversionViaProxy:', error);
  }
}

// Helper function to trigger audio separation via internal proxy
function triggerAudioSeparationViaProxy(folderName) {
  try {
    const axios = require('axios');
    const proxyUrl = `http://localhost:5000/api/songs/ai-services/separate_audio/ultrastar/${encodeURIComponent(folderName)}`;
    
    console.log('🎵 Triggering audio separation via proxy:', {
      folderName,
      proxyUrl,
      timestamp: new Date().toISOString()
    });
    
    // Make async request to internal proxy (don't wait for completion)
    axios.post(proxyUrl, {}, { timeout: 30000 })
      .then(response => {
        console.log('🎵 Audio separation proxy response:', {
          status: response.status,
          data: response.data,
          timestamp: new Date().toISOString()
        });
      })
      .catch(error => {
        console.error('🎵 Audio separation proxy error:', {
          message: error.message,
          code: error.code,
          timestamp: new Date().toISOString()
        });
      });
  } catch (error) {
    console.error('🎵 Error in triggerAudioSeparationViaProxy:', error);
  }
}

// Helper function to trigger automatic USDB search and download
async function triggerAutomaticUSDBSearch(songId, artist, title) {
  try {
    console.log('🔍 Triggering automatic USDB search:', {
      songId,
      artist,
      title,
      timestamp: new Date().toISOString()
    });

    // Get USDB credentials
    const db = require('../../config/database');
    const credentials = await new Promise((resolve, reject) => {
      db.get('SELECT username, password FROM usdb_credentials ORDER BY created_at DESC LIMIT 1', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!credentials) {
      console.log('⚠️ No USDB credentials found, skipping automatic search');
      return;
    }

    // Search USDB using the AI service
    const axios = require('axios');
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:6000';
    
    try {
      console.log('🔍 Making USDB search request to AI service:', {
        url: `${aiServiceUrl}/usdb/search`,
        interpret: artist,
        title: title,
        limit: 1,
        timestamp: new Date().toISOString()
      });

      const searchResponse = await axios.post(`${aiServiceUrl}/usdb/search`, {
        interpret: artist,
        title: title,
        limit: 1, // Only get the first result
        username: credentials.username,
        password: credentials.password
      }, {
        timeout: 30000
      });

      console.log('🔍 USDB search response received:', {
        status: searchResponse.status,
        success: searchResponse.data.success,
        songsFound: searchResponse.data.songs?.length || 0,
        timestamp: new Date().toISOString()
      });

      if (searchResponse.data.success && searchResponse.data.songs.length > 0) {
        const firstSong = searchResponse.data.songs[0];
        console.log('🎵 Found USDB song, triggering download:', {
          songId,
          usdbId: firstSong.id,
          artist: firstSong.artist,
          title: firstSong.title,
          url: firstSong.url,
          timestamp: new Date().toISOString()
        });

        // Trigger USDB download
        await triggerAutomaticUSDBDownload(songId, firstSong.url);
      } else {
        console.log('🔍 No USDB songs found for:', { 
          artist, 
          title,
          response: searchResponse.data,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('🔍 USDB search error:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('🔍 Error in triggerAutomaticUSDBSearch:', error);
  }
}

// Helper function to check if a song requires approval
async function checkIfSongRequiresApproval(artist, title, mode, youtubeUrl) {
  try {
    const db = require('../../config/database');
    
    // Check if song already exists
    const existingSong = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM songs WHERE artist = ? AND title = ?', [artist, title], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (existingSong) {
      console.log(`Song already exists: ${artist} - ${title}`);
      return false; // No approval needed for existing songs
    }
    
    // Check if it's a YouTube song (always requires approval)
    if (mode === 'youtube' || youtubeUrl) {
      console.log(`YouTube song requires approval: ${artist} - ${title}`);
      return true;
    }
    
    // Check if it's a magic-youtube song (always requires approval)
    if (mode === 'magic-youtube') {
      console.log(`Magic-YouTube song requires approval: ${artist} - ${title}`);
      return true;
    }
    
    // Check if it's a USDB song (always requires approval)
    if (mode === 'ultrastar') {
      console.log(`USDB song requires approval: ${artist} - ${title}`);
      return true;
    }
    
    // For other modes, check if they exist in the file system
    const fs = require('fs');
    const path = require('path');
    
    const songsDir = path.join(process.cwd(), 'songs');
    const modeDir = path.join(songsDir, mode);
    
    if (fs.existsSync(modeDir)) {
      const folders = fs.readdirSync(modeDir);
      const songFolder = folders.find(folder => 
        folder.toLowerCase().includes(artist.toLowerCase()) && 
        folder.toLowerCase().includes(title.toLowerCase())
      );
      
      if (songFolder) {
        console.log(`Song found in file system: ${artist} - ${title}`);
        return false; // No approval needed for existing files
      }
    }
    
    // If we get here, it's a new song that requires approval
    console.log(`New song requires approval: ${artist} - ${title}`);
    return true;
    
  } catch (error) {
    console.error('Error checking if song requires approval:', error);
    return true; // Default to requiring approval on error
  }
}

// Helper function to store song request for approval
async function storeSongRequestForApproval(userId, singerName, artist, title, youtubeUrl, songInput, deviceId, withBackgroundVocals) {
  try {
    const db = require('../../config/database');
    
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO song_approvals (user_id, singer_name, artist, title, youtube_url, song_input, device_id, with_background_vocals, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, singerName, artist, title, youtubeUrl, songInput, deviceId, withBackgroundVocals, 'pending', new Date().toISOString()],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    console.log(`📝 Song request stored for approval: ${artist} - ${title} (User: ${singerName})`);
  } catch (error) {
    console.error('Error storing song request for approval:', error);
    throw error;
  }
}

// Helper function to trigger automatic USDB download using modular pipeline
async function triggerAutomaticUSDBDownload(songId, usdbUrl) {
  try {
    console.log('📥 Triggering automatic USDB download (modular):', {
      songId,
      usdbUrl,
      timestamp: new Date().toISOString()
    });

    // Get USDB credentials
    const db = require('../../config/database');
    const credentials = await new Promise((resolve, reject) => {
      db.get('SELECT username, password FROM usdb_credentials ORDER BY created_at DESC LIMIT 1', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!credentials) {
      console.log('⚠️ No USDB credentials found, skipping automatic download');
      // Set status to failed
      try {
        const Song = require('../../models/Song');
        await Song.updateStatus(songId, 'failed');
        console.log('❌ Song status set to failed (no credentials):', { songId });
      } catch (statusError) {
        console.error('❌ Failed to set song status to failed:', statusError);
      }
      return;
    }

    // Extract song ID from URL
    const songIdMatch = usdbUrl.match(/id=(\d+)/);
    if (!songIdMatch) {
      console.error('❌ Could not extract song ID from USDB URL:', usdbUrl);
      // Set status to failed
      try {
        const Song = require('../../models/Song');
        await Song.updateStatus(songId, 'failed');
        console.log('❌ Song status set to failed (invalid URL):', { songId });
      } catch (statusError) {
        console.error('❌ Failed to set song status to failed:', statusError);
      }
      return;
    }

    const usdbSongId = songIdMatch[1];

    // Set download start time and mode to ultrastar
    try {
      const Song = require('../../models/Song');
      await Song.updateDownloadStartTime(songId, new Date().toISOString());
      await Song.updateMode(songId, 'ultrastar');
      console.log('🕐 Download start time and mode set for song:', { songId, mode: 'ultrastar' });
    } catch (timeError) {
      console.error('❌ Failed to set download start time and mode:', timeError);
    }

    // Trigger modular USDB pipeline directly via AI service
    const axios = require('axios');
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:6000';
    
    try {
      // Use the modular USDB pipeline directly instead of the old download endpoint
      console.log('🔄 Triggering modular USDB pipeline directly:', {
        url: `${aiServiceUrl}/usdb/process/USDB_${usdbSongId}`,
        songId,
        usdbSongId,
        timestamp: new Date().toISOString()
      });

      const pipelineResponse = await axios.post(`${aiServiceUrl}/usdb/process/USDB_${usdbSongId}`, {
        songId: songId,
        username: credentials.username,
        password: credentials.password
      }, {
        timeout: 600000 // 10 minutes timeout for full pipeline
      });

      console.log('🔄 Modular USDB pipeline response:', {
        status: pipelineResponse.status,
        success: pipelineResponse.data.success,
        message: pipelineResponse.data.message,
        timestamp: new Date().toISOString()
      });

      if (pipelineResponse.data.success) {
        // The pipeline should have created the folder and processed everything
        // We need to find the actual folder name that was created
        const ultrastarDir = require('path').join(process.cwd(), 'songs', 'ultrastar');
        const fs = require('fs');
        
        let actualFolderName = null;
        try {
          const folders = fs.readdirSync(ultrastarDir);
          // Look for a folder that starts with the artist name from the pipeline
          const artistFromPipeline = pipelineResponse.data.message?.match(/artist['":\s]*([^,\n]+)/i)?.[1]?.trim();
          if (artistFromPipeline) {
            actualFolderName = folders.find(folder => 
              folder.includes(artistFromPipeline) && fs.statSync(require('path').join(ultrastarDir, folder)).isDirectory()
            );
          }
          // Fallback: use the most recently created folder
          if (!actualFolderName) {
            const folderStats = folders.map(folder => ({
              name: folder,
              time: fs.statSync(require('path').join(ultrastarDir, folder)).mtime.getTime()
            })).filter(f => fs.statSync(require('path').join(ultrastarDir, f.name)).isDirectory());
            
            if (folderStats.length > 0) {
              actualFolderName = folderStats.sort((a, b) => b.time - a.time)[0].name;
            }
          }
        } catch (fsError) {
          console.error('❌ Error finding actual folder name:', fsError);
        }
        
        if (actualFolderName) {
          // Update song with ultrastar mode and actual folder name
          try {
            const Song = require('../../models/Song');
            await Song.updateMode(songId, 'ultrastar');
            await Song.updateFolderName(songId, actualFolderName);
            await Song.updateStatus(songId, 'ready');
            await Song.updateDownloadEndTime(songId, new Date().toISOString());
            
            console.log('✅ Song updated to ultrastar mode:', {
              songId,
              actualFolderName,
              timestamp: new Date().toISOString()
            });
            
            // Add to invisible songs list
            try {
              await new Promise((resolve, reject) => {
                db.run(
                  'INSERT OR IGNORE INTO invisible_songs (artist, title) VALUES (?, ?)',
                  [pipelineResponse.data.message?.match(/artist['":\s]*([^,\n]+)/i)?.[1]?.trim() || 'Unknown', 
                   pipelineResponse.data.message?.match(/title['":\s]*([^,\n]+)/i)?.[1]?.trim() || 'Unknown'],
                  function(err) {
                    if (err) reject(err);
                    else resolve();
                  }
                );
              });
              console.log(`📝 Added song to invisible songs`);
            } catch (error) {
              console.error('Error adding song to invisible songs:', error);
            }
            
          } catch (updateError) {
            console.error('❌ Failed to update song after USDB pipeline:', updateError);
          }
          
        } else {
          console.error('❌ Could not determine actual folder name after pipeline');
          // Set status to failed
          try {
            const Song = require('../../models/Song');
            await Song.updateStatus(songId, 'failed');
            console.log('❌ Song status set to failed (no folder found):', { songId });
          } catch (statusError) {
            console.error('❌ Failed to set song status to failed:', statusError);
          }
        }
        
      } else {
        console.error('❌ Modular USDB pipeline failed:', pipelineResponse.data.error);
        // Set status to failed
        try {
          const Song = require('../../models/Song');
          await Song.updateStatus(songId, 'failed');
          console.log('❌ Song status set to failed (pipeline failed):', { songId });
        } catch (statusError) {
          console.error('❌ Failed to set song status to failed:', statusError);
        }
      }
      
    } catch (error) {
      console.error('❌ Modular USDB pipeline request failed:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        timestamp: new Date().toISOString()
      });
      
      // Set status to failed
      try {
        const Song = require('../../models/Song');
        await Song.updateStatus(songId, 'failed');
        console.log('❌ Song status set to failed (request failed):', { songId });
      } catch (statusError) {
        console.error('❌ Failed to set song status to failed:', statusError);
      }
    }

  } catch (error) {
    console.error('❌ Error in triggerAutomaticUSDBDownload:', error);
  }
}

module.exports = router;
