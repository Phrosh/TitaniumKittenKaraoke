const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Song = require('../models/Song');
const PlaylistAlgorithm = require('../utils/playlistAlgorithm');
const YouTubeMetadataService = require('../utils/youtubeMetadata');

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

    // Parse song input (could be "Artist - Title" or YouTube URL)
    let title, artist, youtubeUrl = null;
    
    if (songInput.includes('youtube.com') || songInput.includes('youtu.be')) {
      // It's a YouTube URL - try to extract metadata
      youtubeUrl = songInput;
      
      try {
        console.log('Extracting YouTube metadata for:', youtubeUrl);
        const metadata = await YouTubeMetadataService.getMetadata(youtubeUrl);
        title = metadata.title;
        artist = metadata.artist || 'Unknown Artist';
        console.log('Extracted metadata:', { 
          title, 
          artist, 
          duration: metadata.duration_seconds,
          durationFormatted: metadata.duration_seconds ? `${Math.floor(metadata.duration_seconds / 60)}:${(metadata.duration_seconds % 60).toString().padStart(2, '0')}` : 'N/A'
        });
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

    // Get duration if it's a YouTube URL
    let durationSeconds = null;
    if (youtubeUrl && (songInput.includes('youtube.com') || songInput.includes('youtu.be'))) {
      try {
        const metadata = await YouTubeMetadataService.getMetadata(youtubeUrl);
        durationSeconds = metadata.duration_seconds;
        console.log('Duration extracted for database:', { 
          durationSeconds, 
          formatted: durationSeconds ? `${Math.floor(durationSeconds / 60)}:${(durationSeconds % 60).toString().padStart(2, '0')}` : 'N/A' 
        });
      } catch (error) {
        console.error('Failed to get duration:', error.message);
      }
    }

    // Create song with priority and duration
    console.log('Creating song with data:', { 
      userId: user.id, 
      title, 
      artist, 
      youtubeUrl, 
      priority: 1, 
      durationSeconds 
    });
    const song = await Song.create(user.id, title, artist, youtubeUrl, 1, durationSeconds);
    console.log('Song created:', { 
      id: song.id, 
      duration_seconds: song.duration_seconds 
    });
    
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
router.get('/qr-data', (req, res) => {
  const baseUrl = req.protocol + '://' + req.get('host');
  const qrData = {
    url: `${baseUrl}/new`,
    timestamp: new Date().toISOString()
  };
  
  res.json(qrData);
});

module.exports = router;