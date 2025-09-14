/**
 * Utility functions for cleaning YouTube URLs
 * Strips all parameters except the video ID (v= parameter)
 */

/**
 * Cleans a YouTube URL to contain only the video ID parameter
 * @param url - The YouTube URL to clean
 * @returns The cleaned YouTube URL
 */
export function cleanYouTubeUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  // Trim whitespace
  url = url.trim();

  // Check if it's a valid YouTube URL
  if (!isYouTubeUrl(url)) {
    return url; // Return original if not a YouTube URL
  }

  // Extract video ID from various YouTube URL formats
  const videoId = extractVideoIdFromUrl(url);
  
  if (!videoId) {
    return url; // Return original if no video ID found
  }

  // Return clean URL with only video ID
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Checks if a URL is a YouTube URL
 * @param url - The URL to check
 * @returns True if it's a YouTube URL
 */
export function isYouTubeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  const youtubePatterns = [
    /^https?:\/\/(www\.)?youtube\.com/,
    /^https?:\/\/youtu\.be/,
    /^https?:\/\/m\.youtube\.com/,
    /^https?:\/\/music\.youtube\.com/
  ];

  return youtubePatterns.some(pattern => pattern.test(url));
}

/**
 * Extracts video ID from various YouTube URL formats
 * @param url - The YouTube URL
 * @returns The video ID or null if not found
 */
export function extractVideoIdFromUrl(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Pattern for youtube.com/watch?v=VIDEO_ID
  let match = url.match(/[?&]v=([^&]+)/);
  if (match) {
    return match[1];
  }

  // Pattern for youtu.be/VIDEO_ID
  match = url.match(/youtu\.be\/([^?&]+)/);
  if (match) {
    return match[1];
  }

  // Pattern for youtube.com/embed/VIDEO_ID
  match = url.match(/youtube\.com\/embed\/([^?&]+)/);
  if (match) {
    return match[1];
  }

  // Pattern for youtube.com/v/VIDEO_ID
  match = url.match(/youtube\.com\/v\/([^?&]+)/);
  if (match) {
    return match[1];
  }

  // Pattern for youtube.com/shorts/VIDEO_ID
  match = url.match(/youtube\.com\/shorts\/([^?&]+)/);
  if (match) {
    return match[1];
  }

  return null;
}

/**
 * Validates if a string is a valid YouTube video ID
 * @param videoId - The video ID to validate
 * @returns True if valid
 */
export function isValidVideoId(videoId: string): boolean {
  if (!videoId || typeof videoId !== 'string') {
    return false;
  }

  // YouTube video IDs are typically 11 characters long
  // and contain alphanumeric characters, hyphens, and underscores
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}
