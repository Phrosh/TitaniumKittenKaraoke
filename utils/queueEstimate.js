const DEFAULT_SONG_DURATION_SECONDS = 210; // 3,5 Minuten
const MODERATION_SECONDS = 30;

function getSongDurationSeconds(song) {
  if (song.duration_seconds && song.duration_seconds > 0) {
    return song.duration_seconds;
  }
  return DEFAULT_SONG_DURATION_SECONDS;
}

/**
 * Schätzt Wartezeit und Anzahl Songs vor einem Ziel-Song.
 * @param {Array} playlist
 * @param {Object|null} currentSong
 * @param {number} targetSongId
 * @param {number|null} currentSongRemainingSeconds
 */
function estimateWaitForSong(playlist, currentSong, targetSongId, currentSongRemainingSeconds) {
  const sorted = [...playlist].sort((a, b) => a.position - b.position || a.id - b.id);
  const targetIdx = sorted.findIndex((s) => s.id === targetSongId);
  if (targetIdx === -1) return null;

  const target = sorted[targetIdx];
  const currentSongCompleted =
    currentSongRemainingSeconds !== null &&
    currentSongRemainingSeconds !== undefined &&
    currentSongRemainingSeconds <= 0;

  if (currentSong?.id === target.id) {
    if (currentSongCompleted) return null;

    const remaining = currentSongRemainingSeconds ?? getSongDurationSeconds(target);
    return {
      songsBefore: 0,
      estimatedWaitSeconds: Math.max(0, Math.round(remaining)),
      status: 'current',
    };
  }

  let waitSeconds = 0;
  let songsBefore = 0;

  for (let i = 0; i < targetIdx; i++) {
    const song = sorted[i];
    if (
      currentSong &&
      (song.position < currentSong.position ||
        (currentSongCompleted && song.id === currentSong.id))
    ) {
      continue;
    }

    songsBefore++;
    if (currentSong && song.id === currentSong.id) {
      waitSeconds += Math.max(0, currentSongRemainingSeconds ?? getSongDurationSeconds(song));
    } else {
      waitSeconds += getSongDurationSeconds(song);
    }
    waitSeconds += MODERATION_SECONDS;
  }

  return {
    songsBefore,
    estimatedWaitSeconds: Math.max(0, Math.round(waitSeconds)),
    status: 'queued',
  };
}

function estimateQueueForDevice(playlist, currentSong, deviceId, currentSongRemainingSeconds) {
  return playlist
    .filter((s) => s.device_id === deviceId)
    .map((song) => {
      const estimate = estimateWaitForSong(playlist, currentSong, song.id, currentSongRemainingSeconds);
      if (!estimate) return null;

      return {
        id: song.id,
        artist: song.artist,
        title: song.title,
        position: song.position,
        ...estimate,
      };
    })
    .filter(Boolean);
}

module.exports = {
  DEFAULT_SONG_DURATION_SECONDS,
  MODERATION_SECONDS,
  getSongDurationSeconds,
  estimateWaitForSong,
  estimateQueueForDevice,
};
