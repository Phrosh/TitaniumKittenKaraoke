/**
 * WebSocket Service für Echtzeit-Updates
 * Sendet Updates an alle verbundenen Show-Clients
 */

const Song = require('../models/Song');
const QRCode = require('qrcode');
const { findYouTubeSong } = require('./youtubeSongs');
const PlaylistAlgorithm = require('./playlistAlgorithm');

/**
 * Sendet Show-Updates an alle verbundenen Clients
 * @param {Object} io - Socket.IO Server Instance
 */
async function broadcastShowUpdate(io) {
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
        db.get('SELECT value FROM settings WHERE key = ?', ['custom_url'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      const customUrl = customUrlSetting ? customUrlSetting.value : 'localhost:5000';
      const qrCodeUrl = `http://${customUrl}/new`;
      qrCodeDataUrl = await QRCode.toDataURL(qrCodeUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }

    // Build YouTube URL
    let youtubeUrl = currentSong?.youtube_url;
    let songMode = currentSong?.mode || 'youtube';
    
    if (currentSong?.mode === 'file' && currentSong?.youtube_url) {
      // Get the configured port for file songs
      const portSetting = await new Promise((resolve, reject) => {
        db.get('SELECT value FROM settings WHERE key = ?', ['file_songs_port'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      const port = portSetting ? portSetting.value : '4000';
      youtubeUrl = `http://localhost:${port}/${encodeURIComponent(currentSong.youtube_url)}`;
    } else if (currentSong?.mode === 'youtube' && currentSong?.youtube_url && currentSong?.artist && currentSong?.title) {
      // Check if we have a local YouTube video in cache
      const youtubeSong = findYouTubeSong(currentSong.artist, currentSong.title);
      if (youtubeSong) {
        songMode = 'youtube_cache';
        // Build full URL with protocol and host
        const protocol = 'http'; // Default for local development
        const host = 'localhost:5000';
        youtubeUrl = `${protocol}://${host}/api/youtube-videos/${encodeURIComponent(youtubeSong.folderName)}/${encodeURIComponent(youtubeSong.videoFile)}`;
        console.log(`🎬 Using cached YouTube video: ${youtubeSong.folderName}/${youtubeSong.videoFile} -> ${youtubeUrl}`);
      } else {
        console.log(`🎬 No cached YouTube video found, using original URL: ${currentSong.youtube_url}`);
      }
    }

    const showData = {
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
      overlayTitle
    };

    // Send update to all clients in show room
    io.to('show').emit('show-update', showData);
    console.log(`📡 Broadcasted show update to ${io.sockets.adapter.rooms.get('show')?.size || 0} clients`);
    
  } catch (error) {
    console.error('Error broadcasting show update:', error);
  }
}

/**
 * Sendet einen Song-Wechsel Event
 * @param {Object} io - Socket.IO Server Instance
 * @param {Object} newSong - Der neue aktuelle Song
 */
async function broadcastSongChange(io, newSong) {
  try {
    await broadcastShowUpdate(io);
    console.log(`🎵 Broadcasted song change: ${newSong?.artist} - ${newSong?.title}`);
  } catch (error) {
    console.error('Error broadcasting song change:', error);
  }
}

/**
 * Sendet einen QR-Code Overlay Toggle Event
 * @param {Object} io - Socket.IO Server Instance
 * @param {boolean} show - Ob das Overlay angezeigt werden soll
 */
async function broadcastQRCodeToggle(io, show) {
  try {
    await broadcastShowUpdate(io);
    console.log(`📱 Broadcasted QR code overlay toggle: ${show}`);
  } catch (error) {
    console.error('Error broadcasting QR code toggle:', error);
  }
}

/**
 * Sendet Admin-Dashboard Updates
 * @param {Object} io - Socket.IO Server Instance
 */
async function broadcastAdminUpdate(io) {
  try {
    const Song = require('../models/Song');
    const User = require('../models/User');
    
    const playlist = await Song.getAll();
    const currentSong = await Song.getCurrentSong();
    const maxDelay = await PlaylistAlgorithm.getMaxDelaySetting();
    
    // Get settings
    const db = require('../config/database');
    const settings = await new Promise((resolve, reject) => {
      db.all('SELECT key, value FROM settings', (err, rows) => {
        if (err) reject(err);
        else {
          const settingsObj = {};
          rows.forEach(row => {
            settingsObj[row.key] = row.value;
          });
          resolve(settingsObj);
        }
      });
    });

    const adminData = {
      playlist,
      currentSong,
      maxDelay,
      total: playlist.length,
      settings
    };

    // Send update to all clients in admin room
    io.to('admin').emit('admin-update', adminData);
    console.log(`📊 Broadcasted admin update to ${io.sockets.adapter.rooms.get('admin')?.size || 0} clients`);
    
  } catch (error) {
    console.error('Error broadcasting admin update:', error);
  }
}

/**
 * Sendet Playlist-Updates für öffentliche Playlist-Ansicht
 * @param {Object} io - Socket.IO Server Instance
 */
async function broadcastPlaylistUpdate(io) {
  try {
    const Song = require('../models/Song');
    
    const playlist = await Song.getAll();
    const currentSong = await Song.getCurrentSong();
    const maxDelay = await PlaylistAlgorithm.getMaxDelaySetting();

    const playlistData = {
      playlist,
      currentSong,
      maxDelay,
      total: playlist.length
    };

    // Send update to all clients in playlist room
    io.to('playlist').emit('playlist-update', playlistData);
    console.log(`📋 Broadcasted playlist update to ${io.sockets.adapter.rooms.get('playlist')?.size || 0} clients`);
    
  } catch (error) {
    console.error('Error broadcasting playlist update:', error);
  }
}

module.exports = {
  broadcastShowUpdate,
  broadcastSongChange,
  broadcastQRCodeToggle,
  broadcastAdminUpdate,
  broadcastPlaylistUpdate
};
