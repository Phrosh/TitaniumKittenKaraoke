import { Song, YouTubeSong } from '../types';
import { boilDown, boilDownMatch } from './boilDown';
import { createSanitizedFolderName } from './filenameSanitizer';
import {
  cleanYouTubeUrl,
  extractVideoIdFromUrl,
  isYouTubeUrl,
  isValidVideoId,
} from './youtubeUrlCleaner';

export const EMERGENCY_YOUTUBE_WINDOW_NAME = 'karaoke-emergency-youtube';

export interface EmergencyYouTubePending {
  videoId: string;
  youtubeUrl: string;
  embedUrl: string;
  artist?: string | null;
  title?: string | null;
  ts: number;
}

function findMatchingYouTubeCacheSong(song: Song, youtubeSongs: YouTubeSong[]): YouTubeSong | null {
  if (!youtubeSongs?.length || !song.artist || !song.title) {
    return null;
  }

  let match = youtubeSongs.find(
    (ys) =>
      ys.artist?.toLowerCase() === song.artist?.toLowerCase() &&
      ys.title.toLowerCase() === song.title.toLowerCase()
  );

  if (!match) {
    match = youtubeSongs.find((ys) => {
      const boiledCombined = boilDown(`${song.artist} - ${song.title}`);
      const boiledYoutubeCombined = boilDown(`${ys.artist} - ${ys.title}`);
      if (boiledCombined === boiledYoutubeCombined) return true;
      return (
        boilDownMatch(ys.artist || '', song.artist || '') &&
        boilDownMatch(ys.title, song.title)
      );
    });
  }

  if (!match) {
    const expectedFolderName = createSanitizedFolderName(song.artist, song.title);
    match = youtubeSongs.find((ys) => ys.folderName === expectedFolderName);
  }

  return match ?? null;
}

function extractVideoIdFromCacheEntry(entry: YouTubeSong): string | null {
  const files = entry.videoFiles?.length
    ? entry.videoFiles
    : entry.videoFile
      ? [entry.videoFile]
      : [];

  for (const file of files) {
    const base = file.split('.')[0];
    if (isValidVideoId(base)) {
      return base;
    }
  }

  return null;
}

/** Resolves a YouTube watch URL for emergency fallback (non-ultrastar). */
export function resolveEmergencyYouTubeUrl(song: Song, youtubeSongs: YouTubeSong[] = []): string | null {
  if (song.youtube_url) {
    if (isYouTubeUrl(song.youtube_url)) {
      return cleanYouTubeUrl(song.youtube_url);
    }
    const videoId = extractVideoIdFromUrl(song.youtube_url);
    if (videoId && isValidVideoId(videoId)) {
      return `https://www.youtube.com/watch?v=${videoId}`;
    }
  }

  const cacheEntry = findMatchingYouTubeCacheSong(song, youtubeSongs);
  if (cacheEntry) {
    const videoId = extractVideoIdFromCacheEntry(cacheEntry);
    if (videoId) {
      return `https://www.youtube.com/watch?v=${videoId}`;
    }
  }

  return null;
}

export function getEmergencyYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&autoplay=1`;
}

/** @deprecated Embed is blocked by many karaoke uploads; use getEmergencyYouTubeWatchUrl. */
export function getEmergencyYouTubeEmbedUrl(youtubeUrl: string): string {
  const videoId = extractVideoIdFromUrl(youtubeUrl);
  if (!videoId) {
    return youtubeUrl;
  }
  return (
    `https://www.youtube.com/embed/${videoId}` +
    '?autoplay=1&controls=0&rel=0&modestbranding=1&playsinline=1&mute=0&iv_load_policy=3'
  );
}

export function openEmergencyYouTubePlayer(videoId: string): Window | null {
  const win = window.open(getEmergencyYouTubeWatchUrl(videoId), EMERGENCY_YOUTUBE_WINDOW_NAME);
  if (win) {
    try {
      win.focus();
    } catch {
      // optional
    }
  }
  return win;
}
