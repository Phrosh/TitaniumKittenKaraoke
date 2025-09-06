const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const Song = require('../models/Song');
const User = require('../models/User');
const { verifyToken } = require('./auth');
const db = require('../config/database');

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
    
    // Statistics
    const stats = {
      totalSongs: playlist.length,
      pendingSongs: pendingSongs.length,
      totalUsers: users.length,
      songsWithYoutube: playlist.filter(s => s.youtube_url).length,
      songsWithoutYoutube: playlist.filter(s => !s.youtube_url).length
    };


    res.json({
      playlist,
      pendingSongs,
      users,
      currentSong,
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

    await Song.updateYoutubeUrl(songId, youtubeUrl);
    
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

    // Update song details
    await new Promise((resolve, reject) => {
      const db = require('../config/database');
      db.run(
        'UPDATE songs SET title = ?, artist = ?, youtube_url = ? WHERE id = ?',
        [title, artist || null, youtubeUrl || null, songId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

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

module.exports = router;