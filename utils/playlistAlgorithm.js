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
      
      // Get current song position
      const currentSongPosition = await this.getCurrentSongPosition();
      
      // Calculate minimum position for new song
      // If there's a current song, new song must be at least 4 positions after it
      // If playlist has less than 4 songs, allow normal insertion
      let minPosition = 1;
      if (currentSongPosition !== null && playlist.length >= 4) {
        minPosition = currentSongPosition + 4;
      }
      
      // Calculate priority based on name + device_id combination
      const priority = await this.calculatePriority(newSong.user_id, newSong.device_id);
      
      // Update the song's priority
      await this.updateSongPriority(songId, priority);
      
      // Add song to end of playlist or at minimum position
      const maxPosition = playlist.length === 0 ? 0 : Math.max(...playlist.map(song => song.position));
      const nextPosition = Math.max(minPosition, maxPosition + 1);
      await Song.updatePosition(songId, nextPosition);
      
      // Apply priority-based sorting (with constraints)
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
    return new Promise(async (resolve, reject) => {
      try {
        // Get current song position and ID
        const currentSongPosition = await this.getCurrentSongPosition();
        const currentSongId = await this.getCurrentSongId();
        const minPositionAfterCurrent = currentSongPosition !== null ? currentSongPosition + 4 : 1;
        
        // Get all songs ordered by current position
        db.all(`
          SELECT s.*, u.name as user_name, u.device_id 
          FROM songs s 
          JOIN users u ON s.user_id = u.id 
          ORDER BY s.position ASC
        `, async (err, songs) => {
          if (err) {
            reject(err);
            return;
          }

          // Separate songs into three groups: before/at current position, next 3 songs after current, and rest
          // Do this BEFORE sorting, based on current positions
          const songsBeforeOrAtCurrent = [];
          const nextThreeSongs = []; // The next 3 songs after current song (protected positions)
          const songsAfterProtected = []; // Songs after the protected 3-song zone
          
          songs.forEach(song => {
            if (currentSongId && song.id === currentSongId) {
              // Current song stays at its position
              songsBeforeOrAtCurrent.push(song);
            } else if (currentSongPosition !== null && song.position <= currentSongPosition) {
              // Songs before or at current position
              songsBeforeOrAtCurrent.push(song);
            } else if (currentSongPosition !== null && song.position > currentSongPosition && song.position <= currentSongPosition + 3) {
              // Next 3 songs after current position (protected zone)
              nextThreeSongs.push(song);
            } else {
              // Songs after the protected 3-song zone
              songsAfterProtected.push(song);
            }
          });
          
          // Sort nextThreeSongs by position to maintain their order
          nextThreeSongs.sort((a, b) => a.position - b.position);

          // Sort each group by priority (ascending) - lower priority first
          // Use stable sort with tolerance to preserve manual ordering when priorities are very similar
          const PRIORITY_TOLERANCE = 0.01; // If priorities differ by less than this, preserve current order
          songsBeforeOrAtCurrent.sort((a, b) => {
            const priorityDiff = a.priority - b.priority;
            // If priorities are very similar, preserve current order (stable sort)
            if (Math.abs(priorityDiff) < PRIORITY_TOLERANCE) {
              return a.position - b.position;
            }
            return priorityDiff;
          });
          // nextThreeSongs are already sorted by position - don't re-sort them
          // Sort songs after protected zone by priority
          songsAfterProtected.sort((a, b) => {
            const priorityDiff = a.priority - b.priority;
            // If priorities are very similar, preserve current order (stable sort)
            if (Math.abs(priorityDiff) < PRIORITY_TOLERANCE) {
              return a.position - b.position;
            }
            return priorityDiff;
          });

          // Update positions and apply regression
          let position = 1;
          const updatePromises = [];
          
          // First, assign positions to songs before/at current position
          for (const song of songsBeforeOrAtCurrent) {
            const oldPosition = song.position;
            const newPosition = position++;
            
            // If song moved down (higher position number), apply regression
            if (newPosition > oldPosition) {
              await this.applyRegression(song.id);
            }
            
            updatePromises.push(new Promise((resolveUpdate, rejectUpdate) => {
              db.run(
                'UPDATE songs SET position = ? WHERE id = ?',
                [newPosition, song.id],
                function(err) {
                  if (err) rejectUpdate(err);
                  else resolveUpdate();
                }
              );
            }));
          }
          
          // Then, assign positions to the next 3 songs (protected zone) - maintain their relative order
          for (const song of nextThreeSongs) {
            const oldPosition = song.position;
            const newPosition = position++;
            
            // If song moved down (higher position number), apply regression
            if (newPosition > oldPosition) {
              await this.applyRegression(song.id);
            }
            
            updatePromises.push(new Promise((resolveUpdate, rejectUpdate) => {
              db.run(
                'UPDATE songs SET position = ? WHERE id = ?',
                [newPosition, song.id],
                function(err) {
                  if (err) rejectUpdate(err);
                  else resolveUpdate();
                }
              );
            }));
          }
          
          // Finally, assign positions to songs after the protected zone
          // Ensure they don't go before minPositionAfterCurrent
          // Start from the maximum of current position counter and minPositionAfterCurrent
          let positionAfterProtected = Math.max(position, minPositionAfterCurrent);
          
          for (const song of songsAfterProtected) {
            const oldPosition = song.position;
            const newPosition = positionAfterProtected++;
            
            // If song moved down (higher position number), apply regression
            if (newPosition > oldPosition) {
              await this.applyRegression(song.id);
            }
            
            updatePromises.push(new Promise((resolveUpdate, rejectUpdate) => {
              db.run(
                'UPDATE songs SET position = ? WHERE id = ?',
                [newPosition, song.id],
                function(err) {
                  if (err) rejectUpdate(err);
                  else resolveUpdate();
                }
              );
            }));
          }

          Promise.all(updatePromises)
            .then(() => resolve())
            .catch(reject);
        });
      } catch (error) {
        reject(error);
      }
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

  static async getCurrentSongPosition() {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT s.position 
        FROM songs s 
        WHERE s.id = (
          SELECT CAST(value AS INTEGER) 
          FROM settings 
          WHERE key = 'current_song_id'
        )
      `, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? row.position : null);
        }
      });
    });
  }

  static async getCurrentSongId() {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT CAST(value AS INTEGER) as id
        FROM settings 
        WHERE key = 'current_song_id'
      `, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? row.id : null);
        }
      });
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