#!/usr/bin/env python3
"""
Video Remuxing Module
Remuxt Videos und entfernt/ersetzt Audiospuren
"""

import os
import subprocess
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List

from .meta import ProcessingMeta, ProcessingStatus
from .logger_utils import log_start, send_processing_status

try:
    from ..constants import VIDEO_EXTENSIONS
except ImportError:
    try:
        from constants import VIDEO_EXTENSIONS
    except ImportError:
        # Fallback: define constants locally
        VIDEO_EXTENSIONS = {'.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v'}

logger = logging.getLogger(__name__)

class VideoRemuxer:
    """Video-Remuxer für verschiedene Remuxing-Operationen"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialisiert den Video-Remuxer
        
        Args:
            config: Konfiguration für FFmpeg
        """
        self.config = config or {}
        self.default_config = {
            'video_codec': 'copy',  # Video ohne Re-Encoding kopieren
            'audio_codec': 'libmp3lame',
            'audio_bitrate': '192k',
            'output_format': 'mp4',
            'overwrite': True
        }
    
    def find_video_files(self, meta: ProcessingMeta) -> List[str]:
        """
        Findet alle Video-Dateien im Meta-Objekt
        
        Args:
            meta: ProcessingMeta-Objekt
            
        Returns:
            Liste der Video-Dateipfade
        """
        video_files = []
        video_extensions = VIDEO_EXTENSIONS
        
        # Suche in Eingabedateien
        for file_path in meta.input_files:
            if any(file_path.lower().endswith(ext) for ext in video_extensions):
                video_files.append(file_path)
        
        # Suche im Ordner
        if os.path.exists(meta.folder_path):
            for file in os.listdir(meta.folder_path):
                file_path = os.path.join(meta.folder_path, file)
                if os.path.isfile(file_path) and any(file.lower().endswith(ext) for ext in video_extensions):
                    if file_path not in video_files:
                        video_files.append(file_path)
        
        return video_files
    
    def remove_audio(self, input_path: str, output_path: str) -> bool:
        """
        Entfernt die Audiospur aus einem Video
        
        Args:
            input_path: Eingabedatei
            output_path: Ausgabedatei
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        try:
            config = {**self.default_config, **self.config}
            
            cmd = [
                'ffmpeg',
                '-i', input_path,
                '-c:v', config['video_codec'],  # Video kopieren ohne Re-Encoding
                '-an',  # Kein Audio (Audio entfernen)
                '-y' if config['overwrite'] else '',  # Überschreiben ohne Nachfrage
                output_path
            ]
            
            # Entferne leere Strings aus dem Kommando
            cmd = [arg for arg in cmd if arg]
            
            logger.info(f"Entferne Audiospur: {input_path} -> {output_path}")
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                logger.info(f"✅ Audiospur erfolgreich entfernt: {output_path}")
                return True
            else:
                logger.error(f"❌ Audio-Entfernung fehlgeschlagen: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Fehler bei Audio-Entfernung: {e}")
            return False
    
    def replace_audio(self, video_path: str, audio_path: str, output_path: str) -> bool:
        """
        Ersetzt die Audiospur eines Videos
        
        Args:
            video_path: Video-Datei
            audio_path: Neue Audio-Datei
            output_path: Ausgabedatei
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        try:
            config = {**self.default_config, **self.config}
            
            cmd = [
                'ffmpeg',
                '-i', video_path,
                '-i', audio_path,
                '-c:v', config['video_codec'],  # Video kopieren ohne Re-Encoding
                '-c:a', config['audio_codec'],  # Audio-Codec
                '-b:a', config['audio_bitrate'],  # Audio-Bitrate
                '-map', '0:v:0',  # Video vom ersten Input
                '-map', '1:a:0',  # Audio vom zweiten Input
                '-shortest',  # Stoppe wenn der kürzere Stream endet
                '-y' if config['overwrite'] else '',  # Überschreiben ohne Nachfrage
                output_path
            ]
            
            # Entferne leere Strings aus dem Kommando
            cmd = [arg for arg in cmd if arg]
            
            logger.info(f"Ersetze Audiospur: {video_path} + {audio_path} -> {output_path}")
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                logger.info(f"✅ Audiospur erfolgreich ersetzt: {output_path}")
                return True
            else:
                logger.error(f"❌ Audio-Ersetzung fehlgeschlagen: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Fehler bei Audio-Ersetzung: {e}")
            return False
    
    def convert_format(self, input_path: str, output_path: str, target_format: str = 'mp4') -> bool:
        """
        Konvertiert ein Video in ein anderes Format
        
        Args:
            input_path: Eingabedatei
            output_path: Ausgabedatei
            target_format: Zielformat
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        try:
            config = {**self.default_config, **self.config}
            
            cmd = [
                'ffmpeg',
                '-i', input_path,
                '-c:v', config['video_codec'],
                '-c:a', config['audio_codec'],
                '-b:a', config['audio_bitrate'],
                '-f', target_format,
                '-y' if config['overwrite'] else '',
                output_path
            ]
            
            # Entferne leere Strings aus dem Kommando
            cmd = [arg for arg in cmd if arg]
            
            logger.info(f"Konvertiere Format: {input_path} -> {output_path}")
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                logger.info(f"✅ Format erfolgreich konvertiert: {output_path}")
                return True
            else:
                logger.error(f"❌ Format-Konvertierung fehlgeschlagen: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Fehler bei Format-Konvertierung: {e}")
            return False
    
    def remux_for_karaoke(self, meta: ProcessingMeta, remove_audio: bool = True) -> bool:
        """
        Remuxt Videos für Karaoke (entfernt Audiospur)
        
        Args:
            meta: ProcessingMeta-Objekt
            remove_audio: Audiospur entfernen
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        log_start('video_remuxing.remux_for_karaoke', meta)
        try:
            video_files = self.find_video_files(meta)
            
            if not video_files:
                logger.warning("Keine Video-Dateien zum Remuxen gefunden")
                meta.mark_step_completed('video_remuxing')
                return True
            
            meta.status = ProcessingStatus.IN_PROGRESS
            success_count = 0
            
            for video_file in video_files:
                video_path = Path(video_file)
                
                if remove_audio:
                    # Entferne Audiospur für Karaoke und überschreibe Original
                    backup_requested = bool(getattr(meta, 'config', {}).get('backup_original_video') or getattr(meta, 'backup_original_video', False))
                    backup_path = None
                    if backup_requested:
                        backup_path = meta.get_file_path(f"{video_path.stem}.backup{video_path.suffix}")
                        try:
                            import shutil
                            shutil.copyfile(video_file, backup_path)
                            logger.info(f"Backup erstellt: {backup_path}")
                            meta.add_output_file(backup_path)
                        except Exception as e:
                            logger.error(f"Backup fehlgeschlagen: {e}")
                    
                    temp_output = meta.get_file_path(f"{video_path.stem}_remuxed{video_path.suffix}")
                    if self.remove_audio(video_file, temp_output):
                        try:
                            os.replace(temp_output, video_file)  # Atomar, überschreibt Original
                            logger.info(f"Originalvideo überschrieben: {video_file}")
                            meta.add_output_file(video_file)
                            meta.add_keep_file(os.path.basename(video_file))
                            success_count += 1
                        except Exception as e:
                            logger.error(f"Fehler beim Ersetzen des Originalvideos: {e}")
                else:
                    # Konvertiere nur Format
                    output_name = f"{video_path.stem}_converted.mp4"
                    output_path = meta.get_file_path(output_name)
                    
                    if self.convert_format(video_file, output_path):
                        meta.add_output_file(output_path)
                        meta.add_keep_file(output_name)
                        success_count += 1
            
            if success_count > 0:
                logger.info(f"✅ {success_count} Videos erfolgreich remuxt")
                meta.mark_step_completed('video_remuxing')
                meta.status = ProcessingStatus.COMPLETED
                return True
            else:
                logger.error("Keine Videos konnten remuxt werden")
                meta.mark_step_failed('video_remuxing')
                meta.status = ProcessingStatus.FAILED
                return False
                
        except Exception as e:
            logger.error(f"Fehler bei Video-Remuxing: {e}")
            meta.mark_step_failed('video_remuxing')
            meta.status = ProcessingStatus.FAILED
            return False
    
    def get_video_info(self, video_path: str) -> Optional[Dict[str, Any]]:
        """
        Holt Informationen über eine Video-Datei
        
        Args:
            video_path: Pfad zur Video-Datei
            
        Returns:
            Video-Informationen oder None
        """
        try:
            cmd = [
                'ffprobe',
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_format',
                '-show_streams',
                video_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                import json
                info = json.loads(result.stdout)
                
                # Extrahiere relevante Informationen
                format_info = info.get('format', {})
                streams = info.get('streams', [])
                
                video_stream = None
                audio_stream = None
                
                for stream in streams:
                    if stream.get('codec_type') == 'video' and not video_stream:
                        video_stream = stream
                    elif stream.get('codec_type') == 'audio' and not audio_stream:
                        audio_stream = stream
                
                return {
                    'duration': float(format_info.get('duration', 0)),
                    'size': int(format_info.get('size', 0)),
                    'bitrate': int(format_info.get('bit_rate', 0)),
                    'format': format_info.get('format_name', ''),
                    'video_codec': video_stream.get('codec_name', '') if video_stream else '',
                    'video_width': int(video_stream.get('width', 0)) if video_stream else 0,
                    'video_height': int(video_stream.get('height', 0)) if video_stream else 0,
                    'video_fps': eval(video_stream.get('r_frame_rate', '0/1')) if video_stream else 0,
                    'audio_codec': audio_stream.get('codec_name', '') if audio_stream else '',
                    'audio_sample_rate': int(audio_stream.get('sample_rate', 0)) if audio_stream else 0,
                    'audio_channels': int(audio_stream.get('channels', 0)) if audio_stream else 0
                }
            else:
                logger.error(f"Fehler beim Abrufen der Video-Informationen: {result.stderr}")
                return None
                
        except Exception as e:
            logger.error(f"Fehler bei Video-Info-Abruf: {e}")
            return None

def remux_videos(meta: ProcessingMeta, remove_audio: bool = True) -> bool:
    """
    Convenience-Funktion für Video-Remuxing
    
    Args:
        meta: ProcessingMeta-Objekt
        remove_audio: Audiospur entfernen
        
    Returns:
        True wenn erfolgreich, False sonst
    """
    log_start('remux_videos', meta)
    remuxer = VideoRemuxer()
    return remuxer.remux_for_karaoke(meta, remove_audio)
