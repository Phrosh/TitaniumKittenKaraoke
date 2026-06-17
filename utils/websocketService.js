/**
 * WebSocket Service für Echtzeit-Updates
 * Sendet Updates an alle verbundenen Show-Clients
 */

const Song = require('../models/Song');
const { findYouTubeSong } = require('./youtubeSongs');
const PlaylistAlgorithm = require('./playlistAlgorithm');

/** Letzter Song-Start fürs Admin-Dashboard (für Sync nach Reconnect / Seitenreload). */
let lastAdminSongStart = null;

function getCurrentSongRemainingSeconds(currentSongId) {
  if (!lastAdminSongStart || !lastAdminSongStart.durationSeconds) return null;
  if (currentSongId && lastAdminSongStart.songId !== currentSongId) return null;
  const elapsed = (Date.now() - new Date(lastAdminSongStart.startTimestamp).getTime()) / 1000;
  return Math.max(0, lastAdminSongStart.durationSeconds - elapsed);
}

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

    const showMutedSetting = await new Promise((resolve, reject) => {
      db.get(
        'SELECT value FROM settings WHERE key = ?',
        ['show_muted'],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    const showMuted = showMutedSetting ? showMutedSetting.value === 'true' : false;

    const projectionModeSetting = await new Promise((resolve, reject) => {
      db.get(
        'SELECT value FROM settings WHERE key = ?',
        ['show_projection_mode'],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    const showProjectionMode = projectionModeSetting ? projectionModeSetting.value === 'true' : false;

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
      
      const customUrl = customUrlSetting ? customUrlSetting.value : '';
      
      // Only generate QR code if custom URL is set, otherwise return null
      // This prevents generating QR codes with wrong fallback URLs
      // The frontend will keep the last valid QR code if this is null
      if (customUrl && customUrl.trim()) {
        // Use centralized QR code generation function
        const { generateQRCodeDataUrl } = require('./qrCodeGenerator');
        // Use custom URL as both custom and fallback since it's set
        qrCodeDataUrl = await generateQRCodeDataUrl(customUrl, customUrl);
      } else {
        // No custom URL set - return null to keep existing QR code in frontend
        qrCodeDataUrl = null;
      }
    } catch (error) {
      console.error('Error generating QR code:', error);
      qrCodeDataUrl = null;
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

    const donationsStore = require('./donationsStore');
    const { loadDonationDisplaySettings } = require('./donationDisplaySettings');
    const { getEmergencyYouTubePending } = require('./emergencyYouTubeState');
    const donationDisplay = await loadDonationDisplaySettings();
    const emergencyYouTube = getEmergencyYouTubePending();
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
        with_background_vocals: currentSong.with_background_vocals || false,
        pitch: currentSong.pitch ?? 0
      } : null,
      nextSongs,
      showQRCodeOverlay,
      qrCodeDataUrl,
      overlayTitle,
      backgroundVideoEnabled,
      showMuted,
      showProjectionMode,
      sessionDonors: donationsStore.getSessionDonors(),
      ...donationDisplay,
      emergencyYouTube,
    };

    // Send update to all clients in show room
    io.to('show').emit('show-update', showData);
    console.log(`📡 Broadcasted show update to ${io.sockets.adapter.rooms.get('show')?.size || 0} clients`);
    
  } catch (error) {
    console.error('Error broadcasting show update:', error);
  }
}

/**
 * Notfall-YouTube zurücksetzen und Show-Audio wieder aktivieren (Songwechsel).
 * @param {Object} io
 */
async function resetShowMediaOnSongChange(io) {
  const db = require('../config/database');
  const { clearEmergencyYouTubePending } = require('./emergencyYouTubeState');

  clearEmergencyYouTubePending();

  await new Promise((resolve, reject) => {
    db.run(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      ['show_muted', 'false'],
      function (err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });

  io.emit('show-mute-toggle', { muted: false });
  console.log('🔇 Song change: emergency YouTube cleared, show unmuted');
}

/**
 * Sendet einen Song-Wechsel Event
 * @param {Object} io - Socket.IO Server Instance
 * @param {Object} newSong - Der neue aktuelle Song
 */
async function broadcastSongChange(io, newSong) {
  try {
    await resetShowMediaOnSongChange(io);
    if (newSong) {
      await broadcastSongStart(io, newSong, false);
    } else {
      lastAdminSongStart = null;
      io.to('show').emit('queue-refresh', {
        currentSongId: null,
        timestamp: new Date().toISOString(),
      });
    }
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
 * Sendet einen Background Video Toggle Event
 * @param {Object} io - Socket.IO Server Instance
 * @param {boolean} enabled - Ob das Hintergrundvideo aktiviert ist
 */
async function broadcastBackgroundVideoToggle(io, enabled) {
  try {
    // Send background video toggle event to all clients
    io.emit('background-video-toggle', { enabled });
    
    console.log(`🎬 Broadcasted background video toggle: ${enabled}`);
  } catch (error) {
    console.error('Error broadcasting background video toggle:', error);
  }
}

/**
 * @param {Object} io
 * @param {boolean} muted
 */
async function broadcastShowMuteToggle(io, muted) {
  try {
    io.emit('show-mute-toggle', { muted });
    console.log(`🔇 Broadcasted show mute toggle: ${muted}`);
  } catch (error) {
    console.error('Error broadcasting show mute toggle:', error);
  }
}

/**
 * @param {Object} io
 * @param {{ youtubeUrl: string }} data
 */
async function broadcastEmergencyYouTube(io, data) {
  try {
    io.emit('emergency-youtube', data);
    console.log(`🆘 Broadcasted emergency YouTube: ${data.youtubeUrl}`);
  } catch (error) {
    console.error('Error broadcasting emergency YouTube:', error);
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
          const { sanitizeSettingsForClient } = require('./settingsSanitize');
          resolve(sanitizeSettingsForClient(settingsObj));
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
 * Sendet Song-Start-Event mit Timestamp an Admin Dashboard
 * @param {Object} io - Socket.IO Server Instance
 * @param {Object} song - Der Song der gestartet wurde
 * @param {boolean} isRestart - Ob es ein Neustart ist
 */
async function broadcastSongStart(io, song, isRestart = false) {
  try {
    const startTimestamp = new Date().toISOString();
    
    // Versuche, die Dauer aus der Datei zu lesen, wenn nicht in DB vorhanden
    let durationSeconds = song.duration_seconds;
    if (!durationSeconds || durationSeconds === null) {
      const { getSongDuration } = require('./getFileDuration');
      durationSeconds = await getSongDuration(song);
      console.log(`⏱️ Read duration from file: ${durationSeconds}s for ${song?.artist} - ${song?.title}`);
    }
    
    // Log song data for debugging
    console.log(`⏱️ Broadcasting song start:`, {
      songId: song.id,
      artist: song.artist,
      title: song.title,
      duration_seconds: durationSeconds,
      hasDuration: durationSeconds !== null && durationSeconds !== undefined
    });
    
    const payload = {
      songId: song.id,
      startTimestamp,
      durationSeconds: durationSeconds ?? null,
      isRestart,
      timestamp: startTimestamp
    };
    lastAdminSongStart = payload;

    io.to('admin').emit('song-start', payload);
    io.to('show').emit('queue-refresh', {
      currentSongId: song.id,
      timestamp: startTimestamp,
      isRestart,
    });
    
    console.log(`⏱️ Broadcasted song start to admin: ${song?.artist} - ${song?.title} (${startTimestamp}, duration: ${durationSeconds || 'null'})`);
  } catch (error) {
    console.error('Error broadcasting song start:', error);
  }
}

/**
 * Sendet den letzten Song-Start nur an einen Socket (z. B. nach join-admin),
 * damit die Fortschrittsleiste auch nach Reload funktioniert.
 */
async function syncAdminSongStartToSocket(socket) {
  try {
    if (!socket || !lastAdminSongStart) return;
    const current = await Song.getCurrentSong();
    if (!current || current.id !== lastAdminSongStart.songId) return;

    let durationSeconds = lastAdminSongStart.durationSeconds;
    if (!durationSeconds && current.duration_seconds > 0) {
      durationSeconds = current.duration_seconds;
    }

    socket.emit('song-start', {
      ...lastAdminSongStart,
      durationSeconds: durationSeconds ?? null,
      timestamp: lastAdminSongStart.startTimestamp
    });
    console.log(`⏱️ Sent song-start sync to admin socket ${socket.id} (song ${current.id})`);
  } catch (error) {
    console.error('Error syncing admin song start:', error);
  }
}

/**
 * Sendet Play/Pause-Status an Admin Dashboard
 * @param {Object} io - Socket.IO Server Instance
 * @param {boolean} isPlaying - Ob der Song gerade spielt
 */
async function broadcastPlayPauseStatus(io, isPlaying) {
  try {
    io.to('admin').emit('play-pause-status', {
      isPlaying,
      timestamp: new Date().toISOString()
    });
    
    console.log(`⏯️ Broadcasted play/pause status to admin: ${isPlaying ? 'playing' : 'paused'}`);
  } catch (error) {
    console.error('Error broadcasting play/pause status:', error);
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
    console.log(`⏯️ Broadcasted play/pause toggle to ${io.sockets.adapter.rooms.get('show')?.size || 0} clients in show room`);
    
    // Also send to admin room so admin dashboard can update play/pause state
    io.to('admin').emit('toggle-play-pause');
    console.log(`⏯️ Broadcasted play/pause toggle to ${io.sockets.adapter.rooms.get('admin')?.size || 0} clients in admin room`);
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

/**
 * Broadcast queue status updates (e.g., queue length, processing status)
 * @param {Object} io - Socket.IO Server Instance
 * @param {{ type: string, queue_length: number, is_processing: boolean, current_job?: string, finished_jobs: number, total_jobs: number }} data
 */
async function broadcastQueueStatus(io, data) {
  try {
    if (!data || !data.type) return;
    io.emit('queue-status', data);
    console.log(`📡 Broadcasted queue-status:`, {
      data,
      totalClients: io.engine?.clientsCount || 0,
      adminRoom: io.sockets.adapter.rooms.get('admin')?.size || 0,
      playlistRoom: io.sockets.adapter.rooms.get('playlist')?.size || 0,
    });
  } catch (error) {
    console.error('Error broadcasting queue status:', error);
  }
}

module.exports = {
  getCurrentSongRemainingSeconds,
  broadcastSongStart,
  syncAdminSongStartToSocket,
  broadcastPlayPauseStatus,
  broadcastShowUpdate,
  broadcastSongChange,
  broadcastQRCodeToggle,
  broadcastBackgroundVideoToggle,
  broadcastShowMuteToggle,
  broadcastEmergencyYouTube,
  broadcastAdminUpdate,
  broadcastPlaylistUpdate,
  broadcastTogglePlayPause,
  broadcastRestartSong,
  broadcastUSDBDownloadNotification,
  broadcastProcessingStatus,
  broadcastQueueStatus,
  broadcastSongApprovalNotification
};
