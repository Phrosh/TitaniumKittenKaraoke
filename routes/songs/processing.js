const express = require('express');
const router = express.Router();

// Download YouTube video to songs/youtube folder
router.post('/download-youtube', async (req, res) => {
  try {
    const { youtubeUrl, artist, title } = req.body;
    
    if (!youtubeUrl || !artist || !title) {
      return res.status(400).json({ 
        error: 'YouTube URL, artist, and title are required' 
      });
    }
    
    const { downloadYouTubeVideo } = require('../../utils/youtubeSongs');
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

// Processing status endpoint (from AI services)
router.post('/processing-status', async (req, res) => {
  try {
    const { id, artist, title, status, youtube_url, mode } = req.body || {};
    console.log('📡 API /processing-status received:', { id, artist, title, status, ts: new Date().toISOString() });

    // Add small delay to prevent race conditions
    await new Promise(resolve => setTimeout(resolve, 200));

    // Broadcast over WebSocket
    const io = req.app.get('io');
    if (io) {
      // Only broadcast the status as-is (no magic-* mapping needed anymore)
      const { broadcastProcessingStatus, broadcastAdminUpdate } = require('../../utils/websocketService');
      broadcastProcessingStatus(io, { id, artist, title, status });
      await broadcastAdminUpdate(io).catch(() => {});
    }

    // Try to persist status on the song if possible (by id or by artist/title)
    try {
      const db = require('../../config/database');
      let songRow = null;
      if (typeof id === 'number') {
        songRow = await new Promise((resolve, reject) => {
          db.get('SELECT id FROM songs WHERE id = ?', [id], (err, row) => err ? reject(err) : resolve(row));
        });
      } else if (artist && title) {
        songRow = await new Promise((resolve, reject) => {
          db.get('SELECT id FROM songs WHERE LOWER(artist) = LOWER(?) AND LOWER(title) = LOWER(?) ORDER BY created_at DESC', [artist, title], (err, row) => err ? reject(err) : resolve(row));
        });
      }
      if (songRow && songRow.id) {
        const Song = require('../../models/Song');
        // Map 'finished' to 'ready' for storage; others store as-is
        const storeStatus = status === 'finished' ? 'ready' : status;
        await Song.updateDownloadStatus(songRow.id, storeStatus);
        console.log('💾 Stored processing status for song', { songId: songRow.id, storeStatus });

        // Optional: update mode and youtube_url if provided (e.g., USDB pipeline fallback)
        if ((mode || youtube_url) && (status === 'failed' || status === 'finished' || status === 'processing')) {
          await new Promise((resolve, reject) => {
            const sets = [];
            const params = [];
            if (typeof mode === 'string' && mode.trim()) { sets.push('mode = ?'); params.push(mode.trim()); }
            if (typeof youtube_url === 'string' && youtube_url.trim()) { sets.push('youtube_url = ?'); params.push(youtube_url.trim()); }
            if (sets.length > 0) {
              params.push(songRow.id);
              db.run(`UPDATE songs SET ${sets.join(', ')} WHERE id = ?`, params, (err) => err ? reject(err) : resolve());
            } else {
              resolve();
            }
          });
          console.log('🛠️ Updated song extra fields via processing-status', { songId: songRow.id, mode, youtube_url });
          // Broadcast admin update so dashboard refreshes cached data
          const { broadcastAdminUpdate, broadcastPlaylistUpdate } = require('../../utils/websocketService');
          const io = req.app.get('io');
          if (io) {
            await broadcastAdminUpdate(io).catch(() => {});
            await broadcastPlaylistUpdate(io).catch(() => {});
          }
        }
      }
    } catch (persistErr) {
      console.warn('⚠️ Could not persist processing status:', persistErr.message);
    }

    // Trigger playlist upgrade check when a song finishes processing
    if (status === 'finished') {
      try {
        console.log('🔄 Song finished processing, triggering playlist upgrade check:', { id, artist, title, status });
        
        // Add small delay to ensure all database updates are complete
        setTimeout(async () => {
          try {
            // Note: triggerPlaylistUpgradeCheck function needs to be imported or defined
            // await triggerPlaylistUpgradeCheck();
          } catch (upgradeErr) {
            console.error('❌ Error in playlist upgrade check:', upgradeErr);
          }
        }, 1000); // 1 second delay to ensure all updates are complete
        
      } catch (error) {
        console.error('❌ Error triggering playlist upgrade check:', error);
      }
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('❌ Error in /processing-status:', error);
    res.status(500).json({ ok: false, error: error.message });
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

// Modular processing endpoint for all song types
router.post('/modular-process/:folderName', async (req, res) => {
  try {
    const { folderName } = req.params;
    const { songType } = req.body; // 'ultrastar', 'magic-songs', 'magic-videos'
    
    console.log('🔧 Modular processing request:', {
      folderName: decodeURIComponent(folderName),
      songType,
      timestamp: new Date().toISOString()
    });
    
    // Determine the correct directory based on song type
    let baseDir;
    switch (songType) {
      case 'ultrastar':
        baseDir = require('path').join(process.cwd(), 'songs', 'ultrastar');
        break;
      case 'magic-songs':
        baseDir = require('path').join(process.cwd(), 'songs', 'magic-songs');
        break;
      case 'magic-videos':
        baseDir = require('path').join(process.cwd(), 'songs', 'magic-videos');
        break;
      default:
        return res.status(400).json({ error: 'Invalid song type' });
    }
    
    const folderPath = require('path').join(baseDir, decodeURIComponent(folderName));
    const fs = require('fs');
    
    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Call AI service for modular processing
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:6000';
    const axios = require('axios');
    
    try {
      console.log('🔄 Starting modular processing via AI service:', {
        url: `${aiServiceUrl}/modular-process/${encodeURIComponent(folderName)}`,
        songType,
        timestamp: new Date().toISOString()
      });
      
      const response = await axios.post(`${aiServiceUrl}/modular-process/${encodeURIComponent(folderName)}`, {
        songType: songType,
        baseDir: baseDir
      }, {
        timeout: 600000 // 10 minutes timeout
      });
      
      console.log('🔄 Modular processing response:', {
        status: response.status,
        success: response.data.success,
        message: response.data.message,
        timestamp: new Date().toISOString()
      });
      
      if (response.data.success) {
        res.json({ 
          success: true, 
          message: 'Modular processing started successfully',
          status: 'processing'
        });
      } else {
        res.status(500).json({ 
          success: false, 
          error: response.data.error || 'Modular processing failed' 
        });
      }
      
    } catch (error) {
      console.error('❌ Modular processing request failed:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        timestamp: new Date().toISOString()
      });
      res.status(500).json({ 
        success: false, 
        error: error.response?.data?.message || error.message 
      });
    }
    
  } catch (error) {
    console.error('❌ Error in modular processing:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// Recreate Magic songs endpoint (delete processed files and recreate)
router.post('/recreate/:folderName', async (req, res) => {
  try {
    const { folderName } = req.params;
    const { songType } = req.body; // 'magic-songs', 'magic-videos', 'magic-youtube'
    
    console.log('🔄 Recreate request:', {
      folderName: decodeURIComponent(folderName),
      songType,
      timestamp: new Date().toISOString()
    });
    
    // Determine the correct directory based on song type
    let baseDir;
    switch (songType) {
      case 'magic-songs':
        baseDir = require('path').join(process.cwd(), 'songs', 'magic-songs');
        break;
      case 'magic-videos':
        baseDir = require('path').join(process.cwd(), 'songs', 'magic-videos');
        break;
      case 'magic-youtube':
        baseDir = require('path').join(process.cwd(), 'songs', 'magic-youtube');
        break;
      default:
        return res.status(400).json({ error: 'Invalid song type for recreate' });
    }
    
    const folderPath = require('path').join(baseDir, decodeURIComponent(folderName));
    const fs = require('fs');
    
    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Call AI service for recreate processing
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:6000';
    const axios = require('axios');
    
    try {
      console.log('🔄 Starting recreate via AI service:', {
        url: `${aiServiceUrl}/recreate/${encodeURIComponent(folderName)}`,
        songType,
        timestamp: new Date().toISOString()
      });
      
      const response = await axios.post(`${aiServiceUrl}/recreate/${encodeURIComponent(folderName)}`, {
        songType: songType,
        baseDir: baseDir
      }, {
        timeout: 600000 // 10 minutes timeout
      });
      
      console.log('🔄 Recreate response:', {
        status: response.status,
        success: response.data.success,
        message: response.data.message,
        timestamp: new Date().toISOString()
      });
      
      if (response.data.success) {
        res.json({ 
          success: true, 
          message: 'Recreate started successfully',
          status: 'processing'
        });
      } else {
        res.status(500).json({ 
          success: false, 
          error: response.data.error || 'Recreate failed' 
        });
      }
      
    } catch (error) {
      console.error('❌ Recreate request failed:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        timestamp: new Date().toISOString()
      });
      res.status(500).json({ 
        success: false, 
        error: error.response?.data?.message || error.message 
      });
    }
    
  } catch (error) {
    console.error('❌ Error in recreate:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

module.exports = router;
