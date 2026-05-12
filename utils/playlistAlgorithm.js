const db = require('../config/database');
const Song = require('../models/Song');

/**
 * Songwünsche direkt nach dem aktuellen Song: ein neuer Wunsch darf nicht über diese Einträge
 * „tauschen“ (gleiches Verhalten wie beim aktuellen Song). Standard: 3.
 */
const SAFE_ZONE_AFTER_CURRENT = 3;

class PlaylistAlgorithm {
  /**
   * Fügt einen neuen Song fair in die Playlist ein.
   * - Identifier = Name + Device-ID (entspricht user_id): Song-Count = Anzahl seiner Songs in der DB.
   * - Der neue Song startet am Ende der Liste und tauscht mit dem direkt darüber (kleinere Position),
   *   solange sein Song-Count kleiner ist als der des Nachbarn.
   * - Kein Tausch über den aktuellen Song und nicht über die nächsten SAFE_ZONE_AFTER_CURRENT Wünsche
   *   nach dem aktuellen Song (gleiche Song-IDs wie beim Einfügen festgehalten).
   */
  static async insertSong(songId) {
    try {
      let playlist = await Song.getAll();
      const newSong = await Song.getById(songId);
      if (!newSong) {
        throw new Error('Song not found');
      }

      const currentSongId = await this.getCurrentSongId();
      const others = playlist.filter((s) => s.id !== songId && s.position != null);
      const maxPos = others.length ? Math.max(...others.map((s) => s.position)) : 0;
      const endPosition = maxPos + 1;
      await Song.updatePosition(songId, endPosition);

      const priority = await this.calculatePriority(newSong.user_id, newSong.device_id);
      await this.updateSongPriority(songId, priority);

      playlist = await Song.getAll();
      const nonSwappableAboveIds = this.getNonSwappableAboveIds(
        playlist,
        currentSongId,
        SAFE_ZONE_AFTER_CURRENT
      );

      let moving = await Song.getById(songId);
      while (moving) {
        const above = this.findSongDirectlyAbove(playlist, moving);
        if (!above) break;
        if (currentSongId && above.id === currentSongId) break;
        if (nonSwappableAboveIds.has(above.id)) break;

        const countMoving = await this.getIdentifierSongCount(moving.user_id);
        const countAbove = await this.getIdentifierSongCount(above.user_id);
        if (countMoving >= countAbove) break;

        await this.swapSongPositions(moving.id, moving.position, above.id, above.position);
        playlist = await Song.getAll();
        moving = await Song.getById(songId);
      }

      const finalSong = await Song.getById(songId);
      return finalSong ? finalSong.position : endPosition;
    } catch (error) {
      console.error('Error inserting song:', error);
      throw error;
    }
  }

  /** Sortierte Playlist: aktueller Song und die nächsten safeZoneCount Wünsche (IDs) — nicht per Tausch überholen. */
  static getNonSwappableAboveIds(playlist, currentSongId, safeZoneCount) {
    const blocked = new Set();
    if (!currentSongId) return blocked;

    const sorted = [...playlist]
      .filter((s) => s.position != null)
      .sort((a, b) => {
        if (a.position !== b.position) return a.position - b.position;
        return String(a.created_at || '').localeCompare(String(b.created_at || ''));
      });

    const idx = sorted.findIndex((s) => s.id === currentSongId);
    if (idx < 0) return blocked;

    for (let k = 1; k <= safeZoneCount && idx + k < sorted.length; k++) {
      blocked.add(sorted[idx + k].id);
    }
    return blocked;
  }

  /** Direkter Nachbar „nach oben“ = höchste Position kleiner als moving.position. */
  static findSongDirectlyAbove(playlist, moving) {
    const candidates = playlist.filter(
      (s) => s.id !== moving.id && s.position != null && s.position < moving.position
    );
    if (!candidates.length) return null;
    return candidates.reduce((best, s) => (s.position > best.position ? s : best));
  }

  static async swapSongPositions(songIdA, posA, songIdB, posB) {
    const temp = await this.getTemporaryPosition();
    await Song.updatePosition(songIdA, temp);
    await Song.updatePosition(songIdB, posA);
    await Song.updatePosition(songIdA, posB);
  }

  static async getTemporaryPosition() {
    return new Promise((resolve, reject) => {
      db.get('SELECT IFNULL(MAX(position), 0) AS m FROM songs', (err, row) => {
        if (err) reject(err);
        else resolve((row && row.m ? row.m : 0) + 1_000_000);
      });
    });
  }

  /** Song-Anzahl für Identifier (user_id = Name + Device-ID), wie in der DB gezählt. */
  static async getIdentifierSongCount(userId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) AS c FROM songs WHERE user_id = ?', [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row && row.c != null ? row.c : 0);
      });
    });
  }

  /**
   * Priorität pro Teilnehmer (Name + Device-ID): Anzahl seiner Songs in der DB (inkl. neuem Eintrag).
   * user_id entspricht genau einem Eintrag (Name + device_id); über ein Gerät können sich mehrere Leute eintragen (verschiedene Namen → verschiedene user_id).
   */
  static async calculatePriority(userId, _deviceId) {
    const c = await this.getIdentifierSongCount(userId);
    return Math.max(1, c);
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
        const minPositionAfterCurrent =
          currentSongPosition !== null ? currentSongPosition + 1 + SAFE_ZONE_AFTER_CURRENT : 1;
        
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
            } else if (
              currentSongPosition !== null &&
              song.position > currentSongPosition &&
              song.position <= currentSongPosition + SAFE_ZONE_AFTER_CURRENT
            ) {
              // Nächste SAFE_ZONE_AFTER_CURRENT Songs nach aktuellem (geschützte Zone)
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