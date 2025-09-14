/**
 * Utility functions for sanitizing filenames and folder names
 * Removes or replaces characters that are not allowed in file systems
 */

/**
 * Sanitizes a filename by removing or replacing invalid characters
 * @param filename - The filename to sanitize
 * @returns The sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return '';
  }

  // Characters not allowed in Windows/Linux filenames
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/g;
  
  // Replace invalid characters with underscores
  let sanitized = filename.replace(invalidChars, '_');
  
  // Remove leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '');
  
  // Replace multiple consecutive underscores with single underscore
  sanitized = sanitized.replace(/_+/g, '_');
  
  // Remove leading/trailing underscores
  sanitized = sanitized.replace(/^_+|_+$/g, '');
  
  // Ensure the filename is not empty and not too long (Windows limit: 255 chars)
  if (!sanitized || sanitized.length === 0) {
    sanitized = 'unnamed';
  }
  
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 200);
  }
  
  return sanitized;
}

/**
 * Creates a sanitized folder name for YouTube downloads
 * @param artist - The artist name
 * @param title - The song title
 * @returns The sanitized folder name
 */
export function createSanitizedFolderName(artist: string, title: string): string {
  const artistSanitized = sanitizeFilename(artist || 'Unknown Artist');
  const titleSanitized = sanitizeFilename(title || 'Unknown Title');
  
  return `${artistSanitized} - ${titleSanitized}`;
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
