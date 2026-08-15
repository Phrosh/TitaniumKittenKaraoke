const crypto = require('crypto');

/**
 * Stabiler Sänger-Identifier aus Name + Device-ID (unabhängig von user_id pro Wunsch).
 */
function normalizeParts(name, deviceId) {
  return {
    deviceKey: String(deviceId || '').trim().toUpperCase(),
    nameKey: String(name || '').trim().toLowerCase(),
  };
}

function getSingerHash(name, deviceId) {
  const { deviceKey, nameKey } = normalizeParts(name, deviceId);
  return crypto.createHash('sha256').update(`${deviceKey}:${nameKey}`).digest('hex');
}

function getSingerHashFromSong(song) {
  return getSingerHash(song?.user_name, song?.device_id);
}

function isSameSinger(songA, songB) {
  if (!songA || !songB) return false;
  return getSingerHashFromSong(songA) === getSingerHashFromSong(songB);
}

/**
 * Laufende Wunschrunde eines Songs innerhalb der aktiven Playlist.
 * Der erste Wunsch eines Sängers ist Runde 1, der zweite Runde 2 usw.
 */
function getSingerSongRound(playlist, targetSong) {
  if (!targetSong) return 1;

  const singerSongs = (playlist || [])
    .filter(
      (song) =>
        song &&
        song.position != null &&
        song.position > 0 &&
        isSameSinger(song, targetSong)
    )
    .sort((songA, songB) => {
      const createdAtComparison = String(songA.created_at || '').localeCompare(
        String(songB.created_at || '')
      );
      if (createdAtComparison !== 0) return createdAtComparison;
      return Number(songA.id) - Number(songB.id);
    });

  const index = singerSongs.findIndex((song) => song.id === targetSong.id);
  return index >= 0 ? index + 1 : 1;
}

module.exports = {
  normalizeParts,
  getSingerHash,
  getSingerHashFromSong,
  isSameSinger,
  getSingerSongRound,
};
