const express = require('express');
const router = express.Router();

// Get file songs (public)
router.get('/file-songs', async (req, res) => {
  try {
    const db = require('../../config/database');
    
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
    const { scanFileSongs } = require('../../utils/fileSongs');
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

// Get list of local videos for song selection
router.get('/server-videos', (req, res) => {
  try {
    const { search } = req.query;
    const { scanLocalVideos, searchLocalVideos } = require('../../utils/localVideos');
    
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
    const { scanUltrastarSongs, searchUltrastarSongs } = require('../../utils/ultrastarSongs');
    
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

// Get list of YouTube songs for song selection
router.get('/youtube-songs', (req, res) => {
  try {
    const { search } = req.query;
    const { scanYouTubeSongs, searchYouTubeSongs } = require('../../utils/youtubeSongs');
    
    let songs;
    if (search && search.trim()) {
      songs = searchYouTubeSongs(search.trim());
    } else {
      songs = scanYouTubeSongs();
    }
    
    res.json({ youtubeSongs: songs });
  } catch (error) {
    console.error('Error getting YouTube songs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get list of magic songs for song selection
router.get('/magic-songs', (req, res) => {
  try {
    const { search } = req.query;
    const { scanMagicSongs, searchMagicSongs } = require('../../utils/magicSongs');
    
    let songs;
    if (search && search.trim()) {
      songs = searchMagicSongs(search.trim());
    } else {
      songs = scanMagicSongs();
    }
    
    res.json({ songs: songs });
  } catch (error) {
    console.error('Error getting magic songs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get list of magic videos for song selection
router.get('/magic-videos', (req, res) => {
  try {
    const { search } = req.query;
    const { scanMagicVideos, searchMagicVideos } = require('../../utils/magicVideos');
    
    let videos;
    if (search && search.trim()) {
      videos = searchMagicVideos(search.trim());
    } else {
      videos = scanMagicVideos();
    }
    
    res.json({ videos: videos });
  } catch (error) {
    console.error('Error getting magic videos:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get list of magic YouTube videos for song selection
router.get('/magic-youtube', (req, res) => {
  try {
    const { search } = req.query;
    const { scanMagicYouTube, searchMagicYouTube } = require('../../utils/magicYouTube');
    
    let videos;
    if (search && search.trim()) {
      videos = searchMagicYouTube(search.trim());
    } else {
      videos = scanMagicYouTube();
    }
    
    res.json({ magicYouTube: videos });
  } catch (error) {
    console.error('Error getting magic YouTube videos:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Public endpoint to get invisible songs (for filtering in /new)
router.get('/invisible-songs', async (req, res) => {
  try {
    const db = require('../../config/database');
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
