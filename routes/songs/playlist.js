const express = require('express');
const Song = require('../../models/Song');
const db = require('../../config/database');
const { estimateQueueForDevice } = require('../../utils/queueEstimate');
const { getCurrentSongRemainingSeconds } = require('../../utils/websocketService');
const router = express.Router();

// Get current playlist (public endpoint)
router.get('/playlist', async (req, res) => {
  try {
    const playlist = await Song.getAll();
    const currentSong = await Song.getCurrentSong();
    
    res.json({
      playlist,
      currentSong,
      total: playlist.length
    });
  } catch (error) {
    console.error('Get playlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Warteschlangen-Status für einen Gast (öffentlich, anhand deviceId)
router.get('/my-queue', async (req, res) => {
  try {
    const deviceId = String(req.query.deviceId || '').trim();
    if (!deviceId || deviceId.length !== 3) {
      return res.status(400).json({ message: 'deviceId required (3 characters)' });
    }

    const playlist = await Song.getAll();
    const currentSong = await Song.getCurrentSong();
    const remainingSeconds = currentSong
      ? getCurrentSongRemainingSeconds(currentSong.id)
      : null;

    const queuedItems = estimateQueueForDevice(
      playlist,
      currentSong,
      deviceId,
      remainingSeconds
    );

    const pendingApprovals = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, artist, title, singer_name, created_at
         FROM song_approvals
         WHERE device_id = ? AND status = 'pending'
         ORDER BY created_at ASC`,
        [deviceId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    const pendingItems = pendingApprovals.map((row) => ({
      id: row.id,
      artist: row.artist,
      title: row.title,
      singerName: row.singer_name,
      createdAt: row.created_at,
      status: 'pending_approval',
      songsBefore: null,
      estimatedWaitSeconds: null,
    }));

    res.json({
      items: [...queuedItems, ...pendingItems],
      currentSongId: currentSong?.id ?? null,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get my-queue error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get pending songs (songs without YouTube URLs)
router.get('/pending', async (req, res) => {
  try {
    const pendingSongs = await Song.getPending();
    res.json({ pendingSongs });
  } catch (error) {
    console.error('Get pending songs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
