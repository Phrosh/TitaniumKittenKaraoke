const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { triggerVideoConversionViaProxy } = require('./utils/songHelpers');

// Helper function to get saved audio preference from database
async function getSavedAudioPreference(artist, title) {
  const db = require('../../config/database');
  try {
    const setting = await new Promise((resolve, reject) => {
      db.get(
        'SELECT audio_preference FROM ultrastar_audio_settings WHERE artist = ? AND title = ?',
        [artist, title],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    return setting ? setting.audio_preference : null;
  } catch (error) {
    console.error('Error getting saved audio preference:', error);
    return null;
  }
}

// Helper function to find audio file with HP2/HP5 preference
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
    const { findAudioFile } = require('../../utils/ultrastarParser');
    const originalFile = findAudioFile(folderPath);
    return originalFile;
  } catch (error) {
    console.error('Error finding audio file with preference:', error);
    return null;
  }
}

// New endpoint to organize loose TXT files
router.post('/ultrastar/organize-loose-files', async (req, res) => {
  try {
    const { organizeLooseTxtFiles } = require('../../utils/ultrastarSongs');
    
    console.log('📁 Manual organization of loose TXT files requested');
    
    const organizedCount = organizeLooseTxtFiles();
    
    res.json({
      message: 'Loose TXT files organization completed',
      organizedCount,
      status: 'success'
    });
    
  } catch (error) {
    console.error('Error organizing loose TXT files:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Removed: GET /songs/ultrastar/:folderName/needs-video (unused)

// Get ultrastar song data (parsed .txt file) - MUST be before /:filename route
router.get('/ultrastar/:folderName/data', async (req, res) => {
    try {
      const { folderName } = req.params;
      const { withBackgroundVocals } = req.query; // Optional query parameter
      const { ULTRASTAR_DIR } = require('../utils/ultrastarSongs');
      const { parseUltrastarFile, findAudioFile } = require('../utils/ultrastarParser');
  
      // Check if this is a magic song by looking at the URL path
      let isMagicSong = false;
      let magicDir = null;
      let magicFolderPath = null;
  
      // Check magic-songs
      const { MAGIC_SONGS_DIR } = require('../utils/magicSongs');
      const magicSongsPath = path.join(MAGIC_SONGS_DIR, decodeURIComponent(folderName));
      if (fs.existsSync(magicSongsPath)) {
        isMagicSong = true;
        magicDir = MAGIC_SONGS_DIR;
        magicFolderPath = magicSongsPath;
      }
  
      // Check magic-videos
      if (!isMagicSong) {
        const { MAGIC_VIDEOS_DIR } = require('../utils/magicVideos');
        const magicVideosPath = path.join(MAGIC_VIDEOS_DIR, decodeURIComponent(folderName));
        if (fs.existsSync(magicVideosPath)) {
          isMagicSong = true;
          magicDir = MAGIC_VIDEOS_DIR;
          magicFolderPath = magicVideosPath;
        }
      }
  
      // Check magic-youtube
      if (!isMagicSong) {
        const { MAGIC_YOUTUBE_DIR } = require('../utils/magicYouTube');
        const magicYouTubePath = path.join(MAGIC_YOUTUBE_DIR, decodeURIComponent(folderName));
        console.log('🔍 Checking magic-youtube path:', {
          folderName,
          decodedFolderName: decodeURIComponent(folderName),
          magicYouTubePath,
          exists: fs.existsSync(magicYouTubePath)
        });
        if (fs.existsSync(magicYouTubePath)) {
          isMagicSong = true;
          magicDir = MAGIC_YOUTUBE_DIR;
          magicFolderPath = magicYouTubePath;
          console.log('✅ Magic-YouTube song detected:', magicYouTubePath);
        }
      }
  
      /**
       * Triggers video conversion for an ultrastar song
       * @param {string} folderName - Name of the ultrastar folder
       * @param {string} folderPath - Full path to the ultrastar folder
       * @param {string} videoFile - Video filename
       */
      function triggerVideoConversion(folderName, folderPath, videoFile) {
        try {
          const videoExt = path.extname(videoFile).toLowerCase();
  
          // Check if video needs conversion (not .mp4 or .webm)
          if (videoExt !== '.mp4' && videoExt !== '.webm') {
            console.log('🎬 Triggering video conversion on song request:', {
              folderName,
              videoFile,
              timestamp: new Date().toISOString()
            });
  
            // Use internal proxy endpoint instead of direct call
            triggerVideoConversionViaProxy(folderName);
          } else {
            console.log('🎬 Video already in preferred format, no conversion needed:', {
              folderName,
              videoFile,
              extension: videoExt,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('🎬 Error triggering video conversion:', {
            error: error.message,
            folderName,
            videoFile,
            timestamp: new Date().toISOString()
          });
        }
      }
  
      /**
       * Findet Video-Datei mit Priorität: .webm > .mp4 > andere
       * @param {string} folderPath - Pfad zum Ultrastar-Ordner
       * @param {string} specifiedVideo - In .txt angegebener Video-Dateiname (wird ignoriert)
       * @returns {string|null} Dateiname der besten Video-Datei oder null
       */
      function findBackgroundImageFile(folderPath) {
        try {
          const files = fs.readdirSync(folderPath);
  
          // Priority order: .jpg, .jpeg, .png, .webp
          const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  
          for (const ext of imageExtensions) {
            const imageFile = files.find(file =>
              file.toLowerCase().endsWith(ext) &&
              !file.toLowerCase().includes('cover') && // Exclude cover images
              !file.toLowerCase().includes('thumbnail') // Exclude thumbnails
            );
  
            if (imageFile) {
              console.log('🖼️ Found background image:', {
                folderPath,
                imageFile,
                extension: ext
              });
              return path.join(folderPath, imageFile);
            }
          }
  
          console.log('🖼️ No background image found in:', folderPath);
          return null;
        } catch (error) {
          console.error('Error finding background image:', error);
          return null;
        }
      }
  
      function findVideoFile(folderPath, specifiedVideo) {
        try {
          if (!fs.existsSync(folderPath)) {
            return null;
          }
  
          const files = fs.readdirSync(folderPath);
          const videoExtensions = ['.webm', '.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.xvid', '.mpeg', '.mpg'];
  
          // Sammle alle Video-Dateien
          const videoFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return videoExtensions.includes(ext);
          });
  
          if (videoFiles.length === 0) {
            return null;
          }
  
          // Neue Priorität: .webm > .mp4 > andere
          const webmFiles = videoFiles.filter(file => file.toLowerCase().endsWith('.webm'));
          const mp4Files = videoFiles.filter(file => file.toLowerCase().endsWith('.mp4'));
          const otherFiles = videoFiles.filter(file =>
            !file.toLowerCase().endsWith('.webm') && !file.toLowerCase().endsWith('.mp4')
          );
  
          // Prioritätslogik - ignoriere spezifizierte Datei aus .txt
          if (webmFiles.length > 0) {
            return webmFiles[0]; // Erste .webm Datei
          } else if (mp4Files.length > 0) {
            return mp4Files[0]; // Erste .mp4 Datei
          } else if (otherFiles.length > 0) {
            return otherFiles[0]; // Erste andere Video-Datei
          }
  
          return null;
        } catch (error) {
          console.error('Error finding video file:', error);
          return null;
        }
      }
  
      // Use magic folder path if it's a magic song, otherwise use ultrastar path
      const folderPath = isMagicSong ? magicFolderPath : path.join(ULTRASTAR_DIR, decodeURIComponent(folderName));
  
      console.log('🔍 Ultrastar data request:', {
        folderName: folderName,
        decodedFolderName: decodeURIComponent(folderName),
        folderPath: folderPath,
        isMagicSong: isMagicSong,
        exists: fs.existsSync(folderPath)
      });
  
      if (!fs.existsSync(folderPath)) {
        return res.status(404).json({ message: 'Ultrastar folder not found', folderPath });
      }
  
      // Find .txt file
      const files = fs.readdirSync(folderPath);
      const txtFile = files.find(file => file.toLowerCase().endsWith('.txt'));
  
      if (!txtFile) {
        return res.status(404).json({ message: 'Ultrastar .txt file not found' });
      }
  
      const txtPath = path.join(folderPath, txtFile);
      const songData = parseUltrastarFile(txtPath);
  
      if (!songData) {
        return res.status(500).json({ message: 'Error parsing Ultrastar file' });
      }
  
      // For duets, structure lines and notes as [P1_data, P2_data]
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
  
      // Remove legacy properties and singers array
      delete songData.singer1Notes;
      delete songData.singer1Lines;
      delete songData.singer2Notes;
      delete songData.singer2Lines;
      delete songData.singers;
  
      // Find audio file with HP2/HP5 preference
      // First check if there's a saved preference in the database
      const savedPreference = await getSavedAudioPreference(songData.artist, songData.title);
  
      let preferBackgroundVocals = false;
  
      if (savedPreference === 'hp5') {
        // Saved preference: use HP5 (with background vocals)
        preferBackgroundVocals = true;
      } else if (savedPreference === 'hp2') {
        // Saved preference: use HP2 (without background vocals)
        preferBackgroundVocals = false;
      } else {
        // No saved preference or "choice" - use user's selection from query parameter
        preferBackgroundVocals = withBackgroundVocals === 'true';
      }
  
      const audioFile = findAudioFileWithPreference(folderPath, preferBackgroundVocals);
      if (audioFile) {
        const audioFilename = path.basename(audioFile);
        if (isMagicSong) {
          // For magic songs, use the appropriate magic endpoint
          if (magicDir === require('../utils/magicSongs').MAGIC_SONGS_DIR) {
            songData.audioUrl = `/api/magic-songs/${encodeURIComponent(folderName)}/${encodeURIComponent(audioFilename)}`;
          } else if (magicDir === require('../utils/magicVideos').MAGIC_VIDEOS_DIR) {
            songData.audioUrl = `/api/magic-videos/${encodeURIComponent(folderName)}/${encodeURIComponent(audioFilename)}`;
          } else if (magicDir === require('../utils/magicYouTube').MAGIC_YOUTUBE_DIR) {
            songData.audioUrl = `/api/magic-youtube/${encodeURIComponent(folderName)}/${encodeURIComponent(audioFilename)}`;
          }
        } else {
          songData.audioUrl = `/api/songs/ultrastar/${encodeURIComponent(folderName)}/${encodeURIComponent(audioFilename)}`;
        }
      }
  
      // Find video file with priority: .webm > .mp4 > others
      const videoFile = findVideoFile(folderPath, songData.video);
      if (videoFile) {
        const videoExt = path.extname(videoFile).toLowerCase();
  
        // Always set videoUrl - use the best available video file
        if (isMagicSong) {
          // For magic songs, use the appropriate magic endpoint
          if (magicDir === require('../utils/magicSongs').MAGIC_SONGS_DIR) {
            songData.videoUrl = `/api/magic-songs/${encodeURIComponent(folderName)}/${encodeURIComponent(videoFile)}`;
          } else if (magicDir === require('../utils/magicVideos').MAGIC_VIDEOS_DIR) {
            songData.videoUrl = `/api/magic-videos/${encodeURIComponent(folderName)}/${encodeURIComponent(videoFile)}`;
          } else if (magicDir === require('../utils/magicYouTube').MAGIC_YOUTUBE_DIR) {
            songData.videoUrl = `/api/magic-youtube/${encodeURIComponent(folderName)}/${encodeURIComponent(videoFile)}`;
          }
        } else {
          songData.videoUrl = `/api/songs/ultrastar/${encodeURIComponent(folderName)}/${encodeURIComponent(videoFile)}`;
        }
        songData.videoFile = videoFile;
  
        // Note: Video conversion is handled in the song request route, not here
        console.log('🎬 Video file found:', {
          folderName,
          videoFile,
          extension: videoExt,
          isMagicSong,
          timestamp: new Date().toISOString()
        });
      }
  
  
      // Find background image file
      const backgroundImageFile = findBackgroundImageFile(folderPath);
      if (backgroundImageFile) {
        const imageFilename = path.basename(backgroundImageFile);
        if (isMagicSong) {
          // For magic songs, use the appropriate magic endpoint
          if (magicDir === require('../utils/magicSongs').MAGIC_SONGS_DIR) {
            songData.backgroundImageUrl = `/api/magic-songs/${encodeURIComponent(folderName)}/${encodeURIComponent(imageFilename)}`;
          } else if (magicDir === require('../utils/magicVideos').MAGIC_VIDEOS_DIR) {
            songData.backgroundImageUrl = `/api/magic-videos/${encodeURIComponent(folderName)}/${encodeURIComponent(imageFilename)}`;
          } else if (magicDir === require('../utils/magicYouTube').MAGIC_YOUTUBE_DIR) {
            songData.backgroundImageUrl = `/api/magic-youtube/${encodeURIComponent(folderName)}/${encodeURIComponent(imageFilename)}`;
          }
        } else {
          songData.backgroundImageUrl = `/api/songs/ultrastar/${encodeURIComponent(folderName)}/${encodeURIComponent(imageFilename)}`;
        }
  
        console.log('🖼️ Background image URL added:', {
          folderName,
          imageFilename,
          backgroundImageUrl: songData.backgroundImageUrl,
          isMagicSong
        });
      }
  
      // Add magic flag to song data
      songData.magic = isMagicSong;
  
      res.json({ songData });
    } catch (error) {
      console.error('Error getting ultrastar song data:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

// Serve ultrastar song files (audio, video, cover, txt)
router.get('/ultrastar/:folderName/:filename', (req, res) => {
  try {
    const { folderName, filename } = req.params;
    const { ULTRASTAR_DIR } = require('../../utils/ultrastarSongs');
    
    // Check if this is a magic song by looking at the URL path
    let isMagicSong = false;
    let magicDir = null;
    let folderPath = null;
    
    // Check magic-songs
    const { MAGIC_SONGS_DIR } = require('../../utils/magicSongs');
    const magicSongsPath = path.join(MAGIC_SONGS_DIR, decodeURIComponent(folderName));
    if (fs.existsSync(magicSongsPath)) {
      isMagicSong = true;
      magicDir = MAGIC_SONGS_DIR;
      folderPath = magicSongsPath;
    }
    
    // Check magic-videos
    if (!isMagicSong) {
      const { MAGIC_VIDEOS_DIR } = require('../../utils/magicVideos');
      const magicVideosPath = path.join(MAGIC_VIDEOS_DIR, decodeURIComponent(folderName));
      if (fs.existsSync(magicVideosPath)) {
        isMagicSong = true;
        magicDir = MAGIC_VIDEOS_DIR;
        folderPath = magicVideosPath;
      }
    }
    
    // Check magic-youtube
    if (!isMagicSong) {
      const { MAGIC_YOUTUBE_DIR } = require('../../utils/magicYouTube');
      const magicYouTubePath = path.join(MAGIC_YOUTUBE_DIR, decodeURIComponent(folderName));
      if (fs.existsSync(magicYouTubePath)) {
        isMagicSong = true;
        magicDir = MAGIC_YOUTUBE_DIR;
        folderPath = magicYouTubePath;
      }
    }
    
    // Use magic folder path if it's a magic song, otherwise use ultrastar path
    if (!isMagicSong) {
      folderPath = path.join(ULTRASTAR_DIR, decodeURIComponent(folderName));
    }
    
    const filePath = path.join(folderPath, decodeURIComponent(filename));
    
    // Security check - ensure file is within the appropriate directory
    if (isMagicSong) {
      if (!filePath.startsWith(magicDir)) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else {
      if (!filePath.startsWith(ULTRASTAR_DIR)) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    // Set appropriate content type
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (ext) {
      case '.mp3':
        contentType = 'audio/mpeg';
        break;
      case '.flac':
        contentType = 'audio/flac';
        break;
      case '.wav':
        contentType = 'audio/wav';
        break;
      case '.ogg':
        contentType = 'audio/ogg';
        break;
      case '.m4a':
        contentType = 'audio/mp4';
        break;
      case '.aac':
        contentType = 'audio/aac';
        break;
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.webp':
        contentType = 'image/webp';
        break;
      case '.txt':
        contentType = 'text/plain';
        break;
      case '.avi':
      case '.mp4':
      case '.mkv':
        contentType = 'video/mp4';
        break;
    }
    
    res.setHeader('Content-Type', contentType);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving ultrastar file:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Public endpoint to get ultrastar audio settings (for filtering in /new)
router.get('/ultrastar-audio-settings', async (req, res) => {
  try {
    const db = require('../../config/database');
    const audioSettings = await new Promise((resolve, reject) => {
      db.all('SELECT artist, title, audio_preference FROM ultrastar_audio_settings', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({ ultrastarAudioSettings: audioSettings });
  } catch (error) {
    console.error('Error getting ultrastar audio settings:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
