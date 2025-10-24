const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Song = require('../../models/Song');
const db = require('../../config/database');
const { scanYouTubeSongs, downloadYouTubeVideo, findYouTubeSong } = require('../../utils/youtubeSongs');
const { broadcastProcessingStatus } = require('../../utils/websocketService');
const { cleanYouTubeUrl } = require('../../utils/youtubeUrlCleaner');
const songCache = require('../../utils/songCache');

// Update YouTube URL for a song
router.put('/song/:songId/youtube', [
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
        
        // Wenn der Song vorher "failed" war und jetzt ein YouTube-Link eingetragen wird, setze Status auf "ready"
        if (song.download_status === 'failed') {
          console.log(`🔄 Song was failed, setting status to ready after YouTube URL update: ${song.artist} - ${song.title}`);
          await Song.updateDownloadStatus(songId, 'ready');
        }
        
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
      // Wenn der Song vorher "failed" war und jetzt kein YouTube-Link mehr vorhanden ist, setze Status auf "none"
      if (song.download_status === 'failed') {
        console.log(`🔄 Song was failed, setting status to none after YouTube URL removal: ${song.artist} - ${song.title}`);
        await Song.updateDownloadStatus(songId, 'none');
      } else {
        await Song.updateDownloadStatus(songId, 'none');
      }
    }
    
    // Rebuild cache after YouTube URL update
    try {
      await songCache.buildCache(true);
      console.log('🔄 Cache nach YouTube-URL-Update neu aufgebaut');
    } catch (cacheError) {
      console.warn('⚠️ Fehler beim Cache-Rebuild nach YouTube-URL-Update:', cacheError.message);
    }
    
    res.json({ message: 'YouTube URL updated successfully' });
  } catch (error) {
    console.error('Update YouTube URL error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
