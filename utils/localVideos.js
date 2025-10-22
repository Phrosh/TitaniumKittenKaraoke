const fs = require('fs');
const path = require('path');
const { boilDown, boilDownMatch } = require('./boilDown');

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
          fullPath: fullPath,
          modes: ['server_video']
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
  
  // First try exact match
  let found = videos.find(video => 
    video.artist.toLowerCase() === artist.toLowerCase() &&
    video.title.toLowerCase() === title.toLowerCase()
  );
  
  if (found) {
    console.log(`🎬 Found local video (exact match): ${artist} - ${title} -> ${found.filename}`);
    return found;
  }
  
  // Try with boil down normalization
  if (!found) {
    found = videos.find(video => {
      // Try combined match first (most precise)
      const boiledCombined = boilDown(`${artist} - ${title}`);
      const boiledVideoCombined = boilDown(`${video.artist} - ${video.title}`);
      if (boiledCombined === boiledVideoCombined) {
        return true;
      }
      
      // Try both artist AND title match (both must match, not just one)
      if (boilDownMatch(video.artist, artist) && boilDownMatch(video.title, title)) {
        return true;
      }
      
      return false;
    });
    
    if (found) {
      console.log(`🎬 Found local video (boil down match): "${found.artist}" - "${found.title}" for search: "${artist}" - "${title}" -> ${found.filename}`);
      return found;
    }
  }
  
  // Try more flexible matching (fallback) - but be more strict
  found = videos.find(video => {
    const videoArtist = video.artist.toLowerCase().trim();
    const videoTitle = video.title.toLowerCase().trim();
    const searchArtist = artist.toLowerCase().trim();
    const searchTitle = title.toLowerCase().trim();
    
    // Clean search title from common tags like [DUET], [LIVE], etc.
    const cleanSearchTitle = searchTitle.replace(/\s*\[.*?\]\s*/g, '').trim();
    
    // Check if artist and title are contained in the video
    // But require that the search title is contained in the video title (not the other way around)
    // This prevents "Phantom of the Opera" from matching "Phantom of the Opera (live) [duet]"
    const artistMatch = videoArtist.includes(searchArtist) || searchArtist.includes(videoArtist);
    const titleMatch = videoTitle.includes(cleanSearchTitle);
    
    return artistMatch && titleMatch;
  });
  
  if (found) {
    console.log(`🎬 Found local video (flexible match): "${found.artist}" - "${found.title}" for search: "${artist}" - "${title}" -> ${found.filename}`);
  } else {
    console.log(`❌ No local video found for: ${artist} - ${title}`);
  }
  
  return found;
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
