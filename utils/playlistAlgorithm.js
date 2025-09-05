const db = require('../config/database');
const Song = require('../models/Song');

class PlaylistAlgorithm {
  static async insertSong(songId) {
    try {
      // Get current playlist
      const playlist = await Song.getAll();
      
      // Get the new song to find its user ID and device ID
      const newSong = await Song.getById(songId);
      if (!newSong) {
        throw new Error('Song not found');
      }
      
      // Calculate priority based on name + device_id combination
      const priority = await this.calculatePriority(newSong.user_id, newSong.device_id);
      
      // Update the song's priority
      await this.updateSongPriority(songId, priority);
      
      // Add song to end of playlist
      const nextPosition = playlist.length === 0 ? 1 : Math.max(...playlist.map(song => song.position)) + 1;
      await Song.updatePosition(songId, nextPosition);
      
      // Apply priority-based sorting
      await this.sortByPriority();
      
      return nextPosition;
    } catch (error) {
      console.error('Error inserting song:', error);
      throw error;
    }
  }

  static async calculatePriority(userId, deviceId) {
    return new Promise((resolve, reject) => {
      // Get the user's name
      db.get(`
        SELECT name FROM users WHERE id = ?
      `, [userId], (err, user) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Count existing songs from users with the same name
        db.get(`
          SELECT COUNT(*) as count 
          FROM songs s 
          JOIN users u ON s.user_id = u.id 
          WHERE u.name = ?
        `, [user.name], (err, row) => {
          if (err) {
            reject(err);
          } else {
            // Priority = existing songs count + 1
            resolve((row.count || 0) + 1);
          }
        });
      });
    });
  }

  static async updateSongPriority(songId, priority) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE songs SET priority = ? WHERE id = ?',
        [priority, songId],
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

  static async sortByPriority() {
    return new Promise((resolve, reject) => {
      // Get all songs ordered by current position
      db.all(`
        SELECT s.*, u.name as user_name, u.device_id 
        FROM songs s 
        JOIN users u ON s.user_id = u.id 
        ORDER BY s.position ASC
      `, (err, songs) => {
        if (err) {
          reject(err);
          return;
        }

        // Sort songs by priority (ascending) - lower priority first
        songs.sort((a, b) => a.priority - b.priority);

        // Update positions based on new order
        let position = 1;
        const updatePromises = songs.map(song => {
          return new Promise((resolveUpdate, rejectUpdate) => {
            db.run(
              'UPDATE songs SET position = ? WHERE id = ?',
              [position++, song.id],
              function(err) {
                if (err) rejectUpdate(err);
                else resolveUpdate();
              }
            );
          });
        });

        Promise.all(updatePromises)
          .then(() => resolve())
          .catch(reject);
      });
    });
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