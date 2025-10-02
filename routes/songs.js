const express = require('express');
const { body, validationResult } = require('express-validator');
const axios = require('axios');
const User = require('../models/User');
const Song = require('../models/Song');
const PlaylistAlgorithm = require('../utils/playlistAlgorithm');
const YouTubeMetadataService = require('../utils/youtubeMetadata');
const { generateQRCodeForNew } = require('../utils/qrCodeGenerator');
const { findLocalVideo, VIDEOS_DIR } = require('../utils/localVideos');
const { findFileSong } = require('../utils/fileSongs');
const { scanYouTubeSongs, searchYouTubeSongs, findYouTubeSong, downloadYouTubeVideo } = require('../utils/youtubeSongs');
const { broadcastQRCodeToggle, broadcastShowUpdate, broadcastAdminUpdate, broadcastPlaylistUpdate } = require('../utils/websocketService');
const { cleanYouTubeUrl } = require('../utils/youtubeUrlCleaner');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Helper function to clean up test songs when switching songs
async function cleanupTestSongs() {
  const db = require('../config/database');
  
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
    const db = require('../config/database');
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
    const db = require('../config/database');
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
    const db = require('../config/database');
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
    const db = require('../config/database');
    
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
    const { scanFileSongs } = require('../utils/fileSongs');
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
    const db = require('../config/database');
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
        
        // Try to download YouTube video to songs/youtube folder
        console.log(`📥 Attempting to download YouTube video: ${artist} - ${title}`);
        downloadStatus = 'downloading';
        const downloadResult = await downloadYouTubeVideo(youtubeUrl, artist, title);
        
        if (downloadResult.success) {
          console.log(`✅ YouTube video downloaded successfully: ${downloadResult.folderName}`);
          downloadStatus = 'downloaded';
          
          // Add to invisible songs list
          try {
            const db = require('../config/database');
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
        } else {
          console.log(`⚠️ YouTube download failed: ${downloadResult.error}`);
          downloadStatus = 'failed';
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

    // Check for songs in priority order: file > server_video > ultrastar > youtube
    let mode = 'youtube';
    let durationSeconds = null;
    
    if (!youtubeUrl) {
      // First check file songs (highest priority)
      const db = require('../config/database');
      const fileFolderSetting = await new Promise((resolve, reject) => {
        db.get('SELECT value FROM settings WHERE key = ?', ['file_songs_folder'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      if (fileFolderSetting && fileFolderSetting.value) {
        const fileSong = findFileSong(fileFolderSetting.value, artist, title);
        if (fileSong) {
          mode = 'file';
          // Store only the filename, URL will be built dynamically in /show
          youtubeUrl = fileSong.filename;
          console.log(`Found file song: ${fileSong.filename}`);
        }
      }
      
      // If no file song found, check server videos
      if (mode === 'youtube') {
        const localVideo = findLocalVideo(artist, title);
        if (localVideo) {
          mode = 'server_video';
          youtubeUrl = `/api/videos/${encodeURIComponent(localVideo.filename)}`;
          console.log(`Found server video: ${localVideo.filename} -> URL: ${youtubeUrl}`);
        }
      }
      
      // Fix existing server_video URLs that might be missing file extension
      if (mode === 'server_video' && youtubeUrl && !youtubeUrl.includes('.')) {
        const localVideo = findLocalVideo(artist, title);
        if (localVideo) {
          youtubeUrl = `/api/videos/${encodeURIComponent(localVideo.filename)}`;
          console.log(`🔧 Fixed server video URL: ${artist} - ${title} -> ${youtubeUrl}`);
        }
      }
      
      // If no server video found, check ultrastar songs
      if (mode === 'youtube') {
        const { findUltrastarSong } = require('../utils/ultrastarSongs');
        const ultrastarSong = findUltrastarSong(artist, title);
        if (ultrastarSong) {
          mode = 'ultrastar';
          youtubeUrl = `/api/ultrastar/${encodeURIComponent(ultrastarSong.folderName)}`;
          console.log(`Found ultrastar song: ${ultrastarSong.folderName}`);
          
          // For automatically detected ultrastar songs, set withBackgroundVocals based on available files
          if (withBackgroundVocals === undefined || withBackgroundVocals === null) {
            const folderPath = path.join(require('../utils/ultrastarSongs').ULTRASTAR_DIR, ultrastarSong.folderName);
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
      }
      
      // If no ultrastar song found, check magic songs
      if (mode === 'youtube') {
        const { findMagicSong } = require('../utils/magicSongs');
        const magicSong = findMagicSong(artist, title);
        if (magicSong) {
          mode = 'ultrastar';
          youtubeUrl = `/api/magic-songs/${encodeURIComponent(magicSong.folderName)}`;
          console.log(`Found magic song: ${magicSong.folderName}`);
        }
      }
      
      // If no magic song found, check magic videos
      if (mode === 'youtube') {
        const { findMagicVideo } = require('../utils/magicVideos');
        const magicVideo = findMagicVideo(artist, title);
        if (magicVideo) {
          mode = 'ultrastar';
          youtubeUrl = `/api/magic-videos/${encodeURIComponent(magicVideo.folderName)}`;
          console.log(`Found magic video: ${magicVideo.folderName}`);
        }
      }
      
      // If no magic video found, check magic YouTube videos
      if (mode === 'youtube') {
        const { findMagicYouTubeVideo } = require('../utils/magicYouTube');
        const magicYouTubeVideo = findMagicYouTubeVideo(artist, title);
        if (magicYouTubeVideo) {
          mode = 'ultrastar';
          youtubeUrl = `/api/magic-youtube/${encodeURIComponent(magicYouTubeVideo.folderName)}`;
          console.log(`Found magic YouTube video: ${magicYouTubeVideo.folderName}`);
        }
      }
      
      // Trigger video conversion for ultrastar song
      if (ultrastarSong) {
        try {
            const { ULTRASTAR_DIR } = require('../utils/ultrastarSongs');
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
      
      // If no ultrastar song found, check YouTube cache
      if (mode === 'youtube') {
        const youtubeSong = findYouTubeSong(artist, title, youtubeUrl);
        if (youtubeSong) {
          mode = 'youtube_cache';
          youtubeUrl = `/api/youtube-videos/${encodeURIComponent(youtubeSong.folderName)}/${encodeURIComponent(youtubeSong.videoFile)}`;
          console.log(`Found YouTube cache: ${youtubeSong.folderName}/${youtubeSong.videoFile} -> URL: ${youtubeUrl}`);
        }
      }
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
          const { broadcastSongApprovalNotification } = require('../utils/websocketService');
          const io = require('../server').io;
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
    const song = await Song.create(user.id, title, artist, youtubeUrl, 1, durationSeconds, mode, withBackgroundVocals || false);
    
    // Update download status if this was a YouTube download
    if (mode === 'youtube' && youtubeUrl && (songInput.includes('youtube.com') || songInput.includes('youtu.be'))) {
      if (youtubeMode === 'magic') {
        // Set magic processing status
        await Song.updateDownloadStatus(song.id, 'magic-processing', new Date().toISOString());
        
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
                  Song.updateDownloadStatus(song.id, 'magic-completed').catch(console.error);
                } else {
                  Song.updateDownloadStatus(song.id, 'magic-failed').catch(console.error);
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
          });
          
          // Send the YouTube URL in the request body
          proxyReq.write(JSON.stringify({ youtubeUrl }));
          proxyReq.setTimeout(300000); // 5 minutes timeout for magic processing
          proxyReq.end();
          
        } catch (error) {
          console.error('✨ Error starting Magic YouTube processing from song request:', error);
          await Song.updateDownloadStatus(song.id, 'magic-failed');
        }
      } else {
        // Regular YouTube processing
        await Song.updateDownloadStatus(song.id, downloadStatus);
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
        const Song = require('../models/Song');
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
    const db = require('../config/database');
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


// Get list of local videos for song selection
router.get('/server-videos', (req, res) => {
  try {
    const { search } = req.query;
    const { scanLocalVideos, searchLocalVideos } = require('../utils/localVideos');
    
    let videos;
    if (search && search.trim()) {
      videos = searchLocalVideos(search.trim());
    } else {
      videos = scanLocalVideos();
    }
    
    res.json({ videos });
  } catch (error) {
    console.error('Error getting local videos:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get list of ultrastar songs for song selection
router.get('/ultrastar-songs', (req, res) => {
  try {
    const { search } = req.query;
    const { scanUltrastarSongs, searchUltrastarSongs } = require('../utils/ultrastarSongs');
    
    let songs;
    if (search && search.trim()) {
      songs = searchUltrastarSongs(search.trim());
    } else {
      songs = scanUltrastarSongs();
    }
    
    res.json({ songs });
  } catch (error) {
    console.error('Error getting ultrastar songs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get list of YouTube songs for song selection
router.get('/youtube-songs', (req, res) => {
  try {
    const { search } = req.query;
    
    let songs;
    if (search && search.trim()) {
      songs = searchYouTubeSongs(search.trim());
    } else {
      songs = scanYouTubeSongs();
    }
    
    res.json({ youtubeSongs: songs });
  } catch (error) {
    console.error('Error getting YouTube songs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get list of magic songs for song selection
router.get('/magic-songs', (req, res) => {
  try {
    const { search } = req.query;
    const { scanMagicSongs, searchMagicSongs } = require('../utils/magicSongs');
    
    let songs;
    if (search && search.trim()) {
      songs = searchMagicSongs(search.trim());
    } else {
      songs = scanMagicSongs();
    }
    
    res.json({ magicSongs: songs });
  } catch (error) {
    console.error('Error getting magic songs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get list of magic videos for song selection
router.get('/magic-videos', (req, res) => {
  try {
    const { search } = req.query;
    const { scanMagicVideos, searchMagicVideos } = require('../utils/magicVideos');
    
    let videos;
    if (search && search.trim()) {
      videos = searchMagicVideos(search.trim());
    } else {
      videos = scanMagicVideos();
    }
    
    res.json({ magicVideos: videos });
  } catch (error) {
    console.error('Error getting magic videos:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get list of magic YouTube videos for song selection
router.get('/magic-youtube', (req, res) => {
  try {
    const { search } = req.query;
    const { scanMagicYouTube, searchMagicYouTube } = require('../utils/magicYouTube');
    
    let videos;
    if (search && search.trim()) {
      videos = searchMagicYouTube(search.trim());
    } else {
      videos = scanMagicYouTube();
    }
    
    res.json({ magicYouTube: videos });
  } catch (error) {
    console.error('Error getting magic YouTube videos:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Download YouTube video to songs/youtube folder
router.post('/download-youtube', async (req, res) => {
  try {
    const { youtubeUrl, artist, title } = req.body;
    
    if (!youtubeUrl || !artist || !title) {
      return res.status(400).json({ 
        error: 'YouTube URL, artist, and title are required' 
      });
    }
    
    const result = await downloadYouTubeVideo(youtubeUrl, artist, title);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        folderName: result.folderName,
        videoFile: result.videoFile,
        videoId: result.videoId
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error downloading YouTube video:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error',
      message: error.message 
    });
  }
});

// Proxy endpoints for AI services
router.post('/ai-services/convert_video/ultrastar/:folderName', async (req, res) => {
  try {
    const { folderName } = req.params;
    const pythonServerUrl = 'http://localhost:6000';
    const convertUrl = `${pythonServerUrl}/convert_video/ultrastar/${encodeURIComponent(folderName)}`;
    
    console.log('🎬 Proxying video conversion request:', {
      folderName,
      convertUrl,
      timestamp: new Date().toISOString()
    });
    
    const https = require('http');
    const url = require('url');
    
    const parsedUrl = url.parse(convertUrl);
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
          console.log('🎬 AI service response:', {
            statusCode: proxyRes.statusCode,
            responseData,
            timestamp: new Date().toISOString()
          });
          
          res.status(proxyRes.statusCode).json(responseData);
        } catch (error) {
          console.error('🎬 Error parsing AI service response:', error);
          res.status(500).json({ error: 'Invalid response from AI service' });
        }
      });
    });
    
    proxyReq.on('error', (error) => {
      console.error('🎬 Error proxying to AI service:', error);
      res.status(500).json({ error: 'AI service unavailable' });
    });
    
    proxyReq.setTimeout(30000);
    proxyReq.end();
  } catch (error) {
    console.error('Error proxying video conversion:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/ai-services/separate_audio/ultrastar/:folderName', async (req, res) => {
  try {
    const { folderName } = req.params;
    const pythonServerUrl = 'http://localhost:6000';
    const separateUrl = `${pythonServerUrl}/separate_audio/ultrastar/${encodeURIComponent(folderName)}`;
    
    console.log('🎵 Proxying audio separation request:', {
      folderName,
      separateUrl,
      timestamp: new Date().toISOString()
    });
    
    const https = require('http');
    const url = require('url');
    
    const parsedUrl = url.parse(separateUrl);
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
          console.log('🎵 AI service response:', {
            statusCode: proxyRes.statusCode,
            responseData,
            timestamp: new Date().toISOString()
          });
          
          res.status(proxyRes.statusCode).json(responseData);
        } catch (error) {
          console.error('🎵 Error parsing AI service response:', error);
          res.status(500).json({ error: 'Invalid response from AI service' });
        }
      });
    });
    
    proxyReq.on('error', (error) => {
      console.error('🎵 Error proxying to AI service:', error);
      res.status(500).json({ error: 'AI service unavailable' });
    });
    
    proxyReq.setTimeout(30000);
    proxyReq.end();
  } catch (error) {
    console.error('Error proxying audio separation:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/ai-services/health', async (req, res) => {
  try {
    const pythonServerUrl = 'http://localhost:6000';
    const healthUrl = `${pythonServerUrl}/health`;
    
    const https = require('http');
    const url = require('url');
    
    const parsedUrl = url.parse(healthUrl);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.path,
      method: 'GET',
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
          res.status(proxyRes.statusCode).json(responseData);
        } catch (error) {
          console.error('Error parsing AI service health response:', error);
          res.status(500).json({ error: 'Invalid response from AI service' });
        }
      });
    });
    
    proxyReq.on('error', (error) => {
      console.error('Error proxying to AI service health:', error);
      res.status(500).json({ error: 'AI service unavailable' });
    });
    
    proxyReq.setTimeout(5000);
    proxyReq.end();
  } catch (error) {
    console.error('Error proxying AI service health check:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Manual processing endpoint for ultrastar songs
router.post('/ultrastar/:folderName/process', async (req, res) => {
  try {
    const { folderName } = req.params;
    const { ULTRASTAR_DIR } = require('../utils/ultrastarSongs');
    const fs = require('fs');
    const path = require('path');
    
    const folderPath = path.join(ULTRASTAR_DIR, decodeURIComponent(folderName));
    
    console.log('🔧 Manual processing request:', {
      folderName: decodeURIComponent(folderName),
      folderPath,
      timestamp: new Date().toISOString()
    });
    
    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ error: 'Ultrastar folder not found' });
    }
    
    const files = fs.readdirSync(folderPath);
    
    // Check what needs processing
    const hp2File = files.find(file => file.toLowerCase().includes('.hp2.mp3'));
    const hp5File = files.find(file => file.toLowerCase().includes('.hp5.mp3'));
    const videoFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.webm', '.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.xvid', '.mpeg', '.mpg'].includes(ext);
    });
    const preferredVideoFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.webm', '.mp4'].includes(ext);
    });
    
    // Check for existing audio files (not HP2/HP5/extracted)
    const audioFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      const name = path.basename(file, ext).toLowerCase();
      return ['.mp3', '.flac', '.ogg', '.wav', '.m4a', '.aac'].includes(ext) &&
             !name.includes('hp2') && !name.includes('hp5') && 
             !name.includes('vocals') && !name.includes('instrumental') &&
             !name.includes('extracted');
    });
    
    // Audio separation is needed if HP2/HP5 files are missing AND 
    // there are either audio files OR video files to extract audio from
    const hasAudioSource = audioFiles.length > 0 || videoFiles.length > 0;
    const needsAudioSeparation = (!hp2File || !hp5File) && hasAudioSource;
    const needsVideoConversion = videoFiles.length > 0 && preferredVideoFiles.length === 0;
    
    console.log('🔧 Processing analysis:', {
      folderName: decodeURIComponent(folderName),
      needsAudioSeparation,
      needsVideoConversion,
      hasVideoFiles: videoFiles.length > 0,
      hasPreferredVideo: preferredVideoFiles.length > 0,
      hasAudioFiles: audioFiles.length > 0,
      hasAudioSource,
      hasHp2: !!hp2File,
      hasHp5: !!hp5File,
      timestamp: new Date().toISOString()
    });
    
    // Start processing tasks
    const processingTasks = [];
    
    if (needsAudioSeparation) {
      console.log('🎵 Starting audio separation...');
      processingTasks.push('audio_separation');
      triggerAudioSeparationViaProxy(folderName);
    }
    
    if (needsVideoConversion) {
      console.log('🎬 Starting video conversion...');
      processingTasks.push('video_conversion');
      triggerVideoConversionViaProxy(folderName);
    }
    
    if (processingTasks.length === 0) {
      return res.json({ 
        message: 'No processing needed',
        status: 'no_processing_needed',
        tasks: []
      });
    }
    
    res.json({
      message: 'Processing started',
      status: 'processing_started',
      tasks: processingTasks,
      folderName: decodeURIComponent(folderName)
    });
    
  } catch (error) {
    console.error('Error in manual processing:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// New endpoint to organize loose TXT files
router.post('/ultrastar/organize-loose-files', async (req, res) => {
  try {
    const { organizeLooseTxtFiles } = require('../utils/ultrastarSongs');
    
    console.log('📁 Manual organization of loose TXT files requested');
    
    const organizedCount = organizeLooseTxtFiles();
    
    res.json({
      message: 'Loose TXT files organization completed',
      organizedCount,
      status: 'success'
    });
    
  } catch (error) {
    console.error('Error organizing loose TXT files:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// New endpoint to check if video download is needed
router.get('/ultrastar/:folderName/needs-video', async (req, res) => {
  try {
    const { folderName } = req.params;
    const { ULTRASTAR_DIR } = require('../utils/ultrastarSongs');
    const fs = require('fs');
    const path = require('path');
    
    const folderPath = path.join(ULTRASTAR_DIR, decodeURIComponent(folderName));
    
    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ error: 'Ultrastar folder not found' });
    }
    
    const files = fs.readdirSync(folderPath);
    
    // Check for video files
    const videoFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.webm', '.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.xvid', '.mpeg', '.mpg'].includes(ext);
    });
    
    const needsVideo = videoFiles.length === 0;
    
    res.json({
      needsVideo,
      hasVideo: videoFiles.length > 0,
      videoCount: videoFiles.length
    });
    
  } catch (error) {
    console.error('Error checking video needs:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// New endpoint to download YouTube video via AI services
router.post('/ultrastar/:folderName/download-youtube', async (req, res) => {
  try {
    const { folderName } = req.params;
    const { youtubeUrl } = req.body;
    const pythonServerUrl = 'http://localhost:6000';
    const downloadUrl = `${pythonServerUrl}/download_youtube/ultrastar/${encodeURIComponent(folderName)}`;
    
    console.log('📥 Proxying YouTube download request:', {
      folderName,
      youtubeUrl,
      downloadUrl,
      timestamp: new Date().toISOString()
    });
    
    const https = require('http');
    const url = require('url');
    
    const parsedUrl = url.parse(downloadUrl);
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
          console.log('📥 AI service YouTube download response:', {
            statusCode: proxyRes.statusCode,
            responseData,
            timestamp: new Date().toISOString()
          });
          
          res.status(proxyRes.statusCode).json(responseData);
        } catch (error) {
          console.error('📥 Error parsing AI service YouTube download response:', error);
          res.status(500).json({ error: 'Invalid response from AI service' });
        }
      });
    });
    
    proxyReq.on('error', (error) => {
      console.error('📥 Error proxying to AI service for YouTube download:', error);
      res.status(500).json({ error: 'AI service unavailable' });
    });
    
    // Send the YouTube URL in the request body
    proxyReq.write(JSON.stringify({ youtubeUrl }));
    proxyReq.setTimeout(120000); // 2 minutes timeout for downloads
    proxyReq.end();
    
  } catch (error) {
    console.error('Error proxying YouTube download:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper function to get saved audio preference from database
async function getSavedAudioPreference(artist, title) {
  const db = require('../config/database');
  try {
    const setting = await new Promise((resolve, reject) => {
      db.get(
        'SELECT audio_preference FROM ultrastar_audio_settings WHERE artist = ? AND title = ?',
        [artist, title],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    return setting ? setting.audio_preference : null;
  } catch (error) {
    console.error('Error getting saved audio preference:', error);
    return null;
  }
}

// Helper function to find audio file with HP2/HP5 preference
function findAudioFileWithPreference(folderPath, preferBackgroundVocals = false) {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const files = fs.readdirSync(folderPath);
    
    // Look for HP2/HP5 files first
    const hp5File = files.find(file => file.toLowerCase().includes('.hp5.mp3'));
    const hp2File = files.find(file => file.toLowerCase().includes('.hp2.mp3'));
    
    if (preferBackgroundVocals && hp5File) {
      // User wants background vocals (HP5)
      return path.join(folderPath, hp5File);
    } else if (!preferBackgroundVocals && hp2File) {
      // User wants no background vocals (HP2)
      return path.join(folderPath, hp2File);
    } else if (hp5File) {
      // Fallback to HP5 if HP2 not available
      return path.join(folderPath, hp5File);
    } else if (hp2File) {
      // Fallback to HP2 if HP5 not available
      return path.join(folderPath, hp2File);
    }
    
    // If no HP2/HP5 files, fall back to original audio file
    const { findAudioFile } = require('../utils/ultrastarParser');
    const originalFile = findAudioFile(folderPath);
    return originalFile;
  } catch (error) {
    console.error('Error finding audio file with preference:', error);
    return null;
  }
}

// Get ultrastar song data (parsed .txt file) - MUST be before /:filename route
router.get('/ultrastar/:folderName/data', async (req, res) => {
  try {
    const { folderName } = req.params;
    const { withBackgroundVocals } = req.query; // Optional query parameter
    const { ULTRASTAR_DIR } = require('../utils/ultrastarSongs');
    const { parseUltrastarFile, findAudioFile } = require('../utils/ultrastarParser');
    
    // Check if this is a magic song by looking at the URL path
    let isMagicSong = false;
    let magicDir = null;
    let magicFolderPath = null;
    
    // Check magic-songs
    const { MAGIC_SONGS_DIR } = require('../utils/magicSongs');
    const magicSongsPath = path.join(MAGIC_SONGS_DIR, decodeURIComponent(folderName));
    if (fs.existsSync(magicSongsPath)) {
      isMagicSong = true;
      magicDir = MAGIC_SONGS_DIR;
      magicFolderPath = magicSongsPath;
    }
    
    // Check magic-videos
    if (!isMagicSong) {
      const { MAGIC_VIDEOS_DIR } = require('../utils/magicVideos');
      const magicVideosPath = path.join(MAGIC_VIDEOS_DIR, decodeURIComponent(folderName));
      if (fs.existsSync(magicVideosPath)) {
        isMagicSong = true;
        magicDir = MAGIC_VIDEOS_DIR;
        magicFolderPath = magicVideosPath;
      }
    }
    
    // Check magic-youtube
    if (!isMagicSong) {
      const { MAGIC_YOUTUBE_DIR } = require('../utils/magicYouTube');
      const magicYouTubePath = path.join(MAGIC_YOUTUBE_DIR, decodeURIComponent(folderName));
      if (fs.existsSync(magicYouTubePath)) {
        isMagicSong = true;
        magicDir = MAGIC_YOUTUBE_DIR;
        magicFolderPath = magicYouTubePath;
      }
    }
    
    /**
     * Triggers video conversion for an ultrastar song
     * @param {string} folderName - Name of the ultrastar folder
     * @param {string} folderPath - Full path to the ultrastar folder
     * @param {string} videoFile - Video filename
     */
    function triggerVideoConversion(folderName, folderPath, videoFile) {
      try {
        const videoExt = path.extname(videoFile).toLowerCase();
        
        // Check if video needs conversion (not .mp4 or .webm)
        if (videoExt !== '.mp4' && videoExt !== '.webm') {
          console.log('🎬 Triggering video conversion on song request:', {
            folderName,
            videoFile,
            timestamp: new Date().toISOString()
          });
          
          // Use internal proxy endpoint instead of direct call
          triggerVideoConversionViaProxy(folderName);
        } else {
          console.log('🎬 Video already in preferred format, no conversion needed:', {
            folderName,
            videoFile,
            extension: videoExt,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('🎬 Error triggering video conversion:', {
          error: error.message,
          folderName,
          videoFile,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    /**
     * Findet Video-Datei mit Priorität: .webm > .mp4 > andere
     * @param {string} folderPath - Pfad zum Ultrastar-Ordner
     * @param {string} specifiedVideo - In .txt angegebener Video-Dateiname (wird ignoriert)
     * @returns {string|null} Dateiname der besten Video-Datei oder null
     */
    function findBackgroundImageFile(folderPath) {
  try {
    const files = fs.readdirSync(folderPath);
    
    // Priority order: .jpg, .jpeg, .png, .webp
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    
    for (const ext of imageExtensions) {
      const imageFile = files.find(file => 
        file.toLowerCase().endsWith(ext) && 
        !file.toLowerCase().includes('cover') && // Exclude cover images
        !file.toLowerCase().includes('thumbnail') // Exclude thumbnails
      );
      
      if (imageFile) {
        console.log('🖼️ Found background image:', {
          folderPath,
          imageFile,
          extension: ext
        });
        return path.join(folderPath, imageFile);
      }
    }
    
    console.log('🖼️ No background image found in:', folderPath);
    return null;
  } catch (error) {
    console.error('Error finding background image:', error);
    return null;
  }
}

function findVideoFile(folderPath, specifiedVideo) {
      try {
        if (!fs.existsSync(folderPath)) {
          return null;
        }

        const files = fs.readdirSync(folderPath);
        const videoExtensions = ['.webm', '.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.xvid', '.mpeg', '.mpg'];
        
        // Sammle alle Video-Dateien
        const videoFiles = files.filter(file => {
          const ext = path.extname(file).toLowerCase();
          return videoExtensions.includes(ext);
        });

        if (videoFiles.length === 0) {
          return null;
        }

        // Neue Priorität: .webm > .mp4 > andere
        const webmFiles = videoFiles.filter(file => file.toLowerCase().endsWith('.webm'));
        const mp4Files = videoFiles.filter(file => file.toLowerCase().endsWith('.mp4'));
        const otherFiles = videoFiles.filter(file => 
          !file.toLowerCase().endsWith('.webm') && !file.toLowerCase().endsWith('.mp4')
        );

        // Prioritätslogik - ignoriere spezifizierte Datei aus .txt
        if (webmFiles.length > 0) {
          return webmFiles[0]; // Erste .webm Datei
        } else if (mp4Files.length > 0) {
          return mp4Files[0]; // Erste .mp4 Datei
        } else if (otherFiles.length > 0) {
          return otherFiles[0]; // Erste andere Video-Datei
        }

        return null;
      } catch (error) {
        console.error('Error finding video file:', error);
        return null;
      }
    }
    
    // Use magic folder path if it's a magic song, otherwise use ultrastar path
    const folderPath = isMagicSong ? magicFolderPath : path.join(ULTRASTAR_DIR, decodeURIComponent(folderName));
    
    console.log('🔍 Ultrastar data request:', {
      folderName: folderName,
      decodedFolderName: decodeURIComponent(folderName),
      folderPath: folderPath,
      isMagicSong: isMagicSong,
      exists: fs.existsSync(folderPath)
    });
    
    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ message: 'Ultrastar folder not found', folderPath });
    }
    
    // Find .txt file
    const files = fs.readdirSync(folderPath);
    const txtFile = files.find(file => file.toLowerCase().endsWith('.txt'));
    
    if (!txtFile) {
      return res.status(404).json({ message: 'Ultrastar .txt file not found' });
    }
    
    const txtPath = path.join(folderPath, txtFile);
    const songData = parseUltrastarFile(txtPath);
    
    if (!songData) {
      return res.status(500).json({ message: 'Error parsing Ultrastar file' });
    }
    
    // For duets, structure lines and notes as [P1_data, P2_data]
    if (songData.isDuet && songData.singers && songData.singers.length >= 2) {
      // Get lines and notes from both singers
      const singer1Lines = songData.singers[0].lines || [];
      const singer2Lines = songData.singers[1].lines || [];
      const singer1Notes = songData.singers[0].notes || [];
      const singer2Notes = songData.singers[1].notes || [];
      
      // Structure as [P1_data, P2_data]
      songData.lines = [singer1Lines, singer2Lines];
      songData.notes = [singer1Notes, singer2Notes];
      
      console.log(`🎤 Duet-Song erkannt: "${songData.title}" - Sänger 1: ${singer1Lines.length} Zeilen, ${singer1Notes.length} Noten, Sänger 2: ${singer2Lines.length} Zeilen, ${singer2Notes.length} Noten`);
    }
    
    // Remove legacy properties and singers array
    delete songData.singer1Notes;
    delete songData.singer1Lines;
    delete songData.singer2Notes;
    delete songData.singer2Lines;
    delete songData.singers;
    
    // Find audio file with HP2/HP5 preference
    // First check if there's a saved preference in the database
    const savedPreference = await getSavedAudioPreference(songData.artist, songData.title);
    
    let preferBackgroundVocals = false;
    
    if (savedPreference === 'hp5') {
      // Saved preference: use HP5 (with background vocals)
      preferBackgroundVocals = true;
    } else if (savedPreference === 'hp2') {
      // Saved preference: use HP2 (without background vocals)
      preferBackgroundVocals = false;
    } else {
      // No saved preference or "choice" - use user's selection from query parameter
      preferBackgroundVocals = withBackgroundVocals === 'true';
    }
    
    const audioFile = findAudioFileWithPreference(folderPath, preferBackgroundVocals);
    if (audioFile) {
      const audioFilename = path.basename(audioFile);
      if (isMagicSong) {
        // For magic songs, use the appropriate magic endpoint
        if (magicDir === require('../utils/magicSongs').MAGIC_SONGS_DIR) {
          songData.audioUrl = `/api/magic-songs/${encodeURIComponent(folderName)}/${encodeURIComponent(audioFilename)}`;
        } else if (magicDir === require('../utils/magicVideos').MAGIC_VIDEOS_DIR) {
          songData.audioUrl = `/api/magic-videos/${encodeURIComponent(folderName)}/${encodeURIComponent(audioFilename)}`;
        } else if (magicDir === require('../utils/magicYouTube').MAGIC_YOUTUBE_DIR) {
          songData.audioUrl = `/api/magic-youtube/${encodeURIComponent(folderName)}/${encodeURIComponent(audioFilename)}`;
        }
      } else {
        songData.audioUrl = `/api/songs/ultrastar/${encodeURIComponent(folderName)}/${encodeURIComponent(audioFilename)}`;
      }
    }
    
    // Find video file with priority: .webm > .mp4 > others
    const videoFile = findVideoFile(folderPath, songData.video);
    if (videoFile) {
      const videoExt = path.extname(videoFile).toLowerCase();
      
      // Always set videoUrl - use the best available video file
      if (isMagicSong) {
        // For magic songs, use the appropriate magic endpoint
        if (magicDir === require('../utils/magicSongs').MAGIC_SONGS_DIR) {
          songData.videoUrl = `/api/magic-songs/${encodeURIComponent(folderName)}/${encodeURIComponent(videoFile)}`;
        } else if (magicDir === require('../utils/magicVideos').MAGIC_VIDEOS_DIR) {
          songData.videoUrl = `/api/magic-videos/${encodeURIComponent(folderName)}/${encodeURIComponent(videoFile)}`;
        } else if (magicDir === require('../utils/magicYouTube').MAGIC_YOUTUBE_DIR) {
          songData.videoUrl = `/api/magic-youtube/${encodeURIComponent(folderName)}/${encodeURIComponent(videoFile)}`;
        }
      } else {
        songData.videoUrl = `/api/songs/ultrastar/${encodeURIComponent(folderName)}/${encodeURIComponent(videoFile)}`;
      }
      songData.videoFile = videoFile;
      
      // Note: Video conversion is handled in the song request route, not here
      console.log('🎬 Video file found:', {
        folderName,
        videoFile,
        extension: videoExt,
        isMagicSong,
        timestamp: new Date().toISOString()
      });
    }
    
    
    // Find background image file
    const backgroundImageFile = findBackgroundImageFile(folderPath);
    if (backgroundImageFile) {
      const imageFilename = path.basename(backgroundImageFile);
      if (isMagicSong) {
        // For magic songs, use the appropriate magic endpoint
        if (magicDir === require('../utils/magicSongs').MAGIC_SONGS_DIR) {
          songData.backgroundImageUrl = `/api/magic-songs/${encodeURIComponent(folderName)}/${encodeURIComponent(imageFilename)}`;
        } else if (magicDir === require('../utils/magicVideos').MAGIC_VIDEOS_DIR) {
          songData.backgroundImageUrl = `/api/magic-videos/${encodeURIComponent(folderName)}/${encodeURIComponent(imageFilename)}`;
        } else if (magicDir === require('../utils/magicYouTube').MAGIC_YOUTUBE_DIR) {
          songData.backgroundImageUrl = `/api/magic-youtube/${encodeURIComponent(folderName)}/${encodeURIComponent(imageFilename)}`;
        }
      } else {
        songData.backgroundImageUrl = `/api/songs/ultrastar/${encodeURIComponent(folderName)}/${encodeURIComponent(imageFilename)}`;
      }
      
      console.log('🖼️ Background image URL added:', {
        folderName,
        imageFilename,
        backgroundImageUrl: songData.backgroundImageUrl,
        isMagicSong
      });
    }
    
    // Add magic flag to song data
    songData.magic = isMagicSong;
    
    res.json({ songData });
  } catch (error) {
    console.error('Error getting ultrastar song data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Serve ultrastar song files (audio, video, cover, txt)
router.get('/ultrastar/:folderName/:filename', (req, res) => {
  try {
    const { folderName, filename } = req.params;
    const { ULTRASTAR_DIR } = require('../utils/ultrastarSongs');
    
    // Check if this is a magic song by looking at the URL path
    let isMagicSong = false;
    let magicDir = null;
    let folderPath = null;
    
    // Check magic-songs
    const { MAGIC_SONGS_DIR } = require('../utils/magicSongs');
    const magicSongsPath = path.join(MAGIC_SONGS_DIR, decodeURIComponent(folderName));
    if (fs.existsSync(magicSongsPath)) {
      isMagicSong = true;
      magicDir = MAGIC_SONGS_DIR;
      folderPath = magicSongsPath;
    }
    
    // Check magic-videos
    if (!isMagicSong) {
      const { MAGIC_VIDEOS_DIR } = require('../utils/magicVideos');
      const magicVideosPath = path.join(MAGIC_VIDEOS_DIR, decodeURIComponent(folderName));
      if (fs.existsSync(magicVideosPath)) {
        isMagicSong = true;
        magicDir = MAGIC_VIDEOS_DIR;
        folderPath = magicVideosPath;
      }
    }
    
    // Check magic-youtube
    if (!isMagicSong) {
      const { MAGIC_YOUTUBE_DIR } = require('../utils/magicYouTube');
      const magicYouTubePath = path.join(MAGIC_YOUTUBE_DIR, decodeURIComponent(folderName));
      if (fs.existsSync(magicYouTubePath)) {
        isMagicSong = true;
        magicDir = MAGIC_YOUTUBE_DIR;
        folderPath = magicYouTubePath;
      }
    }
    
    // Use magic folder path if it's a magic song, otherwise use ultrastar path
    if (!isMagicSong) {
      folderPath = path.join(ULTRASTAR_DIR, decodeURIComponent(folderName));
    }
    
    const filePath = path.join(folderPath, decodeURIComponent(filename));
    
    // Security check - ensure file is within the appropriate directory
    if (isMagicSong) {
      if (!filePath.startsWith(magicDir)) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else {
      if (!filePath.startsWith(ULTRASTAR_DIR)) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    // Set appropriate content type
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (ext) {
      case '.mp3':
        contentType = 'audio/mpeg';
        break;
      case '.flac':
        contentType = 'audio/flac';
        break;
      case '.wav':
        contentType = 'audio/wav';
        break;
      case '.ogg':
        contentType = 'audio/ogg';
        break;
      case '.m4a':
        contentType = 'audio/mp4';
        break;
      case '.aac':
        contentType = 'audio/aac';
        break;
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.webp':
        contentType = 'image/webp';
        break;
      case '.txt':
        contentType = 'text/plain';
        break;
      case '.avi':
      case '.mp4':
      case '.mkv':
        contentType = 'video/mp4';
        break;
    }
    
    res.setHeader('Content-Type', contentType);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving ultrastar file:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// Public route to toggle QR overlay (for automatic overlay when videos end)
router.put('/qr-overlay', [
  body('show').isBoolean().withMessage('Show muss ein Boolean sein')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { show } = req.body;
    const db = require('../config/database');

    // Store overlay status in settings
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['show_qr_overlay', show.toString()],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Broadcast QR code toggle via WebSocket
    const io = req.app.get('io');
    if (io) {
      console.log('📱 Songs route: Broadcasting QR overlay toggle:', show);
      await broadcastQRCodeToggle(io, show);
      await broadcastAdminUpdate(io);
    }

    res.json({ message: 'QR Overlay Status erfolgreich aktualisiert', show });
  } catch (error) {
    console.error('Error updating QR overlay status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Public endpoint to get invisible songs (for filtering in /new)
router.get('/invisible-songs', async (req, res) => {
  try {
    const db = require('../config/database');
    const invisibleSongs = await new Promise((resolve, reject) => {
      db.all('SELECT artist, title FROM invisible_songs', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({ invisibleSongs });
  } catch (error) {
    console.error('Error getting invisible songs:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Public endpoint to get ultrastar audio settings (for filtering in /new)
router.get('/ultrastar-audio-settings', async (req, res) => {
  try {
    const db = require('../config/database');
    const audioSettings = await new Promise((resolve, reject) => {
      db.all('SELECT artist, title, audio_preference FROM ultrastar_audio_settings', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({ ultrastarAudioSettings: audioSettings });
  } catch (error) {
    console.error('Error getting ultrastar audio settings:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
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
    const db = require('../config/database');
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

// Helper function to trigger automatic USDB download
async function triggerAutomaticUSDBDownload(songId, usdbUrl) {
  try {
    console.log('📥 Triggering automatic USDB download:', {
      songId,
      usdbUrl,
      timestamp: new Date().toISOString()
    });

    // Get USDB credentials
    const db = require('../config/database');
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
        const Song = require('../models/Song');
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
        const Song = require('../models/Song');
        await Song.updateStatus(songId, 'failed');
        console.log('❌ Song status set to failed (invalid URL):', { songId });
      } catch (statusError) {
        console.error('❌ Failed to set song status to failed:', statusError);
      }
      return;
    }

    const usdbSongId = songIdMatch[1];

    // Set download start time
    try {
      const Song = require('../models/Song');
      await Song.updateDownloadStartTime(songId, new Date().toISOString());
      console.log('🕐 Download start time set for song:', { songId });
    } catch (timeError) {
      console.error('❌ Failed to set download start time:', timeError);
    }

    // Trigger download via AI service
    const axios = require('axios');
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:6000';
    
    try {
      console.log('📥 Making USDB download request to AI service:', {
        url: `${aiServiceUrl}/usdb/download`,
        usdbSongId,
        timestamp: new Date().toISOString()
      });

      const downloadResponse = await axios.post(`${aiServiceUrl}/usdb/download`, {
        songId: usdbSongId,
        username: credentials.username,
        password: credentials.password
      }, {
        timeout: 300000 // 5 minutes timeout for download
      });

      console.log('📥 USDB download response received:', {
        status: downloadResponse.status,
        success: downloadResponse.data.success,
        folderName: downloadResponse.data.folder_name,
        songInfo: downloadResponse.data.song_info,
        timestamp: new Date().toISOString()
      });

      if (downloadResponse.data.success) {
        console.log('✅ USDB download completed:', {
          songId,
          usdbSongId,
          folderName: downloadResponse.data.folder_name,
          artist: downloadResponse.data.song_info?.artist,
          title: downloadResponse.data.song_info?.title,
          timestamp: new Date().toISOString()
        });

        // Extract data for use in both database insertion and WebSocket notification
        const songData = downloadResponse.data.song_info;
        const folderName = downloadResponse.data.folder_name;
        
        try {
          // Add song to database (same as manual download)
          console.log('💾 Adding downloaded song to database...');
          const Song = require('../models/Song');
          
          // Create a default user for automatic downloads
          const User = require('../models/User');
          const defaultUser = await User.create('System', 'SYS');
          
          await Song.createFromUSDB(
            songData.artist || 'Unknown', 
            songData.title || 'Unknown', 
            folderName, 
            'USDB',
            defaultUser.id
          );
          console.log('💾 Song added to database successfully');
        } catch (dbError) {
          console.error('❌ Database insertion error:', dbError);
          // Continue with WebSocket notification even if database insertion fails
        }

        // Broadcast USDB download notification to admin dashboard
        console.log('📡 Broadcasting USDB download notification to admin dashboard...');
        const { broadcastUSDBDownloadNotification } = require('../utils/websocketService');
        
        // Get the io instance from the global server
        const server = require('../server');
        const io = server.io;
        if (io) {
          const notificationData = {
            message: `USDB-Song automatisch heruntergeladen: ${songData.artist || 'Unknown'} - ${songData.title || 'Unknown'}`,
            artist: songData.artist || 'Unknown',
            title: songData.title || 'Unknown',
            folderName: folderName,
            timestamp: new Date().toISOString()
          };
          
          console.log('📡 Notification data:', notificationData);
          await broadcastUSDBDownloadNotification(io, notificationData);
          console.log('📡 USDB download notification broadcasted successfully');
        } else {
          console.log('⚠️ No WebSocket IO instance available for notification');
        }

        // Set original song status to ready (download successful)
        try {
          const Song = require('../models/Song');
          await Song.updateStatus(songId, 'ready');
          console.log('✅ Original song status set to ready (download successful):', { songId });
        } catch (statusError) {
          console.error('❌ Failed to set original song status to ready:', statusError);
        }

        // Trigger playlist upgrade check after successful download
        setTimeout(() => {
          triggerPlaylistUpgradeCheck();
        }, 2000); // Wait 2 seconds for file system to settle

        // Trigger automatic song classification for all YouTube songs
        setTimeout(async () => {
          try {
            const adminModule = require('./admin');
            if (adminModule.triggerAutomaticSongClassification) {
              await adminModule.triggerAutomaticSongClassification();
            }
          } catch (error) {
            console.error('Error in automatic song classification:', error);
          }
        }, 3000); // Wait 3 seconds for file system to settle

      } else {
        console.error('❌ USDB download failed:', downloadResponse.data.error);
        // Set status to failed
        try {
          const Song = require('../models/Song');
          await Song.updateStatus(songId, 'failed');
          console.log('❌ Song status set to failed (download failed):', { songId });
        } catch (statusError) {
          console.error('❌ Failed to set song status to failed:', statusError);
        }
      }
    } catch (error) {
      console.error('❌ USDB download error:', error.message);
      // Set status to failed
      try {
        const Song = require('../models/Song');
        await Song.updateStatus(songId, 'failed');
        console.log('❌ Song status set to failed (download error):', { songId });
      } catch (statusError) {
        console.error('❌ Failed to set song status to failed:', statusError);
      }
    }

  } catch (error) {
    console.error('📥 Error in triggerAutomaticUSDBDownload:', error);
    // Set status to failed
    try {
      const Song = require('../models/Song');
      await Song.updateStatus(songId, 'failed');
      console.log('❌ Song status set to failed (function error):', { songId });
    } catch (statusError) {
      console.error('❌ Failed to set song status to failed:', statusError);
    }
  }
}

// Helper function to check for playlist upgrades after USDB download
async function triggerPlaylistUpgradeCheck() {
  try {
    console.log('🔄 Triggering playlist upgrade check:', {
      timestamp: new Date().toISOString()
    });

    const db = require('../config/database');
    
    // Get all YouTube songs from playlist
    const youtubeSongs = await new Promise((resolve, reject) => {
      db.all('SELECT id, artist, title FROM songs WHERE mode = ? ORDER BY id', ['youtube'], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Get all ultrastar songs from file system
    const { findUltrastarSong } = require('../utils/ultrastarSongs');
    
    let upgradeCount = 0;
    
    for (const youtubeSong of youtubeSongs) {
      try {
        const ultrastarSong = findUltrastarSong(youtubeSong.artist, youtubeSong.title);
        if (ultrastarSong) {
          console.log('🎯 Found upgrade opportunity:', {
            songId: youtubeSong.id,
            artist: youtubeSong.artist,
            title: youtubeSong.title,
            ultrastarFolder: ultrastarSong.folderName
          });

          // Update song mode to ultrastar
          await new Promise((resolve, reject) => {
            db.run(
              'UPDATE songs SET mode = ?, youtube_url = ? WHERE id = ?',
              ['ultrastar', `/api/ultrastar/${encodeURIComponent(ultrastarSong.folderName)}`, youtubeSong.id],
              function(err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });

          // Add to invisible songs list (same as YouTube cache downloads)
          try {
            await new Promise((resolve, reject) => {
              db.run(
                'INSERT OR IGNORE INTO invisible_songs (artist, title) VALUES (?, ?)',
                [youtubeSong.artist, youtubeSong.title],
                function(err) {
                  if (err) reject(err);
                  else resolve();
                }
              );
            });
            console.log(`📝 Added upgraded song to invisible songs: ${youtubeSong.artist} - ${youtubeSong.title}`);
          } catch (error) {
            console.error('Error adding upgraded song to invisible songs:', error);
          }

          upgradeCount++;
          console.log('✅ Upgraded song to ultrastar:', {
            songId: youtubeSong.id,
            artist: youtubeSong.artist,
            title: youtubeSong.title
          });
        }
      } catch (error) {
        console.error('❌ Error checking upgrade for song:', youtubeSong.id, error.message);
      }
    }

    if (upgradeCount > 0) {
      console.log(`🎉 Playlist upgrade completed: ${upgradeCount} songs upgraded to ultrastar`);
      
      // Broadcast update to admin dashboard
      const { broadcastPlaylistUpgrade } = require('../utils/websocketService');
      const io = require('../server').io;
      if (io) {
        await broadcastPlaylistUpgrade(io, {
          message: `${upgradeCount} YouTube-Songs wurden zu Ultrastar-Songs hochgestuft`,
          upgradeCount,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      console.log('ℹ️ No playlist upgrades found');
    }

  } catch (error) {
    console.error('🔄 Error in triggerPlaylistUpgradeCheck:', error);
  }
}

// Helper function to check if a song requires approval
async function checkIfSongRequiresApproval(artist, title, mode, youtubeUrl) {
  const db = require('../config/database');
  
  console.log(`🔍 Checking if song requires approval: ${artist} - ${title} (mode: ${mode})`);
  
  // Check if song is in invisible list
  const invisibleSong = await new Promise((resolve, reject) => {
    db.get('SELECT id FROM invisible_songs WHERE artist = ? AND title = ?', [artist, title], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
  
  if (invisibleSong) {
    console.log(`📝 Song is in invisible list: ${artist} - ${title}`);
    return true;
  }
  
  // Check if song is found in any local source (file, server_video, ultrastar)
  // If mode is 'youtube', it means the song was not found in local sources
  if (mode === 'youtube') {
    console.log(`📝 Song not found in local sources, requires approval: ${artist} - ${title}`);
    return true;
  }
  
  // Check if it's a YouTube URL but not in cache
  if (youtubeUrl && (youtubeUrl.includes('youtube.com') || youtubeUrl.includes('youtu.be'))) {
    const { findYouTubeSong } = require('../utils/youtubeSongs');
    const { cleanYouTubeUrl } = require('../utils/youtubeUrlCleaner');
    const cleanedUrl = cleanYouTubeUrl(youtubeUrl);
    const cachedSong = findYouTubeSong(artist, title, cleanedUrl);
    
    console.log(`🎥 YouTube song check: ${artist} - ${title}, cached: ${!!cachedSong}`);
    
    if (!cachedSong) {
      console.log(`📝 YouTube song not in cache, requires approval: ${artist} - ${title}`);
      return true;
    }
  }
  
  console.log(`✅ Song does not require approval: ${artist} - ${title}`);
  return false;
}

// Helper function to store song request for approval
async function storeSongRequestForApproval(userId, singerName, artist, title, youtubeUrl, songInput, deviceId, withBackgroundVocals) {
  const db = require('../config/database');
  
  await new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO song_approvals (user_id, singer_name, artist, title, youtube_url, song_input, device_id, with_background_vocals, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, singerName, artist, title, youtubeUrl, songInput, deviceId, withBackgroundVocals, new Date().toISOString()],
      function(err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
  
  console.log(`📝 Song request stored for approval: ${artist} - ${title} (${singerName})`);
}

module.exports = {
  router,
  triggerAutomaticUSDBSearch
};