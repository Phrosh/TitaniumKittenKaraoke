const db = require('../config/database');
const songCache = require('../utils/songCache');

class Song {
  static create(userId, title, artist = null, youtubeUrl = null, priority = 1.0, durationSeconds = null, mode = 'youtube', withBackgroundVocals = false) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO songs (user_id, title, artist, youtube_url, priority, duration_seconds, mode, with_background_vocals) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, title, artist, youtubeUrl, priority, durationSeconds, mode, withBackgroundVocals ? 1 : 0],
        function(err) {
          if (err) {
            reject(err);
          } else {
            const newSong = { id: this.lastID, user_id: userId, title, artist, youtube_url: youtubeUrl, priority, duration_seconds: durationSeconds, mode, with_background_vocals: withBackgroundVocals };
            // Update cache
            if (songCache && typeof songCache.addSongToCache === 'function') {
              songCache.addSongToCache(newSong);
            }
            resolve(newSong);
          }
        }
      );
    });
  }

  static createFromUSDB(artist, title, folderName, source = 'USDB', userId = null, songData = null) {
    return new Promise((resolve, reject) => {
      // Prepare duet data if available
      let isDuet = 0;
      let singer1Notes = null;
      let singer2Notes = null;
      let singer1Lines = null;
      let singer2Lines = null;
      
      if (songData && songData.isDuet) {
        isDuet = 1;
        singer1Notes = JSON.stringify(songData.singer1Notes);
        singer2Notes = JSON.stringify(songData.singer2Notes);
        singer1Lines = JSON.stringify(songData.singer1Lines);
        singer2Lines = JSON.stringify(songData.singer2Lines);
      }
      
      db.run(
        'INSERT INTO songs (user_id, artist, title, folder_name, source, mode, status, is_duet, singer1_notes, singer2_notes, singer1_lines, singer2_lines) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, artist, title, folderName, source, 'ultrastar', 'ready', isDuet, singer1Notes, singer2Notes, singer1Lines, singer2Lines],
        function(err) {
          if (err) {
            reject(err);
          } else {
            const newSong = { 
              id: this.lastID, 
              user_id: userId, 
              artist, 
              title, 
              folder_name: folderName, 
              source, 
              mode: 'ultrastar', 
              status: 'ready',
              is_duet: Boolean(isDuet),
              singer1_notes: singer1Notes,
              singer2_notes: singer2Notes,
              singer1_lines: singer1Lines,
              singer2_lines: singer2Lines
            };
            // Update cache
            if (songCache && typeof songCache.addSongToCache === 'function') {
              songCache.addSongToCache(newSong);
            }
            resolve(newSong);
          }
        }
      );
    });
  }

  static getAll() {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT s.*, u.name as user_name, u.device_id 
        FROM songs s 
        JOIN users u ON s.user_id = u.id 
        ORDER BY s.position ASC, s.created_at ASC
      `, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // Convert with_background_vocals from integer to boolean and parse duett data
          const processedRows = rows.map(row => {
            const processedRow = {
              ...row,
              with_background_vocals: Boolean(row.with_background_vocals),
              is_duett: Boolean(row.is_duett),
              magic: false // Default to false
            };
            
            // Check if this is a magic song by examining the youtube_url
            if (row.youtube_url && row.youtube_url.includes('/api/magic-')) {
              processedRow.magic = true;
            }
            
            // Parse duett data if available
            if (row.is_duett) {
              try {
                processedRow.singer1_notes = row.singer1_notes ? JSON.parse(row.singer1_notes) : [];
                processedRow.singer2_notes = row.singer2_notes ? JSON.parse(row.singer2_notes) : [];
                processedRow.singer1_lines = row.singer1_lines ? JSON.parse(row.singer1_lines) : [];
                processedRow.singer2_lines = row.singer2_lines ? JSON.parse(row.singer2_lines) : [];
              } catch (parseError) {
                console.error('Error parsing duett data for song:', row.id, parseError);
                processedRow.singer1_notes = [];
                processedRow.singer2_notes = [];
                processedRow.singer1_lines = [];
                processedRow.singer2_lines = [];
              }
            }
            
            return processedRow;
          });
          resolve(processedRows);
        }
      });
    });
  }

  static getPending() {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT s.*, u.name as user_name, u.device_id 
        FROM songs s 
        JOIN users u ON s.user_id = u.id 
        WHERE s.youtube_url IS NULL OR s.youtube_url = ''
        ORDER BY s.created_at ASC
      `, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // Convert with_background_vocals from integer to boolean
          const processedRows = rows.map(row => ({
            ...row,
            with_background_vocals: Boolean(row.with_background_vocals)
          }));
          resolve(processedRows);
        }
      });
    });
  }

  static updateYoutubeUrl(songId, youtubeUrl) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE songs SET youtube_url = ? WHERE id = ?',
        [youtubeUrl, songId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            // Update cache
            if (songCache && typeof songCache.updateSongInCache === 'function') {
              songCache.updateSongInCache(songId, { youtube_url: youtubeUrl });
            }
            resolve({ changes: this.changes });
          }
        }
      );
    });
  }

  static updateDownloadStatus(songId, downloadStatus, downloadStartedAt = null) {
    return new Promise((resolve, reject) => {
      const query = downloadStartedAt 
        ? 'UPDATE songs SET download_status = ?, download_started_at = ? WHERE id = ?'
        : 'UPDATE songs SET download_status = ? WHERE id = ?';
      
      const params = downloadStartedAt 
        ? [downloadStatus, downloadStartedAt, songId]
        : [downloadStatus, songId];
      
      db.run(query, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  static updatePosition(songId, position) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE songs SET position = ? WHERE id = ?',
        [position, songId],
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

  static updatePriority(songId, priority) {
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

  static incrementRegressionCount(songId) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE songs SET regression_count = regression_count + 1 WHERE id = ?',
        [songId],
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

  static updateDelayCount(songId, delayCount) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE songs SET delay_count = ? WHERE id = ?',
        [delayCount, songId],
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

  static delete(songId) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM songs WHERE id = ?', [songId], function(err) {
        if (err) {
          reject(err);
        } else {
          // Update cache
          if (songCache && typeof songCache.removeSongFromCache === 'function') {
            songCache.removeSongFromCache(songId);
          }
          resolve({ changes: this.changes });
        }
      });
    });
  }

  static getById(songId) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT s.*, u.name as user_name, u.device_id 
        FROM songs s 
        JOIN users u ON s.user_id = u.id 
        WHERE s.id = ?
      `, [songId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          if (row) {
            // Convert with_background_vocals from integer to boolean
            row.with_background_vocals = Boolean(row.with_background_vocals);
            row.is_duett = Boolean(row.is_duett);
            
            // Parse duett data if available
            if (row.is_duett) {
              try {
                row.singer1_notes = row.singer1_notes ? JSON.parse(row.singer1_notes) : [];
                row.singer2_notes = row.singer2_notes ? JSON.parse(row.singer2_notes) : [];
                row.singer1_lines = row.singer1_lines ? JSON.parse(row.singer1_lines) : [];
                row.singer2_lines = row.singer2_lines ? JSON.parse(row.singer2_lines) : [];
              } catch (parseError) {
                console.error('Error parsing duett data for song:', songId, parseError);
                row.singer1_notes = [];
                row.singer2_notes = [];
                row.singer1_lines = [];
                row.singer2_lines = [];
              }
            }
          }
          resolve(row);
        }
      });
    });
  }

  static findById(songId) {
    return this.getById(songId);
  }

  static getCurrentSong() {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT value FROM settings WHERE key = 'current_song_id'
      `, (err, row) => {
        if (err) {
          reject(err);
        } else {
          const currentSongId = row ? parseInt(row.value) : 0;
          if (currentSongId === 0) {
            resolve(null);
          } else {
            this.getById(currentSongId).then(resolve).catch(reject);
          }
        }
      });
    });
  }

  static setCurrentSong(songId) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
        [songId.toString(), 'current_song_id'],
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

  static restoreOriginalSong() {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT value FROM settings WHERE key = ?',
        ['test_mode_original_song_id'],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            const originalSongId = row ? parseInt(row.value) : null;
            if (originalSongId) {
              // Restore original song
              this.setCurrentSong(originalSongId).then(() => {
                // Clear the test mode setting
                db.run(
                  'DELETE FROM settings WHERE key = ?',
                  ['test_mode_original_song_id'],
                  (err) => {
                    if (err) reject(err);
                    else resolve(originalSongId);
                  }
                );
              }).catch(reject);
            } else {
              // No original song to restore, just clear the setting
              db.run(
                'DELETE FROM settings WHERE key = ?',
                ['test_mode_original_song_id'],
                (err) => {
                  if (err) reject(err);
                  else resolve(null);
                }
              );
            }
          }
        }
      );
    });
  }

  static getNextSong() {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT s.*, u.name as user_name, u.device_id 
        FROM songs s 
        JOIN users u ON s.user_id = u.id 
        WHERE s.position > (
          SELECT COALESCE(s2.position, 0) 
          FROM songs s2 
          WHERE s2.id = (
            SELECT COALESCE(CAST(value AS INTEGER), 0) 
            FROM settings 
            WHERE key = 'current_song_id'
          )
        )
        ORDER BY s.position ASC
        LIMIT 1
      `, (err, row) => {
        if (err) {
          reject(err);
        } else {
          if (row) {
            // Convert with_background_vocals from integer to boolean
            row.with_background_vocals = Boolean(row.with_background_vocals);
          }
          resolve(row);
        }
      });
    });
  }

  static getFirstSong() {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT s.*, u.name as user_name, u.device_id 
        FROM songs s 
        JOIN users u ON s.user_id = u.id 
        ORDER BY s.position ASC
        LIMIT 1
      `, (err, row) => {
        if (err) {
          reject(err);
        } else {
          if (row) {
            // Convert with_background_vocals from integer to boolean
            row.with_background_vocals = Boolean(row.with_background_vocals);
          }
          resolve(row);
        }
      });
    });
  }

  static getPreviousSong() {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT s.*, u.name as user_name, u.device_id 
        FROM songs s 
        JOIN users u ON s.user_id = u.id 
        WHERE s.position < (
          SELECT COALESCE(s2.position, 0) 
          FROM songs s2 
          WHERE s2.id = (
            SELECT COALESCE(CAST(value AS INTEGER), 0) 
            FROM settings 
            WHERE key = 'current_song_id'
          )
        )
        ORDER BY s.position DESC
        LIMIT 1
      `, (err, row) => {
        if (err) {
          reject(err);
        } else {
          if (row) {
            // Convert with_background_vocals from integer to boolean
            row.with_background_vocals = Boolean(row.with_background_vocals);
          }
          resolve(row);
        }
      });
    });
  }

  static getLastSong() {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT s.*, u.name as user_name, u.device_id 
        FROM songs s 
        JOIN users u ON s.user_id = u.id 
        ORDER BY s.position DESC
        LIMIT 1
      `, (err, row) => {
        if (err) {
          reject(err);
        } else {
          if (row) {
            // Convert with_background_vocals from integer to boolean
            row.with_background_vocals = Boolean(row.with_background_vocals);
          }
          resolve(row);
        }
      });
    });
  }

  static updateFolderName(id, folderName) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE songs SET folder_name = ? WHERE id = ?',
        [folderName, id],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id, folder_name: folderName, changes: this.changes });
          }
        }
      );
    });
  }

  static updateMode(id, mode) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE songs SET mode = ? WHERE id = ?',
        [mode, id],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id, mode, changes: this.changes });
          }
        }
      );
    });
  }

  static updateStatus(songId, status) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE songs SET status = ? WHERE id = ?',
        [status, songId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: songId, status, changes: this.changes });
          }
        }
      );
    });
  }

  static updateDownloadStartTime(songId, downloadStartedAt) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE songs SET download_started_at = ? WHERE id = ?',
        [downloadStartedAt, songId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: songId, download_started_at: downloadStartedAt, changes: this.changes });
          }
        }
      );
    });
  }

  static updateDownloadEndTime(songId, downloadEndedAt) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE songs SET download_ended_at = ? WHERE id = ?',
        [downloadEndedAt, songId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: songId, download_ended_at: downloadEndedAt, changes: this.changes });
          }
        }
      );
    });
  }

}

module.exports = Song;