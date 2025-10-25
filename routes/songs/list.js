const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../../config/database');
const fs = require('fs');
const path = require('path');
const songCache = require('../../utils/songCache');

// Get file songs (public)
router.get('/file-songs', async (req, res) => {
  try {
    const db = require('../../config/database');
    
    // Get file songs folder and port from settings
    const folderSetting = await new Promise((resolve, reject) => {
      db.get('SELECT value FROM settings WHERE key = ?', ['file_songs_folder'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    const portSetting = await new Promise((resolve, reject) => {
      db.get('SELECT value FROM settings WHERE key = ?', ['file_songs_port'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    const folderPath = folderSetting ? folderSetting.value : '';
    const port = portSetting ? parseInt(portSetting.value) : 4000;
    
    if (!folderPath) {
      return res.json({ fileSongs: [] });
    }
    
    // Scan the folder for video files
    const { scanFileSongs } = require('../../utils/fileSongs');
    const fileSongs = await scanFileSongs(folderPath);
    
    res.json({ 
      fileSongs: fileSongs.map(song => ({
        ...song,
        port: port
      }))
    });
  } catch (error) {
    console.error('Error getting file songs:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get list of local videos for song selection
router.get('/server-videos', (req, res) => {
  try {
    const { search } = req.query;
    const { scanLocalVideos, searchLocalVideos } = require('../../utils/localVideos');
    
    let videos;
    if (search && search.trim()) {
      videos = searchLocalVideos(search.trim());
    } else {
      videos = scanLocalVideos();
    }
    
    res.json({ videos });
  } catch (error) {
    console.error('Error getting local videos:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get list of ultrastar songs for song selection
router.get('/ultrastar-songs', async (req, res) => {
  try {
    const { search, rebuild_cache } = req.query;
    const { searchUltrastarSongs } = require('../../utils/ultrastarSongs');
    
    // Verwende Cache für Ultrastar Songs
    const cachedSongs = await songCache.getUltrastarSongs(rebuild_cache === 'true');
    
    let songs;
    if (search && search.trim()) {
      songs = searchUltrastarSongs(search.trim());
    } else {
      songs = cachedSongs;
    }
    
    res.json({ songs });
  } catch (error) {
    console.error('Error getting ultrastar songs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get list of YouTube songs for song selection
router.get('/youtube-songs', async (req, res) => {
  try {
    const { search, rebuild_cache } = req.query;
    const { searchYouTubeSongs } = require('../../utils/youtubeSongs');
    
    // Verwende Cache für YouTube Songs
    const cachedSongs = await songCache.getYouTubeSongs(rebuild_cache === 'true');
    
    let songs;
    if (search && search.trim()) {
      songs = searchYouTubeSongs(search.trim());
    } else {
      songs = cachedSongs;
    }
    
    res.json({ youtubeSongs: songs });
  } catch (error) {
    console.error('Error getting YouTube songs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get list of magic songs for song selection
router.get('/magic-songs', async (req, res) => {
  try {
    const { search, rebuild_cache } = req.query;
    const { searchMagicSongs } = require('../../utils/magicSongs');
    
    // Verwende Cache für Magic Songs
    const cachedSongs = await songCache.getMagicSongs(rebuild_cache === 'true');
    
    let songs;
    if (search && search.trim()) {
      songs = searchMagicSongs(search.trim());
    } else {
      songs = cachedSongs;
    }
    
    res.json({ songs: songs });
  } catch (error) {
    console.error('Error getting magic songs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get list of magic videos for song selection
router.get('/magic-videos', async (req, res) => {
  try {
    const { search, rebuild_cache } = req.query;
    const { searchMagicVideos } = require('../../utils/magicVideos');
    
    // Verwende Cache für Magic Videos
    const cachedVideos = await songCache.getMagicVideos(rebuild_cache === 'true');
    
    let videos;
    if (search && search.trim()) {
      videos = searchMagicVideos(search.trim());
    } else {
      videos = cachedVideos;
    }
    
    res.json({ videos: videos });
  } catch (error) {
    console.error('Error getting magic videos:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get list of magic YouTube videos for song selection
router.get('/magic-youtube', async (req, res) => {
  try {
    const { search, rebuild_cache } = req.query;
    const { searchMagicYouTube } = require('../../utils/magicYouTube');
    
    // Verwende Cache für Magic YouTube
    const cachedVideos = await songCache.getMagicYouTube(rebuild_cache === 'true');
    
    let videos;
    if (search && search.trim()) {
      videos = searchMagicYouTube(search.trim());
    } else {
      videos = cachedVideos;
    }
    
    res.json({ magicYouTube: videos });
  } catch (error) {
    console.error('Error getting magic YouTube videos:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Unified song data endpoint - automatically detects song type and returns data
router.get('/song-data', async (req, res) => {
  try {
    const { artist, title, youtubeId } = req.query;
    const { withBackgroundVocals } = req.query;
    const { boilDownMatch } = require('../../utils/boilDown');
    const { parseUltrastarFile, findAudioFile } = require('../../utils/ultrastarParser');
    
    // Import the HP2/HP5 preference function from ultrastar route
    function findAudioFileWithPreference(folderPath, preferBackgroundVocals = false) {
      try {
        const files = fs.readdirSync(folderPath);

        // Look for HP2/HP5 files first
        const hp5File = files.find(file => file.toLowerCase().includes('.hp5.mp3'));
        const hp2File = files.find(file => file.toLowerCase().includes('.hp2.mp3'));

        if (preferBackgroundVocals && hp5File) {
          // User wants background vocals (HP5)
          return path.join(folderPath, hp5File);
        } else if (!preferBackgroundVocals && hp2File) {
          // User wants no background vocals (HP2)
          return path.join(folderPath, hp2File);
        } else if (hp5File) {
          // Fallback to HP5 if HP2 not available
          return path.join(folderPath, hp5File);
        } else if (hp2File) {
          // Fallback to HP2 if HP5 not available
          return path.join(folderPath, hp2File);
        }

        // If no HP2/HP5 files, fall back to original audio file
        const originalFile = findAudioFile(folderPath);
        return originalFile;
      } catch (error) {
        console.error('Error finding audio file with preference:', error);
        return null;
      }
    }

    console.log(`🎵 Unified song data request: artist=${artist}, title=${title}, youtubeId=${youtubeId}`);

    if (!artist || !title) {
      return res.status(400).json({ message: 'Artist and title are required' });
    }

    // Define all possible song directories with their priorities
    const songDirectories = [
      { name: 'ultrastar', dir: require('../../utils/ultrastarSongs').ULTRASTAR_DIR, priority: 1 },
      { name: 'magic-songs', dir: require('../../utils/magicSongs').MAGIC_SONGS_DIR, priority: 2 },
      { name: 'magic-videos', dir: require('../../utils/magicVideos').MAGIC_VIDEOS_DIR, priority: 3 },
      { name: 'magic-youtube', dir: require('../../utils/magicYouTube').MAGIC_YOUTUBE_DIR, priority: 4 },
      { name: 'youtube', dir: require('../../utils/youtubeSongs').YOUTUBE_DIR, priority: 5 }
    ];

    let foundSong = null;
    let songType = null;

    // Search in each directory by priority
    for (const songDir of songDirectories) {
      if (!fs.existsSync(songDir.dir)) continue;

      const folders = fs.readdirSync(songDir.dir).filter(item => {
        const itemPath = path.join(songDir.dir, item);
        return fs.statSync(itemPath).isDirectory();
      });

      // Try to find matching folder
      const matchingFolder = folders.find(folder => {
        // Try exact match first
        if (folder === `${artist} - ${title}`) return true;
        
        // Try boilDown match
        return boilDownMatch(folder, `${artist} - ${title}`);
      });

      if (matchingFolder) {
        foundSong = {
          folderName: matchingFolder,
          folderPath: path.join(songDir.dir, matchingFolder),
          type: songDir.name,
          priority: songDir.priority
        };
        songType = songDir.name;
        console.log(`✅ Found song in ${songDir.name}: ${matchingFolder}`);
        break; // Use first match (highest priority)
      }
    }

    if (!foundSong) {
      return res.status(404).json({ message: 'Song not found in any directory' });
    }

    // Process the found song
    const files = fs.readdirSync(foundSong.folderPath);
    
    // Find ultrastar file
    let ultrastarFiles = files.filter(file => file.endsWith('_ultrastar.txt'));
    if (ultrastarFiles.length === 0) {
      ultrastarFiles = files.filter(file => file.endsWith('.txt'));
    }

    let songData;
    
    if (ultrastarFiles.length > 0) {
      const ultrastarFile = ultrastarFiles[0];
      const ultrastarPath = path.join(foundSong.folderPath, ultrastarFile);
      
      console.log(`📄 Using ultrastar file: ${ultrastarFile}`);
      songData = parseUltrastarFile(ultrastarPath);
      
      if (!songData) {
        return res.status(500).json({ message: 'Failed to parse ultrastar file' });
      }

      // For duets, structure lines and notes as [P1_data, P2_data] (same as original route)
      if (songData.isDuet && songData.singers && songData.singers.length >= 2) {
        // Get lines and notes from both singers
        const singer1Lines = songData.singers[0].lines || [];
        const singer2Lines = songData.singers[1].lines || [];
        const singer1Notes = songData.singers[0].notes || [];
        const singer2Notes = songData.singers[1].notes || [];

        // Structure as [P1_data, P2_data]
        songData.lines = [singer1Lines, singer2Lines];
        songData.notes = [singer1Notes, singer2Notes];

        console.log(`🎤 Duet-Song erkannt: "${songData.title}" - Sänger 1: ${singer1Lines.length} Zeilen, ${singer1Notes.length} Noten, Sänger 2: ${singer2Lines.length} Zeilen, ${singer2Notes.length} Noten`);
      }
      // For non-duets, keep the original lines structure from parseUltrastarFile

      // Remove legacy properties and singers array (same as original route)
      delete songData.singer1Notes;
      delete songData.singer2Notes;
      delete songData.singer1Lines;
      delete songData.singer2Lines;
      delete songData.singers;
    } else {
      // Create minimal song data
      console.log(`⚠️ No ultrastar file found, creating minimal song data`);
      songData = {
        title: title,
        artist: artist,
        bpm: 120,
        gap: 0,
        isDuet: false,
        lines: [],
        notes: [],
        audio: '',
        video: '',
        background: ''
      };
    }

    // Find audio file with HP2/HP5 preference (same logic as original route)
    const preferBackgroundVocals = withBackgroundVocals === 'true';
    const audioFile = findAudioFileWithPreference(foundSong.folderPath, preferBackgroundVocals);
    if (audioFile) {
      // Extract just the filename from the full path
      const audioFilename = path.basename(audioFile);
      songData.audioUrl = `/api/audio/${songType}/${encodeURIComponent(foundSong.folderName)}/${encodeURIComponent(audioFilename)}`;
    }

    // Find video file
    const videoFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.mp4', '.webm', '.mkv'].includes(ext) && !file.endsWith('_remuxed.mp4');
    });

    if (videoFiles.length > 0) {
      // Priority: .webm > .mp4 > others
      const webmFiles = videoFiles.filter(file => file.toLowerCase().endsWith('.webm'));
      const mp4Files = videoFiles.filter(file => file.toLowerCase().endsWith('.mp4'));
      const otherFiles = videoFiles.filter(file =>
        !file.toLowerCase().endsWith('.webm') && !file.toLowerCase().endsWith('.mp4')
      );

      let selectedVideoFile;
      if (webmFiles.length > 0) {
        selectedVideoFile = webmFiles[0];
      } else if (mp4Files.length > 0) {
        selectedVideoFile = mp4Files[0];
      } else if (otherFiles.length > 0) {
        selectedVideoFile = otherFiles[0];
      }

      if (selectedVideoFile) {
        songData.videoUrl = `/api/video/${songType}/${encodeURIComponent(foundSong.folderName)}/${encodeURIComponent(selectedVideoFile)}`;
        songData.videoFile = selectedVideoFile;
      }
    }

    // Find background image
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(ext);
    });

    if (imageFiles.length > 0) {
      const imageFile = imageFiles[0];
      songData.backgroundImageUrl = `/api/video/${songType}/${encodeURIComponent(foundSong.folderName)}/${encodeURIComponent(imageFile)}`;
    }

    // Add metadata
    songData.songType = songType;
    songData.folderName = foundSong.folderName;

    res.json({ songData });
    
  } catch (error) {
    console.error('Error getting unified song data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Public endpoint to get invisible songs (for filtering in /new)
router.get('/invisible-songs', async (req, res) => {
  try {
    const db = require('../../config/database');
    const invisibleSongs = await new Promise((resolve, reject) => {
      db.all('SELECT artist, title FROM invisible_songs', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({ invisibleSongs });
  } catch (error) {
    console.error('Error getting invisible songs:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
