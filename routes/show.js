const express = require('express');
const router = express.Router();
const Song = require('../models/Song');
const QRCode = require('qrcode');
// const { findYouTubeSong } = require('../utils/youtubeSongs');

// GET /show - Zeige aktuelles Video und nächste Songs
router.get('/', async (req, res) => {
  try {
    const currentSong = await Song.getCurrentSong();

    console.log('currentSong', currentSong);
    console.log("hodor")
    const allSongs = await Song.getAll();
    
    // Nächste 3 Songs nach dem aktuellen Song
    let nextSongs = [];
    if (currentSong) {
      nextSongs = allSongs
        .filter(song => song.position > currentSong.position)
        .sort((a, b) => a.position - b.position)
        .slice(0, 3)
        .map(song => ({
          id: song.id,
          user_name: song.user_name,
          artist: song.artist,
          title: song.title,
          position: song.position
        }));
    }

    // Get QR overlay status from settings
    const db = require('../config/database');
    const overlaySetting = await new Promise((resolve, reject) => {
      db.get(
        'SELECT value FROM settings WHERE key = ?',
        ['show_qr_overlay'],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    const showQRCodeOverlay = overlaySetting ? overlaySetting.value === 'true' : false;

    // Get overlay title from settings
    const overlayTitleSetting = await new Promise((resolve, reject) => {
      db.get(
        'SELECT value FROM settings WHERE key = ?',
        ['overlay_title'],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    const overlayTitle = overlayTitleSetting ? overlayTitleSetting.value : 'Willkommen beim Karaoke';

    // Get background video status from settings (default: true)
    const backgroundVideoSetting = await new Promise((resolve, reject) => {
      db.get(
        'SELECT value FROM settings WHERE key = ?',
        ['background_video_enabled'],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    const backgroundVideoEnabled = backgroundVideoSetting ? backgroundVideoSetting.value === 'true' : true; // Default: enabled

    // Generate QR code for /new endpoint
    let qrCodeDataUrl = null;
    try {
      // Get custom URL from settings
      const customUrlSetting = await new Promise((resolve, reject) => {
        db.get(
          'SELECT value FROM settings WHERE key = ?',
          ['custom_url'],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      const customUrl = customUrlSetting ? customUrlSetting.value : '';
      
      // Use same domain for QR code generation as fallback
      const protocol = req.get('x-forwarded-proto') || req.protocol;
      const host = req.get('host');
      const fallbackUrl = `${protocol}://${host}/new`;
      
      // Use centralized QR code generation function
      const { generateQRCodeDataUrl } = require('../utils/qrCodeGenerator');
      qrCodeDataUrl = await generateQRCodeDataUrl(customUrl, fallbackUrl);
      
    } catch (error) {
      console.error('Error generating QR code for show:', error);
    }

    // Verwende zentrale Video-Modi-Konfiguration für URL-Building
    const { findBestVideoMode } = require('../config/videoModes');

    console.log("ich hab hier das video", currentSong);
    let youtubeUrl = currentSong?.youtube_url;
    let songMode = currentSong?.mode || 'youtube';
    
    if (currentSong?.artist && currentSong?.title) {
      // Nur URL-Building durchführen, wenn die aktuelle URL nicht korrekt ist
      // (z.B. wenn sie noch eine YouTube-URL ist statt einer API-URL)
      const needsUrlUpdate = !currentSong.youtube_url || 
                            currentSong.youtube_url.includes('youtube.com') || 
                            currentSong.youtube_url.includes('youtu.be') ||
                            currentSong.youtube_url.includes('localhost:5000');
      
      if (needsUrlUpdate) {
        // Finde den besten verfügbaren Video-Modus für URL-Building
        const result = await findBestVideoMode(currentSong.artist, currentSong.title, currentSong.youtube_url, req);
        
        // URL und Modus aktualisieren, wenn ein besserer Modus gefunden wurde oder URL leer ist
        if (result.mode !== currentSong.mode || !currentSong.youtube_url) {
          songMode = result.mode;
          youtubeUrl = result.url;
          console.log(`🔄 Show: Updated song mode from ${currentSong.mode} to ${songMode} for: ${currentSong.artist} - ${currentSong.title}`);
        }
      } else {
        console.log(`✅ Show: Using existing API URL for: ${currentSong.artist} - ${currentSong.title} -> ${currentSong.youtube_url}`);
      }
    }

    res.json({
      currentSong: currentSong ? {
        id: currentSong.id,
        user_name: currentSong.user_name,
        artist: currentSong.artist,
        title: currentSong.title,
        youtube_url: youtubeUrl,
        mode: songMode,
        position: currentSong.position,
        duration_seconds: currentSong.duration_seconds,
        with_background_vocals: currentSong.with_background_vocals || false
      } : null,
      nextSongs,
      showQRCodeOverlay,
      qrCodeDataUrl,
      overlayTitle,
      backgroundVideoEnabled
    });
  } catch (error) {
    console.error('Error fetching show data:', error);
    res.status(500).json({ 
      message: 'Fehler beim Laden der Show-Daten',
      error: error.message 
    });
  }
});

module.exports = router;
