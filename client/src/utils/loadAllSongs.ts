import { toast } from "react-hot-toast";
import { songAPI } from "../services/api";

// Load all available songs (server videos, ultrastar, file songs)
const loadAllSongs = async () => {
    try {
      const [localResponse, ultrastarResponse, fileResponse] = await Promise.all([
        songAPI.getServerVideos(),
        songAPI.getUltrastarSongs(),
        songAPI.getFileSongs()
      ]);
      
      const serverVideos = localResponse.data.videos || [];
      const ultrastarSongs = ultrastarResponse.data.songs || [];
      const fileSongs = fileResponse.data.fileSongs || [];
      
      // Combine all songs
      const allSongs = [
        ...serverVideos.map((video: any) => ({
          artist: video.artist,
          title: video.title,
          mode: 'server_video'
        })),
        ...ultrastarSongs.map((song: any) => ({
          artist: song.artist,
          title: song.title,
          mode: 'ultrastar'
        })),
        ...fileSongs.map((song: any) => ({
          artist: song.artist,
          title: song.title,
          mode: 'file'
        }))
      ];
      
      // Sort by artist, then by title
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