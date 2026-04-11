/**
 * Utility functions for sanitizing filenames and folder names.
 * Uses reversible encoding for ', &, / so they are path/URL-safe but
 * can be decoded for display and search (same mapping on Node and Python).
 */

/** Reversible path encoding: character -> encoded form (for folder/file names and URLs) */
const PATH_ENCODE_MAP = {
  "'": '%27',
  '&': '%26',
  '/': '%2F'
};

/** Reversible path decoding: encoded form -> character (when reading folder names for display/search) */
const PATH_DECODE_MAP = {
  '%27': "'",
  '%26': '&',
  '%2F': '/'
};

/**
 * Encodes artist/title for use in folder names and URLs. Use before sanitize.
 * Mapping: ' -> %27, & -> %26, / -> %2F (reversible via decodeFromPath).
 * Backslash and other invalid filename chars are still handled only in sanitizeFilename.
 * @param {string} str - Raw string (e.g. artist or title)
 * @returns {string} - Encoded string safe for paths/URLs
 */
function encodeForPath(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/'/g, PATH_ENCODE_MAP["'"])
    .replace(/&/g, PATH_ENCODE_MAP['&'])
    .replace(/\//g, PATH_ENCODE_MAP['/']);
}

/**
 * Decodes a folder/file name segment for display or search comparison.
 * Only use on strings that came from our encoded paths (folder names, file names).
 * @param {string} str - Encoded string (e.g. from folder name)
 * @returns {string} - Decoded string for display
 */
function decodeFromPath(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/%2F/g, PATH_DECODE_MAP['%2F'])
    .replace(/%27/g, PATH_DECODE_MAP['%27'])
    .replace(/%26/g, PATH_DECODE_MAP['%26']);
}

/**
 * Sanitizes a filename by replacing invalid filesystem/URL characters (not ', &, / – use encodeForPath first).
 * @param {string} filename - The filename to sanitize (should be already encoded if it may contain ' or &)
 * @returns {string} - The sanitized filename
 */
function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return '';
  }

  // Characters not allowed in Windows/Linux filenames (', &, / handled by encodeForPath before calling)
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/g;
  
  let sanitized = filename.replace(invalidChars, '_');
  sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '');
  sanitized = sanitized.replace(/_+/g, '_');
  sanitized = sanitized.replace(/^_+|_+$/g, '');
  if (!sanitized || sanitized.length === 0) sanitized = 'unnamed';
  if (sanitized.length > 200) sanitized = sanitized.substring(0, 200);
  return sanitized;
}

/**
 * Creates a sanitized folder name for YouTube/downloads: encode then sanitize (reversible for display).
 * @param {string} artist - The artist name
 * @param {string} title - The song title
 * @returns {string} - Encoded folder name for paths/URLs
 */
function createSanitizedFolderName(artist, title) {
  const artistEnc = encodeForPath(artist || 'Unknown Artist');
  const titleEnc = encodeForPath(title || 'Unknown Title');
  return `${sanitizeFilename(artistEnc)} - ${sanitizeFilename(titleEnc)}`;
}

/**
 * Collapses stray slashes in a URL path segment (e.g. wrong client or legacy decoding) so path.join
 * does not traverse subdirs. Canonical folder names use %2F from encodeForPath, not raw slashes.
 * @param {string} segment - Decoded route param (folder name)
 * @returns {string}
 */
function collapseSlashesInPathSegment(segment) {
  if (!segment || typeof segment !== 'string') return '';
  return segment.replace(/[/\\]/g, '_');
}

module.exports = {
  encodeForPath,
  decodeFromPath,
  sanitizeFilename,
  createSanitizedFolderName,
  collapseSlashesInPathSegment
};
