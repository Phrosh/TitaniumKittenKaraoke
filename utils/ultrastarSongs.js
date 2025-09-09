const fs = require('fs');
const path = require('path');

const ULTRASTAR_DIR = path.join(__dirname, '..', 'songs', 'ultrastar');

/**
 * Scannt den ultrastar Ordner und gibt alle verfügbaren Ultrastar-Songs zurück
 * @returns {Array} Array von Song-Objekten mit {folderName, artist, title, fullPath, hasVideo, hasHp2Hp5}
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
        
        // Check for video files
        const hasVideo = checkForVideoFiles(fullPath);
        const hasPreferredVideo = checkForPreferredVideoFiles(fullPath);
        
        // Check for HP2/HP5 files
        const hasHp2Hp5 = checkForHp2Hp5Files(fullPath);
        
        // Check for audio files
        const hasAudio = checkForAudioFiles(fullPath);
        
        songs.push({
          folderName: folder,
          artist: artist,
          title: title,
          fullPath: fullPath,
          hasVideo: hasVideo,
          hasPreferredVideo: hasPreferredVideo,
          hasHp2Hp5: hasHp2Hp5,
          hasAudio: hasAudio
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
 * Prüft ob Video-Dateien (webm oder mp4) im Ordner vorhanden sind
 * @param {string} folderPath - Pfad zum Song-Ordner
 * @returns {boolean} true wenn Video-Dateien vorhanden sind
 */
function checkForVideoFiles(folderPath) {
  try {
    const files = fs.readdirSync(folderPath);
    const videoExtensions = ['.webm', '.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.xvid', '.mpeg', '.mpg'];
    
    return files.some(file => {
      const ext = path.extname(file).toLowerCase();
      return videoExtensions.includes(ext);
    });
  } catch (error) {
    console.error('Error checking for video files:', error);
    return false;
  }
}

/**
 * Prüft ob bevorzugte Video-Dateien (webm oder mp4) im Ordner vorhanden sind
 * @param {string} folderPath - Pfad zum Song-Ordner
 * @returns {boolean} true wenn bevorzugte Video-Dateien vorhanden sind
 */
function checkForPreferredVideoFiles(folderPath) {
  try {
    const files = fs.readdirSync(folderPath);
    const preferredVideoExtensions = ['.webm', '.mp4'];
    
    return files.some(file => {
      const ext = path.extname(file).toLowerCase();
      return preferredVideoExtensions.includes(ext);
    });
  } catch (error) {
    console.error('Error checking for preferred video files:', error);
    return false;
  }
}

/**
 * Prüft ob HP2/HP5 Audio-Dateien im Ordner vorhanden sind
 * @param {string} folderPath - Pfad zum Song-Ordner
 * @returns {boolean} true wenn HP2 oder HP5 Dateien vorhanden sind
 */
function checkForHp2Hp5Files(folderPath) {
  try {
    const files = fs.readdirSync(folderPath);
    
    return files.some(file => {
      const fileName = file.toLowerCase();
      return fileName.includes('.hp2.mp3') || fileName.includes('.hp5.mp3');
    });
  } catch (error) {
    console.error('Error checking for HP2/HP5 files:', error);
    return false;
  }
}

/**
 * Prüft ob Audio-Dateien (nicht HP2/HP5) im Ordner vorhanden sind
 * @param {string} folderPath - Pfad zum Song-Ordner
 * @returns {boolean} true wenn Audio-Dateien vorhanden sind
 */
function checkForAudioFiles(folderPath) {
  try {
    const files = fs.readdirSync(folderPath);
    const audioExtensions = ['.mp3', '.flac', '.ogg', '.wav', '.m4a', '.aac'];
    
    return files.some(file => {
      const ext = path.extname(file).toLowerCase();
      const name = path.basename(file, ext).toLowerCase();
      
      return audioExtensions.includes(ext) &&
             !name.includes('hp2') && !name.includes('hp5') && 
             !name.includes('vocals') && !name.includes('instrumental') &&
             !name.includes('extracted');
    });
  } catch (error) {
    console.error('Error checking for audio files:', error);
    return false;
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
  checkForVideoFiles,
  checkForPreferredVideoFiles,
  checkForHp2Hp5Files,
  checkForAudioFiles,
  ULTRASTAR_DIR
};
