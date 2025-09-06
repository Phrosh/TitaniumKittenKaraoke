const fs = require('fs');
const path = require('path');

const VIDEOS_DIR = path.join(__dirname, '..', 'songs', 'videos');

/**
 * Scannt den videos Ordner und gibt alle verfügbaren lokalen Videos zurück
 * @returns {Array} Array von Video-Objekten mit {filename, artist, title, extension}
 */
function scanLocalVideos() {
  try {
    if (!fs.existsSync(VIDEOS_DIR)) {
      console.log('Videos directory does not exist:', VIDEOS_DIR);
      return [];
    }

    const files = fs.readdirSync(VIDEOS_DIR);
    const videos = [];

    files.forEach(file => {
      // Ignoriere versteckte Dateien und Ordner
      if (file.startsWith('.')) return;

      const fullPath = path.join(VIDEOS_DIR, file);
      const stat = fs.statSync(fullPath);
      
      // Nur Dateien, keine Ordner
      if (!stat.isFile()) return;

      const extension = path.extname(file).toLowerCase();
      const filenameWithoutExt = path.basename(file, extension);
      
      // Parse "Artist - Title" Format
      const parts = filenameWithoutExt.split(' - ');
      if (parts.length >= 2) {
        const artist = parts[0].trim();
        const title = parts.slice(1).join(' - ').trim(); // Falls der Titel selbst " - " enthält
        
        videos.push({
          filename: file,
          artist: artist,
          title: title,
          extension: extension,
          fullPath: fullPath
        });
      }
    });

    return videos.sort((a, b) => {
      // Sortiere nach Artist, dann nach Title
      if (a.artist !== b.artist) {
        return a.artist.localeCompare(b.artist);
      }
      return a.title.localeCompare(b.title);
    });

  } catch (error) {
    console.error('Error scanning local videos:', error);
    return [];
  }
}

/**
 * Sucht nach einem lokalen Video basierend auf Artist und Title
 * @param {string} artist - Der Künstlername
 * @param {string} title - Der Songtitel
 * @returns {Object|null} Video-Objekt oder null wenn nicht gefunden
 */
function findLocalVideo(artist, title) {
  const videos = scanLocalVideos();
  
  return videos.find(video => 
    video.artist.toLowerCase() === artist.toLowerCase() &&
    video.title.toLowerCase() === title.toLowerCase()
  );
}

/**
 * Sucht nach lokalen Videos basierend auf einem Suchbegriff
 * @param {string} searchTerm - Der Suchbegriff
 * @returns {Array} Array von passenden Video-Objekten
 */
function searchLocalVideos(searchTerm) {
  const videos = scanLocalVideos();
  const term = searchTerm.toLowerCase();
  
  return videos.filter(video => 
    video.artist.toLowerCase().includes(term) ||
    video.title.toLowerCase().includes(term) ||
    `${video.artist} - ${video.title}`.toLowerCase().includes(term)
  );
}

module.exports = {
  scanLocalVideos,
  findLocalVideo,
  searchLocalVideos,
  VIDEOS_DIR
};
