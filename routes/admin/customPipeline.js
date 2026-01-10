const express = require('express');
const axios = require('axios');
const router = express.Router();

// Custom Pipeline endpoint
router.post('/custom-pipeline', async (req, res) => {
  try {
    const { youtubeUrl, selectedSteps } = req.body;

    if (!youtubeUrl) {
      return res.status(400).json({ error: 'YouTube URL is required' });
    }

    if (!selectedSteps || selectedSteps.length === 0) {
      return res.status(400).json({ error: 'At least one processing step must be selected' });
    }

    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:6000';

    console.log('🔧 Custom pipeline request:', {
      youtubeUrl,
      selectedSteps,
      timestamp: new Date().toISOString()
    });

    try {
      const response = await axios.post(`${aiServiceUrl}/custom-pipeline`, {
        youtubeUrl,
        selectedSteps
      }, {
        timeout: 600000 // 10 minutes timeout
      });

      if (response.data.success) {
        console.log('✅ Custom pipeline started successfully:', response.data);
        res.json({
          success: true,
          message: response.data.message || 'Custom pipeline gestartet',
          folder_name: response.data.folder_name,
          folder_path: response.data.folder_path
        });
      } else {
        throw new Error(response.data.error || 'Custom pipeline fehlgeschlagen');
      }
    } catch (error) {
      console.error('❌ Fehler bei der Custom Pipeline:', {
        message: error.message,
        code: error.code,
        response: error.response?.data
      });
      res.status(500).json({
        success: false,
        error: error.response?.data?.error || error.message || 'Custom pipeline fehlgeschlagen'
      });
    }
  } catch (error) {
    console.error('❌ Error in custom pipeline endpoint:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

module.exports = router;
