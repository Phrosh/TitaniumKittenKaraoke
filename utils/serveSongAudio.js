const path = require('path');
const fs = require('fs');
const { boilDownMatch } = require('./boilDown');
const { collapseSlashesInPathSegment } = require('./filenameSanitizer');
const { ensurePitchShiftedAudio, clampPitch } = require('./pitchShiftAudio');

function getBaseDir(songType) {
  switch (songType) {
    case 'ultrastar':
      return require('./ultrastarSongs').ULTRASTAR_DIR;
    case 'magic-songs':
      return require('./magicSongs').MAGIC_SONGS_DIR;
    case 'magic-videos':
      return require('./magicVideos').MAGIC_VIDEOS_DIR;
    case 'magic-youtube':
      return require('./magicYouTube').MAGIC_YOUTUBE_DIR;
    case 'youtube':
      return require('./youtubeSongs').YOUTUBE_DIR;
    default:
      return null;
  }
}

function isPathUnderBase(filePath, baseDir) {
  const resolvedBase = path.resolve(baseDir) + path.sep;
  const resolvedFile = path.resolve(filePath);
  return resolvedFile.startsWith(resolvedBase);
}

function resolveAudioPath(baseDir, folderName, filename) {
  let audioPath = path.join(baseDir, folderName, filename);

  if (!fs.existsSync(audioPath)) {
    const folders = fs.readdirSync(baseDir).filter((item) => {
      const itemPath = path.join(baseDir, item);
      return fs.statSync(itemPath).isDirectory();
    });

    const matchingFolder = folders.find((folder) => boilDownMatch(folder, folderName));
    if (matchingFolder) {
      audioPath = path.join(baseDir, matchingFolder, filename);
    }
  }

  return audioPath;
}

function serveSongAudio(req, res, pitchOverride = null) {
  try {
    const songType = req.params.songType;
    const folderName = collapseSlashesInPathSegment(decodeURIComponent(req.params.folderName));
    const filename = decodeURIComponent(req.params.filename);
    const pitch = pitchOverride != null ? clampPitch(pitchOverride) : clampPitch(req.query.pitch);

    const baseDir = getBaseDir(songType);
    if (!baseDir) {
      return res.status(400).json({ message: 'Invalid song type' });
    }

    console.log(`🎵 Audio request: ${songType}/${folderName}/${filename} pitch=${pitch}`);

    let audioPath = resolveAudioPath(baseDir, folderName, filename);

    if (!isPathUnderBase(audioPath, baseDir)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!fs.existsSync(audioPath)) {
      return res.status(404).json({ message: 'Audio file not found' });
    }

    const originalPath = audioPath;
    let pitchSource = 'original';

    if (pitch !== 0) {
      const pitchedPath = ensurePitchShiftedAudio(audioPath, pitch);
      if (pitchedPath !== path.resolve(originalPath)) {
        audioPath = pitchedPath;
        pitchSource = 'cache';
      } else {
        pitchSource = 'fallback-original';
        console.warn(`⚠️ Pitch shift fallback to original: ${path.basename(originalPath)} (pitch ${pitch})`);
      }
    }

    if (!isPathUnderBase(audioPath, baseDir)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!fs.existsSync(audioPath)) {
      return res.status(404).json({ message: 'Audio file not found' });
    }

    const stat = fs.statSync(audioPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    const cacheHeaders =
      pitch !== 0
        ? {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache',
            'X-Pitch-Applied': String(pitch),
            'X-Audio-Source': pitchSource,
            'X-Audio-File': path.basename(audioPath),
          }
        : {};

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(audioPath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'audio/mpeg',
        ...cacheHeaders,
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'audio/mpeg',
        ...cacheHeaders,
      });
      fs.createReadStream(audioPath).pipe(res);
    }
  } catch (error) {
    console.error('Error serving audio:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { serveSongAudio };
