"""
File utility functions for AI services
"""
import os
import re
import logging

logger = logging.getLogger(__name__)

def sanitize_filename(filename):
    """
    Sanitizes a filename by removing or replacing invalid characters
    """
    if not filename or not isinstance(filename, str):
        return ''
    
    # Characters not allowed in Windows/Linux filenames
    invalid_chars = r'[<>:"/\\|?*\x00-\x1f]'
    
    # Replace invalid characters with underscores
    sanitized = re.sub(invalid_chars, '_', filename)
    
    # Remove leading/trailing dots and spaces
    sanitized = re.sub(r'^[.\s]+|[.\s]+$', '', sanitized)
    
    # Replace multiple consecutive underscores with single underscore
    sanitized = re.sub(r'_+', '_', sanitized)
    
    # Remove leading/trailing underscores
    sanitized = re.sub(r'^_+|_+$', '', sanitized)
    
    # Ensure the filename is not empty and not too long
    if not sanitized or len(sanitized) == 0:
        sanitized = 'unnamed'
    
    if len(sanitized) > 200:
        sanitized = sanitized[:200]
    
    return sanitized

def create_sanitized_folder_name(artist, title):
    """
    Creates a sanitized folder name for YouTube downloads
    """
    artist_sanitized = sanitize_filename(artist or 'Unknown Artist')
    title_sanitized = sanitize_filename(title or 'Unknown Title')
    
    return f"{artist_sanitized} - {title_sanitized}"

def find_youtube_song_by_video_id(video_id, youtube_dir):
    """
    Find YouTube song by video ID in the YouTube directory (recursive search)
    """
    if not video_id or not os.path.exists(youtube_dir):
        return None
    
    try:
        # Search through all folders in YouTube directory
        for folder_name in os.listdir(youtube_dir):
            folder_path = os.path.join(youtube_dir, folder_name)
            
            if os.path.isdir(folder_path):
                # Check if any video file in this folder starts with the video ID
                for file_name in os.listdir(folder_path):
                    if file_name.startswith(video_id):
                        # Parse folder name to get artist and title
                        parts = folder_name.split(' - ')
                        if len(parts) >= 2:
                            artist = parts[0].strip()
                            title = ' - '.join(parts[1:]).strip()
                            
                            return {
                                'artist': artist,
                                'title': title,
                                'folderName': folder_name,
                                'videoFile': file_name,
                                'videoFiles': [f for f in os.listdir(folder_path) 
                                             if f.lower().endswith(('.mp4', '.webm', '.avi', '.mov', '.mkv'))],
                                'modes': ['youtube'],
                                'hasVideo': True
                            }
    except Exception as e:
        logger.error(f"Error searching for video ID {video_id}: {e}")
    
    return None
