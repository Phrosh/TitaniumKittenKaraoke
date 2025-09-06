const express = require('express');
const router = express.Router();
const Song = require('../models/Song');
const QRCode = require('qrcode');

// GET /show - Zeige aktuelles Video und nächste Songs
router.get('/', async (req, res) => {
  try {
    const currentSong = await Song.getCurrentSong();
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
      
      let qrUrl;
      if (customUrl && customUrl.trim()) {
        // Use custom URL + /new
        qrUrl = customUrl.trim().replace(/\/$/, '') + '/new';
      } else {
        // Use environment CLIENT_URL + /new, fallback to current domain
        const CLIENT_URL = (process.env.CLIENT_URL && process.env.CLIENT_URL.trim()) || 'http://localhost:3000';
        qrUrl = CLIENT_URL.replace(/\/$/, '') + '/new';
      }

      console.log('🔍 Show QR Code Debug:', { 
        customUrl, 
        qrUrl, 
        protocol: req.get('x-forwarded-proto') || req.protocol,
        host: req.get('host'),
        originalUrl: req.originalUrl
      });
      
      qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 300
      });
      
      console.log('🔍 Show QR Code Generated:', {
        qrUrl,
        dataUrlLength: qrCodeDataUrl ? qrCodeDataUrl.length : 0,
        dataUrlStart: qrCodeDataUrl ? qrCodeDataUrl.substring(0, 50) + '...' : 'null'
      });
    } catch (error) {
      console.error('Error generating QR code for show:', error);
    }

    res.json({
      currentSong: currentSong ? {
        id: currentSong.id,
        user_name: currentSong.user_name,
        artist: currentSong.artist,
        title: currentSong.title,
        youtube_url: currentSong.youtube_url,
        position: currentSong.position,
        duration_seconds: currentSong.duration_seconds
      } : null,
      nextSongs,
      showQRCodeOverlay,
      qrCodeDataUrl,
      overlayTitle
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
