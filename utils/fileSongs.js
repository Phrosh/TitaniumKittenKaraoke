const fs = require('fs');
const path = require('path');

/**
 * Scannt einen lokalen Ordner und gibt alle verfügbaren Video-Dateien zurück
 * @param {string} folderPath - Der Pfad zum zu scannenden Ordner
 * @returns {Array} Array von Video-Objekten mit {filename, artist, title, extension, fullPath}
 */
function scanFileSongs(folderPath) {
  try {
    if (!folderPath || !fs.existsSync(folderPath)) {
      console.log('File songs directory does not exist:', folderPath);
      return [];
    }

    const files = fs.readdirSync(folderPath);
    const videos = [];

    files.forEach(file => {
      // Ignoriere versteckte Dateien und Ordner
      if (file.startsWith('.')) return;

      const fullPath = path.join(folderPath, file);
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
    console.error('Error scanning file songs:', error);
    return [];
  }
}

/**
 * Sucht nach einer Datei basierend auf Artist und Title
 * @param {string} folderPath - Der Pfad zum Ordner
 * @param {string} artist - Der Künstlername
 * @param {string} title - Der Songtitel
 * @returns {Object|null} Video-Objekt oder null wenn nicht gefunden
 */
function findFileSong(folderPath, artist, title) {
  const videos = scanFileSongs(folderPath);
  
  return videos.find(video => 
    video.artist.toLowerCase() === artist.toLowerCase() &&
    video.title.toLowerCase() === title.toLowerCase()
  );
}

/**
 * Sucht nach Dateien basierend auf einem Suchbegriff
 * @param {string} folderPath - Der Pfad zum Ordner
 * @param {string} searchTerm - Der Suchbegriff
 * @returns {Array} Array von passenden Video-Objekten
 */
function searchFileSongs(folderPath, searchTerm) {
  const videos = scanFileSongs(folderPath);
  const term = searchTerm.toLowerCase();
  
  return videos.filter(video => 
    video.artist.toLowerCase().includes(term) ||
    video.title.toLowerCase().includes(term) ||
    `${video.artist} - ${video.title}`.toLowerCase().includes(term)
  );
}

module.exports = {
  scanFileSongs,
  findFileSong,
  searchFileSongs
};
