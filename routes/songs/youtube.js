const express = require('express');
const router = express.Router();
const https = require('https');

// Get YouTube enabled setting (public)
router.get('/youtube-enabled', async (req, res) => {
  try {
    const db = require('../../config/database');
    const youtubeSetting = await new Promise((resolve, reject) => {
      db.get('SELECT value FROM settings WHERE key = ?', ['youtube_enabled'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    const youtubeEnabled = youtubeSetting ? youtubeSetting.value === 'true' : true; // Default to true if not set
    
    res.json({ 
      settings: { 
        youtube_enabled: youtubeEnabled.toString() 
      } 
    });
  } catch (error) {
    console.error('Error getting YouTube setting:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Search YouTube videos by query
router.post('/youtube/search', async (req, res) => {
  try {
    const { query, maxResults = 20 } = req.body;
    
    if (!query || !query.trim()) {
      return res.status(400).json({ message: 'Query is required' });
    }

    // Use YouTube Data API v3 if API key is available, otherwise use a simple search method
    const youtubeApiKey = process.env.YOUTUBE_API_KEY;
    
    if (youtubeApiKey) {
      // Use YouTube Data API v3
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${maxResults}&key=${youtubeApiKey}`;
      
      https.get(searchUrl, (apiRes) => {
        let data = '';
        
        apiRes.on('data', (chunk) => {
          data += chunk;
        });
        
        apiRes.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            
            if (jsonData.error) {
              console.error('YouTube API error:', jsonData.error);
              return res.status(500).json({ message: 'YouTube API error', error: jsonData.error.message });
            }
            
            const videos = (jsonData.items || []).map((item) => ({
              id: item.id.videoId,
              title: item.snippet.title,
              description: item.snippet.description,
              thumbnail: item.snippet.thumbnails?.default?.url || '',
              url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
              channelTitle: item.snippet.channelTitle
            }));
            
            res.json({ videos });
          } catch (error) {
            console.error('Error parsing YouTube API response:', error);
            res.status(500).json({ message: 'Error parsing YouTube response', error: error.message });
          }
        });
      }).on('error', (error) => {
        console.error('Error calling YouTube API:', error);
        res.status(500).json({ message: 'Error calling YouTube API', error: error.message });
      });
    } else {
      // Fallback: Use a simple method to search YouTube (web scraping approach)
      // This is a basic implementation - in production, you might want to use a more robust solution
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      
      https.get(searchUrl, (apiRes) => {
        let data = '';
        
        apiRes.on('data', (chunk) => {
          data += chunk.toString();
        });
        
        apiRes.on('end', () => {
          try {
            // Extract video IDs from YouTube search page
            // YouTube embeds initial data in a script tag with var ytInitialData
            const ytInitialDataMatch = data.match(/var ytInitialData = ({.+?});/);
            
            if (ytInitialDataMatch) {
              const ytInitialData = JSON.parse(ytInitialDataMatch[1]);
              const videos = [];
              
              // Navigate through the YouTube data structure to find video results
              const contents = ytInitialData?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
              
              for (const section of contents) {
                const itemSection = section?.itemSectionRenderer?.contents || [];
                for (const item of itemSection) {
                  const videoRenderer = item?.videoRenderer;
                  if (videoRenderer && videos.length < maxResults) {
                    videos.push({
                      id: videoRenderer.videoId,
                      title: videoRenderer.title?.runs?.[0]?.text || videoRenderer.title?.simpleText || '',
                      description: videoRenderer.descriptionSnippet?.runs?.map(r => r.text).join('') || '',
                      thumbnail: videoRenderer.thumbnail?.thumbnails?.[0]?.url || '',
                      url: `https://www.youtube.com/watch?v=${videoRenderer.videoId}`,
                      channelTitle: videoRenderer.ownerText?.runs?.[0]?.text || ''
                    });
                  }
                }
              }
              
              res.json({ videos });
            } else {
              // If we can't parse the data, return an empty result
              console.warn('Could not parse YouTube search results');
              res.json({ videos: [] });
            }
          } catch (error) {
            console.error('Error parsing YouTube search results:', error);
            res.status(500).json({ message: 'Error parsing YouTube search results', error: error.message });
          }
        });
      }).on('error', (error) => {
        console.error('Error searching YouTube:', error);
        res.status(500).json({ message: 'Error searching YouTube', error: error.message });
      });
    }
  } catch (error) {
    console.error('Error in YouTube search:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
