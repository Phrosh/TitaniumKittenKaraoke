const express = require('express');
const Song = require('../../models/Song');
const path = require('path');
const fs = require('fs');
const { scanUltrastarSongs, ULTRASTAR_DIR } = require('../../utils/ultrastarSongs');

const router = express.Router();

// Get Ultrastar songs
router.get('/', async (req, res) => {
  try {
    const ultrastarSongs = await scanUltrastarSongs();
    res.json({ ultrastarSongs });
  } catch (error) {
    console.error('Error getting Ultrastar songs:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get Ultrastar song data
router.get('/data/:folderName', async (req, res) => {
  try {
    const { folderName } = req.params;
    const ultrastarSong = await scanUltrastarSongs().then(songs => 
      songs.find(song => song.folderName === folderName)
    );
    
    if (!ultrastarSong) {
      return res.status(404).json({ message: 'Ultrastar song not found' });
    }
    
    res.json({ ultrastarSong });
  } catch (error) {
    console.error('Error getting Ultrastar song data:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Serve Ultrastar files
router.get('/files/:folderName/:filename', async (req, res) => {
  try {
    const { folderName, filename } = req.params;
    const filePath = path.join(ULTRASTAR_DIR, folderName, filename);
    
    // Security check - ensure file is within Ultrastar directory
    if (!filePath.startsWith(ULTRASTAR_DIR)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving Ultrastar file:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
