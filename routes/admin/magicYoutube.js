const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Song = require('../../models/Song');
const db = require('../../config/database');
const { cleanYouTubeUrl } = require('../../utils/youtubeUrlCleaner');
const { broadcastProcessingStatus } = require('../../utils/websocketService');

// Process Magic YouTube for a song
router.post('/song/:songId/magic-youtube', [
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
              Song.updateDownloadStatus(songId, 'failed').catch(console.error);
              const io = require('../../server').io;
              if (io) {
                broadcastProcessingStatus(io, { id: Number(songId), artist: song.artist, title: song.title, status: 'failed' });
              }
            }
          } catch (error) {
            console.error('✨ Error parsing Magic YouTube response:', error);
            Song.updateDownloadStatus(songId, 'failed').catch(console.error);
            const io = require('../../server').io;
            if (io) {
              broadcastProcessingStatus(io, { id: Number(songId), artist: song.artist, title: song.title, status: 'failed' });
            }
          }
        });
      });
      
      proxyReq.on('error', (error) => {
        console.error('✨ Error processing Magic YouTube:', error);
        Song.updateDownloadStatus(songId, 'failed').catch(console.error);
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
      await Song.updateDownloadStatus(songId, 'failed');
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

module.exports = router;
