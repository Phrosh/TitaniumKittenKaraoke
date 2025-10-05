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
from .logger_utils import log_start

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
            config['quiet'] = True
            
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
            
            # Aktualisiere Ordnername falls nötig
            new_folder_name = f"{meta.artist} - {meta.title}"
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
            config['outtmpl'] = os.path.join(meta.folder_path, f"{video_id}.%(ext)s")
            
            # Download starten
            logger.info(f"Lade YouTube-Video herunter: {meta.artist} - {meta.title}")
            meta.status = ProcessingStatus.IN_PROGRESS
            
            with yt_dlp.YoutubeDL(config) as ydl:
                ydl.download([meta.youtube_url])
            
            # Finde die heruntergeladene Datei
            downloaded_files = []
            for file in os.listdir(meta.folder_path):
                if file.startswith(video_id) and file.lower().endswith(('.mp4', '.webm', '.mkv')):
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
            config['format'] = 'bestaudio/best'
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
