#!/usr/bin/env python3
"""
YouTube Download Module
Lädt YouTube-Videos herunter und extrahiert Metadaten
"""

import os
import re
import subprocess
import logging
from pathlib import Path
from typing import Optional, Dict, Any
import yt_dlp

from .meta import ProcessingMeta, ProcessingStatus
from .logger_utils import log_start, send_processing_status

# Import sanitize_filename from routes.utils
try:
    # Try relative import first
    from ..routes.utils import sanitize_filename
except ImportError:
    try:
        # Try absolute import
        from routes.utils import sanitize_filename
    except ImportError:
        # Fallback: define sanitize_filename locally
        def sanitize_filename(filename):
            """Sanitizes a filename by removing or replacing invalid characters"""
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

logger = logging.getLogger(__name__)

class YouTubeDownloader:
    """YouTube-Downloader mit Metadaten-Extraktion"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialisiert den YouTube-Downloader
        
        Args:
            config: Konfiguration für yt-dlp
        """
        self.config = config or {}
        self.default_config = {
            'format': 'best[height<=720]',  # Max 720p für bessere Performance
            'outtmpl': '%(title)s.%(ext)s',
            'writesubtitles': False,
            'writeautomaticsub': False,
            'ignoreerrors': True,
            'no_warnings': True,
            'extract_flat': False,
            'quiet': True
        }
    
    def extract_video_id(self, url: str) -> Optional[str]:
        """
        Extrahiert die YouTube-Video-ID aus einer URL
        
        Args:
            url: YouTube-URL
            
        Returns:
            Video-ID oder None
        """
        patterns = [
            r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)',
            r'youtube\.com\/v\/([^&\n?#]+)',
            r'youtube\.com\/watch\?.*v=([^&\n?#]+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        
        return None
    
    def get_video_metadata(self, url: str) -> Optional[Dict[str, Any]]:
        """
        Holt Metadaten für ein YouTube-Video
        
        Args:
            url: YouTube-URL
            
        Returns:
            Metadaten-Dictionary oder None
        """
        try:
            config = {**self.default_config, **self.config}
            config.update({
                'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'quiet': True,
                'extract_flat': False,
                'extractor_args': {
                    'youtube': {
                        'player_client': ['android', 'ios'],  # Use mobile clients to bypass SABR streaming
                        'skip': ['dash', 'hls']
                    }
                }
            })
            
            with yt_dlp.YoutubeDL(config) as ydl:
                info = ydl.extract_info(url, download=False)
                
                return {
                    'title': info.get('title', 'Unknown Title'),
                    'artist': info.get('uploader', 'Unknown Artist'),
                    'duration': info.get('duration', 0),
                    'view_count': info.get('view_count', 0),
                    'upload_date': info.get('upload_date', ''),
                    'description': info.get('description', ''),
                    'thumbnail': info.get('thumbnail', ''),
                    'video_id': info.get('id', ''),
                    'url': url
                }
        except Exception as e:
            logger.error(f"Fehler beim Abrufen der Metadaten für {url}: {e}")
            return None
    
    def download_video(self, meta: ProcessingMeta) -> bool:
        """
        Lädt ein YouTube-Video herunter
        
        Args:
            meta: ProcessingMeta-Objekt mit YouTube-URL
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        log_start('download_video', meta)
        send_processing_status(meta, 'downloading')
        if not meta.youtube_url:
            logger.error("Keine YouTube-URL im Meta-Objekt")
            return False
        
        try:
            # Hole Metadaten
            metadata = self.get_video_metadata(meta.youtube_url)
            if not metadata:
                logger.error(f"Konnte keine Metadaten für {meta.youtube_url} abrufen")
                return False
            
            # Aktualisiere Meta-Objekt mit Metadaten (nur wenn noch nicht gesetzt)
            if meta.artist == 'Unknown Artist':
                meta.artist = metadata.get('artist', meta.artist)
            if meta.title == 'Unknown Title':
                meta.title = metadata.get('title', meta.title)
            meta.update_metadata('youtube_metadata', metadata)
            
            # Aktualisiere Ordnername falls nötig (nur wenn noch nicht korrekt gesetzt)
            if meta.folder_name == 'Unknown Artist - Unknown Title' or meta.folder_name == 'ultrastar':
                # Sanitize artist and title to ensure valid folder names
                sanitized_artist = sanitize_filename(meta.artist)
                sanitized_title = sanitize_filename(meta.title)
                new_folder_name = f"{sanitized_artist} - {sanitized_title}"
                if new_folder_name != meta.folder_name:
                    old_path = meta.folder_path
                    meta.folder_name = new_folder_name
                    meta.folder_path = os.path.join(meta.base_dir, meta.folder_name)
                    
                    # Erstelle neuen Ordner und verschiebe falls nötig
                    os.makedirs(meta.folder_path, exist_ok=True)
                    if old_path != meta.folder_path and os.path.exists(old_path):
                        # Verschiebe Dateien vom alten zum neuen Ordner
                        for file in os.listdir(old_path):
                            old_file = os.path.join(old_path, file)
                            new_file = os.path.join(meta.folder_path, file)
                            os.rename(old_file, new_file)
                        os.rmdir(old_path)
            
            # Konfiguriere Download
            video_id = metadata.get('video_id', self.extract_video_id(meta.youtube_url))
            if not video_id:
                logger.error("Konnte Video-ID nicht extrahieren")
                return False
            
            config = {**self.default_config, **self.config}
            
            # Enhanced options to bypass YouTube restrictions
            config.update({
                'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'extract_flat': False,
                'noplaylist': True,
                'no_warnings': False,
                'quiet': False,
                'cookiefile': None,  # Optional: Path to cookies file if available
                'extractor_args': {
                    'youtube': {
                        'player_client': ['android', 'ios'],  # Use mobile clients to bypass SABR streaming
                        'skip': ['dash', 'hls']
                    }
                }
            })
            
            # Entscheide Dateiname basierend auf Flag
            if meta.use_youtube_id_as_filename:
                filename = video_id
            else:
                filename = meta.base_filename or f"{meta.artist} - {meta.title}"
            
            config['outtmpl'] = os.path.join(meta.folder_path, f"{filename}.%(ext)s")
            
            # Download starten
            logger.info(f"Lade YouTube-Video herunter: {meta.artist} - {meta.title}")
            meta.status = ProcessingStatus.IN_PROGRESS
            
            with yt_dlp.YoutubeDL(config) as ydl:
                ydl.download([meta.youtube_url])
            
            # Finde die heruntergeladene Datei
            downloaded_files = []
            for file in os.listdir(meta.folder_path):
                if file.startswith(filename) and file.lower().endswith(('.mp4', '.webm', '.mkv')):
                    downloaded_files.append(file)
            
            if not downloaded_files:
                logger.error("Keine Video-Datei gefunden nach Download")
                return False
            
            # Füge die heruntergeladene Datei zum Meta-Objekt hinzu
            video_file = downloaded_files[0]  # Nehme die erste gefundene Datei
            video_path = meta.get_file_path(video_file)
            meta.add_input_file(video_path)
            meta.add_keep_file(video_file)
            
            logger.info(f"✅ YouTube-Video erfolgreich heruntergeladen: {video_file}")
            meta.mark_step_completed('youtube_download')
            meta.status = ProcessingStatus.COMPLETED
            
            return True
            
        except Exception as e:
            logger.error(f"Fehler beim Herunterladen von {meta.youtube_url}: {e}")
            meta.mark_step_failed('youtube_download')
            meta.status = ProcessingStatus.FAILED
            send_processing_status(meta, 'failed')
            return False
    
    def download_audio_only(self, meta: ProcessingMeta) -> bool:
        """
        Lädt nur die Audiospur eines YouTube-Videos herunter
        
        Args:
            meta: ProcessingMeta-Objekt mit YouTube-URL
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        log_start('download_audio_only', meta)
        send_processing_status(meta, 'downloading')
        if not meta.youtube_url:
            logger.error("Keine YouTube-URL im Meta-Objekt")
            return False
        
        try:
            # Hole Metadaten
            metadata = self.get_video_metadata(meta.youtube_url)
            if not metadata:
                logger.error(f"Konnte keine Metadaten für {meta.youtube_url} abrufen")
                return False
            
            # Aktualisiere Meta-Objekt mit Metadaten
            meta.artist = metadata.get('artist', meta.artist)
            meta.title = metadata.get('title', meta.title)
            meta.update_metadata('youtube_metadata', metadata)
            
            # Konfiguriere Download für Audio
            video_id = metadata.get('video_id', self.extract_video_id(meta.youtube_url))
            if not video_id:
                logger.error("Konnte Video-ID nicht extrahieren")
                return False
            
            config = {**self.default_config, **self.config}
            
            # Enhanced options to bypass YouTube restrictions
            config.update({
                'format': 'bestaudio/best',
                'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'extract_flat': False,
                'noplaylist': True,
                'no_warnings': False,
                'quiet': False,
                'extractor_args': {
                    'youtube': {
                        'player_client': ['android', 'ios'],  # Use mobile clients to bypass SABR streaming
                        'skip': ['dash', 'hls']
                    }
                }
            })
            
            config['outtmpl'] = os.path.join(meta.folder_path, f"{video_id}.%(ext)s")
            
            # Download starten
            logger.info(f"Lade YouTube-Audio herunter: {meta.artist} - {meta.title}")
            meta.status = ProcessingStatus.IN_PROGRESS
            
            with yt_dlp.YoutubeDL(config) as ydl:
                ydl.download([meta.youtube_url])
            
            # Finde die heruntergeladene Datei
            downloaded_files = []
            for file in os.listdir(meta.folder_path):
                if file.startswith(video_id) and file.lower().endswith(('.mp3', '.m4a', '.webm', '.ogg')):
                    downloaded_files.append(file)
            
            if not downloaded_files:
                logger.error("Keine Audio-Datei gefunden nach Download")
                return False
            
            # Füge die heruntergeladene Datei zum Meta-Objekt hinzu
            audio_file = downloaded_files[0]  # Nehme die erste gefundene Datei
            audio_path = meta.get_file_path(audio_file)
            meta.add_input_file(audio_path)
            meta.add_keep_file(audio_file)
            
            logger.info(f"✅ YouTube-Audio erfolgreich heruntergeladen: {audio_file}")
            meta.mark_step_completed('youtube_audio_download')
            meta.status = ProcessingStatus.COMPLETED
            
            return True
            
        except Exception as e:
            logger.error(f"Fehler beim Herunterladen der Audiospur von {meta.youtube_url}: {e}")
            meta.mark_step_failed('youtube_audio_download')
            meta.status = ProcessingStatus.FAILED
            send_processing_status(meta, 'failed')
            return False

def download_youtube_video(meta: ProcessingMeta, audio_only: bool = False) -> bool:
    """
    Convenience-Funktion für YouTube-Download
    
    Args:
        meta: ProcessingMeta-Objekt
        audio_only: Nur Audio herunterladen
        
    Returns:
        True wenn erfolgreich, False sonst
    """
    log_start('download_youtube_video', meta)
    downloader = YouTubeDownloader()
    
    if audio_only:
        return downloader.download_audio_only(meta)
    else:
        return downloader.download_video(meta)
