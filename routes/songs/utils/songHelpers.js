// Helper functions for song processing
// These functions are shared across multiple song route modules

// Helper function to clean up test songs when switching songs
async function cleanupTestSongs() {
  const db = require('../../../config/database');
  const Song = require('../../../models/Song');
  
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
    const db = require('../../../config/database');
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
    console.log('📥 Triggering automatic USDB download (modular):', {
      songId,
      usdbUrl,
      timestamp: new Date().toISOString()
    });

    // Get USDB credentials
    const db = require('../../../config/database');
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
        const Song = require('../../../models/Song');
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
        const Song = require('../../../models/Song');
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
      const Song = require('../../../models/Song');
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
            const Song = require('../../../models/Song');
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
            const Song = require('../../../models/Song');
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
          const Song = require('../../../models/Song');
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
        const Song = require('../../../models/Song');
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

// Helper function to trigger automatic song classification for all YouTube songs
async function triggerAutomaticSongClassification() {
  try {
    console.log('🔄 Triggering automatic song classification for all YouTube songs...');
    
    const db = require('../../../config/database');
    
    // Get all YouTube and youtube_cache songs from playlist
    const youtubeSongs = await new Promise((resolve, reject) => {
      db.all('SELECT id, artist, title, mode FROM songs WHERE mode IN (?, ?) ORDER BY id', ['youtube', 'youtube_cache'], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    if (youtubeSongs.length === 0) {
      console.log('ℹ️ No YouTube songs found for classification');
      return;
    }

    console.log(`🔍 Checking ${youtubeSongs.length} YouTube songs for classification updates...`);

    let classificationCount = 0;
    
    for (const song of youtubeSongs) {
      try {
        const { artist, title } = song;
        
        // Check file songs (highest priority)
        const fileFolderSetting = await new Promise((resolve, reject) => {
          db.get('SELECT value FROM settings WHERE key = ?', ['file_songs_folder'], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
        
        let updated = false;
        let newMode = song.mode;
        let newYoutubeUrl = null;
        
        if (fileFolderSetting && fileFolderSetting.value) {
          const { findFileSong } = require('../../../utils/fileSongs');
          const fileSong = findFileSong(fileFolderSetting.value, artist, title);
          if (fileSong) {
            newMode = 'file';
            newYoutubeUrl = fileSong.filename;
            updated = true;
            console.log(`🔄 Song classification updated: ${artist} - ${title} -> file (${fileSong.filename})`);
          }
        }
        
        // Check server videos if not updated yet
        if (!updated) {
          const { findLocalVideo } = require('../../../utils/localVideos');
          const localVideo = findLocalVideo(artist, title);
          if (localVideo) {
            newMode = 'server_video';
            newYoutubeUrl = `/api/videos/${encodeURIComponent(localVideo.filename)}`;
            updated = true;
            console.log(`🔄 Song classification updated: ${artist} - ${title} -> server_video (${localVideo.filename}) -> URL: ${newYoutubeUrl}`);
          }
        }
        
        // Fix existing server_video URLs that might be missing file extension
        if (!updated && song.mode === 'server_video' && song.youtube_url && !song.youtube_url.includes('.')) {
          const { findLocalVideo } = require('../../../utils/localVideos');
          const localVideo = findLocalVideo(artist, title);
          if (localVideo) {
            newYoutubeUrl = `/api/videos/${encodeURIComponent(localVideo.filename)}`;
            updated = true;
            console.log(`🔧 Fixed server video URL: ${artist} - ${title} -> ${newYoutubeUrl}`);
          }
        }
        
        // Check ultrastar songs if not updated yet
        if (!updated) {
          const { findUltrastarSong } = require('../../../utils/ultrastarSongs');
          const ultrastarSong = findUltrastarSong(artist, title);
          if (ultrastarSong) {
            newMode = 'ultrastar';
            newYoutubeUrl = `/api/ultrastar/${encodeURIComponent(ultrastarSong.folderName)}`;
            updated = true;
            console.log(`🔄 Song classification updated: ${artist} - ${title} -> ultrastar (${ultrastarSong.folderName})`);
          }
        }
        
        // Update song in database if classification changed
        if (updated) {
          await new Promise((resolve, reject) => {
            db.run(
              'UPDATE songs SET youtube_url = ?, mode = ? WHERE id = ?',
              [newYoutubeUrl, newMode, song.id],
              function(err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });
          
          classificationCount++;
          console.log(`✅ Song classification updated successfully: ${artist} - ${title} -> ${newMode}`);
        }
        
      } catch (error) {
        console.error(`❌ Error checking classification for song ${song.id}:`, error.message);
      }
    }

    if (classificationCount > 0) {
      console.log(`🎉 Automatic song classification completed: ${classificationCount} songs updated`);
      
      // Broadcast playlist update to admin dashboard
      const { broadcastAdminUpdate } = require('../../../utils/websocketService');
      const io = require('../../../server').io;
      if (io) {
        await broadcastAdminUpdate(io);
      }
    } else {
      console.log('ℹ️ No song classifications needed updates');
    }

  } catch (error) {
    console.error('🔄 Error in triggerAutomaticSongClassification:', error);
  }
}

// Helper function to check if a song requires approval
async function checkIfSongRequiresApproval(artist, title, mode, youtubeUrl) {
  try {
    const db = require('../config/database');
    
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
  const db = require('../../../config/database');
  
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
  cleanupTestSongs,
  triggerVideoConversionViaProxy,
  triggerAudioSeparationViaProxy,
  triggerAutomaticUSDBSearch,
  triggerAutomaticUSDBDownload,
  triggerAutomaticSongClassification,
  checkIfSongRequiresApproval,
  storeSongRequestForApproval
};
