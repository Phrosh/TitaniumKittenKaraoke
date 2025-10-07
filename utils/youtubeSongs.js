const fs = require('fs');
const path = require('path');
const { boilDown, boilDownMatch } = require('./boilDown');
const { createSanitizedFolderName } = require('./filenameSanitizer');

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
              videoFiles: videoFiles, // Store all video files for video ID matching
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
function findYouTubeSong(artist, title, youtubeUrl = null) {
  const songs = scanYouTubeSongs();
  
  // First try exact match
  let found = songs.find(song => 
    song.artist.toLowerCase() === artist.toLowerCase() &&
    song.title.toLowerCase() === title.toLowerCase()
  );
  
  // If not found, try with boil down normalization
  if (!found) {
    found = songs.find(song => {
      // Try individual artist/title matches
      if (boilDownMatch(song.artist, artist) || boilDownMatch(song.title, title)) {
        return true;
      }
      
      // Try combined match
      const boiledCombined = boilDown(`${artist} - ${title}`);
      const boiledSongCombined = boilDown(`${song.artist} - ${song.title}`);
      return boiledCombined === boiledSongCombined;
    });
  }
  
  // If still not found, try with sanitized names (fallback)
  if (!found) {
    const sanitizedFolderName = createSanitizedFolderName(artist, title);
    found = songs.find(song => 
      song.folderName === sanitizedFolderName
    );
  }
  
  // If still not found and we have a YouTube URL, try to find by video ID
  if (!found && youtubeUrl) {
    const videoId = extractYouTubeVideoId(youtubeUrl);
    if (videoId) {
      // First try to find in the scanned songs
      found = songs.find(song => {
        // Check if any video file in the folder has this video ID as filename
        if (song.videoFiles && Array.isArray(song.videoFiles)) {
          return song.videoFiles.some(videoFile => 
            typeof videoFile === 'string' ? videoFile.startsWith(videoId) : 
            videoFile.filename && videoFile.filename.startsWith(videoId)
          );
        }
        // Fallback: check the main videoFile
        return song.videoFile && song.videoFile.startsWith(videoId);
      });
      
      // If still not found, do a recursive search in all subdirectories
      if (!found) {
        found = findYouTubeSongByVideoIdRecursive(videoId);
      }
    }
  }
  
  return found;
}

/**
 * Recursively search for YouTube song by video ID in all subdirectories
 * @param {string} videoId - The video ID to search for
 * @returns {Object|null} YouTube song object or null if not found
 */
function findYouTubeSongByVideoIdRecursive(videoId) {
  try {
    // Search through all folders in YouTube directory
    const folders = fs.readdirSync(YOUTUBE_DIR);
    
    for (const folder of folders) {
      const folderPath = path.join(YOUTUBE_DIR, folder);
      
      if (fs.statSync(folderPath).isDirectory()) {
        // Check if any video file in this folder starts with the video ID
        const files = fs.readdirSync(folderPath);
        const videoFiles = files.filter(file => {
          const ext = path.extname(file).toLowerCase();
          return ['.mp4', '.webm', '.avi', '.mov', '.mkv'].includes(ext);
        });
        
        const matchingVideoFile = videoFiles.find(file => file.startsWith(videoId));
        
        if (matchingVideoFile) {
          // Parse folder name to get artist and title
          const parts = folder.split(' - ');
          if (parts.length >= 2) {
            const artist = parts[0].trim();
            const title = parts.slice(1).join(' - ').trim();
            
            return {
              artist,
              title,
              folderName: folder,
              videoFile: matchingVideoFile,
              videoFiles: videoFiles,
              modes: ['youtube'],
              hasVideo: true
            };
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error in recursive video ID search for ${videoId}:`, error);
  }
  
  return null;
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

    // Create sanitized folder name: "Artist - Songname"
    const folderName = createSanitizedFolderName(artist, title);
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

    // After successful download, trigger modular processing for youtube cache (normalize + cleanup)
    try {
      const processUrl = `http://localhost:6000/process_youtube_cache/${encodeURIComponent(folderName)}`;
      await axios.post(processUrl, {}, { timeout: 180000 });
    } catch (e) {
      console.warn('YouTube cache post-processing failed (normalize/cleanup):', e?.message || e);
    }

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
  findYouTubeSongByVideoIdRecursive,
  extractYouTubeVideoId,
  downloadYouTubeVideo
};
