const fs = require('fs');
const path = require('path');
const { boilDown, boilDownMatch } = require('./boilDown');

const ULTRASTAR_DIR = path.join(__dirname, '..', 'songs', 'ultrastar');

/**
 * Organisiert lose TXT-Dateien im Ultrastar-Ordner in entsprechende Unterordner
 * @returns {number} Anzahl der organisierten Dateien
 */
function organizeLooseTxtFiles() {
  try {
    if (!fs.existsSync(ULTRASTAR_DIR)) {
      console.log('Ultrastar directory does not exist:', ULTRASTAR_DIR);
      return 0;
    }

    const files = fs.readdirSync(ULTRASTAR_DIR);
    let organizedCount = 0;

    files.forEach(file => {
      // Nur TXT-Dateien verarbeiten
      if (!file.toLowerCase().endsWith('.txt')) return;
      
      // Versteckte Dateien ignorieren
      if (file.startsWith('.')) return;

      const filePath = path.join(ULTRASTAR_DIR, file);
      const stat = fs.statSync(filePath);
      
      // Nur Dateien, keine Ordner
      if (!stat.isFile()) return;

      // Generiere Ordnername aus Dateiname (ohne .txt Extension)
      const folderName = path.basename(file, '.txt');
      const folderPath = path.join(ULTRASTAR_DIR, folderName);

      // Prüfe ob Ordner bereits existiert
      if (fs.existsSync(folderPath)) {
        console.log(`📁 Folder already exists for ${file}, checking if TXT already exists`);
        
        // Prüfe ob TXT-Datei bereits im Ordner existiert
        const existingTxtPath = path.join(folderPath, file);
        if (fs.existsSync(existingTxtPath)) {
          console.log(`📄 TXT file already exists in folder, removing loose file: ${file}`);
          fs.unlinkSync(filePath); // Lösche die lose Datei
          organizedCount++;
          return;
        } else {
          console.log(`📁 Moving ${file} to existing folder: ${folderName}`);
          // Verschiebe TXT-Datei in existierenden Ordner
          fs.renameSync(filePath, existingTxtPath);
          console.log(`📄 Moved ${file} to existing folder ${folderName}/`);
          organizedCount++;
          return;
        }
      }

      try {
        // Erstelle neuen Ordner
        fs.mkdirSync(folderPath);
        console.log(`📁 Created folder: ${folderName}`);

        // Verschiebe TXT-Datei in den Ordner
        const newFilePath = path.join(folderPath, file);
        fs.renameSync(filePath, newFilePath);
        console.log(`📄 Moved ${file} to ${folderName}/`);

        organizedCount++;
      } catch (error) {
        console.error(`Error organizing file ${file}:`, error);
      }
    });

    if (organizedCount > 0) {
      console.log(`📁 Organized ${organizedCount} loose TXT files into folders`);
    }

    return organizedCount;
  } catch (error) {
    console.error('Error organizing loose TXT files:', error);
    return 0;
  }
}

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

    // Zuerst lose TXT-Dateien organisieren
    const organizedCount = organizeLooseTxtFiles();
    if (organizedCount > 0) {
      console.log(`📁 Organized ${organizedCount} loose TXT files before scanning`);
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
  
  console.log(`🔍 Searching for ultrastar song: "${artist}" - "${title}"`);
  console.log(`📁 Found ${songs.length} ultrastar songs total`);
  
  // First try exact match
  let found = songs.find(song => 
    song.artist.toLowerCase() === artist.toLowerCase() &&
    song.title.toLowerCase() === title.toLowerCase()
  );
  
  if (found) {
    console.log(`✅ Found exact match: "${found.artist}" - "${found.title}"`);
    return found;
  }
  
  // Try with boil down normalization
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
    
    if (found) {
      console.log(`🎵 Found ultrastar song with boil down matching: "${found.artist}" - "${found.title}" for search: "${artist}" - "${title}"`);
      return found;
    }
  }
  
  // Try more flexible matching (fallback)
  found = songs.find(song => {
    const songArtist = song.artist.toLowerCase().trim();
    const songTitle = song.title.toLowerCase().trim();
    const searchArtist = artist.toLowerCase().trim();
    const searchTitle = title.toLowerCase().trim();
    
    // Check if artist and title are contained in the song
    return (songArtist.includes(searchArtist) || searchArtist.includes(songArtist)) &&
           (songTitle.includes(searchTitle) || searchTitle.includes(songTitle));
  });
  
  if (found) {
    console.log(`🎵 Found ultrastar song with flexible matching: "${found.artist}" - "${found.title}" for search: "${artist}" - "${title}"`);
  } else {
    console.log(`❌ No ultrastar song found for: "${artist}" - "${title}"`);
    // Log some examples for debugging
    if (songs.length > 0) {
      console.log(`📋 Available songs (first 5):`);
      songs.slice(0, 5).forEach(song => {
        console.log(`  - "${song.artist}" - "${song.title}"`);
      });
    }
  }
  
  return found;
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
  organizeLooseTxtFiles,
  ULTRASTAR_DIR
};
