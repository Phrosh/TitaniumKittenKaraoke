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

// Get YouTube enabled setting (public)
router.get('/youtube-enabled', async (req, res) => {
  try {
    const db = require('../config/database');
    const youtubeSetting = await new Promise((resolve, reject) => {
      db.get('SELECT value FROM settings WHERE key = ?', ['youtube_enabled'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    const youtubeEnabled = youtubeSetting ? youtubeSetting.value === 'true' : true; // Default to true if not set
    
    res.json({ 
      settings: { 
        youtube_enabled: youtubeEnabled.toString() 
      } 
    });
  } catch (error) {
    console.error('Error getting YouTube setting:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get file songs (public)
router.get('/file-songs', async (req, res) => {
  try {
    const db = require('../config/database');
    
    // Get file songs folder and port from settings
    const folderSetting = await new Promise((resolve, reject) => {
      db.get('SELECT value FROM settings WHERE key = ?', ['file_songs_folder'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    const portSetting = await new Promise((resolve, reject) => {
      db.get('SELECT value FROM settings WHERE key = ?', ['file_songs_port'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    const folderPath = folderSetting ? folderSetting.value : '';
    const port = portSetting ? parseInt(portSetting.value) : 4000;
    
    if (!folderPath) {
      return res.json({ fileSongs: [] });
    }
    
    // Scan the folder for video files
    const { scanFileSongs } = require('../utils/fileSongs');
    const fileSongs = await scanFileSongs(folderPath);
    
    res.json({ 
      fileSongs: fileSongs.map(song => ({
        ...song,
        port: port
      }))
    });
  } catch (error) {
    console.error('Error getting file songs:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

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

    // Check for songs in priority order: file > server_video > ultrastar > youtube
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
      
      // If no file song found, check server videos
      if (mode === 'youtube') {
        const localVideo = findLocalVideo(artist, title);
        if (localVideo) {
          mode = 'server_video';
          youtubeUrl = `/api/videos/${encodeURIComponent(localVideo.filename)}`;
          console.log(`Found server video: ${localVideo.filename}`);
        }
      }
      
      // If no server video found, check ultrastar songs
      if (mode === 'youtube') {
        const { findUltrastarSong } = require('../utils/ultrastarSongs');
        const ultrastarSong = findUltrastarSong(artist, title);
        if (ultrastarSong) {
          mode = 'ultrastar';
          youtubeUrl = `/api/ultrastar/${encodeURIComponent(ultrastarSong.folderName)}`;
          console.log(`Found ultrastar song: ${ultrastarSong.folderName}`);
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
router.get('/server-videos', (req, res) => {
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

// Get list of ultrastar songs for song selection
router.get('/ultrastar-songs', (req, res) => {
  try {
    const { search } = req.query;
    const { scanUltrastarSongs, searchUltrastarSongs } = require('../utils/ultrastarSongs');
    
    let songs;
    if (search && search.trim()) {
      songs = searchUltrastarSongs(search.trim());
    } else {
      songs = scanUltrastarSongs();
    }
    
    res.json({ songs });
  } catch (error) {
    console.error('Error getting ultrastar songs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get ultrastar song data (parsed .txt file) - MUST be before /:filename route
router.get('/ultrastar/:folderName/data', (req, res) => {
  try {
    const { folderName } = req.params;
    const { ULTRASTAR_DIR } = require('../utils/ultrastarSongs');
    const { parseUltrastarFile, findAudioFile } = require('../utils/ultrastarParser');
    
    const folderPath = path.join(ULTRASTAR_DIR, decodeURIComponent(folderName));
    
    console.log('🔍 Ultrastar data request:', {
      folderName: folderName,
      decodedFolderName: decodeURIComponent(folderName),
      folderPath: folderPath,
      exists: fs.existsSync(folderPath)
    });
    
    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ message: 'Ultrastar folder not found', folderPath });
    }
    
    // Find .txt file
    const files = fs.readdirSync(folderPath);
    const txtFile = files.find(file => file.toLowerCase().endsWith('.txt'));
    
    if (!txtFile) {
      return res.status(404).json({ message: 'Ultrastar .txt file not found' });
    }
    
    const txtPath = path.join(folderPath, txtFile);
    const songData = parseUltrastarFile(txtPath);
    
    if (!songData) {
      return res.status(500).json({ message: 'Error parsing Ultrastar file' });
    }
    
    // Find audio file
    const audioFile = findAudioFile(folderPath);
    if (audioFile) {
      const audioFilename = path.basename(audioFile);
      songData.audioUrl = `/api/songs/ultrastar/${encodeURIComponent(folderName)}/${encodeURIComponent(audioFilename)}`;
    }
    
    res.json({ songData });
  } catch (error) {
    console.error('Error getting ultrastar song data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Serve ultrastar song files (audio, video, cover, txt)
router.get('/ultrastar/:folderName/:filename', (req, res) => {
  try {
    const { folderName, filename } = req.params;
    const { ULTRASTAR_DIR } = require('../utils/ultrastarSongs');
    
    const folderPath = path.join(ULTRASTAR_DIR, decodeURIComponent(folderName));
    const filePath = path.join(folderPath, decodeURIComponent(filename));
    
    // Security check - ensure file is within ultrastar directory
    if (!filePath.startsWith(ULTRASTAR_DIR)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    // Set appropriate content type
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (ext) {
      case '.mp3':
        contentType = 'audio/mpeg';
        break;
      case '.flac':
        contentType = 'audio/flac';
        break;
      case '.wav':
        contentType = 'audio/wav';
        break;
      case '.ogg':
        contentType = 'audio/ogg';
        break;
      case '.m4a':
        contentType = 'audio/mp4';
        break;
      case '.aac':
        contentType = 'audio/aac';
        break;
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.txt':
        contentType = 'text/plain';
        break;
      case '.avi':
      case '.mp4':
      case '.mkv':
        contentType = 'video/mp4';
        break;
    }
    
    res.setHeader('Content-Type', contentType);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving ultrastar file:', error);
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

// Public endpoint to get invisible songs (for filtering in /new)
router.get('/invisible-songs', async (req, res) => {
  try {
    const db = require('../config/database');
    const invisibleSongs = await new Promise((resolve, reject) => {
      db.all('SELECT artist, title FROM invisible_songs', (err, rows) => {
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

module.exports = router;