import { toast } from "react-hot-toast";
import { songAPI } from "../services/api";

// Load all available songs (server videos, ultrastar, file songs)
const loadAllSongs = async (callback?: (songs: any[]) => void) => {
    try {
      const [localResponse, ultrastarResponse, fileResponse] = await Promise.all([
        songAPI.getServerVideos(),
        songAPI.getUltrastarSongs(),
        songAPI.getFileSongs()
      ]);
      
      const serverVideos = localResponse.data.videos || [];
      const ultrastarSongs = ultrastarResponse.data.songs || [];
      const fileSongs = fileResponse.data.fileSongs || [];
      
      // Combine all songs and merge duplicates
      const songMap = new Map<string, any>();
      
      // Add server videos
      serverVideos.forEach((video: any) => {
        const key = `${video.artist.toLowerCase()}|${video.title.toLowerCase()}`;
        songMap.set(key, {
          artist: video.artist,
          title: video.title,
          mode: 'server_video',
          modes: ['server_video']
        });
      });
      
      // Add ultrastar songs (merge with existing if found)
      ultrastarSongs.forEach((song: any) => {
        const key = `${song.artist.toLowerCase()}|${song.title.toLowerCase()}`;
        const existing = songMap.get(key);
        if (existing) {
          // Merge modes
          if (!existing.modes.includes('ultrastar')) {
            existing.modes.push('ultrastar');
          }
          existing.mode = 'ultrastar'; // Update primary mode
        } else {
          songMap.set(key, {
            artist: song.artist,
            title: song.title,
            mode: 'ultrastar',
            modes: ['ultrastar']
          });
        }
      });
      
      // Add file songs (merge with existing if found)
      fileSongs.forEach((song: any) => {
        const key = `${song.artist.toLowerCase()}|${song.title.toLowerCase()}`;
        const existing = songMap.get(key);
        if (existing) {
          // Merge modes
          if (!existing.modes.includes('file')) {
            existing.modes.push('file');
          }
        } else {
          songMap.set(key, {
            artist: song.artist,
            title: song.title,
            mode: 'file',
            modes: ['file']
          });
        }
      });
      
      // Convert map to array and sort
      const allSongs = Array.from(songMap.values());
      allSongs.sort((a, b) => {
        const artistA = a.artist.toLowerCase();
        const artistB = b.artist.toLowerCase();
        if (artistA !== artistB) {
          return artistA.localeCompare(artistB);
        }
        return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
      });
      
    //   setManualSongList(allSongs);
      return allSongs;
    } catch (error) {
      console.error('Error loading all songs:', error);
      toast.error('Fehler beim Laden der Songliste');
      return [];
    }
  };

  export default loadAllSongs;