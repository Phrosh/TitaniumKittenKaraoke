const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Song = require('../../models/Song');
const db = require('../../config/database');
const { scanYouTubeSongs, downloadYouTubeVideo, findYouTubeSong } = require('../../utils/youtubeSongs');
const { broadcastProcessingStatus, broadcastSongChange, broadcastAdminUpdate, broadcastPlaylistUpdate } = require('../../utils/websocketService');
const { cleanYouTubeUrl } = require('../../utils/youtubeUrlCleaner');
const { triggerAutomaticUSDBSearch } = require('../songs/utils/songHelpers');
const songCache = require('../../utils/songCache');

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
  body('youtubeUrl').optional().custom((value) => {
    // Allow empty string, null, undefined
    if (!value || value.trim() === '') {
      return true;
    }
    // Allow API routes (starting with /api/)
    if (value.startsWith('/api/')) {
      return true;
    }
    // Otherwise, must be a valid URL
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }).withMessage('youtubeUrl must be a valid URL, an API route, or empty')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { songId } = req.params;
    const { title, artist, youtubeUrl, withBackgroundVocals, singerName } = req.body;

    const song = await Song.getById(songId);
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    // Clean the YouTube URL before saving
    const cleanedUrl = cleanYouTubeUrl(youtubeUrl);
    
    // Determine with_background_vocals value (use existing value if not provided)
    const withBackgroundVocalsValue = withBackgroundVocals !== undefined 
      ? (withBackgroundVocals ? 1 : 0) 
      : (song.with_background_vocals ? 1 : 0);
    
    // Update song details
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE songs SET title = ?, artist = ?, youtube_url = ?, with_background_vocals = ? WHERE id = ?',
        [title, artist || null, cleanedUrl || null, withBackgroundVocalsValue, songId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Update user name (singerName) if provided
    if (singerName !== undefined && singerName !== null && song.user_id) {
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE users SET name = ? WHERE id = ?',
          [singerName.trim(), song.user_id],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

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
          const io = req.app.get('io');
          if (io) {
            try { broadcastProcessingStatus(io, { id: Number(songId), artist, title, status: 'finished' }); } catch {}
          }
        } else {
          // Fire-and-forget download; respond immediately
          const io = req.app.get('io');
          (async () => {
            try {
              const downloadResult = await downloadYouTubeVideo(youtubeUrl, artist, title, songId);
              if (downloadResult.success) {
                console.log(`✅ YouTube video downloaded successfully: ${downloadResult.folderName}`);
                // Don't set status to 'ready' here - wait for processing to complete
                // Status will be updated by processing-status endpoint after normalization/cleanup
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
      // Import the function from songHelpers
      triggerAutomaticUSDBSearch(songId, artist, title);
    }

    // Rebuild cache after song update
    try {
      await songCache.buildCache(true);
      console.log('🔄 Cache nach Song-Update neu aufgebaut');
    } catch (cacheError) {
      console.warn('⚠️ Fehler beim Cache-Rebuild nach Song-Update:', cacheError.message);
    }

    res.json({ message: 'Song updated successfully' });
  } catch (error) {
    console.error('Update song error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get pending song approvals
router.get('/song-approvals', async (req, res) => {
  try {
    const approvals = await new Promise((resolve, reject) => {
      db.all(`
        SELECT sa.*, u.name as user_name, u.device_id 
        FROM song_approvals sa 
        JOIN users u ON sa.user_id = u.id 
        WHERE sa.status = 'pending' 
        ORDER BY sa.created_at ASC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({ approvals });
  } catch (error) {
    console.error('Error getting song approvals:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Approve a song request
router.post('/song-approvals/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { singerName, artist, title, youtubeUrl, withBackgroundVocals } = req.body;

    // Get the approval request
    const approval = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM song_approvals WHERE id = ? AND status = ?', [id, 'pending'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!approval) {
      return res.status(404).json({ message: 'Approval request not found' });
    }

    // Create the song
    const song = await Song.create(
      approval.user_id, 
      title || approval.title, 
      artist || approval.artist, 
      youtubeUrl || approval.youtube_url, 
      1, 
      null, 
      'youtube', 
      withBackgroundVocals || approval.with_background_vocals
    );

    // Update approval status
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE song_approvals SET status = ?, approved_at = ? WHERE id = ?',
        ['approved', new Date().toISOString(), id],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ message: 'Song erfolgreich genehmigt und zur Playlist hinzugefügt', song });
  } catch (error) {
    console.error('Error approving song:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Reject a song request
router.post('/song-approvals/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;

    // Update approval status
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE song_approvals SET status = ?, rejected_at = ? WHERE id = ?',
        ['rejected', new Date().toISOString(), id],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ message: 'Song erfolgreich abgelehnt' });
  } catch (error) {
    console.error('Error rejecting song:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Clear all songs (admin only)
router.delete('/clear-all', async (req, res) => {
  try {
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM songs', function(err) {
        if (err) reject(err);
        else resolve();
      });
    });

    // Reset current song
    await Song.setCurrentSong(0);

    // Broadcast song change via WebSocket (no current song)
    const io = req.app.get('io');
    if (io) {
      await broadcastSongChange(io, null);
      await broadcastAdminUpdate(io);
      await broadcastPlaylistUpdate(io);
    }

    // Rebuild cache after clearing all songs
    try {
      await songCache.buildCache(true);
      console.log('🔄 Cache nach Löschen aller Songs neu aufgebaut');
    } catch (cacheError) {
      console.warn('⚠️ Fehler beim Cache-Rebuild nach Löschen aller Songs:', cacheError.message);
    }

    res.json({ message: 'All songs cleared successfully' });
  } catch (error) {
    console.error('Clear all songs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Refresh song classification - check if song is now available locally
router.put('/song/:songId/refresh-classification', async (req, res) => {
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

// General Song Rename (for all song types)
router.post('/song/rename', [
  body('oldArtist').notEmpty().trim(),
  body('oldTitle').notEmpty().trim(),
  body('newArtist').notEmpty().trim(),
  body('newTitle').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validierungsfehler', 
        errors: errors.array() 
      });
    }

    const { oldArtist, oldTitle, newArtist, newTitle } = req.body;
    const fs = require('fs');
    const path = require('path');

    // Import song scanning functions
    const { scanUltrastarSongs, findUltrastarSong } = require('../../utils/ultrastarSongs');
    const { scanYouTubeSongs } = require('../../utils/youtubeSongs');
    const { scanLocalVideos } = require('../../utils/localVideos');
    const { scanFileSongs } = require('../../utils/fileSongs');
    const { scanMagicVideos } = require('../../utils/magicVideos');
    const { scanMagicSongs } = require('../../utils/magicSongs');
    const { scanMagicYouTube } = require('../../utils/magicYouTube');

    // Find the song in all possible locations
    let songType = null;
    let songData = null;
    let oldPath = null;
    let newPath = null;

    // Check Ultrastar songs (folder-based)
    const ultrastarSongs = scanUltrastarSongs();
    const ultrastarSong = ultrastarSongs.find(song => 
      song.artist.toLowerCase() === oldArtist.toLowerCase() &&
      song.title.toLowerCase() === oldTitle.toLowerCase()
    );
    
    if (ultrastarSong) {
      songType = 'ultrastar';
      songData = ultrastarSong;
      oldPath = ultrastarSong.fullPath;
      const oldFolderName = path.basename(oldPath);
      const newFolderName = `${newArtist} - ${newTitle}`;
      newPath = path.join(path.dirname(oldPath), newFolderName);
      console.log(`🔍 Found ultrastar song: ${oldArtist} - ${oldTitle}`);
      console.log(`📁 Old path: ${oldPath}`);
      console.log(`📁 New path: ${newPath}`);
    }

    // Check YouTube cache songs (folder-based)
    if (!songData) {
      const youtubeSongs = scanYouTubeSongs();
      const youtubeSong = youtubeSongs.find(song => 
        song.artist.toLowerCase() === oldArtist.toLowerCase() &&
        song.title.toLowerCase() === oldTitle.toLowerCase()
      );
      
      if (youtubeSong) {
        songType = 'youtube_cache';
        songData = youtubeSong;
        oldPath = youtubeSong.fullPath;
        const oldFolderName = path.basename(oldPath);
        const newFolderName = `${newArtist} - ${newTitle}`;
        newPath = path.join(path.dirname(oldPath), newFolderName);
        console.log(`🔍 Found YouTube cache song: ${oldArtist} - ${oldTitle}`);
        console.log(`📁 Old path: ${oldPath}`);
        console.log(`📁 New path: ${newPath}`);
      }
    }

    // Check local videos (file-based)
    if (!songData) {
      const localVideos = scanLocalVideos();
      const localVideo = localVideos.find(video => 
        video.artist.toLowerCase() === oldArtist.toLowerCase() &&
        video.title.toLowerCase() === oldTitle.toLowerCase()
      );
      
      if (localVideo) {
        songType = 'server_video';
        songData = localVideo;
        oldPath = localVideo.fullPath;
        const fileNameWithoutExt = path.basename(oldPath, localVideo.extension);
        const oldFolderName = fileNameWithoutExt.replace(/\.[^.]+$/, ''); // Remove any extension
        const newFileName = `${newArtist} - ${newTitle}${localVideo.extension}`;
        newPath = path.join(path.dirname(oldPath), newFileName);
        console.log(`🔍 Found local video: ${oldArtist} - ${oldTitle}`);
        console.log(`📁 Old path: ${oldPath}`);
        console.log(`📁 New path: ${newPath}`);
      }
    }

    // Check magic videos (folder-based)
    if (!songData) {
      const magicVideos = scanMagicVideos();
      const magicVideo = magicVideos.find(video => 
        video.artist.toLowerCase() === oldArtist.toLowerCase() &&
        video.title.toLowerCase() === oldTitle.toLowerCase()
      );
      
      if (magicVideo) {
        songType = 'magic_video';
        songData = magicVideo;
        oldPath = magicVideo.fullPath;
        const oldFolderName = path.basename(oldPath);
        const newFolderName = `${newArtist} - ${newTitle}`;
        newPath = path.join(path.dirname(oldPath), newFolderName);
        console.log(`🔍 Found magic video: ${oldArtist} - ${oldTitle}`);
        console.log(`📁 Old path: ${oldPath}`);
        console.log(`📁 New path: ${newPath}`);
      }
    }

    // Check magic songs (folder-based)
    if (!songData) {
      const magicSongs = scanMagicSongs();
      const magicSong = magicSongs.find(song => 
        song.artist.toLowerCase() === oldArtist.toLowerCase() &&
        song.title.toLowerCase() === oldTitle.toLowerCase()
      );
      
      if (magicSong) {
        songType = 'magic_song';
        songData = magicSong;
        oldPath = magicSong.fullPath;
        const oldFolderName = path.basename(oldPath);
        const newFolderName = `${newArtist} - ${newTitle}`;
        newPath = path.join(path.dirname(oldPath), newFolderName);
        console.log(`🔍 Found magic song: ${oldArtist} - ${oldTitle}`);
        console.log(`📁 Old path: ${oldPath}`);
        console.log(`📁 New path: ${newPath}`);
      }
    }

    // Check magic YouTube (folder-based)
    if (!songData) {
      const magicYouTube = scanMagicYouTube();
      const magicYouTubeSong = magicYouTube.find(video => 
        video.artist.toLowerCase() === oldArtist.toLowerCase() &&
        video.title.toLowerCase() === oldTitle.toLowerCase()
      );
      
      if (magicYouTubeSong) {
        songType = 'magic_youtube';
        songData = magicYouTubeSong;
        oldPath = magicYouTubeSong.fullPath;
        const oldFolderName = path.basename(oldPath);
        const newFolderName = `${newArtist} - ${newTitle}`;
        newPath = path.join(path.dirname(oldPath), newFolderName);
        console.log(`🔍 Found magic YouTube song: ${oldArtist} - ${oldTitle}`);
        console.log(`📁 Old path: ${oldPath}`);
        console.log(`📁 New path: ${newPath}`);
      }
    }

    // Check file songs (file-based, but we need to know the folder path)
    // This is more complex as file songs can be in different folders
    // For now, we'll skip this and focus on the main song types

    if (!songData) {
      console.error(`❌ Song not found in any location: ${oldArtist} - ${oldTitle}`);
      return res.status(404).json({ 
        message: 'Song nicht gefunden',
        success: false
      });
    }

    // Check if new name already exists
    let existingSong = null;
    
    if (songType === 'ultrastar') {
      const ultrastarSongs = scanUltrastarSongs();
      existingSong = ultrastarSongs.find(song => 
        song.artist.toLowerCase() === newArtist.toLowerCase() &&
        song.title.toLowerCase() === newTitle.toLowerCase()
      );
    } else if (songType === 'youtube_cache') {
      const youtubeSongs = scanYouTubeSongs();
      existingSong = youtubeSongs.find(song => 
        song.artist.toLowerCase() === newArtist.toLowerCase() &&
        song.title.toLowerCase() === newTitle.toLowerCase()
      );
    } else if (songType === 'server_video') {
      const localVideos = scanLocalVideos();
      existingSong = localVideos.find(video => 
        video.artist.toLowerCase() === newArtist.toLowerCase() &&
        video.title.toLowerCase() === newTitle.toLowerCase()
      );
    }

    if (existingSong) {
      return res.status(400).json({ 
        message: 'Ein Song mit diesem Namen existiert bereits',
        success: false
      });
    }

    // Check if old path exists
    if (!fs.existsSync(oldPath)) {
      console.error(`❌ Path does not exist: ${oldPath}`);
      return res.status(404).json({ 
        message: `${songType === 'server_video' ? 'Video-Datei' : 'Ordner'} nicht gefunden`,
        success: false
      });
    }

    // Check if new path already exists
    if (fs.existsSync(newPath)) {
      return res.status(400).json({ 
        message: `${songType === 'server_video' ? 'Eine Datei' : 'Ein Ordner'} mit diesem Namen existiert bereits`,
        success: false
      });
    }

    // Rename the file/folder
    fs.renameSync(oldPath, newPath);
    console.log(`📁 Renamed ${songType} ${songType === 'server_video' ? 'file' : 'folder'}: "${path.basename(oldPath)}" → "${path.basename(newPath)}"`);

    // Rebuild cache after song rename
    try {
      await songCache.buildCache(true);
      console.log('🔄 Cache nach Song-Umbenennung neu aufgebaut');
    } catch (cacheError) {
      console.warn('⚠️ Fehler beim Cache-Rebuild nach Song-Umbenennung:', cacheError.message);
    }

    // Update invisible songs database entry
    try {
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE invisible_songs SET artist = ?, title = ? WHERE artist = ? AND title = ?',
          [newArtist, newTitle, oldArtist, oldTitle],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      console.log(`📝 Updated invisible songs entry: "${oldArtist} - ${oldTitle}" → "${newArtist} - ${newTitle}"`);
    } catch (dbError) {
      console.warn('Could not update invisible songs database:', dbError.message);
      // Don't fail the operation if database update fails
    }

    res.json({ 
      message: `Song erfolgreich umbenannt von "${oldArtist} - ${oldTitle}" zu "${newArtist} - ${newTitle}"`,
      success: true,
      oldName: `${oldArtist} - ${oldTitle}`,
      newName: `${newArtist} - ${newTitle}`,
      songType: songType
    });

  } catch (error) {
    console.error('Error renaming song:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      success: false
    });
  }
});

// General Song Delete (for all song types)
router.post('/song/delete', [
  body('artist').notEmpty().trim(),
  body('title').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validierungsfehler', 
        errors: errors.array() 
      });
    }

    const { artist, title } = req.body;
    const fs = require('fs');
    const path = require('path');

    // Import song scanning functions
    const { scanUltrastarSongs } = require('../../utils/ultrastarSongs');
    const { scanYouTubeSongs } = require('../../utils/youtubeSongs');
    const { scanLocalVideos } = require('../../utils/localVideos');
    const { scanMagicVideos } = require('../../utils/magicVideos');
    const { scanMagicSongs } = require('../../utils/magicSongs');
    const { scanMagicYouTube } = require('../../utils/magicYouTube');

    // Find the song in all possible locations
    let songType = null;
    let songData = null;
    let deletePath = null;

    // Check Ultrastar songs (folder-based)
    const ultrastarSongs = scanUltrastarSongs();
    const ultrastarSong = ultrastarSongs.find(song => 
      song.artist.toLowerCase() === artist.toLowerCase() &&
      song.title.toLowerCase() === title.toLowerCase()
    );
    
    if (ultrastarSong) {
      songType = 'ultrastar';
      songData = ultrastarSong;
      deletePath = ultrastarSong.fullPath;
      console.log(`🔍 Found ultrastar song for deletion: ${artist} - ${title}`);
      console.log(`📁 Delete path: ${deletePath}`);
    }

    // Check YouTube cache songs (folder-based)
    if (!songData) {
      const youtubeSongs = scanYouTubeSongs();
      const youtubeSong = youtubeSongs.find(song => 
        song.artist.toLowerCase() === artist.toLowerCase() &&
        song.title.toLowerCase() === title.toLowerCase()
      );
      
      if (youtubeSong) {
        songType = 'youtube_cache';
        songData = youtubeSong;
        deletePath = youtubeSong.fullPath;
        console.log(`🔍 Found YouTube cache song for deletion: ${artist} - ${title}`);
        console.log(`📁 Delete path: ${deletePath}`);
      }
    }

    // Check local videos (file-based)
    if (!songData) {
      const localVideos = scanLocalVideos();
      const localVideo = localVideos.find(video => 
        video.artist.toLowerCase() === artist.toLowerCase() &&
        video.title.toLowerCase() === title.toLowerCase()
      );
      
      if (localVideo) {
        songType = 'server_video';
        songData = localVideo;
        deletePath = localVideo.fullPath;
        console.log(`🔍 Found local video for deletion: ${artist} - ${title}`);
        console.log(`📁 Delete path: ${deletePath}`);
      }
    }

    // Check magic videos (folder-based)
    if (!songData) {
      const magicVideos = scanMagicVideos();
      const magicVideo = magicVideos.find(video => 
        video.artist.toLowerCase() === artist.toLowerCase() &&
        video.title.toLowerCase() === title.toLowerCase()
      );
      
      if (magicVideo) {
        songType = 'magic_video';
        songData = magicVideo;
        deletePath = magicVideo.fullPath;
        console.log(`🔍 Found magic video for deletion: ${artist} - ${title}`);
        console.log(`📁 Delete path: ${deletePath}`);
      }
    }

    // Check magic songs (folder-based)
    if (!songData) {
      const magicSongs = scanMagicSongs();
      const magicSong = magicSongs.find(song => 
        song.artist.toLowerCase() === artist.toLowerCase() &&
        song.title.toLowerCase() === title.toLowerCase()
      );
      
      if (magicSong) {
        songType = 'magic_song';
        songData = magicSong;
        deletePath = magicSong.fullPath;
        console.log(`🔍 Found magic song for deletion: ${artist} - ${title}`);
        console.log(`📁 Delete path: ${deletePath}`);
      }
    }

    // Check magic YouTube (folder-based)
    if (!songData) {
      const magicYouTube = scanMagicYouTube();
      const magicYouTubeSong = magicYouTube.find(video => 
        video.artist.toLowerCase() === artist.toLowerCase() &&
        video.title.toLowerCase() === title.toLowerCase()
      );
      
      if (magicYouTubeSong) {
        songType = 'magic_youtube';
        songData = magicYouTubeSong;
        deletePath = magicYouTubeSong.fullPath;
        console.log(`🔍 Found magic YouTube song for deletion: ${artist} - ${title}`);
        console.log(`📁 Delete path: ${deletePath}`);
      }
    }

    if (!songData) {
      console.error(`❌ Song not found in any location for deletion: ${artist} - ${title}`);
      return res.status(404).json({ 
        message: 'Song nicht gefunden',
        success: false
      });
    }

    // Check if path exists
    if (!fs.existsSync(deletePath)) {
      console.error(`❌ Path does not exist for deletion: ${deletePath}`);
      return res.status(404).json({ 
        message: `${songType === 'server_video' ? 'Video-Datei' : 'Ordner'} nicht gefunden`,
        success: false
      });
    }

    // Delete the file/folder
    if (songType === 'server_video') {
      // Delete single file
      fs.unlinkSync(deletePath);
      console.log(`🗑️ Deleted ${songType} file: "${path.basename(deletePath)}"`);
    } else {
      // Delete folder recursively
      fs.rmSync(deletePath, { recursive: true, force: true });
      console.log(`🗑️ Deleted ${songType} folder: "${path.basename(deletePath)}"`);
    }

    // Rebuild cache after song deletion
    try {
      await songCache.buildCache(true);
      console.log('🔄 Cache nach Song-Löschung neu aufgebaut');
    } catch (cacheError) {
      console.warn('⚠️ Fehler beim Cache-Rebuild nach Song-Löschung:', cacheError.message);
    }

    // Remove from invisible songs database entry
    try {
      await new Promise((resolve, reject) => {
        db.run(
          'DELETE FROM invisible_songs WHERE artist = ? AND title = ?',
          [artist, title],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      console.log(`📝 Removed invisible songs entry: "${artist} - ${title}"`);
    } catch (dbError) {
      console.warn('Could not remove invisible songs database entry:', dbError.message);
      // Don't fail the operation if database update fails
    }

    res.json({ 
      message: `Song "${artist} - ${title}" erfolgreich gelöscht`,
      success: true,
      deletedName: `${artist} - ${title}`,
      songType: songType
    });

  } catch (error) {
    console.error('Error deleting song:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      success: false
    });
  }
});

module.exports = router;