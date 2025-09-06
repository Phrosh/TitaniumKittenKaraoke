const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Song = require('../models/Song');
const PlaylistAlgorithm = require('../utils/playlistAlgorithm');
const YouTubeMetadataService = require('../utils/youtubeMetadata');
const { generateQRCodeForNew } = require('../utils/qrCodeGenerator');
const { findLocalVideo, VIDEOS_DIR } = require('../utils/localVideos');
const { findFileSong } = require('../utils/fileSongs');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Submit new song request
router.post('/request', [
  body('name').notEmpty().trim().isLength({ min: 1, max: 100 }),
  body('songInput').notEmpty().trim().isLength({ min: 1, max: 500 }),
  body('deviceId').optional().isLength({ min: 3, max: 3 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, songInput, deviceId } = req.body;

    // Check if YouTube is enabled
    const db = require('../config/database');
    const youtubeSetting = await new Promise((resolve, reject) => {
      db.get('SELECT value FROM settings WHERE key = ?', ['youtube_enabled'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    const youtubeEnabled = youtubeSetting ? youtubeSetting.value === 'true' : true; // Default to true if not set

    // Check if device ID is banned
    const banCheck = await new Promise((resolve, reject) => {
      db.get('SELECT device_id FROM banlist WHERE device_id = ?', [deviceId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (banCheck) {
      // Device is banned - return success response but don't actually add the song
      console.log(`🚫 Song request blocked due to banlist - Device ID: ${deviceId}, Song: ${songInput}, User: ${name}`);
      
      // Return fake success response to user
      return res.json({
        success: true,
        song: {
          id: 0, // Fake ID
          title: songInput.includes(' - ') ? songInput.split(' - ')[1] : songInput,
          artist: songInput.includes(' - ') ? songInput.split(' - ')[0] : 'Unknown',
          position: 0
        },
        message: 'Song wurde erfolgreich zur Playlist hinzugefügt!'
      });
    }

    // Parse song input (could be "Artist - Title" or YouTube URL)
    let title, artist, youtubeUrl = null;
    
    if (songInput.includes('youtube.com') || songInput.includes('youtu.be')) {
      // Check if YouTube is enabled
      if (!youtubeEnabled) {
        return res.status(400).json({ 
          error: 'YouTube-Links sind derzeit nicht erlaubt. Bitte wähle einen Song aus der lokalen Songliste.' 
        });
      }
      
      // It's a YouTube URL - try to extract metadata
      youtubeUrl = songInput;
      
      try {
        const metadata = await YouTubeMetadataService.getMetadata(youtubeUrl);
        title = metadata.title;
        artist = metadata.artist || 'Unknown Artist';
      } catch (error) {
        console.error('Failed to extract YouTube metadata:', error.message);
        // Fallback to generic values
        title = 'YouTube Song';
        artist = 'Unknown Artist';
      }
    } else if (songInput.includes(' - ')) {
      // It's "Artist - Title" format
      const parts = songInput.split(' - ');
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    } else {
      // Treat as title only
      title = songInput;
      artist = 'Unknown Artist';
    }

    // Always create a new user for each song request
    // Device ID is only used as additional information
    const user = await User.create(name, deviceId);

    // Check for songs in priority order: file > local_video > youtube
    let mode = 'youtube';
    let durationSeconds = null;
    
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
        const fileSong = findFileSong(fileFolderSetting.value, artist, title);
        if (fileSong) {
          mode = 'file';
          // Store only the filename, URL will be built dynamically in /show
          youtubeUrl = fileSong.filename;
          console.log(`Found file song: ${fileSong.filename}`);
        }
      }
      
      // If no file song found, check local videos
      if (mode === 'youtube') {
        const localVideo = findLocalVideo(artist, title);
        if (localVideo) {
          mode = 'local_video';
          youtubeUrl = `/api/videos/${encodeURIComponent(localVideo.filename)}`;
          console.log(`Found local video: ${localVideo.filename}`);
        }
      }
    }

    // Get duration if it's a YouTube URL
    if (mode === 'youtube' && youtubeUrl && (songInput.includes('youtube.com') || songInput.includes('youtu.be'))) {
      try {
        const metadata = await YouTubeMetadataService.getMetadata(youtubeUrl);
        durationSeconds = metadata.duration_seconds;
      } catch (error) {
        console.error('Failed to get duration:', error.message);
      }
    }

    // Create song with priority, duration and mode
    const song = await Song.create(user.id, title, artist, youtubeUrl, 1, durationSeconds, mode);
    
    // Insert into playlist using algorithm
    const position = await PlaylistAlgorithm.insertSong(song.id);

    res.json({
      success: true,
      song: {
        id: song.id,
        title,
        artist,
        youtubeUrl,
        position,
        deviceId: user.device_id
      },
      user: {
        id: user.id,
        name: user.name,
        deviceId: user.device_id
      }
    });
  } catch (error) {
    console.error('Song request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current playlist (public endpoint)
router.get('/playlist', async (req, res) => {
  try {
    const playlist = await Song.getAll();
    const currentSong = await Song.getCurrentSong();
    
    res.json({
      playlist,
      currentSong,
      total: playlist.length
    });
  } catch (error) {
    console.error('Get playlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get pending songs (songs without YouTube URLs)
router.get('/pending', async (req, res) => {
  try {
    const pendingSongs = await Song.getPending();
    res.json({ pendingSongs });
  } catch (error) {
    console.error('Get pending songs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Generate QR code data
router.get('/qr-data', async (req, res) => {
  try {
    // Get custom URL from settings
    const db = require('../config/database');
    const customUrlSetting = await new Promise((resolve, reject) => {
      db.get(
        'SELECT value FROM settings WHERE key = ?',
        ['custom_url'],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    const customUrl = customUrlSetting ? customUrlSetting.value : '';
    
    let qrUrl;
    if (customUrl && customUrl.trim()) {
      // Use custom URL + /new
      qrUrl = customUrl.trim().replace(/\/$/, '') + '/new';
    } else {
      // Use same domain for QR code generation
      const protocol = req.get('x-forwarded-proto') || req.protocol;
      const host = req.get('host');
      qrUrl = `${protocol}://${host}/new`;
    }


    // Generate QR code data URL using local library
    const QRCode = require('qrcode');
    const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 300
    });
    

    const qrData = {
      url: qrUrl,
      qrCodeDataUrl: qrCodeDataUrl,
      timestamp: new Date().toISOString()
    };
    
    res.json(qrData);
  } catch (error) {
    console.error('Error generating QR data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// Get list of local videos for song selection
router.get('/local-videos', (req, res) => {
  try {
    const { search } = req.query;
    const { scanLocalVideos, searchLocalVideos } = require('../utils/localVideos');
    
    let videos;
    if (search && search.trim()) {
      videos = searchLocalVideos(search.trim());
    } else {
      videos = scanLocalVideos();
    }
    
    res.json({ videos });
  } catch (error) {
    console.error('Error getting local videos:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Public route to toggle QR overlay (for automatic overlay when videos end)
router.put('/qr-overlay', [
  body('show').isBoolean().withMessage('Show muss ein Boolean sein')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { show } = req.body;
    const db = require('../config/database');

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

    res.json({ message: 'QR Overlay Status erfolgreich aktualisiert', show });
  } catch (error) {
    console.error('Error updating QR overlay status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;