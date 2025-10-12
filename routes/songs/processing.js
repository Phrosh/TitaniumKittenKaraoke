const express = require('express');
const Song = require('../../models/Song');
const { broadcastProcessingStatus } = require('../../utils/websocketService');

const router = express.Router();

// Update processing status
router.put('/status/:songId', async (req, res) => {
  try {
    const { songId } = req.params;
    const { status, error } = req.body;
    
    await Song.updateProcessingStatus(songId, status, error);
    
    // Broadcast status update
    const io = req.app.get('io');
    if (io) {
      broadcastProcessingStatus(io, { id: songId, status, error });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating processing status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get processing status for a song
router.get('/status/:songId', async (req, res) => {
  try {
    const { songId } = req.params;
    const song = await Song.getById(songId);
    
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }
    
    res.json({ 
      status: song.processing_status,
      error: song.processing_error,
      downloadStatus: song.download_status
    });
  } catch (error) {
    console.error('Error getting processing status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
