const db = require('../config/database');

class Song {
  static create(userId, title, artist = null, youtubeUrl = null, priority = 1) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO songs (user_id, title, artist, youtube_url, priority) VALUES (?, ?, ?, ?, ?)',
        [userId, title, artist, youtubeUrl, priority],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, user_id: userId, title, artist, youtube_url: youtubeUrl, priority });
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
          resolve(rows);
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
          resolve(rows);
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
            resolve({ changes: this.changes });
          }
        }
      );
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
          resolve(row);
        }
      });
    });
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
          resolve(row);
        }
      });
    });
  }
}

module.exports = Song;