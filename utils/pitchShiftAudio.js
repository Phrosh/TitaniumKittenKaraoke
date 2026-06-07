const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

function clampPitch(pitch) {
  return Math.max(-12, Math.min(12, Math.round(Number(pitch) || 0)));
}

function getPitchCachePath(originalPath, pitch) {
  const resolved = path.resolve(originalPath);
  const dir = path.join(path.dirname(resolved), '.pitch-cache');
  const ext = path.extname(resolved) || '.mp3';
  const base = path.basename(resolved, ext);
  return path.join(dir, `${base}_p${pitch}${ext}`);
}

function findExistingPitchCache(resolvedOriginal, pitch) {
  const direct = getPitchCachePath(resolvedOriginal, pitch);
  if (fs.existsSync(direct)) {
    return direct;
  }

  const cacheDir = path.join(path.dirname(resolvedOriginal), '.pitch-cache');
  if (!fs.existsSync(cacheDir)) {
    return null;
  }

  const ext = path.extname(resolvedOriginal) || '.mp3';
  const base = path.basename(resolvedOriginal, ext);
  const suffix = `_p${pitch}${ext}`;

  const match = fs
    .readdirSync(cacheDir)
    .find((file) => file.startsWith(base) && file.endsWith(suffix));

  return match ? path.join(cacheDir, match) : null;
}

/**
 * Returns path to pitch-shifted audio (cached). Falls back to original on error.
 * Pitch in semitones (-12..+12), tempo preserved via asetrate+atempo.
 */
function ensurePitchShiftedAudio(originalPath, pitch) {
  const clamped = clampPitch(pitch);
  const resolvedOriginal = path.resolve(originalPath);
  if (clamped === 0) {
    return resolvedOriginal;
  }

  const existing = findExistingPitchCache(resolvedOriginal, clamped);
  if (existing) {
    return existing;
  }

  const cachePath = getPitchCachePath(resolvedOriginal, clamped);
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });

  const factor = Math.pow(2, clamped / 12);
  const filter = `asetrate=44100*${factor},aresample=44100,atempo=${1 / factor}`;
  const tempPath = cachePath.replace(/(\.[^./\\]+)$/, '.tmp$1');

  console.log(`🎵 Pitch-shifting: ${resolvedOriginal} -> ${clamped} semitones`);

  const result = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      resolvedOriginal,
      '-af',
      filter,
      '-f',
      'mp3',
      '-codec:a',
      'libmp3lame',
      '-b:a',
      '192k',
      tempPath,
    ],
    { encoding: 'utf8', timeout: 300000 }
  );

  if (result.status !== 0) {
    console.error('ffmpeg pitch shift failed:', result.stderr || result.error);
    try {
      fs.unlinkSync(tempPath);
    } catch {
      /* ignore */
    }
    return resolvedOriginal;
  }

  fs.renameSync(tempPath, cachePath);
  console.log(`🎵 Pitch-shifted audio cached: ${cachePath} (${clamped} semitones)`);
  return cachePath;
}

module.exports = { ensurePitchShiftedAudio, clampPitch };
