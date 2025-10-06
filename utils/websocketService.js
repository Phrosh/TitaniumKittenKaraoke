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

    // Verwende zentrale Video-Modi-Konfiguration für URL-Building
    const { findBestVideoMode } = require('../config/videoModes');
    let youtubeUrl = currentSong?.youtube_url;
    let songMode = currentSong?.mode || 'youtube';
    
    if (currentSong?.artist && currentSong?.title) {
      // Finde den besten verfügbaren Video-Modus für URL-Building
      const result = await findBestVideoMode(currentSong.artist, currentSong.title, currentSong.youtube_url, null);
      
      // Nur URL und Modus aktualisieren, wenn ein besserer Modus gefunden wurde
      if (result.mode !== currentSong.mode) {
        songMode = result.mode;
        youtubeUrl = result.url;
        console.log(`🔄 WebSocket: Updated song mode from ${currentSong.mode} to ${songMode} for: ${currentSong.artist} - ${currentSong.title}`);
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
    
    // Send specific QR overlay toggle event for autonomous overlay
    io.emit('qr-overlay-toggle', { show });
    
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

/**
 * Sendet Play/Pause Toggle Event
 * @param {Object} io - Socket.IO Server Instance
 */
async function broadcastTogglePlayPause(io) {
  try {
    // Send toggle event to all clients in show room
    io.to('show').emit('toggle-play-pause');
    console.log(`⏯️ Broadcasted play/pause toggle to ${io.sockets.adapter.rooms.get('show')?.size || 0} clients`);
  } catch (error) {
    console.error('Error broadcasting play/pause toggle:', error);
  }
}

/**
 * Sendet Song Restart Event
 * @param {Object} io - Socket.IO Server Instance
 * @param {Object} song - Der Song der neu gestartet werden soll
 */
async function broadcastRestartSong(io, song) {
  try {
    // Send restart event to all clients in show room
    io.to('show').emit('restart-song', song);
    console.log(`🔄 Broadcasted song restart: ${song?.artist} - ${song?.title} to ${io.sockets.adapter.rooms.get('show')?.size || 0} clients`);
  } catch (error) {
    console.error('Error broadcasting song restart:', error);
  }
}

/**
 * Sendet Next-Song Event an alle verbundenen Clients
 * @param {Object} io - Socket.IO Server Instance
 * @param {Object} song - Der aktuelle Song
 */
async function broadcastNextSong(io, song) {
  try {
    // Send next song event to all clients in show room
    io.to('show').emit('next-song', song);
    console.log(`⏭️ Broadcasted next song: ${song?.artist} - ${song?.title} to ${io.sockets.adapter.rooms.get('show')?.size || 0} clients`);
  } catch (error) {
    console.error('Error broadcasting next song:', error);
  }
}

/**
 * Sendet Previous-Song Event an alle verbundenen Clients
 * @param {Object} io - Socket.IO Server Instance
 * @param {Object} song - Der aktuelle Song
 */
async function broadcastPreviousSong(io, song) {
  try {
    // Send previous song event to all clients in show room
    io.to('show').emit('previous-song', song);
    console.log(`⏮️ Broadcasted previous song: ${song?.artist} - ${song?.title} to ${io.sockets.adapter.rooms.get('show')?.size || 0} clients`);
  } catch (error) {
    console.error('Error broadcasting previous song:', error);
  }
}

/**
 * Sendet Show-Action Event an Admin-Clients
 * @param {Object} io - Socket.IO Server Instance
 * @param {string} action - Die ausgeführte Aktion
 * @param {Object} data - Zusätzliche Daten
 */
async function broadcastShowActionToAdmin(io, action, data = {}) {
  try {
    if (io) {
      io.to('admin').emit('show-action', {
        action,
        timestamp: new Date().toISOString(),
        ...data
      });
      console.log(`📡 Show action '${action}' broadcasted to admin clients`);
    }
  } catch (error) {
    console.error('Error broadcasting show action to admin:', error);
  }
}

/**
 * Sendet Playlist-Upgrade-Benachrichtigungen an Admin-Dashboard
 * @param {Object} io - Socket.IO Server Instance
 * @param {Object} data - Upgrade-Daten
 */
async function broadcastPlaylistUpgrade(io, data) {
  try {
    // Send upgrade notification to all clients in admin room
    io.to('admin').emit('playlist_upgrade', data);
    console.log(`🎉 Broadcasted playlist upgrade notification to ${io.sockets.adapter.rooms.get('admin')?.size || 0} clients`);
    
  } catch (error) {
    console.error('Error broadcasting playlist upgrade notification:', error);
  }
}

/**
 * Sendet USDB-Download-Benachrichtigungen an Admin-Dashboard
 * @param {Object} io - Socket.IO Server Instance
 * @param {Object} data - Download-Daten
 */
async function broadcastUSDBDownloadNotification(io, data) {
  try {
    console.log('📡 WebSocket: Broadcasting USDB download notification:', {
      event: 'usdb_download',
      data: data,
      adminRoomSize: io.sockets.adapter.rooms.get('admin')?.size || 0,
      timestamp: new Date().toISOString()
    });

    // Send download notification to all clients in admin room
    io.to('admin').emit('usdb_download', data);
    console.log(`📥 WebSocket: USDB download notification broadcasted to ${io.sockets.adapter.rooms.get('admin')?.size || 0} clients`);
    
  } catch (error) {
    console.error('📡 WebSocket: Error broadcasting USDB download notification:', error);
  }
}

/**
 * Sendet Song-Approval-Benachrichtigung an Admin Dashboard
 * @param {Object} io - Socket.IO Server Instance
 * @param {Object} approvalData - Approval request data
 */
async function broadcastSongApprovalNotification(io, approvalData) {
  try {
    if (io && io.sockets) {
      io.to('admin').emit('song-approval-request', {
        type: 'song-approval-request',
        data: approvalData,
        timestamp: new Date().toISOString()
      });
      
      console.log(`📡 WebSocket: Broadcasted song approval request: ${approvalData.artist} - ${approvalData.title} (${approvalData.singer_name})`);
    }
  } catch (error) {
    console.error('📡 WebSocket: Error broadcasting song approval notification:', error);
  }
}

/**
 * Broadcast processing status updates (e.g., separating, transcribing, downloading, failed, finished)
 * @param {Object} io - Socket.IO Server Instance
 * @param {{ id?: number, artist?: string, title?: string, status: string }} data
 */
async function broadcastProcessingStatus(io, data) {
  try {
    if (!data || !data.status) return;
    io.emit('processing-status', data);
    console.log(`📡 Broadcasted processing-status:`, {
      data,
      totalClients: io.engine?.clientsCount || 0,
      adminRoom: io.sockets.adapter.rooms.get('admin')?.size || 0,
      playlistRoom: io.sockets.adapter.rooms.get('playlist')?.size || 0,
    });
  } catch (error) {
    console.error('Error broadcasting processing status:', error);
  }
}

module.exports = {
  broadcastShowUpdate,
  broadcastSongChange,
  broadcastQRCodeToggle,
  broadcastAdminUpdate,
  broadcastPlaylistUpdate,
  broadcastTogglePlayPause,
  broadcastRestartSong,
  broadcastNextSong,
  broadcastPreviousSong,
  broadcastShowActionToAdmin,
  broadcastPlaylistUpgrade,
  broadcastUSDBDownloadNotification,
  broadcastProcessingStatus,
  broadcastSongApprovalNotification
};
