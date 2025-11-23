const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Holt die Dauer einer Audio- oder Video-Datei mit ffprobe
 * @param {string} filePath - Pfad zur Datei
 * @returns {Promise<number|null>} - Dauer in Sekunden oder null bei Fehler
 */
function getFileDuration(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      console.log(`⏱️ File not found: ${filePath}`);
      resolve(null);
      return;
    }

    const command = `ffprobe -v quiet -print_format json -show_format "${filePath}"`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`⏱️ Error getting duration for ${filePath}:`, error.message);
        resolve(null);
        return;
      }

      try {
        const info = JSON.parse(stdout);
        const duration = parseFloat(info.format?.duration);
        
        if (duration && !isNaN(duration) && duration > 0) {
          console.log(`⏱️ Duration for ${filePath}: ${Math.floor(duration)}s`);
          resolve(Math.floor(duration));
        } else {
          console.log(`⏱️ Invalid duration for ${filePath}`);
          resolve(null);
        }
      } catch (parseError) {
        console.error(`⏱️ Error parsing ffprobe output for ${filePath}:`, parseError);
        resolve(null);
      }
    });
  });
}

/**
 * Findet die Datei für einen Song basierend auf seinem Modus
 * @param {Object} song - Song-Objekt mit mode, artist, title, etc.
 * @returns {Promise<string|null>} - Pfad zur Datei oder null
 */
async function findSongFile(song) {
  if (!song || !song.mode) {
    return null;
  }

  const { ULTRASTAR_DIR } = require('./ultrastarSongs');
  const { YOUTUBE_DIR } = require('./youtubeSongs');
  const { MAGIC_SONGS_DIR } = require('./magicSongs');
  const { MAGIC_VIDEOS_DIR } = require('./magicVideos');
  const { MAGIC_YOUTUBE_DIR } = require('./magicYouTube');
  const { findLocalVideo } = require('./localVideos');

  try {
    switch (song.mode) {
      case 'ultrastar': {
        // Suche nach Video-Dateien im Ultrastar-Ordner
        const { findUltrastarSong } = require('./ultrastarSongs');
        const ultrastarSong = await findUltrastarSong(song.artist, song.title);
        if (ultrastarSong && ultrastarSong.folderName) {
          const folderPath = path.join(ULTRASTAR_DIR, ultrastarSong.folderName);
          if (fs.existsSync(folderPath)) {
            const files = fs.readdirSync(folderPath);
            // Suche nach Video-Dateien
            const videoFiles = files.filter(file => {
              const ext = path.extname(file).toLowerCase();
              return ['.mp4', '.avi', '.mkv', '.webm', '.mov'].includes(ext);
            });
            if (videoFiles.length > 0) {
              return path.join(folderPath, videoFiles[0]);
            }
            // Fallback: Suche nach Audio-Dateien
            const audioFiles = files.filter(file => {
              const ext = path.extname(file).toLowerCase();
              return ['.mp3', '.flac', '.ogg', '.wav', '.m4a', '.aac'].includes(ext);
            });
            if (audioFiles.length > 0) {
              return path.join(folderPath, audioFiles[0]);
            }
          }
        }
        break;
      }
      case 'youtube_cache': {
        // Suche nach Video-Dateien im YouTube-Cache
        const { findYouTubeSong } = require('./youtubeSongs');
        const youtubeSong = await findYouTubeSong(song.artist, song.title);
        if (youtubeSong && youtubeSong.folderName) {
          const folderPath = path.join(YOUTUBE_DIR, youtubeSong.folderName);
          if (fs.existsSync(folderPath)) {
            const files = fs.readdirSync(folderPath);
            const videoFiles = files.filter(file => {
              const ext = path.extname(file).toLowerCase();
              return ['.mp4', '.webm', '.mkv'].includes(ext);
            });
            if (videoFiles.length > 0) {
              return path.join(folderPath, videoFiles[0]);
            }
          }
        }
        break;
      }
      case 'magic-songs': {
        // Suche nach Audio-Dateien in Magic Songs
        const { scanMagicSongs } = require('./magicSongs');
        const magicSongs = await scanMagicSongs();
        const magicSong = magicSongs.find(s => 
          s.artist === song.artist && s.title === song.title
        );
        if (magicSong && magicSong.folderName) {
          const folderPath = path.join(MAGIC_SONGS_DIR, magicSong.folderName);
          if (fs.existsSync(folderPath)) {
            const files = fs.readdirSync(folderPath);
            const audioFiles = files.filter(file => {
              const ext = path.extname(file).toLowerCase();
              return ['.mp3', '.flac', '.ogg', '.wav', '.m4a', '.aac'].includes(ext);
            });
            if (audioFiles.length > 0) {
              return path.join(folderPath, audioFiles[0]);
            }
          }
        }
        break;
      }
      case 'magic-videos': {
        // Suche nach Video-Dateien in Magic Videos
        const { scanMagicVideos } = require('./magicVideos');
        const magicVideos = await scanMagicVideos();
        const magicVideo = magicVideos.find(v => 
          v.artist === song.artist && v.title === song.title
        );
        if (magicVideo && magicVideo.folderName) {
          const folderPath = path.join(MAGIC_VIDEOS_DIR, magicVideo.folderName);
          if (fs.existsSync(folderPath)) {
            const files = fs.readdirSync(folderPath);
            const videoFiles = files.filter(file => {
              const ext = path.extname(file).toLowerCase();
              return ['.mp4', '.webm', '.mkv'].includes(ext);
            });
            if (videoFiles.length > 0) {
              return path.join(folderPath, videoFiles[0]);
            }
          }
        }
        break;
      }
      case 'magic-youtube': {
        // Suche nach Video-Dateien in Magic YouTube
        const { scanMagicYouTube } = require('./magicYouTube');
        const magicYouTube = await scanMagicYouTube();
        const magicYT = magicYouTube.find(v => 
          v.artist === song.artist && v.title === song.title
        );
        if (magicYT && magicYT.folderName) {
          const folderPath = path.join(MAGIC_YOUTUBE_DIR, magicYT.folderName);
          if (fs.existsSync(folderPath)) {
            const files = fs.readdirSync(folderPath);
            const videoFiles = files.filter(file => {
              const ext = path.extname(file).toLowerCase();
              return ['.mp4', '.webm', '.mkv'].includes(ext);
            });
            if (videoFiles.length > 0) {
              return path.join(folderPath, videoFiles[0]);
            }
          }
        }
        break;
      }
      case 'server_video': {
        // Suche nach Video-Dateien in server_video
        const localVideo = await findLocalVideo(song.artist, song.title);
        if (localVideo && localVideo.filename) {
          const videosDir = path.join(__dirname, '..', 'songs', 'videos');
          const videoPath = path.join(videosDir, localVideo.filename);
          if (fs.existsSync(videoPath)) {
            return videoPath;
          }
        }
        break;
      }
    }
  } catch (error) {
    console.error(`⏱️ Error finding file for song ${song.artist} - ${song.title}:`, error);
  }

  return null;
}

/**
 * Holt die Dauer eines Songs aus der Datei
 * @param {Object} song - Song-Objekt
 * @returns {Promise<number|null>} - Dauer in Sekunden oder null
 */
async function getSongDuration(song) {
  if (!song) {
    return null;
  }

  // Wenn bereits eine Dauer in der DB vorhanden ist, verwende diese
  if (song.duration_seconds && song.duration_seconds > 0) {
    return song.duration_seconds;
  }

  // Versuche, die Datei zu finden und die Dauer auszulesen
  const filePath = await findSongFile(song);
  if (filePath) {
    return await getFileDuration(filePath);
  }

  return null;
}

module.exports = {
  getFileDuration,
  findSongFile,
  getSongDuration
};

