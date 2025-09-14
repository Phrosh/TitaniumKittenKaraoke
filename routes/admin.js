const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const Song = require('../models/Song');
const User = require('../models/User');
const { verifyToken } = require('./auth');
const db = require('../config/database');
const { scanYouTubeSongs, downloadYouTubeVideo, findYouTubeSong } = require('../utils/youtubeSongs');
const { broadcastQRCodeToggle, broadcastSongChange, broadcastAdminUpdate, broadcastPlaylistUpdate } = require('../utils/websocketService');
const { cleanYouTubeUrl } = require('../utils/youtubeUrlCleaner');

const router = express.Router();

// All admin routes require authentication
router.use(verifyToken);

// Get admin dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    
    const playlist = await Song.getAll();
    
    
    const pendingSongs = await Song.getPending();
    
    const users = await User.getAll();
    
    const currentSong = await Song.getCurrentSong();
    
    // Load YouTube songs from cache
    const youtubeSongs = scanYouTubeSongs();
    
    // Statistics
    const stats = {
      totalSongs: playlist.length,
      pendingSongs: pendingSongs.length,
      totalUsers: users.length,
      songsWithYoutube: playlist.filter(s => s.youtube_url).length,
      songsWithoutYoutube: playlist.filter(s => !s.youtube_url).length,
      youtubeCacheSongs: youtubeSongs.length
    };


    res.json({
      playlist,
      pendingSongs,
      users,
      currentSong,
      youtubeSongs,
      stats
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

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
        
        // Check if song is already in YouTube cache
        const existingCache = findYouTubeSong(song.artist, song.title, cleanedUrl);
        if (existingCache) {
          console.log(`✅ Song already in YouTube cache: ${song.artist} - ${song.title}`);
          await Song.updateDownloadStatus(songId, 'cached');
        } else {
          // Try to download YouTube video
          const downloadResult = await downloadYouTubeVideo(youtubeUrl, song.artist, song.title);
          
          if (downloadResult.success) {
            console.log(`✅ YouTube video downloaded successfully: ${downloadResult.folderName}`);
            await Song.updateDownloadStatus(songId, 'downloaded');
            
            // Add to invisible songs list
            try {
              await new Promise((resolve, reject) => {
                db.run(
                  'INSERT OR IGNORE INTO invisible_songs (artist, title) VALUES (?, ?)',
                  [song.artist, song.title],
                  function(err) {
                    if (err) reject(err);
                    else resolve();
                  }
                );
              });
              console.log(`📝 Added to invisible songs: ${song.artist} - ${song.title}`);
            } catch (error) {
              console.error('Error adding to invisible songs:', error);
            }
          } else {
            console.log(`⚠️ YouTube download failed: ${downloadResult.error}`);
            await Song.updateDownloadStatus(songId, 'failed');
          }
        }
      } catch (error) {
        console.error('Error downloading YouTube video from admin update:', error);
        await Song.updateDownloadStatus(songId, 'failed');
        // Don't fail the request if download fails
      }
    } else {
      // No YouTube URL, reset download status
      await Song.updateDownloadStatus(songId, 'none');
    }
    
    res.json({ message: 'YouTube URL updated successfully' });
  } catch (error) {
    console.error('Update YouTube URL error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

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
  body('youtubeUrl').optional().isURL()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { songId } = req.params;
    const { title, artist, youtubeUrl } = req.body;

    const song = await Song.getById(songId);
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    // Clean the YouTube URL before saving
    const cleanedUrl = cleanYouTubeUrl(youtubeUrl);
    
    // Update song details
    await new Promise((resolve, reject) => {
      const db = require('../config/database');
      db.run(
        'UPDATE songs SET title = ?, artist = ?, youtube_url = ? WHERE id = ?',
        [title, artist || null, cleanedUrl || null, songId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

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
        } else {
          // Try to download YouTube video
          const downloadResult = await downloadYouTubeVideo(youtubeUrl, artist, title);
          
          if (downloadResult.success) {
            console.log(`✅ YouTube video downloaded successfully: ${downloadResult.folderName}`);
            await Song.updateDownloadStatus(songId, 'downloaded');
            
            // Add to invisible songs list
            try {
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
            await Song.updateDownloadStatus(songId, 'failed');
          }
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

    res.json({ message: 'Song updated successfully' });
  } catch (error) {
    console.error('Update song error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.getAll();
    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's songs
router.get('/user/:userId/songs', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const songs = await new Promise((resolve, reject) => {
      const db = require('../config/database');
      db.all(
        'SELECT * FROM songs WHERE user_id = ? ORDER BY position ASC',
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({ songs });
  } catch (error) {
    console.error('Get user songs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Clear all songs (admin only)
router.delete('/clear-all', async (req, res) => {
  try {
    await new Promise((resolve, reject) => {
      const db = require('../config/database');
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

    res.json({ message: 'All songs cleared successfully' });
  } catch (error) {
    console.error('Clear all songs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get system settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await new Promise((resolve, reject) => {
      const db = require('../config/database');
      db.all('SELECT * FROM settings', (err, rows) => {
        if (err) reject(err);
        else {
          const settingsObj = {};
          rows.forEach(row => {
            settingsObj[row.key] = row.value;
          });
          resolve(settingsObj);
        }
      });
    });

    res.json({ settings });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update custom URL setting
router.put('/settings/custom-url', [
  body('customUrl').optional().isString().withMessage('Custom URL muss ein String sein')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { customUrl } = req.body;

    // Store custom URL in settings
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['custom_url', customUrl || ''],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ message: 'Custom URL erfolgreich aktualisiert', customUrl: customUrl || '' });
  } catch (error) {
    console.error('Error updating custom URL:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update overlay title setting
router.put('/settings/overlay-title', [
  body('overlayTitle').optional().isString().withMessage('Overlay Title muss ein String sein')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { overlayTitle } = req.body;

    // Store overlay title in settings
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['overlay_title', overlayTitle || 'Willkommen beim Karaoke'],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ message: 'Overlay Title erfolgreich aktualisiert', overlayTitle: overlayTitle || 'Willkommen beim Karaoke' });
  } catch (error) {
    console.error('Error updating overlay title:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update YouTube enabled setting
router.put('/settings/youtube-enabled', [
  body('youtubeEnabled').isBoolean().withMessage('YouTube Enabled muss ein Boolean sein')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { youtubeEnabled } = req.body;

    // Store YouTube enabled setting in settings
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['youtube_enabled', youtubeEnabled ? 'true' : 'false'],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ message: 'YouTube-Einstellung erfolgreich aktualisiert', youtubeEnabled });
  } catch (error) {
    console.error('Error updating YouTube setting:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


// Update regression value
router.put('/settings/regression', [
  body('value').isFloat({ min: 0, max: 1 }).withMessage('Regression value must be between 0 and 1')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { value } = req.body;
    
    await new Promise((resolve, reject) => {
      const db = require('../config/database');
      db.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['regression_value', value.toString()],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ message: 'Regression value updated successfully' });
  } catch (error) {
    console.error('Update regression value error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// Set QR Code Overlay Status
router.put('/qr-overlay', [
  body('show').isBoolean().withMessage('Show muss ein Boolean sein')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { show } = req.body;

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
      await broadcastQRCodeToggle(io, show);
      await broadcastAdminUpdate(io);
    }

    res.json({ message: 'QR-Code Overlay Status aktualisiert', show });
  } catch (error) {
    console.error('Error setting QR overlay status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin User Management Routes

// Get all admin users
router.get('/admin-users', async (req, res) => {
  try {
    console.log('Fetching admin users...');
    const adminUsers = await new Promise((resolve, reject) => {
      db.all('SELECT id, username, created_at FROM admin_users ORDER BY created_at DESC', (err, rows) => {
        if (err) {
          console.error('Database error:', err);
          reject(err);
        } else {
          console.log('Admin users found:', rows);
          resolve(rows);
        }
      });
    });

    console.log('Sending response:', { adminUsers });
    res.json({ adminUsers });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new admin user
router.post('/admin-users', [
  body('username').notEmpty().trim().withMessage('Benutzername ist erforderlich'),
  body('password').isLength({ min: 6 }).withMessage('Passwort muss mindestens 6 Zeichen lang sein')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    // Check if username already exists
    const existingUser = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM admin_users WHERE username = ?', [username], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Benutzername bereits vergeben' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create admin user
    const result = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO admin_users (username, password_hash) VALUES (?, ?)',
        [username, passwordHash],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });

    res.json({ 
      message: 'Admin-Benutzer erfolgreich erstellt', 
      user: { id: result.id, username } 
    });
  } catch (error) {
    console.error('Error creating admin user:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete admin user
router.delete('/admin-users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id;

    // Prevent deleting own account
    if (parseInt(id) === currentUserId) {
      return res.status(400).json({ message: 'Du kannst deinen eigenen Account nicht löschen' });
    }

    // Check if user exists
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT id, username FROM admin_users WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      return res.status(404).json({ message: 'Admin-Benutzer nicht gefunden' });
    }

    // Delete user
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM admin_users WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ message: `Admin-Benutzer "${user.username}" erfolgreich gelöscht` });
  } catch (error) {
    console.error('Error deleting admin user:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// File Songs Management
const { scanFileSongs, findFileSong } = require('../utils/fileSongs');

// USDB Management
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// Get file songs folder setting
router.get('/settings/file-songs-folder', async (req, res) => {
  try {
    const [folderSetting, portSetting] = await Promise.all([
      new Promise((resolve, reject) => {
        db.get('SELECT value FROM settings WHERE key = ?', ['file_songs_folder'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      }),
      new Promise((resolve, reject) => {
        db.get('SELECT value FROM settings WHERE key = ?', ['file_songs_port'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      })
    ]);

    const folderPath = folderSetting ? folderSetting.value : '';
    const port = portSetting ? parseInt(portSetting.value) : 4000;

    res.json({ 
      folderPath: folderPath,
      port: port,
      fileSongs: folderPath ? scanFileSongs(folderPath) : []
    });
  } catch (error) {
    console.error('Error getting file songs folder:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Set file songs folder setting
router.put('/settings/file-songs-folder', [
  body('folderPath').isString().trim(),
  body('port').optional().isInt({ min: 1000, max: 65535 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { folderPath, port } = req.body;

    // Validate folder exists
    const fs = require('fs');
    if (folderPath && !fs.existsSync(folderPath)) {
      return res.status(400).json({ message: 'Ordner existiert nicht' });
    }

    // Save folder setting
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
        ['file_songs_folder', folderPath],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Save port setting if provided
    if (port) {
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
          ['file_songs_port', port.toString()],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    // Scan files in the folder
    const fileSongs = folderPath ? scanFileSongs(folderPath) : [];

    res.json({ 
      message: 'File songs folder updated successfully',
      fileSongs: fileSongs
    });
  } catch (error) {
    console.error('Error setting file songs folder:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Rescan file songs
router.post('/settings/rescan-file-songs', async (req, res) => {
  try {
    const setting = await new Promise((resolve, reject) => {
      db.get('SELECT value FROM settings WHERE key = ?', ['file_songs_folder'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    const folderPath = setting ? setting.value : '';
    const fileSongs = folderPath ? scanFileSongs(folderPath) : [];

    res.json({ 
      message: 'File songs rescanned successfully',
      fileSongs: fileSongs
    });
  } catch (error) {
    console.error('Error rescanning file songs:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Remove all file songs (like rescan with 0 results)
router.post('/settings/remove-file-songs', async (req, res) => {
  try {
    console.log('🗑️ Removing all file songs from list...');
    
    // Return empty array (like rescan with 0 results)
    res.json({ 
      message: 'All file songs removed from list successfully',
      fileSongs: []
    });
  } catch (error) {
    console.error('Error removing file songs:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Banlist Management
// Get all banned device IDs
router.get('/banlist', async (req, res) => {
  try {
    const bannedDevices = await new Promise((resolve, reject) => {
      db.all(`
        SELECT b.*, au.username as banned_by 
        FROM banlist b 
        LEFT JOIN admin_users au ON b.created_by = au.id 
        ORDER BY b.created_at DESC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({ bannedDevices });
  } catch (error) {
    console.error('Error getting banlist:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add device ID to banlist
router.post('/banlist', [
  body('deviceId').isLength({ min: 3, max: 3 }).withMessage('Device ID muss genau 3 Zeichen lang sein'),
  body('reason').optional().isString().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { deviceId, reason } = req.body;
    const adminId = req.user.id;

    // Check if device is already banned
    const existingBan = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM banlist WHERE device_id = ?', [deviceId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existingBan) {
      return res.status(400).json({ message: 'Device ID ist bereits auf der Banlist' });
    }

    // Add to banlist
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO banlist (device_id, reason, created_by) VALUES (?, ?, ?)',
        [deviceId, reason || null, adminId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ message: 'Device ID erfolgreich zur Banlist hinzugefügt', deviceId });
  } catch (error) {
    console.error('Error adding to banlist:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Remove device ID from banlist
router.delete('/banlist/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;

    if (!deviceId || deviceId.length !== 3) {
      return res.status(400).json({ message: 'Ungültige Device ID' });
    }

    const result = await new Promise((resolve, reject) => {
      db.run('DELETE FROM banlist WHERE device_id = ?', [deviceId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

    if (result === 0) {
      return res.status(404).json({ message: 'Device ID nicht auf der Banlist gefunden' });
    }

    res.json({ message: 'Device ID erfolgreich von der Banlist entfernt', deviceId });
  } catch (error) {
    console.error('Error removing from banlist:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Invisible Songs Management - Get all invisible song combinations
router.get('/invisible-songs', async (req, res) => {
  try {
    const invisibleSongs = await new Promise((resolve, reject) => {
      db.all(`
        SELECT i.*, au.username as hidden_by 
        FROM invisible_songs i 
        LEFT JOIN admin_users au ON i.created_by = au.id 
        ORDER BY i.created_at DESC
      `, (err, rows) => {
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

// Invisible Songs Management - Add song combination to invisible list
router.post('/invisible-songs', [
  body('artist').isString().trim().notEmpty().withMessage('Artist ist erforderlich'),
  body('title').isString().trim().notEmpty().withMessage('Title ist erforderlich')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { artist, title } = req.body;
    const adminId = req.user.id;

    // Check if combination is already invisible
    const existingInvisible = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM invisible_songs WHERE artist = ? AND title = ?', [artist, title], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existingInvisible) {
      return res.status(400).json({ message: 'Song-Kombination ist bereits unsichtbar' });
    }

    // Add to invisible songs
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO invisible_songs (artist, title, created_by) VALUES (?, ?, ?)',
        [artist, title, adminId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ message: 'Song-Kombination erfolgreich unsichtbar gemacht', artist, title });
  } catch (error) {
    console.error('Error adding to invisible songs:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Invisible Songs Management - Remove song combination from invisible list
router.delete('/invisible-songs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await new Promise((resolve, reject) => {
      db.run('DELETE FROM invisible_songs WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

    if (result === 0) {
      return res.status(404).json({ message: 'Unsichtbare Song-Kombination nicht gefunden' });
    }

    res.json({ message: 'Song-Kombination erfolgreich wieder sichtbar gemacht' });
  } catch (error) {
    console.error('Error removing from invisible songs:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Ultrastar Audio Settings Management
router.get('/ultrastar-audio-settings', async (req, res) => {
  try {
    const settings = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM ultrastar_audio_settings', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({ ultrastarAudioSettings: settings });
  } catch (error) {
    console.error('Error fetching ultrastar audio settings:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/ultrastar-audio-settings', [
  body('artist').notEmpty().trim(),
  body('title').notEmpty().trim(),
  body('audioPreference').isIn(['hp2', 'hp5', 'choice'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { artist, title, audioPreference } = req.body;

    await new Promise((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO ultrastar_audio_settings (artist, title, audio_preference, created_by) VALUES (?, ?, ?, ?)',
        [artist, title, audioPreference, req.user.id],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    res.json({ message: 'Ultrastar Audio-Einstellung erfolgreich gespeichert' });
  } catch (error) {
    console.error('Error setting ultrastar audio setting:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/ultrastar-audio-settings', [
  body('artist').notEmpty().trim(),
  body('title').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { artist, title } = req.body;

    await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM ultrastar_audio_settings WHERE artist = ? AND title = ?',
        [artist, title],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });

    res.json({ message: 'Ultrastar Audio-Einstellung erfolgreich entfernt' });
  } catch (error) {
    console.error('Error removing ultrastar audio setting:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// USDB Credentials Management
// Get USDB credentials
router.get('/usdb-credentials', async (req, res) => {
  try {
    const credentials = await new Promise((resolve, reject) => {
      db.get('SELECT username, password FROM usdb_credentials ORDER BY created_at DESC LIMIT 1', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

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

    const { usdbUrl } = req.body;

    // Get USDB credentials
    const credentials = await new Promise((resolve, reject) => {
      db.get('SELECT username, password FROM usdb_credentials ORDER BY created_at DESC LIMIT 1', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!credentials) {
      return res.status(400).json({ message: 'Keine USDB-Zugangsdaten gefunden. Bitte zuerst in den Einstellungen eingeben.' });
    }

    // Extract song ID from URL
    const songIdMatch = usdbUrl.match(/id=(\d+)/);
    if (!songIdMatch) {
      return res.status(400).json({ message: 'Ungültige USDB-URL. Song-ID konnte nicht extrahiert werden.' });
    }

    const songId = songIdMatch[1];

    // Call Python AI service for USDB download
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:6000';
    
    try {
      const response = await axios.post(`${aiServiceUrl}/usdb/download`, {
        songId: songId,
        username: credentials.username,
        password: credentials.password
      }, {
        timeout: 300000 // 5 minutes timeout for download
      });

      if (response.data.success) {
        // Add song to database
        const songData = response.data.song_info;
        const folderName = response.data.folder_name;
        
        // Insert song into database using the Song model
        const Song = require('../models/Song');
        await Song.createFromUSDB(
          songData.artist || 'Unknown', 
          songData.title || 'Unknown', 
          folderName, 
          'USDB'
        );

        // Prepare success message with audio separation and video remux info
        let message = 'Song erfolgreich von USDB heruntergeladen';
        if (response.data.audio_separation && response.data.audio_separation.status !== 'failed') {
          message += ' und Audio-Separation abgeschlossen';
        } else if (response.data.audio_separation && response.data.audio_separation.status === 'failed') {
          message += ' (Audio-Separation fehlgeschlagen)';
        }
        
        if (response.data.video_remux && response.data.video_remux.status === 'success') {
          message += ' und Audio aus Video entfernt';
        } else if (response.data.video_remux && response.data.video_remux.status === 'failed') {
          message += ' (Video-Remux fehlgeschlagen)';
        }

        res.json({
          message: message,
          song: {
            id: songId,
            artist: songData.artist,
            title: songData.title,
            folder_name: folderName,
            source: 'USDB'
          },
          files: response.data.files,
          audio_separation: response.data.audio_separation,
          video_remux: response.data.video_remux
        });
      } else {
        res.status(500).json({ message: 'Download fehlgeschlagen', error: response.data.error });
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
  body('query').notEmpty().trim().withMessage('Suchbegriff ist erforderlich'),
  body('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit muss zwischen 1 und 100 liegen')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { query, limit = 20 } = req.body;

    // Call Python AI service for USDB search
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:6000';
    
    try {
      const response = await axios.post(`${aiServiceUrl}/usdb/search`, {
        query: query,
        limit: limit
      }, {
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

    // Check for songs in priority order: file > server_video > ultrastar > youtube
    // First check file songs (highest priority)
    const db = require('../config/database');
    const fileFolderSetting = await new Promise((resolve, reject) => {
      db.get('SELECT value FROM settings WHERE key = ?', ['file_songs_folder'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (fileFolderSetting && fileFolderSetting.value) {
      console.log(`🔍 Searching for file song: "${artist}" - "${title}"`);
      const fileSong = findFileSong(fileFolderSetting.value, artist, title);
      if (fileSong) {
        newMode = 'file';
        newYoutubeUrl = fileSong.filename;
        updated = true;
        console.log(`🔄 Song classification updated: ${artist} - ${title} -> file (${fileSong.filename})`);
      } else {
        console.log(`❌ No file song found for: ${artist} - ${title}`);
      }
    }
    
    // If no file song found, check server videos
    if (!updated) {
      console.log(`🔍 Searching for server video: "${artist}" - "${title}"`);
      const { findLocalVideo } = require('../utils/localVideos');
      const localVideo = findLocalVideo(artist, title);
      if (localVideo) {
        newMode = 'server_video';
        newYoutubeUrl = `/api/videos/${encodeURIComponent(localVideo.filename)}`;
        updated = true;
        console.log(`🔄 Song classification updated: ${artist} - ${title} -> server_video (${localVideo.filename}) -> URL: ${newYoutubeUrl}`);
      } else {
        console.log(`❌ No server video found for: ${artist} - ${title}`);
      }
    }
    
    // Fix existing server_video URLs that might be missing file extension
    if (!updated && song.mode === 'server_video' && song.youtube_url && !song.youtube_url.includes('.')) {
      const { findLocalVideo } = require('../utils/localVideos');
      const localVideo = findLocalVideo(artist, title);
      if (localVideo) {
        newMode = 'server_video';
        newYoutubeUrl = `/api/videos/${encodeURIComponent(localVideo.filename)}`;
        updated = true;
        console.log(`🔧 Fixed existing server video URL: ${artist} - ${title} -> ${newYoutubeUrl}`);
      }
    }
    
    // If no server video found, check ultrastar songs
    if (!updated) {
      const { findUltrastarSong } = require('../utils/ultrastarSongs');
      console.log(`🔍 Searching for ultrastar song: "${artist}" - "${title}"`);
      const ultrastarSong = findUltrastarSong(artist, title);
      if (ultrastarSong) {
        newMode = 'ultrastar';
        newYoutubeUrl = `/api/ultrastar/${encodeURIComponent(ultrastarSong.folderName)}`;
        updated = true;
        console.log(`🔄 Song classification updated: ${artist} - ${title} -> ultrastar (${ultrastarSong.folderName})`);
      } else {
        console.log(`❌ No ultrastar song found for: ${artist} - ${title}`);
      }
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

// Helper function to start audio separation
function startAudioSeparation(songDir, songName) {
  try {
    console.log(`[USDB] Starting audio separation for: ${songName}`);
    console.log(`[USDB] Song directory: ${songDir}`);
    
    const { spawn } = require('child_process');
    const pythonPath = path.join(__dirname, '..', 'ai-services', 'venv', 'Scripts', 'python.exe');
    const appPath = path.join(__dirname, '..', 'ai-services', 'app.py');
    
    console.log(`[USDB] Python path: ${pythonPath}`);
    console.log(`[USDB] App path: ${appPath}`);
    
    const audioSeparation = spawn(pythonPath, [appPath, songDir, songName]);
    
    audioSeparation.on('close', (code) => {
      console.log(`[USDB] Audio separation completed with code: ${code}`);
    });
    
    audioSeparation.on('error', (error) => {
      console.error('[USDB] Audio separation error:', error);
    });
    
    audioSeparation.stdout.on('data', (data) => {
      console.log(`[USDB] Audio separation stdout: ${data}`);
    });
    
    audioSeparation.stderr.on('data', (data) => {
      console.error(`[USDB] Audio separation stderr: ${data}`);
    });
  } catch (error) {
    console.error('[USDB] Error starting audio separation:', error);
  }
}

// Helper function to insert test song before current song
async function insertTestSongBeforeCurrent(testSongId) {
  const db = require('../config/database');
  
  // Get current song position
  const currentSong = await Song.getCurrentSong();
  let insertPosition = 1; // Default to beginning if no current song
  
  if (currentSong) {
    insertPosition = currentSong.position;
  }
  
  // Shift all songs at and after insert position to make room
  await new Promise((resolve, reject) => {
    db.run(
      'UPDATE songs SET position = position + 1 WHERE position >= ?',
      [insertPosition],
      function(err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
  
  // Set test song position
  await new Promise((resolve, reject) => {
    db.run(
      'UPDATE songs SET position = ? WHERE id = ?',
      [insertPosition, testSongId],
      function(err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

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

// Test a song - start it immediately as current song with admin as singer
router.post('/song/test', async (req, res) => {
  try {
    const { artist, title, mode, youtubeUrl } = req.body;
    const adminUsername = req.user.username; // Get admin username from JWT token
    
    if (!artist || !title) {
      return res.status(400).json({ message: 'Artist and title are required' });
    }

    // Store the current song ID to restore later
    const currentSong = await Song.getCurrentSong();
    const originalCurrentSongId = currentSong ? currentSong.id : null;
    
    // Store original song ID in settings for restoration
    if (originalCurrentSongId) {
      await new Promise((resolve, reject) => {
        const db = require('../config/database');
        db.run(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          ['test_mode_original_song_id', originalCurrentSongId.toString()],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    } else {
      // Clear the setting if no original song
      await new Promise((resolve, reject) => {
        const db = require('../config/database');
        db.run(
          'DELETE FROM settings WHERE key = ?',
          ['test_mode_original_song_id'],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    // Create a temporary test user for the admin
    const testUser = await new Promise((resolve, reject) => {
      const db = require('../config/database');
      db.run(
        'INSERT INTO users (device_id, name) VALUES (?, ?)',
        ['TEST', adminUsername],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });

    // Clean up any existing test songs first (before creating new one)
    await cleanupTestSongs();

    // Determine the correct mode and URL for the test song
    let finalMode = mode || 'youtube';
    let finalYoutubeUrl = youtubeUrl;
    
    // Check for songs in priority order: file > server_video > ultrastar > youtube
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
        const { findFileSong } = require('../utils/fileSongs');
        const fileSong = findFileSong(fileFolderSetting.value, artist, title);
        if (fileSong) {
          finalMode = 'file';
          finalYoutubeUrl = fileSong.filename;
          console.log(`🎵 Test song classified as file: ${fileSong.filename}`);
        }
      }
      
      // If no file song found, check server videos
      if (finalMode === 'youtube') {
        const { findLocalVideo } = require('../utils/localVideos');
        const localVideo = findLocalVideo(artist, title);
        if (localVideo) {
          finalMode = 'server_video';
          finalYoutubeUrl = `/api/videos/${encodeURIComponent(localVideo.filename)}`;
          console.log(`🎬 Test song classified as server_video: ${localVideo.filename}`);
        }
      }
      
      // If no server video found, check ultrastar songs
      if (finalMode === 'youtube') {
        const { findUltrastarSong } = require('../utils/ultrastarSongs');
        const ultrastarSong = findUltrastarSong(artist, title);
        if (ultrastarSong) {
          finalMode = 'ultrastar';
          finalYoutubeUrl = `/api/ultrastar/${encodeURIComponent(ultrastarSong.folderName)}`;
          console.log(`🎤 Test song classified as ultrastar: ${ultrastarSong.folderName}`);
        }
      }
    } else {
      // If youtubeUrl is provided, fix server_video URLs that might be missing file extension
      if (mode === 'server_video' && youtubeUrl && !youtubeUrl.includes('.')) {
        const { findLocalVideo } = require('../utils/localVideos');
        const localVideo = findLocalVideo(artist, title);
        if (localVideo) {
          finalYoutubeUrl = `/api/videos/${encodeURIComponent(localVideo.filename)}`;
          console.log(`🔧 Fixed server_video URL for test song: ${youtubeUrl} -> ${finalYoutubeUrl}`);
        }
      }
    }

    // Create a temporary test song in the database
    const testSong = await Song.create(
      testUser.id, // Use the test user ID
      title,
      artist,
      finalYoutubeUrl || null,
      1.0, // Priority
      null, // Duration
      finalMode,
      false // withBackgroundVocals
    );

    // Insert test song before current song instead of at the end
    await insertTestSongBeforeCurrent(testSong.id);

    // Set the test song as current song
    await Song.setCurrentSong(testSong.id);

    // Broadcast song change via WebSocket
    const io = req.app.get('io');
    if (io) {
      await broadcastSongChange(io, testSong);
      await broadcastAdminUpdate(io);
      await broadcastPlaylistUpdate(io);
    }

    console.log(`🎤 Test song started: ${artist} - ${title} (Admin: ${adminUsername})`);
    
    res.json({ 
      message: 'Test-Song erfolgreich gestartet',
      song: {
        id: testSong.id,
        title: title,
        artist: artist,
        user_name: adminUsername
      }
    });
  } catch (error) {
    console.error('Test song error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Restore original song after test
router.post('/restore-original-song', async (req, res) => {
  try {
    // First, delete the current test song and test user if they exist
    const currentSong = await Song.getCurrentSong();
    if (currentSong) {
      // Check if this is a test song by looking at the user
      const user = await new Promise((resolve, reject) => {
        const db = require('../config/database');
        db.get(
          'SELECT * FROM users WHERE id = ?',
          [currentSong.user_id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
      
      if (user && user.device_id === 'TEST') {
        // This is a test song, delete both song and user
        await new Promise((resolve, reject) => {
          const db = require('../config/database');
          db.run(
            'DELETE FROM songs WHERE id = ?',
            [currentSong.id],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
        
        await new Promise((resolve, reject) => {
          const db = require('../config/database');
          db.run(
            'DELETE FROM users WHERE id = ?',
            [currentSong.user_id],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
        
        console.log(`🎤 Deleted test song and user: ${currentSong.id}`);
      }
    }
    
    const originalSongId = await Song.restoreOriginalSong();
    
    if (originalSongId) {
      console.log(`🎤 Restored original song: ${originalSongId}`);
      res.json({ 
        message: 'Ursprünglicher Song erfolgreich wiederhergestellt',
        originalSongId 
      });
    } else {
      console.log(`🎤 No original song to restore`);
      res.json({ 
        message: 'Kein ursprünglicher Song zu wiederherstellen',
        originalSongId: null 
      });
    }
  } catch (error) {
    console.error('Restore original song error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Rename YouTube Cache Song
router.post('/youtube-cache/rename', [
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

    // Validate that the old song exists in YouTube cache
    const youtubeSongs = scanYouTubeSongs();
    const oldSong = youtubeSongs.find(song => 
      song.artist.toLowerCase() === oldArtist.toLowerCase() &&
      song.title.toLowerCase() === oldTitle.toLowerCase()
    );

    if (!oldSong) {
      return res.status(404).json({ 
        message: 'YouTube-Cache-Song nicht gefunden',
        success: false
      });
    }

    // Check if new name already exists
    const existingSong = youtubeSongs.find(song => 
      song.artist.toLowerCase() === newArtist.toLowerCase() &&
      song.title.toLowerCase() === newTitle.toLowerCase()
    );

    if (existingSong) {
      return res.status(400).json({ 
        message: 'Ein Song mit diesem Namen existiert bereits',
        success: false
      });
    }

    // Construct paths
    const youtubeDir = path.join(__dirname, '..', 'songs', 'youtube');
    const oldFolderName = `${oldArtist} - ${oldTitle}`;
    const newFolderName = `${newArtist} - ${newTitle}`;
    const oldPath = path.join(youtubeDir, oldFolderName);
    const newPath = path.join(youtubeDir, newFolderName);

    // Check if old folder exists
    if (!fs.existsSync(oldPath)) {
      return res.status(404).json({ 
        message: 'YouTube-Cache-Ordner nicht gefunden',
        success: false
      });
    }

    // Check if new folder already exists
    if (fs.existsSync(newPath)) {
      return res.status(400).json({ 
        message: 'Ein Ordner mit diesem Namen existiert bereits',
        success: false
      });
    }

    // Rename the folder
    fs.renameSync(oldPath, newPath);
    console.log(`📁 Renamed YouTube cache folder: "${oldFolderName}" → "${newFolderName}"`);

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
      newName: `${newArtist} - ${newTitle}`
    });

  } catch (error) {
    console.error('Rename YouTube cache song error:', error);
    res.status(500).json({ 
      message: 'Server-Fehler beim Umbenennen des Songs', 
      error: error.message,
      success: false
    });
  }
});

module.exports = router;