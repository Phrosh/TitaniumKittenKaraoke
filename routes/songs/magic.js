const express = require('express');
const Song = require('../../models/Song');
const { scanMagicSongs } = require('../../utils/magicSongs');
const { scanMagicVideos: scanMagicVideosUtil } = require('../../utils/magicVideos');
const { scanMagicYouTube: scanMagicYouTubeUtil } = require('../../utils/magicYouTube');

const router = express.Router();

// Get Magic songs
router.get('/', async (req, res) => {
  try {
    const magicSongs = await scanMagicSongs();
    res.json({ magicSongs });
  } catch (error) {
    console.error('Error getting Magic songs:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get Magic videos
router.get('/videos', async (req, res) => {
  try {
    const magicVideos = await scanMagicVideosUtil();
    res.json({ magicVideos });
  } catch (error) {
    console.error('Error getting Magic videos:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get Magic YouTube songs
router.get('/youtube', async (req, res) => {
  try {
    const magicYouTubeSongs = await scanMagicYouTubeUtil();
    res.json({ magicYouTubeSongs });
  } catch (error) {
    console.error('Error getting Magic YouTube songs:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
