const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../../config/database');
// const { generateQRCodeDataUrl } = require('../../utils/qrCodeGenerator');
const { scanFileSongs } = require('../../utils/fileSongs');
const fs = require('fs');

// Get system settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await new Promise((resolve, reject) => {
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

    // Generate new QR code with updated URL
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('host');
    const fallbackUrl = `${protocol}://${host}/new`;
    
    // Use centralized QR code generation function
    const { generateQRCodeDataUrl } = require('../../utils/qrCodeGenerator');
    const qrCodeDataUrl = await generateQRCodeDataUrl(customUrl, fallbackUrl);

    // Broadcast QR code update via WebSocket
    const io = req.app.get('io');
    if (io) {
      io.emit('qr-code-update', {
        qrCodeDataUrl: qrCodeDataUrl,
        qrUrl: customUrl,
        timestamp: new Date().toISOString()
      });
    }

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

// Update Auto-Approve Songs setting
router.put('/settings/auto-approve-songs', [
  body('autoApproveSongs').isBoolean().withMessage('Auto-Approve Songs muss ein Boolean sein')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { autoApproveSongs } = req.body;

    // Store Auto-Approve Songs setting in settings
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['auto_approve_songs', autoApproveSongs ? 'true' : 'false'],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ message: 'Auto-Approve Einstellung erfolgreich aktualisiert', autoApproveSongs });
  } catch (error) {
    console.error('Error updating auto-approve songs setting:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update USDB Search Enabled setting
router.put('/settings/usdb-search-enabled', [
  body('usdbSearchEnabled').isBoolean().withMessage('USDB Search Enabled muss ein Boolean sein')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { usdbSearchEnabled } = req.body;

    // Store USDB Search Enabled setting in settings
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['usdb_search_enabled', usdbSearchEnabled ? 'true' : 'false'],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ message: 'USDB-Suche Einstellung erfolgreich aktualisiert', usdbSearchEnabled });
  } catch (error) {
    console.error('Error updating USDB search enabled setting:', error);
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

module.exports = router;
