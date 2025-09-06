const fs = require('fs');
const path = require('path');

const ULTRASTAR_DIR = path.join(__dirname, '..', 'songs', 'ultrastar');

/**
 * Scannt den ultrastar Ordner und gibt alle verfügbaren Ultrastar-Songs zurück
 * @returns {Array} Array von Song-Objekten mit {folderName, artist, title, fullPath}
 */
function scanUltrastarSongs() {
  try {
    if (!fs.existsSync(ULTRASTAR_DIR)) {
      console.log('Ultrastar directory does not exist:', ULTRASTAR_DIR);
      return [];
    }

    const folders = fs.readdirSync(ULTRASTAR_DIR);
    const songs = [];

    folders.forEach(folder => {
      // Ignoriere versteckte Ordner
      if (folder.startsWith('.')) return;

      const fullPath = path.join(ULTRASTAR_DIR, folder);
      const stat = fs.statSync(fullPath);
      
      // Nur Ordner, keine Dateien
      if (!stat.isDirectory()) return;

      // Parse "Artist - Title" Format
      const parts = folder.split(' - ');
      if (parts.length >= 2) {
        const artist = parts[0].trim();
        const title = parts.slice(1).join(' - ').trim(); // Falls der Titel selbst " - " enthält
        
        songs.push({
          folderName: folder,
          artist: artist,
          title: title,
          fullPath: fullPath
        });
      }
    });

    return songs.sort((a, b) => {
      // Sortiere nach Artist, dann nach Title
      if (a.artist !== b.artist) {
        return a.artist.localeCompare(b.artist);
      }
      return a.title.localeCompare(b.title);
    });

  } catch (error) {
    console.error('Error scanning ultrastar songs:', error);
    return [];
  }
}

/**
 * Sucht nach einem Ultrastar-Song basierend auf Artist und Title
 * @param {string} artist - Der Künstlername
 * @param {string} title - Der Songtitel
 * @returns {Object|null} Song-Objekt oder null wenn nicht gefunden
 */
function findUltrastarSong(artist, title) {
  const songs = scanUltrastarSongs();
  
  return songs.find(song => 
    song.artist.toLowerCase() === artist.toLowerCase() &&
    song.title.toLowerCase() === title.toLowerCase()
  );
}

/**
 * Sucht nach Ultrastar-Songs basierend auf einem Suchbegriff
 * @param {string} searchTerm - Der Suchbegriff
 * @returns {Array} Array von passenden Song-Objekten
 */
function searchUltrastarSongs(searchTerm) {
  const songs = scanUltrastarSongs();
  const term = searchTerm.toLowerCase();
  
  return songs.filter(song => 
    song.artist.toLowerCase().includes(term) ||
    song.title.toLowerCase().includes(term) ||
    `${song.artist} - ${song.title}`.toLowerCase().includes(term)
  );
}

module.exports = {
  scanUltrastarSongs,
  findUltrastarSong,
  searchUltrastarSongs,
  ULTRASTAR_DIR
};
