const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { triggerVideoConversionViaProxy } = require('./utils/songHelpers');

// Helper function to get saved audio preference from database
// async function getSavedAudioPreference(artist, title) {
//   const db = require('../../config/database');
//   try {
//     const setting = await new Promise((resolve, reject) => {
//       db.get(
//         'SELECT audio_preference FROM ultrastar_audio_settings WHERE artist = ? AND title = ?',
//         [artist, title],
//         (err, row) => {
//           if (err) reject(err);
//           else resolve(row);
//         }
//       );
//     });
//     return setting ? setting.audio_preference : null;
//   } catch (error) {
//     console.error('Error getting saved audio preference:', error);
//     return null;
//   }
// }

// Helper function to find audio file with HP2/HP5 preference
// function findAudioFileWithPreference(folderPath, preferBackgroundVocals = false) {
//   try {
//     const files = fs.readdirSync(folderPath);

//     // Look for HP2/HP5 files first
//     const hp5File = files.find(file => file.toLowerCase().includes('.hp5.mp3'));
//     const hp2File = files.find(file => file.toLowerCase().includes('.hp2.mp3'));

//     if (preferBackgroundVocals && hp5File) {
//       // User wants background vocals (HP5)
//       return path.join(folderPath, hp5File);
//     } else if (!preferBackgroundVocals && hp2File) {
//       // User wants no background vocals (HP2)
//       return path.join(folderPath, hp2File);
//     } else if (hp5File) {
//       // Fallback to HP5 if HP2 not available
//       return path.join(folderPath, hp5File);
//     } else if (hp2File) {
//       // Fallback to HP2 if HP5 not available
//       return path.join(folderPath, hp2File);
//     }

//     // If no HP2/HP5 files, fall back to original audio file
//     const { findAudioFile } = require('../../utils/ultrastarParser');
//     const originalFile = findAudioFile(folderPath);
//     return originalFile;
//   } catch (error) {
//     console.error('Error finding audio file with preference:', error);
//     return null;
//   }
// }

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
