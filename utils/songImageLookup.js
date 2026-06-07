const { scanUltrastarSongs } = require('./ultrastarSongs');
const { scanYouTubeSongs } = require('./youtubeSongs');
const { scanMagicSongs } = require('./magicSongs');
const { scanMagicVideos } = require('./magicVideos');
const { scanMagicYouTube } = require('./magicYouTube');

const FOLDER_SONG_SOURCES = [
  { scan: scanUltrastarSongs, apiSongType: 'ultrastar' },
  { scan: scanMagicSongs, apiSongType: 'magic-songs' },
  { scan: scanMagicVideos, apiSongType: 'magic-videos' },
  { scan: scanMagicYouTube, apiSongType: 'magic-youtube' },
  { scan: scanYouTubeSongs, apiSongType: 'youtube' },
];

function findFolderSongForImage(artist, title) {
  const artistNorm = String(artist || '').trim().toLowerCase();
  const titleNorm = String(title || '').trim().toLowerCase();

  for (const { scan, apiSongType } of FOLDER_SONG_SOURCES) {
    const song = scan().find(
      (entry) =>
        entry.artist.toLowerCase() === artistNorm &&
        entry.title.toLowerCase() === titleNorm &&
        entry.fullPath
    );

    if (song) {
      return {
        folderPath: song.fullPath,
        folderName: song.folderName,
        apiSongType,
      };
    }
  }

  return null;
}

module.exports = {
  findFolderSongForImage,
};
