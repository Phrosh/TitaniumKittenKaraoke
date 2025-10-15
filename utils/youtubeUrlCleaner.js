/**
 * Utility functions for cleaning YouTube URLs
 * Strips all parameters except the video ID (v= parameter)
 */

/**
 * Cleans a YouTube URL to contain only the video ID parameter
 * @param {string} url - The YouTube URL to clean
 * @returns {string} - The cleaned YouTube URL
 */
function cleanYouTubeUrl(url) {
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
 * @param {string} url - The URL to check
 * @returns {boolean} - True if it's a YouTube URL
 */
function isYouTubeUrl(url) {
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
 * @param {string} url - The YouTube URL
 * @returns {string|null} - The video ID or null if not found
 */
function extractVideoIdFromUrl(url) {
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

module.exports = {
  cleanYouTubeUrl,
  isYouTubeUrl,
  extractVideoIdFromUrl
};
