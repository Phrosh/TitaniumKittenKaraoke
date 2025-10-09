import { boilDown, boilDownMatch } from "./boilDown";
import { Song } from "../types";
import { extractVideoIdFromUrl } from './youtubeUrlCleaner';

export const isSongInYouTubeCache = (song: Song, youtubeSongs: any[]) => {
  if (!youtubeSongs) return false;

  // If we have a YouTube URL but no artist/title, prioritize video ID search
  if (song.youtube_url && (!song.artist || !song.title)) {
    const videoId = extractVideoIdFromUrl(song.youtube_url);
    if (videoId) {
      console.log('🔍 Searching by video ID only:', videoId);
      const found = youtubeSongs.some(youtubeSong => {
        console.log('🔍 Checking YouTube song:', youtubeSong.artist, '-', youtubeSong.title);
        console.log('📁 Video files:', youtubeSong.videoFiles);
        console.log('🎥 Main video file:', youtubeSong.videoFile);

        // Check if any video file in the folder has this video ID as filename
        if (youtubeSong.videoFiles && Array.isArray(youtubeSong.videoFiles)) {
          const found = youtubeSong.videoFiles.some((videoFile: string) => {
            const matches = videoFile.startsWith(videoId);
            console.log(`🎬 Video file "${videoFile}" starts with "${videoId}":`, matches);
            return matches;
          });
          return found;
        }
        // Fallback: check the main videoFile
        const mainFileMatch = youtubeSong.videoFile && youtubeSong.videoFile.startsWith(videoId);
        console.log(`🎥 Main video file "${youtubeSong.videoFile}" starts with "${videoId}":`, mainFileMatch);
        return mainFileMatch;
      });
      console.log('🎯 Video ID search result:', found);
      return found;
    }
  }

  // If no artist or title, return false for artist/title based search
  if (!song.artist || !song.title) {
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

export type DownloadStatus = 'downloading' | 'transcoding' | 'failed' | 'finished' | 'separating' | 'transcribing';

// getDownloadStatusText is no longer used directly by the badge; kept for backward compatibility
export const getDownloadStatusText = (status: DownloadStatus) => '';


// Check if processing button should be visible and enabled
export const getProcessingButtonState = (song: any) => {
  const result = { visible: false, enabled: false };

  // Check if it's an ultrastar song
  if (song.modes?.includes('ultrastar')) {
    // Button is visible if neither hp2 nor hp5 files exist
    const hasHp2Hp5 = song.hasHp2Hp5 === true;
    result.visible = !hasHp2Hp5;

    if (result.visible) {
      // Button is enabled if:
      // 1. TXT file exists AND
      // 2. Either video OR audio exists, OR there's a #VIDEO: line in TXT
      const hasTxt = song.hasTxt === true;
      const hasVideo = song.hasVideo === true;
      const hasAudio = song.hasAudio === true;

      // Check if TXT contains #VIDEO: line (this would be handled by backend)
      // For now, we assume if hasVideo is false but hasTxt is true, 
      // the backend will check for #VIDEO: line
      const hasVideoOrAudio = hasVideo || hasAudio;

      result.enabled = hasTxt && hasVideoOrAudio;
    }
  }

  // Check if it's a magic song/video
  if (song.modes?.includes('magic-songs') || song.modes?.includes('magic-videos')) {
    // Button is visible if neither hp2 nor hp5 files exist
    const hasHp2Hp5 = song.hasHp2Hp5 === true;
    result.visible = !hasHp2Hp5;

    if (result.visible) {
      // Enable if at least one of video or audio exists
      const hasVideo = song.hasVideo === true;
      const hasAudio = song.hasAudio === true;
      result.enabled = hasVideo || hasAudio;
    }
  }

  return result;
};