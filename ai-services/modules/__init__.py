#!/usr/bin/env python3
"""
Modular Audio/Video Processing Package
Enthält alle Module für die modulare Verarbeitung von Audio- und Video-Dateien
"""

from .meta import ProcessingMeta, ProcessingMode, ProcessingStatus, create_meta_from_youtube_url, create_meta_from_file_path
from .youtube_download import YouTubeDownloader, download_youtube_video
from .audio_normalization import AudioNormalizer, normalize_audio_files
from .audio_separation import AudioSeparator, separate_audio
from .video_remuxing import VideoRemuxer, remux_videos
from .transcription import AudioTranscriber, transcribe_audio
from .usdb_download import USDBDownloader, download_usdb_file, download_usdb_song, search_and_download_usdb
from .cleanup import FileCleaner, cleanup_files, get_folder_summary

__all__ = [
    # Meta-Objekt
    'ProcessingMeta',
    'ProcessingMode', 
    'ProcessingStatus',
    'create_meta_from_youtube_url',
    'create_meta_from_file_path',
    
    # YouTube Download
    'YouTubeDownloader',
    'download_youtube_video',
    
    # Audio Normalization
    'AudioNormalizer',
    'normalize_audio_files',
    
    # Audio Separation
    'AudioSeparator',
    'separate_audio',
    
    # Video Remuxing
    'VideoRemuxer',
    'remux_videos',
    
    # Transcription
    'AudioTranscriber',
    'transcribe_audio',
    
    # USDB Download
    'USDBDownloader',
    'download_usdb_file',
    'download_usdb_song',
    'search_and_download_usdb',
    
    # Cleanup
    'FileCleaner',
    'cleanup_files',
    'get_folder_summary'
]

# Version
__version__ = '1.0.0'
