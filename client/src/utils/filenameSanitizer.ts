/**
 * Utility functions for sanitizing filenames and folder names.
 * Reversible encoding for ' and & (same mapping as backend) for path/URL safety and display/search.
 */

/** Reversible path encoding: character -> encoded form (for folder/file names and URLs) */
const PATH_ENCODE_MAP: Record<string, string> = { "'": '%27', '&': '%26' };
/** Reversible path decoding: encoded form -> character */
const PATH_DECODE_MAP: Record<string, string> = { '%27': "'", '%26': '&' };

/**
 * Encodes artist/title for use in folder names and URLs. Use before sanitize.
 * Mapping: ' -> %27, & -> %26 (reversible via decodeFromPath).
 */
export function encodeForPath(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/'/g, PATH_ENCODE_MAP["'"]).replace(/&/g, PATH_ENCODE_MAP['&']);
}

/**
 * Decodes a folder/file name segment for display or search. Only use on strings from our encoded paths.
 */
export function decodeFromPath(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/%27/g, PATH_DECODE_MAP['%27']).replace(/%26/g, PATH_DECODE_MAP['%26']);
}

/**
 * Sanitizes a filename (invalid chars only; ', & should be encoded with encodeForPath first).
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') return '';
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
 */
export function createSanitizedFolderName(artist: string, title: string): string {
  const artistEnc = encodeForPath(artist || 'Unknown Artist');
  const titleEnc = encodeForPath(title || 'Unknown Title');
  return `${sanitizeFilename(artistEnc)} - ${sanitizeFilename(titleEnc)}`;
}

/**
 * Sanitizes a search term for cache lookups
 * @param searchTerm - The search term to sanitize
 * @returns The sanitized search term
 */
export function sanitizeSearchTerm(searchTerm: string): string {
  if (!searchTerm || typeof searchTerm !== 'string') {
    return '';
  }
  
  // For search terms, we can be more lenient - just remove the most problematic chars
  const problematicChars = /[<>:"/\\|*\x00-\x1f]/g;
  
  let sanitized = searchTerm.replace(problematicChars, '');
  
  // Remove leading/trailing spaces
  sanitized = sanitized.trim();
  
  return sanitized;
}
