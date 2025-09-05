const db = require('../config/database');
const Song = require('../models/Song');

class PlaylistAlgorithm {
  static async insertSong(songId) {
    try {
      // Get current playlist
      const playlist = await Song.getAll();
      
      // Get max delay setting
      const maxDelay = await this.getMaxDelaySetting();
      
      // Find optimal position
      const optimalPosition = this.findOptimalPosition(playlist, maxDelay);
      
      // Update positions for songs that need to be shifted
      await this.shiftPositions(optimalPosition);
      
      // Set the new song's position
      await Song.updatePosition(songId, optimalPosition);
      
      return optimalPosition;
    } catch (error) {
      console.error('Error inserting song:', error);
      throw error;
    }
  }

  static findOptimalPosition(playlist, maxDelay) {
    if (playlist.length === 0) {
      return 1;
    }

    // Group songs by user
    const userSongCounts = {};
    const userLastPositions = {};
    
    playlist.forEach(song => {
      const userId = song.user_id;
      userSongCounts[userId] = (userSongCounts[userId] || 0) + 1;
      userLastPositions[userId] = song.position;
    });

    // Find users with only one song (should be prioritized)
    const usersWithOneSong = Object.keys(userSongCounts).filter(
      userId => userSongCounts[userId] === 1
    );

    // If there are users with only one song, try to place new song before their songs
    if (usersWithOneSong.length > 0) {
      const minPosition = Math.min(
        ...usersWithOneSong.map(userId => userLastPositions[userId])
      );
      
      // Check if we can insert before this position without exceeding max delay
      const songsToShift = playlist.filter(song => song.position >= minPosition);
      const canShift = songsToShift.every(song => song.delay_count < maxDelay);
      
      if (canShift) {
        return minPosition;
      }
    }

    // Otherwise, find the best position considering fairness
    return this.findFairPosition(playlist, userSongCounts, maxDelay);
  }

  static findFairPosition(playlist, userSongCounts, maxDelay) {
    // Sort users by song count (ascending) and last position (ascending)
    const sortedUsers = Object.keys(userSongCounts).sort((a, b) => {
      if (userSongCounts[a] !== userSongCounts[b]) {
        return userSongCounts[a] - userSongCounts[b];
      }
      return userLastPositions[a] - userLastPositions[b];
    });

    // Try to find a position that maintains fairness
    for (let i = 0; i < sortedUsers.length; i++) {
      const userId = sortedUsers[i];
      const userSongs = playlist.filter(song => song.user_id == userId);
      
      // Find the earliest position where we can insert without exceeding max delay
      for (let j = 0; j < userSongs.length; j++) {
        const song = userSongs[j];
        const insertPosition = song.position;
        
        // Check if inserting here would exceed max delay for any song
        const songsToShift = playlist.filter(s => s.position >= insertPosition);
        const wouldExceedDelay = songsToShift.some(s => s.delay_count >= maxDelay);
        
        if (!wouldExceedDelay) {
          return insertPosition;
        }
      }
    }

    // If no fair position found, append to end
    return Math.max(...playlist.map(song => song.position)) + 1;
  }

  static async shiftPositions(fromPosition) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE songs SET position = position + 1 WHERE position >= ?',
        [fromPosition],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ changes: this.changes });
          }
        }
      );
    });
  }

  static async incrementDelayCounts(fromPosition) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE songs SET delay_count = delay_count + 1 WHERE position >= ?',
        [fromPosition],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ changes: this.changes });
          }
        }
      );
    });
  }

  static async getMaxDelaySetting() {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT value FROM settings WHERE key = ?',
        ['max_song_delay'],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(parseInt(row?.value || '15'));
          }
        }
      );
    });
  }

  static async updateMaxDelaySetting(maxDelay) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
        [maxDelay.toString(), 'max_song_delay'],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ changes: this.changes });
          }
        }
      );
    });
  }
}

module.exports = PlaylistAlgorithm;