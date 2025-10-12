"""
YouTube utility functions for AI services
"""
import re
import logging

logger = logging.getLogger(__name__)

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
