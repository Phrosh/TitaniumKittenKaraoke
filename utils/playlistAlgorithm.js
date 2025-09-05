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
            return;
          }
          
          const userSongCount = row.count || 0;
          
          // Get current song's priority
          db.get(`
            SELECT s.priority 
            FROM songs s 
            WHERE s.id = (
              SELECT CAST(value AS INTEGER) 
              FROM settings 
              WHERE key = 'current_song_id'
            )
          `, (err, currentSong) => {
            if (err) {
              reject(err);
              return;
            }
            
            // Minimum priority is current song's priority (or 1 if no current song)
            const minPriority = currentSong ? currentSong.priority : 1;
            
            // User's priority is max of: (user's song count + 1) and minPriority
            const finalPriority = Math.max(userSongCount + 1, minPriority);
            
            resolve(finalPriority);
          });
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

        // Update positions and apply regression
        let position = 1;
        const updatePromises = songs.map((song, index) => {
          return new Promise(async (resolveUpdate, rejectUpdate) => {
            const oldPosition = song.position;
            const newPosition = position++;
            
            // If song moved down (higher position number), apply regression
            if (newPosition > oldPosition) {
              await this.applyRegression(song.id);
            }
            
            db.run(
              'UPDATE songs SET position = ? WHERE id = ?',
              [newPosition, song.id],
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

  static async applyRegression(songId) {
    try {
      // Get regression value from settings
      const regressionValue = await this.getRegressionValue();
      
      // Increment regression count
      await Song.incrementRegressionCount(songId);
      
      // Get current priority
      const song = await Song.getById(songId);
      if (song) {
        // Reduce priority by regression value
        const newPriority = Math.max(0.1, song.priority - regressionValue);
        await Song.updatePriority(songId, newPriority);
      }
    } catch (error) {
      console.error('Error applying regression:', error);
    }
  }

  static async getRegressionValue() {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT value FROM settings WHERE key = 'regression_value'
      `, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(parseFloat(row ? row.value : '0.1'));
        }
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