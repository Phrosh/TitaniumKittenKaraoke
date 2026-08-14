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

module.exports = {
  normalizeParts,
  getSingerHash,
  getSingerHashFromSong,
  isSameSinger,
};
