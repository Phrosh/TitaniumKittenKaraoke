const { VIDEO_EXTENSIONS } = require('../utils/fileExtensions');

// Magic Videos Directory
const MAGIC_VIDEOS_DIR = path.join(__dirname, '..', 'songs', 'magic-videos');

/**
 * Scans the magic-videos directory for all videos
 * @returns {Array} Array of video objects
 */
function scanMagicVideos() {
  try {
    if (!fs.existsSync(MAGIC_VIDEOS_DIR)) {
      return [];
    }

    const videos = [];
    const folders = fs.readdirSync(MAGIC_VIDEOS_DIR);

    for (const folder of folders) {
      const folderPath = path.join(MAGIC_VIDEOS_DIR, folder);
      
      if (fs.statSync(folderPath).isDirectory()) {
        // Parse folder name: "Artist - Title"
        const parts = folder.split(' - ');
        const artist = parts[0] || 'Unknown Artist';
        const title = parts.slice(1).join(' - ') || 'Unknown Title';

        // Check for video files
        const files = fs.readdirSync(folderPath);
        const videoFiles = files.filter(file => {
          const ext = path.extname(file).toLowerCase();
          return VIDEO_EXTENSIONS.includes(ext) && !file.endsWith('_remuxed.mp4');
        });

        const remuxedFiles = files.filter(file => file.endsWith('_remuxed.mp4'));
        const ultrastarFiles = files.filter(file => file.endsWith('_ultrastar.txt'));

        if (videoFiles.length > 0) {
          // Check for HP2/HP5 files
          const hp2Files = files.filter(file => file.includes('.hp2'));
          const hp5Files = files.filter(file => file.includes('.hp5'));
          const hasHp2Hp5 = hp2Files.length > 0 || hp5Files.length > 0;
          
          // Check for audio files
          const audioFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.mp3', '.wav', '.flac', '.m4a', '.aac'].includes(ext);
          });
          
          videos.push({
            folderName: folder,
            artist: artist,
            title: title,
            videoFiles: videoFiles,
            remuxedFiles: remuxedFiles,
            ultrastarFiles: ultrastarFiles,
            hasUltrastar: ultrastarFiles.length > 0,
            isRemuxed: remuxedFiles.length > 0,
            hasVideo: videoFiles.length > 0,
            hasAudio: audioFiles.length > 0,
            hasHp2Hp5: hasHp2Hp5,
            hasTxt: ultrastarFiles.length > 0,
            modes: ['magic-videos'],
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
    console.error('Error scanning magic videos:', error);
    return [];
  }
}

/**
 * Searches magic videos by artist or title
 * @param {string} searchTerm - Search term
 * @returns {Array} Array of matching video objects
 */
function searchMagicVideos(searchTerm) {
  try {
    const allVideos = scanMagicVideos();
    const term = searchTerm.toLowerCase();

    return allVideos.filter(video => 
      video.artist.toLowerCase().includes(term) || 
      video.title.toLowerCase().includes(term)
    );

  } catch (error) {
    console.error('Error searching magic videos:', error);
    return [];
  }
}

module.exports = {
  MAGIC_VIDEOS_DIR,
  scanMagicVideos,
  searchMagicVideos
};
