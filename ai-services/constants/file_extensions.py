#!/usr/bin/env python3
"""
Zentrale Konstanten für Dateiendungen
Stellt einheitliche Listen für Audio- und Video-Extensions bereit
"""

# Audio-Extensions
AUDIO_EXTENSIONS = [
    '.mp3',
    '.wav', 
    '.flac',
    '.m4a',
    '.aac',
    '.ogg'
]

# Video-Extensions
VIDEO_EXTENSIONS = [
    '.mp4',
    '.avi',
    '.mkv',
    '.mov',
    '.wmv',
    '.webm',
    '.mpg',
    '.mpeg',
    '.flv'
]

# Alle unterstützten Media-Extensions
MEDIA_EXTENSIONS = AUDIO_EXTENSIONS + VIDEO_EXTENSIONS

# Lyrics-Extensions
LYRICS_EXTENSIONS = [
    '.txt',
    '.json'
]

# Cover-Extensions
COVER_EXTENSIONS = [
    '.jpg',
    '.jpeg',
    '.png',
    '.gif'
]

# Hilfsfunktionen
def is_audio_file(filename: str) -> bool:
    """Prüft ob eine Datei eine Audio-Datei ist"""
    return any(filename.lower().endswith(ext) for ext in AUDIO_EXTENSIONS)

def is_video_file(filename: str) -> bool:
    """Prüft ob eine Datei eine Video-Datei ist"""
    return any(filename.lower().endswith(ext) for ext in VIDEO_EXTENSIONS)

def is_media_file(filename: str) -> bool:
    """Prüft ob eine Datei eine Media-Datei ist"""
    return any(filename.lower().endswith(ext) for ext in MEDIA_EXTENSIONS)

def is_lyrics_file(filename: str) -> bool:
    """Prüft ob eine Datei eine Lyrics-Datei ist"""
    return any(filename.lower().endswith(ext) for ext in LYRICS_EXTENSIONS)

def is_cover_file(filename: str) -> bool:
    """Prüft ob eine Datei eine Cover-Datei ist"""
    return any(filename.lower().endswith(ext) for ext in COVER_EXTENSIONS)
