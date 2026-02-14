const db = require('../config/database');
const Song = require('../models/Song');

/** Zusätzlicher Prioritäts-Abstand, den ein Song haben muss, damit wir uns vor ihn setzen dürfen (Progressive-Penalty). */
const PENALTY_FOR_FORWARD_SLOT = 1.0;

/** Geschützte Zone: neue Songs landen nicht in den nächsten 3 Slots (außer es gibt zu wenig Songs). */
const PROTECTED_SLOTS = 3;

class PlaylistAlgorithm {
  /**
   * Fügt einen neuen Song fair in die Playlist ein.
   * - Kein Song wird "in die Vergangenheit" gesetzt (Index nie < aktueller Song).
   * - Neue Sänger (weniger Songs) kommen weiter vorne; gleiche Priorität = Reihenfolge bleibt.
   * - Der neue Song wird nicht zu einem der nächsten 3 Songs (außer es gibt ≤3 zukünftige Songs).
   * - Kein Sänger soll direkt zweimal hintereinander vorkommen.
   * - Songs, die sich nach vorne "kämpfen", haben es pro Position schwerer (Progressive Penalty).
   * Es wird nur eingefügt und verschoben – keine globale Neu-Sortierung.
   */
  static async insertSong(songId) {
    try {
      const playlist = await Song.getAll();
      const newSong = await Song.getById(songId);
      if (!newSong) {
        throw new Error('Song not found');
      }

      const currentSongPosition = await this.getCurrentSongPosition();
      const currentPos = currentSongPosition != null ? currentSongPosition : 0;

      // Nur Songs in der "Zukunft" (Position > aktueller Song), ohne den neuen Song; nach Position sortiert
      const future = playlist
        .filter((s) => s.id !== songId && s.position != null && s.position > currentPos)
        .sort((a, b) => a.position - b.position);

      const priority = await this.calculatePriority(newSong.user_id, newSong.device_id);
      await this.updateSongPriority(songId, priority);

      let insertIndex;

      if (future.length === 0) {
        insertIndex = 0;
      } else if (future.length <= PROTECTED_SLOTS) {
        // Wenig Songs: erlaubte Einfügeposition nach Priorität, inkl. „vorne“
        insertIndex = this.computeNaturalIndex(future, priority);
        insertIndex = Math.min(insertIndex, future.length);
        insertIndex = this.resolveSameSingerConflict(future, insertIndex, newSong.user_id, future.length);
      } else {
        // Genug Songs: neue Songs nicht in die nächsten 3 (Indizes 0,1,2)
        const naturalIndex = this.computeNaturalIndex(future, priority);
        let candidateIndex = Math.max(PROTECTED_SLOTS, naturalIndex);
        candidateIndex = Math.min(candidateIndex, future.length);

        // Progressive Penalty: direkt nach der geschützten Zone nur, wenn der verdrängte Song „deutlich“ mehr Priorität hat
        if (candidateIndex === PROTECTED_SLOTS && future[PROTECTED_SLOTS] != null) {
          const displacedPriority = future[PROTECTED_SLOTS].priority;
          if (priority + PENALTY_FOR_FORWARD_SLOT > displacedPriority) {
            candidateIndex++;
          }
        }

        candidateIndex = this.resolveSameSingerConflict(future, candidateIndex, newSong.user_id, future.length);
        insertIndex = candidateIndex;
      }

      const newPosition = currentPos + 1 + insertIndex;

      await Song.updatePosition(songId, newPosition);

      // Alle Songs mit Position >= newPosition um 1 nach hinten schieben (ohne den neuen)
      const toShift = playlist.filter(
        (s) => s.id !== songId && s.position != null && s.position >= newPosition
      );
      for (const s of toShift) {
        await Song.updatePosition(s.id, s.position + 1);
      }

      return newPosition;
    } catch (error) {
      console.error('Error inserting song:', error);
      throw error;
    }
  }

  /** Anzahl der Songs in future, die eine höhere (schlechtere) Priorität haben als die gegebene. */
  static computeNaturalIndex(future, newPriority) {
    let count = 0;
    for (const s of future) {
      if (s.priority > newPriority) count++;
    }
    return count;
  }

  /** Findet den nächsten Index ohne „gleicher Teilnehmer direkt davor/danach“ (Identität = user_id = Name + Device-ID). */
  static resolveSameSingerConflict(future, startIndex, newSongUserId, maxIndex) {
    let i = startIndex;
    while (i <= maxIndex) {
      const prev = i > 0 ? future[i - 1] : null;
      const next = i < future.length ? future[i] : null;
      const conflictBefore = prev && prev.user_id === newSongUserId;
      const conflictAfter = next && next.user_id === newSongUserId;
      if (!conflictBefore && !conflictAfter) return i;
      i++;
    }
    return maxIndex;
  }

  /**
   * Priorität pro Teilnehmer (Name + Device-ID).
   * user_id entspricht genau einem Eintrag (Name + device_id); über ein Gerät können sich mehrere Leute eintragen (verschiedene Namen → verschiedene user_id).
   */
  static async calculatePriority(userId, deviceId) {
    return new Promise((resolve, reject) => {
      // Song-Anzahl dieses Teilnehmers (Name + Device-ID = user_id)
      db.get(`
        SELECT COUNT(*) as count FROM songs WHERE user_id = ?
      `, [userId], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        const userSongCount = row ? row.count : 0;

        // Aktueller Song-Priorität als Untergrenze
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
          const minPriority = currentSong ? currentSong.priority : 1;
          const finalPriority = Math.max(userSongCount + 1, minPriority);
          resolve(finalPriority);
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