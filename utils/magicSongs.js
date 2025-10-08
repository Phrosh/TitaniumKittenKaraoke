const fs = require('fs');
const path = require('path');

// Magic Songs Directory
const MAGIC_SONGS_DIR = path.join(__dirname, '..', 'songs', 'magic-songs');

/**
 * Scans the magic-songs directory for all songs
 * @returns {Array} Array of song objects
 */
function scanMagicSongs() {
  try {
    if (!fs.existsSync(MAGIC_SONGS_DIR)) {
      return [];
    }

    const songs = [];
    const folders = fs.readdirSync(MAGIC_SONGS_DIR);

    for (const folder of folders) {
      const folderPath = path.join(MAGIC_SONGS_DIR, folder);
      
      if (fs.statSync(folderPath).isDirectory()) {
        // Parse folder name: "Artist - Title"
        const parts = folder.split(' - ');
        const artist = parts[0] || 'Unknown Artist';
        const title = parts.slice(1).join(' - ') || 'Unknown Title';

        // Check for audio files
        const files = fs.readdirSync(folderPath);
        const audioFiles = files.filter(file => {
          const ext = path.extname(file).toLowerCase();
          return ['.mp3', '.wav', '.flac', '.m4a', '.aac'].includes(ext);
        });

        const ultrastarFiles = files.filter(file => file.endsWith('_ultrastar.txt'));
        const coverFiles = files.filter(file => {
          const ext = path.extname(file).toLowerCase();
          return file.toLowerCase().startsWith('cover') && ['.jpg', '.jpeg', '.png', '.gif'].includes(ext);
        });

        if (audioFiles.length > 0) {
          // Check for HP2/HP5 files
          const hp2Files = files.filter(file => file.endsWith('.hp2'));
          const hp5Files = files.filter(file => file.endsWith('.hp5'));
          const hasHp2Hp5 = hp2Files.length > 0 || hp5Files.length > 0;
          
          songs.push({
            folderName: folder,
            artist: artist,
            title: title,
            audioFiles: audioFiles,
            ultrastarFiles: ultrastarFiles,
            coverFiles: coverFiles,
            hasUltrastar: ultrastarFiles.length > 0,
            hasCover: coverFiles.length > 0,
            hasAudio: audioFiles.length > 0,
            hasVideo: false, // Magic songs don't have videos
            hasHp2Hp5: hasHp2Hp5,
            hasTxt: ultrastarFiles.length > 0,
            modes: ['magic-songs'],
            magic: true
          });
        }
      }
    }

    return songs.sort((a, b) => {
      const artistCompare = a.artist.localeCompare(b.artist);
      return artistCompare !== 0 ? artistCompare : a.title.localeCompare(b.title);
    });

  } catch (error) {
    console.error('Error scanning magic songs:', error);
    return [];
  }
}

/**
 * Searches magic songs by artist or title
 * @param {string} searchTerm - Search term
 * @returns {Array} Array of matching song objects
 */
function searchMagicSongs(searchTerm) {
  try {
    const allSongs = scanMagicSongs();
    const term = searchTerm.toLowerCase();

    return allSongs.filter(song => 
      song.artist.toLowerCase().includes(term) || 
      song.title.toLowerCase().includes(term)
    );

  } catch (error) {
    console.error('Error searching magic songs:', error);
    return [];
  }
}

/**
 * Finds a specific magic song by artist and title
 * @param {string} artist - Artist name
 * @param {string} title - Song title
 * @returns {Object|null} Song object or null if not found
 */
function findMagicSong(artist, title) {
  try {
    const allSongs = scanMagicSongs();
    
    return allSongs.find(song => 
      song.artist.toLowerCase() === artist.toLowerCase() && 
      song.title.toLowerCase() === title.toLowerCase()
    ) || null;

  } catch (error) {
    console.error('Error finding magic song:', error);
    return null;
  }
}

module.exports = {
  MAGIC_SONGS_DIR,
  scanMagicSongs,
  searchMagicSongs,
  findMagicSong
};
