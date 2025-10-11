/**
 * Zentrale Konfiguration für Video-Modi und deren Priorität
 * Diese Datei definiert alle verfügbaren Video-Modi und deren Reihenfolge
 */

const { findFileSong } = require('../utils/fileSongs');
const { findLocalVideo } = require('../utils/localVideos');
const { findUltrastarSong } = require('../utils/ultrastarSongs');
const { findYouTubeSong } = require('../utils/youtubeSongs');
const { scanMagicSongs } = require('../utils/magicSongs');
const { scanMagicVideos } = require('../utils/magicVideos');
const { scanMagicYouTube } = require('../utils/magicYouTube');

/**
 * Video-Modi-Konfiguration mit Prioritätsreihenfolge
 * Die Reihenfolge bestimmt die Priorität beim Song-Abruf
 */
const VIDEO_MODES = [
  {
    id: 'file',
    name: 'File Songs',
    description: 'Lokale Dateien aus konfiguriertem Ordner',
    priority: 1,
    enabled: true,
    requiresConfig: true,
    configKey: 'file_songs_folder',
    finder: async (artist, title, config) => {
      if (!config) return null;
      return findFileSong(config, artist, title);
    },
    urlBuilder: (foundItem, req) => {
      const portSetting = req?.app?.get('file_songs_port') || '4000';
      return `http://localhost:${portSetting}/${encodeURIComponent(foundItem.filename)}`;
    }
  },
  {
    id: 'server_video',
    name: 'Server Videos',
    description: 'Lokale Videos aus dem videos/ Ordner',
    priority: 2,
    enabled: true,
    requiresConfig: false,
    finder: async (artist, title) => {
      return findLocalVideo(artist, title);
    },
    urlBuilder: (foundItem) => {
      return `/api/videos/${encodeURIComponent(foundItem.filename)}`;
    }
  },
  {
    id: 'ultrastar',
    name: 'Ultrastar Songs',
    description: 'Ultrastar-Songs mit integrierten Videos',
    priority: 3,
    enabled: true,
    requiresConfig: false,
    finder: async (artist, title) => {
      return findUltrastarSong(artist, title);
    },
    urlBuilder: (foundItem) => {
      return `/api/ultrastar/${encodeURIComponent(foundItem.folderName)}`;
    }
  },
  {
    id: 'magic-songs',
    name: 'Magic Songs',
    description: 'KI-generierte Songs mit Audio',
    priority: 4,
    enabled: true,
    requiresConfig: false,
    finder: async (artist, title) => {
      const magicSongs = scanMagicSongs();
      return magicSongs.find(song => 
        song.artist.toLowerCase() === artist.toLowerCase() &&
        song.title.toLowerCase() === title.toLowerCase()
      );
    },
    urlBuilder: (foundItem) => {
      return `/api/magic-songs/${encodeURIComponent(foundItem.folderName)}`;
    }
  },
  {
    id: 'magic-videos',
    name: 'Magic Videos',
    description: 'KI-generierte Videos',
    priority: 5,
    enabled: true,
    requiresConfig: false,
    finder: async (artist, title) => {
      const magicVideos = scanMagicVideos();
      return magicVideos.find(video => 
        video.artist.toLowerCase() === artist.toLowerCase() &&
        video.title.toLowerCase() === title.toLowerCase()
      );
    },
    urlBuilder: (foundItem) => {
      return `/api/magic-videos/${encodeURIComponent(foundItem.folderName)}`;
    }
  },
  {
    id: 'magic-youtube',
    name: 'Magic YouTube',
    description: 'KI-verarbeitete YouTube-Videos',
    priority: 6,
    enabled: true,
    requiresConfig: false,
    finder: async (artist, title) => {
      const magicYouTube = scanMagicYouTube();
      return magicYouTube.find(video => 
        video.artist.toLowerCase() === artist.toLowerCase() &&
        video.title.toLowerCase() === title.toLowerCase()
      );
    },
    urlBuilder: (foundItem) => {
      return `/api/magic-youtube/${encodeURIComponent(foundItem.folderName)}`;
    }
  },
  {
    id: 'youtube_cache',
    name: 'YouTube Cache',
    description: 'Lokal gespeicherte YouTube-Videos',
    priority: 7,
    enabled: true,
    requiresConfig: false,
    finder: async (artist, title, config, youtubeUrl) => {
      return findYouTubeSong(artist, title, youtubeUrl);
    },
    urlBuilder: (foundItem, req) => {
      const protocol = req?.get('x-forwarded-proto') || req?.protocol || 'http';
      const host = req?.get('host') || 'localhost:5000';
      return `${protocol}://${host}/api/youtube-videos/${encodeURIComponent(foundItem.folderName)}/${encodeURIComponent(foundItem.videoFile)}`;
    }
  },
  {
    id: 'youtube',
    name: 'YouTube Direct',
    description: 'Direkte YouTube-Einbettung (Fallback)',
    priority: 8,
    enabled: true,
    requiresConfig: false,
    finder: async () => null, // YouTube benötigt keine lokale Suche
    urlBuilder: (foundItem, req, originalUrl) => {
      return originalUrl || '';
    }
  }
];

/**
 * Findet den besten verfügbaren Video-Modus für einen Song
 * @param {string} artist - Künstlername
 * @param {string} title - Songtitel
 * @param {string} youtubeUrl - Optionale YouTube-URL
 * @param {Object} req - Express Request-Objekt für Konfiguration
 * @returns {Promise<Object>} { mode, url, foundItem }
 */
async function findBestVideoMode(artist, title, youtubeUrl = null, req = null) {
  // Hole Konfiguration aus der Datenbank
  const db = require('./database');
  const configs = {};
  
  // Lade alle benötigten Konfigurationen
  for (const mode of VIDEO_MODES) {
    if (mode.requiresConfig && mode.configKey) {
      try {
        const config = await new Promise((resolve, reject) => {
          db.get(`SELECT value FROM settings WHERE key = ?`, [mode.configKey], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
        configs[mode.id] = config?.value;
      } catch (error) {
        console.error(`Error loading config for ${mode.id}:`, error);
        configs[mode.id] = null;
      }
    }
  }

  // Durchlaufe alle Modi in Prioritätsreihenfolge
  for (const mode of VIDEO_MODES) {
    if (!mode.enabled) continue;
    
    try {
      const config = configs[mode.id];
      
      // Prüfe ob Konfiguration erforderlich ist
      if (mode.requiresConfig && !config) {
        console.log(`⏭️ Skipping ${mode.id}: No configuration available`);
        continue;
      }
      
      console.log(`🔍 Checking ${mode.id} for: "${artist}" - "${title}"`);
      
      // Für youtube_cache-Modus: Verwende keine YouTube-URL für Video-ID-Matching,
      // da dies zu falschen Treffern führen kann
      const youtubeUrlForFinder = (mode.id === 'youtube_cache') ? null : youtubeUrl;
      
      const foundItem = await mode.finder(artist, title, config, youtubeUrlForFinder);
      
      if (foundItem) {
        const url = mode.urlBuilder(foundItem, req, youtubeUrl);
        console.log(`✅ Found ${mode.id}: ${url}`);
        
        return {
          mode: mode.id,
          url: url,
          foundItem: foundItem,
          modeConfig: mode
        };
      } else {
        console.log(`❌ No ${mode.id} found for: "${artist}" - "${title}"`);
      }
    } catch (error) {
      console.error(`Error checking ${mode.id}:`, error);
    }
  }
  
  // Fallback zu YouTube
  console.log(`🔄 Fallback to YouTube for: "${artist}" - "${title}"`);
  return {
    mode: 'youtube',
    url: youtubeUrl || '',
    foundItem: null,
    modeConfig: VIDEO_MODES.find(m => m.id === 'youtube')
  };
}

/**
 * Aktualisiert die Priorität eines Modus
 * @param {string} modeId - ID des Modus
 * @param {number} newPriority - Neue Priorität
 */
function updateModePriority(modeId, newPriority) {
  const mode = VIDEO_MODES.find(m => m.id === modeId);
  if (mode) {
    mode.priority = newPriority;
    // Sortiere die Modi nach neuer Priorität
    VIDEO_MODES.sort((a, b) => a.priority - b.priority);
    console.log(`🔄 Updated priority for ${modeId} to ${newPriority}`);
  }
}

/**
 * Aktiviert oder deaktiviert einen Modus
 * @param {string} modeId - ID des Modus
 * @param {boolean} enabled - Aktiviert-Status
 */
function setModeEnabled(modeId, enabled) {
  const mode = VIDEO_MODES.find(m => m.id === modeId);
  if (mode) {
    mode.enabled = enabled;
    console.log(`🔄 ${enabled ? 'Enabled' : 'Disabled'} mode: ${modeId}`);
  }
}

/**
 * Gibt alle verfügbaren Modi zurück
 * @returns {Array} Array aller Modi
 */
function getAllModes() {
  return VIDEO_MODES.map(mode => ({
    id: mode.id,
    name: mode.name,
    description: mode.description,
    priority: mode.priority,
    enabled: mode.enabled,
    requiresConfig: mode.requiresConfig,
    configKey: mode.configKey
  }));
}

/**
 * Gibt einen spezifischen Modus zurück
 * @param {string} modeId - ID des Modus
 * @returns {Object|null} Modus-Konfiguration oder null
 */
function getMode(modeId) {
  return VIDEO_MODES.find(m => m.id === modeId) || null;
}

module.exports = {
  VIDEO_MODES,
  findBestVideoMode,
  updateModePriority,
  setModeEnabled,
  getAllModes,
  getMode
};
