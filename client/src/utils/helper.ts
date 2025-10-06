import { boilDown, boilDownMatch } from "./boilDown";
import { Song } from "../types";
import { extractVideoIdFromUrl } from './youtubeUrlCleaner';

export const isSongInYouTubeCache = (song: Song, youtubeSongs: any[]) => {
    if (!youtubeSongs || !song.artist || !song.title) {
      return false;
    }
    
    // First try exact match
    let found = youtubeSongs.some(youtubeSong => 
      youtubeSong.artist?.toLowerCase() === song.artist?.toLowerCase() &&
      youtubeSong.title.toLowerCase() === song.title.toLowerCase()
    );
    
    // If not found, try with boil down normalization
    if (!found) {
      const boiledArtist = boilDown(song.artist);
      const boiledTitle = boilDown(song.title);
      
      found = youtubeSongs.some(youtubeSong => {
        const boiledYoutubeArtist = boilDown(youtubeSong.artist || '');
        const boiledYoutubeTitle = boilDown(youtubeSong.title);
        
        // Try combined match first (most precise)
        const boiledCombined = boilDown(`${song.artist} - ${song.title}`);
        const boiledYoutubeCombined = boilDown(`${youtubeSong.artist} - ${youtubeSong.title}`);
        if (boiledCombined === boiledYoutubeCombined) {
          return true;
        }
        
        // Try both artist AND title match (both must match, not just one)
        if (boilDownMatch(youtubeSong.artist || '', song.artist || '') && 
            boilDownMatch(youtubeSong.title, song.title)) {
          return true;
        }
        
        return false;
      });
    }
    
    // If still not found, try with sanitized names (fallback)
    if (!found) {
      const sanitizeFilename = (filename: string) => {
        if (!filename) return '';
        return filename.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
                     .replace(/^[.\s]+|[.\s]+$/g, '')
                     .replace(/_+/g, '_')
                     .replace(/^_+|_+$/g, '') || 'unnamed';
      };
      
      const sanitizedArtist = sanitizeFilename(song.artist);
      const sanitizedTitle = sanitizeFilename(song.title);
      
      found = youtubeSongs.some(youtubeSong => 
        youtubeSong.folderName === `${sanitizedArtist} - ${sanitizedTitle}`
      );
    }
    
    // If still not found and we have a YouTube URL, try to find by video ID
    if (!found && song.youtube_url) {
      const videoId = extractVideoIdFromUrl(song.youtube_url);
      if (videoId) {
        // First try to find in the scanned songs
        found = youtubeSongs.some(youtubeSong => {
          // Check if any video file in the folder has this video ID as filename
          if (youtubeSong.videoFiles && Array.isArray(youtubeSong.videoFiles)) {
            return youtubeSong.videoFiles.some((videoFile: string) => 
              videoFile.startsWith(videoId)
            );
          }
          // Fallback: check the main videoFile
          return youtubeSong.videoFile && youtubeSong.videoFile.startsWith(videoId);
        });
        
        // If still not found, the backend will handle recursive search
        // This is just for frontend display - the actual cache hit detection
        // happens on the backend when the song is processed
      }
    }
    
    return found;
  }

export type DownloadStatus = 'downloading' | 'failed' | 'finished' | 'separating' | 'transcribing';

// getDownloadStatusText is no longer used directly by the badge; kept for backward compatibility
export const getDownloadStatusText = (status: DownloadStatus) => '';
  
  // Check if Ultrastar song has missing files (for warning display)
  export const hasMissingFiles = (song: any) => {
    if (!song.modes?.includes('ultrastar')) return false;
    
    // If the properties are undefined, we can't determine if files are missing
    // So we assume they are complete (don't show button/warning)
    if (song.hasVideo === undefined || song.hasHp2Hp5 === undefined) {
      return false;
    }
    
    // Check if video files are present (mp4 or webm)
    const hasVideo = song.hasVideo === true;
    
    // Check if HP2/HP5 files are present
    const hasHp2Hp5 = song.hasHp2Hp5 === true;
    
    // Show warning if video OR HP2/HP5 files are missing
    return !hasVideo || !hasHp2Hp5;
  };