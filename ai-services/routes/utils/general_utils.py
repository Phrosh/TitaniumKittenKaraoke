import re

# Reversible path encoding (same mapping as Node/Client): for folder/file names and URLs
PATH_ENCODE_MAP = {"'": '%27', '&': '%26'}
PATH_DECODE_MAP = {'%27': "'", '%26': '&'}


def encode_for_path(s):
    """Encode artist/title for paths/URLs. Mapping: ' -> %27, & -> %26. Use before sanitize."""
    if not s or not isinstance(s, str):
        return ''
    return s.replace("'", PATH_ENCODE_MAP["'"]).replace('&', PATH_ENCODE_MAP['&'])


def decode_from_path(s):
    """Decode folder/file name for display or search. Only use on strings from our encoded paths."""
    if not s or not isinstance(s, str):
        return ''
    return s.replace('%27', PATH_DECODE_MAP['%27']).replace('%26', PATH_DECODE_MAP['%26'])


def sanitize_filename(filename):
    """
    Sanitizes a filename by replacing invalid filesystem characters.
    ', & are not replaced here – use encode_for_path() first.
    """
    if not filename or not isinstance(filename, str):
        return ''
    invalid_chars = r'[<>:"/\\|?*\x00-\x1f]'
    sanitized = re.sub(invalid_chars, '_', filename)
    sanitized = re.sub(r'^[.\s]+|[.\s]+$', '', sanitized)
    sanitized = re.sub(r'_+', '_', sanitized)
    sanitized = re.sub(r'^_+|_+$', '', sanitized)
    if not sanitized or len(sanitized) == 0:
        sanitized = 'unnamed'
    if len(sanitized) > 200:
        sanitized = sanitized[:200]
    return sanitized


def create_sanitized_folder_name(artist, title):
    """Creates a sanitized folder name: encode then sanitize (reversible for display)."""
    artist_enc = encode_for_path(artist or 'Unknown Artist')
    title_enc = encode_for_path(title or 'Unknown Title')
    folder_name = f"{sanitize_filename(artist_enc)} - {sanitize_filename(title_enc)}"
    folder_name = re.sub(r'\s+', ' ', folder_name).strip()[:200]
    return folder_name
