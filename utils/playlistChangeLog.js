const db = require('../config/database');

const SETTING_KEY = 'playlist_change_log_enabled';

function songLabel(song) {
  if (!song) return null;
  const artist = song.artist || '?';
  const title = song.title || '?';
  const singer = song.user_name || song.singer_name;
  const device = song.device_id;
  const parts = [`${artist} – ${title}`];
  if (singer || device) {
    parts.push(`(${[singer, device].filter(Boolean).join(' / ')})`);
  }
  if (song.position != null) {
    parts.push(`@${song.position}`);
  }
  return parts.join(' ');
}

function resolveActorType({ deviceId, singerName, actorType } = {}) {
  if (actorType) return actorType;
  const id = String(deviceId || '').toUpperCase();
  const name = String(singerName || '').trim().toLowerCase();
  if (id === 'ADM' || id === 'ADMIN' || name === 'admin') return 'admin';
  if (!deviceId && !singerName) return 'system';
  return 'guest';
}

async function isEnabled() {
  return new Promise((resolve) => {
    db.get('SELECT value FROM settings WHERE key = ?', [SETTING_KEY], (err, row) => {
      if (err) {
        console.error('playlistChangeLog.isEnabled:', err);
        resolve(true);
        return;
      }
      // Default: enabled when setting missing
      resolve(!row || row.value === 'true');
    });
  });
}

async function setEnabled(enabled) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [SETTING_KEY, enabled ? 'true' : 'false'],
      function (err) {
        if (err) reject(err);
        else resolve({ enabled: !!enabled });
      }
    );
  });
}

/**
 * @param {object} entry
 * @returns {Promise<number|null>} log row id
 */
async function log(entry) {
  try {
    if (!(await isEnabled())) return null;

    const details =
      entry.details == null
        ? null
        : typeof entry.details === 'string'
          ? entry.details
          : JSON.stringify(entry.details);

    const actorType = resolveActorType({
      deviceId: entry.device_id || entry.deviceId,
      singerName: entry.singer_name || entry.singerName,
      actorType: entry.actor_type || entry.actorType,
    });

    return await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO playlist_change_log (
          action, song_id, artist, title, singer_name, device_id, actor_type,
          start_position, end_position, positions_climbed, mode, details
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.action,
          entry.song_id ?? entry.songId ?? null,
          entry.artist ?? null,
          entry.title ?? null,
          entry.singer_name ?? entry.singerName ?? null,
          entry.device_id ?? entry.deviceId ?? null,
          actorType,
          entry.start_position ?? entry.startPosition ?? null,
          entry.end_position ?? entry.endPosition ?? null,
          entry.positions_climbed ?? entry.positionsClimbed ?? null,
          entry.mode ?? null,
          details,
        ],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  } catch (error) {
    console.error('playlistChangeLog.log failed:', error);
    return null;
  }
}

async function findLatestInsertLogId(songId) {
  if (!songId) return null;
  return new Promise((resolve) => {
    db.get(
      `SELECT id, details FROM playlist_change_log
       WHERE song_id = ? AND action = 'insert'
       ORDER BY id DESC LIMIT 1`,
      [songId],
      (err, row) => {
        if (err) {
          console.error('playlistChangeLog.findLatestInsertLogId:', err);
          resolve(null);
        } else {
          resolve(row || null);
        }
      }
    );
  });
}

/**
 * Append a follow-up event to the latest insert log for a song
 * (USDB download, cache hit, YouTube download, …).
 */
async function appendFollowUp(songId, followUp) {
  try {
    if (!(await isEnabled())) return null;

    const row = await findLatestInsertLogId(songId);
    const event = {
      at: new Date().toISOString(),
      ...followUp,
    };

    if (row) {
      let details = {};
      try {
        details = row.details ? JSON.parse(row.details) : {};
      } catch {
        details = { raw: row.details };
      }
      if (!Array.isArray(details.followUps)) details.followUps = [];
      details.followUps.push(event);

      return await new Promise((resolve, reject) => {
        db.run(
          'UPDATE playlist_change_log SET details = ? WHERE id = ?',
          [JSON.stringify(details), row.id],
          function (err) {
            if (err) reject(err);
            else resolve(row.id);
          }
        );
      });
    }

    // No insert row yet — write a standalone follow_up entry
    return log({
      action: 'follow_up',
      song_id: songId,
      actor_type: 'system',
      details: { followUps: [event], ...followUp },
    });
  } catch (error) {
    console.error('playlistChangeLog.appendFollowUp failed:', error);
    return null;
  }
}

async function getEntries({ limit = 200, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 1000);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM playlist_change_log
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [safeLimit, safeOffset],
      (err, rows) => {
        if (err) reject(err);
        else {
          resolve(
            (rows || []).map((row) => {
              let details = null;
              if (row.details) {
                try {
                  details = JSON.parse(row.details);
                } catch {
                  details = { raw: row.details };
                }
              }
              return { ...row, details };
            })
          );
        }
      }
    );
  });
}

async function getCount() {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) AS c FROM playlist_change_log', (err, row) => {
      if (err) reject(err);
      else resolve(row?.c || 0);
    });
  });
}

async function clear() {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM playlist_change_log', function (err) {
      if (err) reject(err);
      else resolve({ deleted: this.changes });
    });
  });
}

function describeStopReason(reason, ctx = {}) {
  switch (reason) {
    case 'no_above':
      return 'Kein Song darüber — bereits ganz vorne (nach Safe Zone).';
    case 'current_song':
      return `Stopp am aktuellen Song${ctx.above ? `: ${songLabel(ctx.above)}` : ''}.`;
    case 'safe_zone':
      return `Safe Zone (aktueller Song + nächste 3) — nicht überholt: ${songLabel(ctx.above) || '?'}.`;
    case 'same_singer_two_above':
      return `Zwei Positionen darüber steht derselbe Sänger — Clustering vermeiden${
        ctx.twoAbove ? `: ${songLabel(ctx.twoAbove)}` : ''
      }.`;
    case 'count_not_higher':
      return `Sänger darüber hat nicht mehr Wünsche (${ctx.countAbove ?? '?'} ≤ ${
        ctx.countMoving ?? '?'
      }) — kein Tausch mit ${songLabel(ctx.above) || '?'}.`;
    case 'end_of_playlist':
      return 'Am Ende der Playlist eingefügt (keine weiteren Tausche).';
    default:
      return reason || 'Unbekannt';
  }
}

module.exports = {
  SETTING_KEY,
  isEnabled,
  setEnabled,
  log,
  appendFollowUp,
  getEntries,
  getCount,
  clear,
  songLabel,
  describeStopReason,
  resolveActorType,
};
