const express = require('express');
const axios = require('axios');
const router = express.Router();

// Get USDB search enabled setting (public)
router.get('/usdb-search-enabled', async (req, res) => {
  try {
    const db = require('../../config/database');
    const usdbSearchSetting = await new Promise((resolve, reject) => {
      db.get('SELECT value FROM settings WHERE key = ?', ['usdb_search_enabled'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    const usdbSearchEnabled = usdbSearchSetting ? usdbSearchSetting.value === 'true' : false; // Default to false if not set
    
    res.json({ 
      settings: { 
        usdb_search_enabled: usdbSearchEnabled.toString() 
      } 
    });
  } catch (error) {
    console.error('Error getting USDB search setting:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Public USDB search endpoint
router.post('/usdb-search', async (req, res) => {
  try {
    const { interpret, title, limit = 20 } = req.body;
    console.log('🔍 Public USDB search called with:', { interpret, title, limit });
    
    // Check if USDB search is enabled
    const db = require('../../config/database');
    const usdbSearchSetting = await new Promise((resolve, reject) => {
      db.get('SELECT value FROM settings WHERE key = ?', ['usdb_search_enabled'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    const usdbSearchEnabled = usdbSearchSetting ? usdbSearchSetting.value === 'true' : false;
    console.log('⚙️ USDB search enabled setting:', usdbSearchEnabled);
    
    if (!usdbSearchEnabled) {
      console.log('❌ USDB search disabled, returning empty results');
      return res.json({ songs: [] });
    }
    
    // Get USDB credentials from database
    const credentials = await new Promise((resolve, reject) => {
      db.get('SELECT username, password FROM usdb_credentials ORDER BY created_at DESC LIMIT 1', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!credentials) {
      console.log('❌ No USDB credentials found, returning empty results');
      return res.json({ songs: [] });
    }
    
    const usdbCredentials = credentials;
    
    // Call Python AI service for USDB search
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:6000';
    
    try {
      // First check if AI service is reachable
      try {
        await axios.get(`${aiServiceUrl}/health`, { timeout: 5000 });
      } catch (healthError) {
        console.error('AI Service health check failed:', healthError.message);
        return res.json({ songs: [] }); // Return empty results instead of error
      }

      const searchData = {
        interpret: interpret || '',
        title: title || '',
        limit: limit,
        username: usdbCredentials.username,
        password: usdbCredentials.password
      };

      console.log('🌐 Performing USDB search via AI service...');
      const response = await axios.post(`${aiServiceUrl}/usdb/search`, searchData, {
        timeout: 30000 // 30 seconds timeout for search
      });

      if (response.data.success) {
        console.log('🎯 USDB search returned', response.data.songs.length, 'songs');
        res.json({ songs: response.data.songs });
      } else {
        console.log('❌ USDB search failed:', response.data.error);
        res.json({ songs: [] });
      }
    } catch (aiServiceError) {
      console.error('AI Service Search Error:', aiServiceError.message);
      res.json({ songs: [] }); // Return empty results instead of error
    }
    
  } catch (error) {
    console.error('💥 Error in public USDB search:', error);
    res.json({ songs: [] }); // Return empty results instead of error
  }
});

module.exports = router;
