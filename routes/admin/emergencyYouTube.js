const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { broadcastEmergencyYouTube } = require('../../utils/websocketService');
const { isYouTubeUrl, extractVideoIdFromUrl } = require('../../utils/youtubeUrlCleaner');
const { setEmergencyYouTubePending } = require('../../utils/emergencyYouTubeState');

router.put('/emergency-youtube', [
  body('youtubeUrl').isString().trim().notEmpty().withMessage('youtubeUrl ist erforderlich'),
  body('artist').optional().isString(),
  body('title').optional().isString(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { youtubeUrl, artist, title } = req.body;
    const videoId = extractVideoIdFromUrl(youtubeUrl);

    if (!isYouTubeUrl(youtubeUrl) || !videoId) {
      return res.status(400).json({ message: 'Ungültige YouTube-URL' });
    }

    const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const pending = setEmergencyYouTubePending(cleanUrl, videoId, { artist, title });

    const io = req.app.get('io');
    if (io) {
      await broadcastEmergencyYouTube(io, pending);
    }

    res.json({ message: 'Notfall-YouTube bereit', emergencyYouTube: pending });
  } catch (error) {
    console.error('Error triggering emergency YouTube:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
