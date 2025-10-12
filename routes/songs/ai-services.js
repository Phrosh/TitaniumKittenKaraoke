const express = require('express');
const axios = require('axios');

const router = express.Router();

// Proxy endpoint for AI services
router.all('/proxy/*', async (req, res) => {
  try {
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:6000';
    const targetPath = req.path.replace('/proxy', '');
    const targetUrl = `${aiServiceUrl}${targetPath}`;
    
    console.log(`🔄 Proxying ${req.method} request to AI service:`, {
      from: req.path,
      to: targetUrl,
      timestamp: new Date().toISOString()
    });
    
    const config = {
      method: req.method.toLowerCase(),
      url: targetUrl,
      headers: {
        ...req.headers,
        host: undefined, // Remove host header to avoid conflicts
      },
      timeout: 300000, // 5 minutes timeout
    };
    
    if (req.body && Object.keys(req.body).length > 0) {
      config.data = req.body;
    }
    
    if (req.query && Object.keys(req.query).length > 0) {
      config.params = req.query;
    }
    
    const response = await axios(config);
    
    console.log(`✅ AI service response:`, {
      status: response.status,
      dataKeys: Object.keys(response.data || {}),
      timestamp: new Date().toISOString()
    });
    
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('❌ AI service proxy error:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      response: error.response?.data,
      timestamp: new Date().toISOString()
    });
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.message,
      details: error.response?.data
    });
  }
});

// Convert video for Ultrastar song
router.post('/convert_video/ultrastar/:folderName', async (req, res) => {
  try {
    const { folderName } = req.params;
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:6000';
    
    console.log('🎬 Converting video for Ultrastar song:', {
      folderName,
      timestamp: new Date().toISOString()
    });
    
    const response = await axios.post(`${aiServiceUrl}/convert_video/ultrastar/${encodeURIComponent(folderName)}`, {}, {
      timeout: 300000 // 5 minutes timeout
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('❌ Video conversion error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Separate audio for Ultrastar song
router.post('/separate_audio/ultrastar/:folderName', async (req, res) => {
  try {
    const { folderName } = req.params;
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:6000';
    
    console.log('🎵 Separating audio for Ultrastar song:', {
      folderName,
      timestamp: new Date().toISOString()
    });
    
    const response = await axios.post(`${aiServiceUrl}/separate_audio/ultrastar/${encodeURIComponent(folderName)}`, {}, {
      timeout: 300000 // 5 minutes timeout
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('❌ Audio separation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;
