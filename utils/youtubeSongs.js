const fs = require('fs');
const path = require('path');

// YouTube songs directory
const YOUTUBE_DIR = path.join(__dirname, '..', 'songs', 'youtube');

/**
 * Scan YouTube songs directory for downloaded videos
 * @returns {Array} Array of YouTube song objects
 */
function scanYouTubeSongs() {
  try {
    if (!fs.existsSync(YOUTUBE_DIR)) {
      fs.mkdirSync(YOUTUBE_DIR, { recursive: true });
      return [];
    }

    const folders = fs.readdirSync(YOUTUBE_DIR);
    const songs = [];

    for (const folder of folders) {
      const folderPath = path.join(YOUTUBE_DIR, folder);
      
      if (fs.statSync(folderPath).isDirectory()) {
        // Parse folder name: "Artist - Songname"
        const parts = folder.split(' - ');
        if (parts.length >= 2) {
          const artist = parts[0].trim();
          const title = parts.slice(1).join(' - ').trim();
          
          // Find video files in the folder
          const files = fs.readdirSync(folderPath);
          const videoFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.mp4', '.webm', '.avi', '.mov', '.mkv'].includes(ext);
          });

          if (videoFiles.length > 0) {
            songs.push({
              artist,
              title,
              folderName: folder,
              videoFile: videoFiles[0], // Use first video file found
              modes: ['youtube'],
              hasVideo: true
            });
          }
        }
      }
    }

    return songs.sort((a, b) => {
      // Sort by artist, then by title
      if (a.artist !== b.artist) {
        return a.artist.localeCompare(b.artist);
      }
      return a.title.localeCompare(b.title);
    });
  } catch (error) {
    console.error('Error scanning YouTube songs:', error);
    return [];
  }
}

/**
 * Search YouTube songs by query
 * @param {string} query - Search query
 * @returns {Array} Array of matching YouTube songs
 */
function searchYouTubeSongs(query) {
  const allSongs = scanYouTubeSongs();
  const searchTerm = query.toLowerCase();
  
  return allSongs.filter(song => 
    song.artist.toLowerCase().includes(searchTerm) ||
    song.title.toLowerCase().includes(searchTerm) ||
    `${song.artist} - ${song.title}`.toLowerCase().includes(searchTerm)
  );
}

/**
 * Find YouTube song by artist and title
 * @param {string} artist - Artist name
 * @param {string} title - Song title
 * @returns {Object|null} YouTube song object or null if not found
 */
function findYouTubeSong(artist, title) {
  const songs = scanYouTubeSongs();
  return songs.find(song => 
    song.artist.toLowerCase() === artist.toLowerCase() &&
    song.title.toLowerCase() === title.toLowerCase()
  );
}

/**
 * Extract YouTube video ID from URL
 * @param {string} url - YouTube URL
 * @returns {string|null} Video ID or null if not found
 */
function extractYouTubeVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Download YouTube video to songs/youtube directory
 * @param {string} youtubeUrl - YouTube URL
 * @param {string} artist - Artist name
 * @param {string} title - Song title
 * @returns {Promise<Object>} Download result
 */
async function downloadYouTubeVideo(youtubeUrl, artist, title) {
  try {
    const videoId = extractYouTubeVideoId(youtubeUrl);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    // Create folder name: "Artist - Songname"
    const folderName = `${artist} - ${title}`;
    const folderPath = path.join(YOUTUBE_DIR, folderName);

    // Create folder if it doesn't exist
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    // Check if video already exists
    const existingFiles = fs.readdirSync(folderPath);
    const existingVideo = existingFiles.find(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.mp4', '.webm', '.avi', '.mov', '.mkv'].includes(ext);
    });

    if (existingVideo) {
      return {
        success: true,
        message: 'Video already exists',
        folderName,
        videoFile: existingVideo,
        videoId
      };
    }

    // Call AI service to download video
    const axios = require('axios');
    const downloadUrl = `http://localhost:6000/download_youtube/youtube/${encodeURIComponent(folderName)}`;
    
    const response = await axios.post(downloadUrl, {
      youtubeUrl,
      videoId,
      artist,
      title
    }, {
      timeout: 300000 // 5 minutes timeout
    });

    return {
      success: true,
      message: 'Video downloaded successfully',
      folderName,
      videoFile: response.data.videoFile,
      videoId,
      ...response.data
    };

  } catch (error) {
    console.error('Error downloading YouTube video:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to download video'
    };
  }
}

module.exports = {
  YOUTUBE_DIR,
  scanYouTubeSongs,
  searchYouTubeSongs,
  findYouTubeSong,
  extractYouTubeVideoId,
  downloadYouTubeVideo
};
