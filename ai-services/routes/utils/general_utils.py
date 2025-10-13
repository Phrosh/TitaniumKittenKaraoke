import re

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
    
    # Combine artist and title
    folder_name = f"{artist_sanitized} - {title_sanitized}"
    
    # Remove or replace invalid characters
    folder_name = re.sub(r'[<>:"/\\|?*]', '', folder_name)
    folder_name = re.sub(r'[^\w\s\-_\.]', '', folder_name)
    
    # Replace multiple spaces with single space
    folder_name = re.sub(r'\s+', ' ', folder_name)
    
    # Trim and limit length
    folder_name = folder_name.strip()[:100]
    
    return folder_name
