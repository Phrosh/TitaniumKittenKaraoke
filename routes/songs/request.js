const express = require('express');
const { body, validationResult } = require('express-validator');
// const axios = require('axios');
const router = express.Router();
const PlaylistAlgorithm = require('../../utils/playlistAlgorithm');
const YouTubeMetadataService = require('../../utils/youtubeMetadata');
const { triggerVideoConversionViaProxy, triggerAudioSeparationViaProxy, cleanupTestSongs, triggerAutomaticUSDBSearch } = require('./utils/songHelpers');
const { cleanYouTubeUrl } = require('../../utils/youtubeUrlCleaner');
const User = require('../../models/User');
const Song = require('../../models/Song');
const { checkIfSongRequiresApproval, storeSongRequestForApproval } = require('./utils/songHelpers');
const { broadcastProcessingStatus, broadcastShowUpdate, broadcastAdminUpdate, broadcastPlaylistUpdate } = require('../../utils/websocketService');
const songCache = require('../../utils/songCache');
const { VIDEO_EXTENSIONS } = require('../../utils/fileExtensions');

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
    const { name, songInput, deviceId, youtubeMode, artist: manualArtist, title: manualTitle } = req.body;
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
      
      // If manual artist/title are provided, use them (higher priority than YouTube metadata)
      if (manualArtist && manualArtist.trim() && manualTitle && manualTitle.trim()) {
        console.log(`📝 Using manually provided artist/title: ${manualArtist} - ${manualTitle}`);
        artist = manualArtist.trim();
        title = manualTitle.trim();
      } else {
        // Only extract metadata if no manual values provided
        try {
          const metadata = await YouTubeMetadataService.getMetadata(youtubeUrl);
          title = metadata.title;
          artist = metadata.artist || 'Unknown Artist';
          console.log(`📥 Extracted YouTube metadata: ${artist} - ${title}`);
        } catch (error) {
          console.error('Failed to extract YouTube metadata:', error.message);
          // Fallback: use manual values if available, otherwise generic values
          if (manualArtist && manualArtist.trim()) {
            artist = manualArtist.trim();
          } else {
            artist = 'Unknown Artist';
          }
          if (manualTitle && manualTitle.trim()) {
            title = manualTitle.trim();
          } else {
            title = 'YouTube Song';
          }
        }
      }
      
      // Try to download YouTube video to songs/youtube folder (skip for magic mode)
      if (youtubeMode !== 'magic') {
        console.log(`📥 Will download YouTube video (async): ${artist} - ${title}`);
        downloadStatus = 'downloading';
        // Note: Download will be started after song creation (see line ~563)
      } else {
        console.log(`✨ Skipping normal YouTube download for magic mode: ${artist} - ${title}`);
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
        
        // For automatically detected ultrastar songs, set withBackgroundVocals based on database setting or available files
        if (withBackgroundVocals === undefined || withBackgroundVocals === null) {
          // First check database for saved audio preference
          try {
            const db = require('../../config/database');
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

            if (setting && setting.audio_preference) {
              if (setting.audio_preference === 'hp5') {
                // Background vocals preferred
                withBackgroundVocals = true;
                console.log(`📋 Using saved audio preference (database): hp5 for ${artist} - ${title}`);
              } else if (setting.audio_preference === 'hp2') {
                // Instrumental preferred
                withBackgroundVocals = false;
                console.log(`📋 Using saved audio preference (database): hp2 for ${artist} - ${title}`);
              }
              // If 'choice', continue to auto-detection based on available files
            }
          } catch (error) {
            console.error('Error getting audio preference from database:', error);
          }

          // If still not set (no database entry or 'choice' setting), detect based on available files
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
      }
      
      // Trigger video conversion for ultrastar song
      if (ultrastarSong) {
        try {
            const path = require('path');
            const fs = require('fs');
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
                return VIDEO_EXTENSIONS.includes(ext);
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
                  Song.updateDownloadStatus(song.id, 'failed').catch(console.error);
                  try {
                    const io = req.app.get('io');
                    if (io) {
                      broadcastProcessingStatus(io, { id: song.id, artist, title, status: 'failed' });
                    }
                  } catch {}
                }
              } catch (error) {
                console.error('✨ Error parsing Magic YouTube response from song request:', error);
                Song.updateDownloadStatus(song.id, 'failed').catch(console.error);
              }
            });
          });
          
          proxyReq.on('error', (error) => {
            console.error('✨ Error processing Magic YouTube from song request:', error);
            Song.updateDownloadStatus(song.id, 'failed').catch(console.error);
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
          await Song.updateDownloadStatus(song.id, 'failed');
          try {
            const io = req.app.get('io');
            if (io) {
              broadcastProcessingStatus(io, { id: song.id, artist, title, status: 'failed' });
            }
          } catch {}
        }
      } else {
        // Regular YouTube processing
        console.log(`📥 Setting download status to '${downloadStatus}' for song ID ${song.id}: ${artist} - ${title}`);
        await Song.updateDownloadStatus(song.id, downloadStatus);
        try {
          const io = req.app.get('io');
          if (io) {
            const { broadcastProcessingStatus } = require('../../utils/websocketService');
            broadcastProcessingStatus(io, { id: song.id, artist, title, status: downloadStatus });
            console.log(`📡 Broadcasted '${downloadStatus}' status for: ${artist} - ${title}`);
          }
        } catch {}
        
        // If download status is 'downloading', start the actual download
        if (downloadStatus === 'downloading' && youtubeUrl) {
          console.log(`🚀 Starting YouTube download for song ID ${song.id}: ${artist} - ${title}`);
          const { downloadYouTubeVideo } = require('../../utils/youtubeSongs');
          const io = req.app.get('io');
          
          // Start async download without awaiting to allow immediate response and UI closing
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
                    const { broadcastProcessingStatus } = require('../../utils/websocketService');
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
                    const { broadcastProcessingStatus } = require('../../utils/websocketService');
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
                  const { broadcastProcessingStatus } = require('../../utils/websocketService');
                  broadcastProcessingStatus(io2, { id: song.id, artist, title, status: 'failed' });
                }
              } catch {}
            });
        }
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

    // Rebuild cache after song creation
    try {
      await songCache.buildCache(true);
      console.log('🔄 Cache nach Song-Erstellung neu aufgebaut');
    } catch (cacheError) {
      console.warn('⚠️ Fehler beim Cache-Rebuild nach Song-Erstellung:', cacheError.message);
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

module.exports = router;
