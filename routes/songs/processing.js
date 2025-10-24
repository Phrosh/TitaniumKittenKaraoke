const express = require('express');
const axios = require('axios');
const router = express.Router();

// Removed: POST /songs/download-youtube (unused)

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
        
        // Spezielle Behandlung für fehlgeschlagene USDB-Downloads: Modus auf youtube zurücksetzen und YouTube-Link löschen
        if (status === 'failed') {
          try {
            // Prüfe ob der Song aktuell im ultrastar-Modus ist (USDB-Download)
            const currentSong = await new Promise((resolve, reject) => {
              db.get('SELECT mode FROM songs WHERE id = ?', [songRow.id], (err, row) => err ? reject(err) : resolve(row));
            });
            
            if (currentSong && currentSong.mode === 'ultrastar') {
              console.log('🔄 USDB download failed, resetting song to youtube mode:', { songId: songRow.id, artist, title });
              
              // Setze Modus auf youtube und lösche YouTube-Link
              await new Promise((resolve, reject) => {
                db.run('UPDATE songs SET mode = ?, youtube_url = ? WHERE id = ?', ['youtube', '', songRow.id], (err) => err ? reject(err) : resolve());
              });
              
              console.log('✅ Song reset to youtube mode after failed USDB download:', { songId: songRow.id, artist, title });
              
              // Broadcast admin update so dashboard refreshes cached data
              const { broadcastAdminUpdate, broadcastPlaylistUpdate } = require('../../utils/websocketService');
              const io = req.app.get('io');
              if (io) {
                await broadcastAdminUpdate(io).catch(() => {});
                await broadcastPlaylistUpdate(io).catch(() => {});
              }
            }
          } catch (resetError) {
            console.error('❌ Error resetting song after failed USDB download:', resetError);
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

// Queue status endpoint (from AI services)
router.post('/queue-status', async (req, res) => {
  try {
    const { type, queue_length, is_processing, current_job, finished_jobs, total_jobs } = req.body || {};
    console.log('📡 API /queue-status received:', { type, queue_length, is_processing, current_job, finished_jobs, total_jobs, ts: new Date().toISOString() });

    // Broadcast over WebSocket
    const io = req.app.get('io');
    if (io) {
      const { broadcastQueueStatus } = require('../../utils/websocketService');
      broadcastQueueStatus(io, {
        type: 'queue_status',
        queue_length,
        is_processing,
        current_job,
        finished_jobs,
        total_jobs
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error in queue-status endpoint:', error);
    res.status(500).json({ error: 'Server error' });
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

// Removed: GET /songs/ai-services/health (unused)

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
    
    // Extrahiere Artist und Title aus dem folderName
    const decodedFolderName = decodeURIComponent(folderName);
    const parts = decodedFolderName.split(' - ');
    const artist = parts[0] || 'Unknown';
    const title = parts.slice(1).join(' - ') || 'Unknown';
    
    // Setze DownloadStatus auf "pending" bevor Job zur Queue hinzugefügt wird
    try {
      const Song = require('../../models/Song');
      await Song.update(
        { download_status: 'pending' },
        { where: { folder_name: decodedFolderName } }
      );
      console.log(`📋 DownloadStatus auf "pending" gesetzt für: ${artist} - ${title}`);
      
      // Sende WebSocket-Update für pending Status
      const io = req.app.get('io');
      if (io) {
        const { broadcastProcessingStatus } = require('../../utils/websocketService');
        broadcastProcessingStatus(io, {
          id: `${artist}-${title}`,
          artist: artist,
          title: title,
          status: 'pending'
        });
      }
    } catch (statusError) {
      console.warn('⚠️ Konnte DownloadStatus nicht auf pending setzen:', statusError.message);
    }
    
        // Direkter Aufruf der AI-Services (Queue wird jetzt in AI-Services verwaltet)
        const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:6000';
        
        try {
          console.log('🚀 Starte Verarbeitung:', {
            url: `${aiServiceUrl}/modular-process/${encodeURIComponent(decodedFolderName)}`,
            songType,
            baseDir,
            artist,
            title,
            timestamp: new Date().toISOString()
          });
          
          const response = await axios.post(`${aiServiceUrl}/modular-process/${encodeURIComponent(decodedFolderName)}`, {
            songType: songType,
            baseDir: baseDir
          }, {
            timeout: 600000 // 10 Minuten Timeout
          });
          
          if (response.data.success) {
            console.log('✅ Verarbeitung erfolgreich gestartet:', response.data);
            res.json({ 
              success: true, 
              message: response.data.message || 'Verarbeitung gestartet',
              job_id: response.data.job_id,
              queue_position: response.data.queue_position
            });
          } else {
            throw new Error(response.data.error || 'Verarbeitung fehlgeschlagen');
          }
          
        } catch (error) {
          console.error('❌ Fehler bei der Verarbeitung:', {
            message: error.message,
            code: error.code,
            response: error.response?.data
          });
          res.status(500).json({ 
            success: false, 
            error: error.response?.data?.error || error.message || 'Verarbeitung fehlgeschlagen' 
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
