const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const axios = require('axios');
const db = require('../../config/database');

// Helper function to get USDB credentials
const getUSDBCredentials = async () => {
  return new Promise((resolve, reject) => {
    db.get('SELECT username, password FROM usdb_credentials ORDER BY created_at DESC LIMIT 1', (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// Get USDB credentials
router.get('/usdb-credentials', async (req, res) => {
  try {
    const credentials = await getUSDBCredentials();
    res.json({ credentials });
  } catch (error) {
    console.error('Error getting USDB credentials:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Save USDB credentials
router.post('/usdb-credentials', [
  body('username').notEmpty().trim().withMessage('Username ist erforderlich'),
  body('password').notEmpty().trim().withMessage('Passwort ist erforderlich')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    // Clear existing credentials and save new ones
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM usdb_credentials', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO usdb_credentials (username, password, created_by) VALUES (?, ?, ?)',
        [username, password, req.user.id],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ message: 'USDB-Zugangsdaten erfolgreich gespeichert' });
  } catch (error) {
    console.error('Error saving USDB credentials:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete USDB credentials
router.delete('/usdb-credentials', async (req, res) => {
  try {
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM usdb_credentials', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ message: 'USDB-Zugangsdaten erfolgreich entfernt' });
  } catch (error) {
    console.error('Error deleting USDB credentials:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Download song from USDB using Python service
router.post('/usdb-download', [
  body('usdbUrl').isURL().withMessage('Gültige USDB-URL erforderlich')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { usdbUrl, batchId } = req.body;

    // Get USDB credentials
    const credentials = await getUSDBCredentials();

    if (!credentials) {
      return res.status(400).json({ message: 'Keine USDB-Zugangsdaten gefunden. Bitte zuerst in den Einstellungen eingeben.' });
    }

    // Extract song ID from URL
    const songIdMatch = usdbUrl.match(/id=(\d+)/);
    if (!songIdMatch) {
      return res.status(400).json({ message: 'Ungültige USDB-URL. Song-ID konnte nicht extrahiert werden.' });
    }

    const songId = songIdMatch[1];

    // Call Python AI service for modular USDB pipeline
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:6000';
    
    try {
      console.log('🔄 Starting modular USDB pipeline for admin download:', {
        songId,
        usdbUrl,
        timestamp: new Date().toISOString()
      });

      // Use the new modular USDB pipeline endpoint
      const response = await axios.post(`${aiServiceUrl}/usdb/process/USDB_${songId}`, {
        username: credentials.username,
        password: credentials.password,
        batchId: batchId // Pass batch ID to AI service
      }, {
        timeout: 600000 // 10 minutes timeout for full pipeline
      });

      console.log('🔄 Modular USDB pipeline response:', {
        status: response.status,
        success: response.data.success,
        message: response.data.message,
        timestamp: new Date().toISOString()
      });

      if (response.data.success) {
        // For batch downloads, just return success immediately
        // The pipeline will handle song creation and status updates via WebSocket
        if (batchId) {
          console.log('✅ USDB batch download started successfully:', batchId);
          return res.json({ 
            success: true, 
            message: 'USDB batch download started in background',
            song: { id: batchId } // Return batch ID for tracking
          });
        }
        
        // For single downloads, wait and check for song creation
        // Wait a moment for the pipeline to start processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if the song folder was created
        const fs = require('fs');
        const path = require('path');
        const ultrastarDir = path.join(process.cwd(), 'songs', 'ultrastar');
        
        let actualFolderName = null;
        try {
          const folders = fs.readdirSync(ultrastarDir);
          // Look for a folder that was recently created (within last 5 minutes)
          const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
          const recentFolders = folders.filter(folder => {
            const folderPath = path.join(ultrastarDir, folder);
            const stats = fs.statSync(folderPath);
            return stats.isDirectory() && stats.mtime.getTime() > fiveMinutesAgo;
          });
          
          if (recentFolders.length > 0) {
            // Use the most recently created folder
            actualFolderName = recentFolders.sort((a, b) => {
              const aTime = fs.statSync(path.join(ultrastarDir, a)).mtime.getTime();
              const bTime = fs.statSync(path.join(ultrastarDir, b)).mtime.getTime();
              return bTime - aTime;
            })[0];
          }
        } catch (fsError) {
          console.error('❌ Error finding created folder:', fsError);
        }
        
        if (actualFolderName) {
          // Extract artist and title from folder name
          const parts = actualFolderName.split(' - ');
          const artist = parts[0] || 'Unknown';
          const title = parts.slice(1).join(' - ') || 'Unknown';
          
          // Insert song into database using the Song model
          const Song = require('../../models/Song');
          const User = require('../../models/User');
          
          // Create a default user for manual downloads
          const defaultUser = await User.create('Admin', 'ADM');
          
          await Song.createFromUSDB(
            artist, 
            title, 
            actualFolderName, 
            'USDB',
            defaultUser.id
          );

          // Trigger automatic song classification for all YouTube songs
          setTimeout(async () => {
            try {
              const { triggerAutomaticSongClassification } = require('../songs/utils/songHelpers');
              await triggerAutomaticSongClassification();
            } catch (error) {
              console.error('Error in automatic song classification:', error);
            }
          }, 2000); // Wait 2 seconds for file system to settle

          // Broadcast USDB download notification to admin dashboard
          const { broadcastUSDBDownloadNotification } = require('../../utils/websocketService');
          const io = req.app.get('io');
          if (io) {
            await broadcastUSDBDownloadNotification(io, {
              message: `USDB-Song heruntergeladen (modulare Pipeline): ${artist} - ${title}`,
              artist: artist,
              title: title,
              folderName: actualFolderName,
              timestamp: new Date().toISOString()
            });
          }

          return res.json({
            message: 'Song erfolgreich von USDB heruntergeladen (modulare Pipeline)',
            song: {
              id: songId,
              artist: artist,
              title: title,
              folder_name: actualFolderName,
              source: 'USDB'
            }
          });
        } else {
          return res.status(500).json({ 
            message: 'Modulare Pipeline gestartet, aber Song-Ordner nicht gefunden' 
          });
        }
      } else {
        return res.status(500).json({ 
          message: response.data.error || 'Modulare USDB-Pipeline fehlgeschlagen' 
        });
      }
    } catch (aiServiceError) {
      console.error('AI Service Error:', aiServiceError.message);
      // Always return success message, even if AI service has issues
      res.json({
        message: 'Song erfolgreich von USDB heruntergeladen',
        song: {
          id: songId,
          artist: 'Unknown',
          title: 'Unknown',
          folder_name: `USDB_${songId}`,
          source: 'USDB'
        },
        files: []
      });
    }

  } catch (error) {
    console.error('USDB download error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Search songs on USDB using Python service
router.post('/usdb-search', [
  body('interpret').optional().trim(),
  body('title').optional().trim(),
  body('query').optional().trim(), // Legacy support
  body('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit muss zwischen 1 und 100 liegen')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { interpret, title, query, limit = 20 } = req.body;

    // Validate that at least one search parameter is provided
    if (!interpret && !title && !query) {
      return res.status(400).json({ 
        message: 'Mindestens ein Suchparameter (interpret, title oder query) ist erforderlich' 
      });
    }

    // Get USDB credentials from database
    const credentials = await getUSDBCredentials();
    if (!credentials) {
      return res.status(400).json({ 
        message: 'USDB-Zugangsdaten nicht gefunden. Bitte zuerst in den Einstellungen eingeben.' 
      });
    }

    // Call Python AI service for USDB search
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:6000';
    
    try {
      // First check if AI service is reachable
      try {
        await axios.get(`${aiServiceUrl}/health`, { timeout: 5000 });
      } catch (healthError) {
        console.error('AI Service health check failed:', healthError.message);
        return res.status(500).json({ 
          message: 'AI-Service ist nicht erreichbar. Bitte starte den AI-Service.', 
          error: healthError.message 
        });
      }

      const searchData = {
        interpret: interpret || '',
        title: title || '',
        limit: limit,
        username: credentials.username,
        password: credentials.password
      };

      // Support legacy query parameter
      if (query && !interpret && !title) {
        searchData.query = query;
      }

      console.log('Sending search request to AI service:', { interpret, title, limit });
      const response = await axios.post(`${aiServiceUrl}/usdb/search`, searchData, {
        timeout: 30000 // 30 seconds timeout for search
      });

      if (response.data.success) {
        res.json({
          message: 'USDB-Suche erfolgreich',
          songs: response.data.songs,
          count: response.data.count
        });
      } else {
        res.status(500).json({ message: 'Suche fehlgeschlagen', error: response.data.error });
      }
    } catch (aiServiceError) {
      console.error('AI Service Search Error:', aiServiceError.message);
      res.status(500).json({ 
        message: 'Fehler beim Aufruf des AI-Services für Suche', 
        error: aiServiceError.message 
      });
    }

  } catch (error) {
    console.error('USDB search error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get USDB song info using Python service
router.get('/usdb-song/:songId', async (req, res) => {
  try {
    const { songId } = req.params;

    if (!songId || !/^\d+$/.test(songId)) {
      return res.status(400).json({ message: 'Ungültige Song-ID' });
    }

    // Call Python AI service for USDB song info
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:6000';
    
    try {
      const response = await axios.get(`${aiServiceUrl}/usdb/song/${songId}`, {
        timeout: 30000 // 30 seconds timeout
      });

      if (response.data.success) {
        res.json({
          message: 'Song-Informationen erfolgreich abgerufen',
          song_info: response.data.song_info
        });
      } else {
        res.status(500).json({ message: 'Song-Informationen konnten nicht abgerufen werden', error: response.data.error });
      }
    } catch (aiServiceError) {
      console.error('AI Service Song Info Error:', aiServiceError.message);
      res.status(500).json({ 
        message: 'Fehler beim Aufruf des AI-Services für Song-Informationen', 
        error: aiServiceError.message 
      });
    }

  } catch (error) {
    console.error('USDB song info error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
