import re
import os
import logging

# Logger für Utils-Module
logger = logging.getLogger(__name__)

def is_youtube_url(url):
    """
    Checks if a URL is a YouTube URL
    """
    if not url or not isinstance(url, str):
        return False
    
    youtube_patterns = [
        r'^https?://(www\.)?youtube\.com',
        r'^https?://youtu\.be',
        r'^https?://m\.youtube\.com',
        r'^https?://music\.youtube\.com'
    ]
    
    return any(re.match(pattern, url) for pattern in youtube_patterns)

def extract_video_id_from_url(url):
    """
    Extracts video ID from various YouTube URL formats
    """
    if not url or not isinstance(url, str):
        return None
    
    # Pattern for youtube.com/watch?v=VIDEO_ID
    match = re.search(r'[?&]v=([^&]+)', url)
    if match:
        return match.group(1)
    
    # Pattern for youtu.be/VIDEO_ID
    match = re.search(r'youtu\.be/([^?&]+)', url)
    if match:
        return match.group(1)
    
    # Pattern for youtube.com/embed/VIDEO_ID
    match = re.search(r'youtube\.com/embed/([^?&]+)', url)
    if match:
        return match.group(1)
    
    # Pattern for youtube.com/v/VIDEO_ID
    match = re.search(r'youtube\.com/v/([^?&]+)', url)
    if match:
        return match.group(1)
    
    # Pattern for youtube.com/shorts/VIDEO_ID
    match = re.search(r'youtube\.com/shorts/([^?&]+)', url)
    if match:
        return match.group(1)
    
    return None

def clean_youtube_url(url):
    """
    Cleans a YouTube URL to contain only the video ID parameter
    """
    if not url or not isinstance(url, str):
        return ''
    
    url = url.strip()
    
    # Check if it's a valid YouTube URL
    if not is_youtube_url(url):
        return url  # Return original if not a YouTube URL
    
    # Extract video ID from various YouTube URL formats
    video_id = extract_video_id_from_url(url)
    
    if not video_id:
        return url  # Return original if no video ID found
    
    # Return clean URL with only video ID
    return f"https://www.youtube.com/watch?v={video_id}"

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
