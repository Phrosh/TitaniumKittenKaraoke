const fs = require('fs');
const path = require('path');

// Magic YouTube Directory
const MAGIC_YOUTUBE_DIR = path.join(__dirname, '..', 'songs', 'magic-youtube');

/**
 * Scans the magic-youtube directory for all videos
 * @returns {Array} Array of video objects
 */
function scanMagicYouTube() {
  try {
    if (!fs.existsSync(MAGIC_YOUTUBE_DIR)) {
      return [];
    }

    const videos = [];
    const folders = fs.readdirSync(MAGIC_YOUTUBE_DIR);

    for (const folder of folders) {
      const folderPath = path.join(MAGIC_YOUTUBE_DIR, folder);
      
      if (fs.statSync(folderPath).isDirectory()) {
        // Parse folder name: "Artist - Title"
        const parts = folder.split(' - ');
        const artist = parts[0] || 'Unknown Artist';
        const title = parts.slice(1).join(' - ') || 'Unknown Title';

        // Check for video files
        const files = fs.readdirSync(folderPath);
        const videoFiles = files.filter(file => {
          const ext = path.extname(file).toLowerCase();
          return ['.mp4', '.webm', '.mkv'].includes(ext) && !file.endsWith('_remuxed.mp4');
        });

        const remuxedFiles = files.filter(file => file.endsWith('_remuxed.mp4'));
        const ultrastarFiles = files.filter(file => file.endsWith('_ultrastar.txt'));

        if (videoFiles.length > 0) {
          videos.push({
            folderName: folder,
            artist: artist,
            title: title,
            videoFiles: videoFiles,
            remuxedFiles: remuxedFiles,
            ultrastarFiles: ultrastarFiles,
            hasUltrastar: ultrastarFiles.length > 0,
            isRemuxed: remuxedFiles.length > 0,
            fullPath: folderPath,
            modes: ['magic-youtube'],
            magic: true
          });
        }
      }
    }

    return videos.sort((a, b) => {
      const artistCompare = a.artist.localeCompare(b.artist);
      return artistCompare !== 0 ? artistCompare : a.title.localeCompare(b.title);
    });

  } catch (error) {
    console.error('Error scanning magic YouTube videos:', error);
    return [];
  }
}

/**
 * Searches magic YouTube videos by artist or title
 * @param {string} searchTerm - Search term
 * @returns {Array} Array of matching video objects
 */
function searchMagicYouTube(searchTerm) {
  try {
    const allVideos = scanMagicYouTube();
    const term = searchTerm.toLowerCase();

    return allVideos.filter(video => 
      video.artist.toLowerCase().includes(term) || 
      video.title.toLowerCase().includes(term)
    );

  } catch (error) {
    console.error('Error searching magic YouTube videos:', error);
    return [];
  }
}

module.exports = {
  MAGIC_YOUTUBE_DIR,
  scanMagicYouTube,
  searchMagicYouTube
};
