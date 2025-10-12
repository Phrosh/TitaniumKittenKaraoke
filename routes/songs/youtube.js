const express = require('express');
const Song = require('../../models/Song');
const { scanYouTubeSongs, searchYouTubeSongs, findYouTubeSong, downloadYouTubeVideo } = require('../../utils/youtubeSongs');
const { cleanYouTubeUrl } = require('../../utils/youtubeUrlCleaner');

const router = express.Router();

// Get YouTube songs
router.get('/', async (req, res) => {
  try {
    const youtubeSongs = await scanYouTubeSongs();
    res.json({ youtubeSongs });
  } catch (error) {
    console.error('Error getting YouTube songs:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Search YouTube songs
router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ message: 'Query parameter required' });
    }
    
    const results = await searchYouTubeSongs(query);
    res.json({ results });
  } catch (error) {
    console.error('Error searching YouTube songs:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Find specific YouTube song
router.get('/find/:artist/:title', async (req, res) => {
  try {
    const { artist, title } = req.params;
    const song = await findYouTubeSong(artist, title);
    
    if (!song) {
      return res.status(404).json({ message: 'YouTube song not found' });
    }
    
    res.json({ song });
  } catch (error) {
    console.error('Error finding YouTube song:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Download YouTube video
router.post('/download', async (req, res) => {
  try {
    const { youtubeUrl, artist, title } = req.body;
    
    if (!youtubeUrl || !artist || !title) {
      return res.status(400).json({ message: 'youtubeUrl, artist, and title are required' });
    }
    
    const cleanUrl = cleanYouTubeUrl(youtubeUrl);
    const result = await downloadYouTubeVideo(cleanUrl, artist, title);
    
    res.json(result);
  } catch (error) {
    console.error('Error downloading YouTube video:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
