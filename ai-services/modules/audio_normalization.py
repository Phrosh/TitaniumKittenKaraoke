#!/usr/bin/env python3
"""
Audio Normalization Module
Normalisiert Audio-Dateien für bessere Verarbeitung
"""

import os
import subprocess
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List

from .meta import ProcessingMeta, ProcessingStatus
from .logger_utils import log_start

logger = logging.getLogger(__name__)

class AudioNormalizer:
    """Audio-Normalisierer für verschiedene Audio-Formate"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialisiert den Audio-Normalisierer
        
        Args:
            config: Konfiguration für FFmpeg
        """
        self.config = config or {}
        self.default_config = {
            'sample_rate': 44100,
            'bit_depth': 16,
            'channels': 2,
            'loudness_target': -23.0,  # LUFS
            'true_peak': -1.0,  # dBTP
            'audio_codec': 'pcm_s16le'  # Für bessere Qualität
        }
    
    def find_audio_files(self, meta: ProcessingMeta) -> List[str]:
        """
        Findet alle Audio-Dateien im Meta-Objekt
        
        Args:
            meta: ProcessingMeta-Objekt
            
        Returns:
            Liste der Audio-Dateipfade
        """
        audio_files = []
        audio_extensions = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.webm']
        
        # Suche in Eingabedateien
        for file_path in meta.input_files:
            if any(file_path.lower().endswith(ext) for ext in audio_extensions):
                audio_files.append(file_path)
        
        # Suche im Ordner
        if os.path.exists(meta.folder_path):
            for file in os.listdir(meta.folder_path):
                file_path = os.path.join(meta.folder_path, file)
                if os.path.isfile(file_path) and any(file.lower().endswith(ext) for ext in audio_extensions):
                    if file_path not in audio_files:
                        audio_files.append(file_path)
        
        return audio_files
    
    def normalize_audio(self, input_path: str, output_path: str) -> bool:
        """
        Normalisiert eine Audio-Datei
        
        Args:
            input_path: Eingabedatei
            output_path: Ausgabedatei
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        try:
            config = {**self.default_config, **self.config}
            
            # FFmpeg-Kommando für Normalisierung
            cmd = [
                'ffmpeg',
                '-i', input_path,
                '-af', f'loudnorm=I={config["loudness_target"]}:TP={config["true_peak"]}:LRA=7',
                '-ar', str(config['sample_rate']),
                '-ac', str(config['channels']),
                '-c:a', config['audio_codec'],
                '-y',  # Überschreiben ohne Nachfrage
                output_path
            ]
            
            logger.info(f"Normalisiere Audio: {input_path} -> {output_path}")
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                logger.info(f"✅ Audio erfolgreich normalisiert: {output_path}")
                return True
            else:
                logger.error(f"❌ Audio-Normalisierung fehlgeschlagen: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Fehler bei Audio-Normalisierung: {e}")
            return False
    
    def normalize_audio_simple(self, input_path: str, output_path: str) -> bool:
        """
        Einfache Audio-Normalisierung (nur Lautstärke-Anpassung)
        
        Args:
            input_path: Eingabedatei
            output_path: Ausgabedatei
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        try:
            # Einfache Normalisierung mit FFmpeg
            cmd = [
                'ffmpeg',
                '-i', input_path,
                '-af', 'loudnorm',
                '-c:a', 'libmp3lame',
                '-b:a', '192k',
                '-y',
                output_path
            ]
            
            logger.info(f"Normalisiere Audio (einfach): {input_path} -> {output_path}")
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                logger.info(f"✅ Audio erfolgreich normalisiert: {output_path}")
                return True
            else:
                logger.error(f"❌ Audio-Normalisierung fehlgeschlagen: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Fehler bei einfacher Audio-Normalisierung: {e}")
            return False
    
    def process_meta(self, meta: ProcessingMeta, simple: bool = False) -> bool:
        """
        Normalisiert alle Audio-Dateien im Meta-Objekt
        
        Args:
            meta: ProcessingMeta-Objekt
            simple: Verwende einfache Normalisierung
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        log_start('audio_normalization.process_meta', meta)
        try:
            audio_files = self.find_audio_files(meta)
            
            if not audio_files:
                logger.warning("Keine Audio-Dateien zum Normalisieren gefunden")
                meta.mark_step_completed('audio_normalization')
                return True
            
            meta.status = ProcessingStatus.IN_PROGRESS
            success_count = 0
            
            for audio_file in audio_files:
                # Erstelle Ausgabedateiname
                audio_path = Path(audio_file)
                normalized_name = f"{audio_path.stem}.normalized.mp3"
                normalized_path = meta.get_file_path(normalized_name)
                
                # Normalisiere Audio
                if simple:
                    success = self.normalize_audio_simple(audio_file, normalized_path)
                else:
                    success = self.normalize_audio(audio_file, normalized_path)
                
                if success:
                    meta.add_output_file(normalized_path)
                    meta.add_keep_file(normalized_name)
                    success_count += 1
                else:
                    logger.error(f"Normalisierung fehlgeschlagen für: {audio_file}")
            
            if success_count > 0:
                logger.info(f"✅ {success_count} Audio-Dateien erfolgreich normalisiert")
                meta.mark_step_completed('audio_normalization')
                meta.status = ProcessingStatus.COMPLETED
                return True
            else:
                logger.error("Keine Audio-Dateien konnten normalisiert werden")
                meta.mark_step_failed('audio_normalization')
                meta.status = ProcessingStatus.FAILED
                return False
                
        except Exception as e:
            logger.error(f"Fehler bei Audio-Normalisierung: {e}")
            meta.mark_step_failed('audio_normalization')
            meta.status = ProcessingStatus.FAILED
            return False
    
    def get_audio_info(self, audio_path: str) -> Optional[Dict[str, Any]]:
        """
        Holt Informationen über eine Audio-Datei
        
        Args:
            audio_path: Pfad zur Audio-Datei
            
        Returns:
            Audio-Informationen oder None
        """
        try:
            cmd = [
                'ffprobe',
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_format',
                '-show_streams',
                audio_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                import json
                info = json.loads(result.stdout)
                
                # Extrahiere relevante Informationen
                format_info = info.get('format', {})
                streams = info.get('streams', [])
                
                audio_stream = None
                for stream in streams:
                    if stream.get('codec_type') == 'audio':
                        audio_stream = stream
                        break
                
                return {
                    'duration': float(format_info.get('duration', 0)),
                    'size': int(format_info.get('size', 0)),
                    'bitrate': int(format_info.get('bit_rate', 0)),
                    'sample_rate': int(audio_stream.get('sample_rate', 0)) if audio_stream else 0,
                    'channels': int(audio_stream.get('channels', 0)) if audio_stream else 0,
                    'codec': audio_stream.get('codec_name', '') if audio_stream else '',
                    'format': format_info.get('format_name', '')
                }
            else:
                logger.error(f"Fehler beim Abrufen der Audio-Informationen: {result.stderr}")
                return None
                
        except Exception as e:
            logger.error(f"Fehler bei Audio-Info-Abruf: {e}")
            return None

def normalize_audio_files(meta: ProcessingMeta, simple: bool = False) -> bool:
    """
    Convenience-Funktion für Audio-Normalisierung
    
    Args:
        meta: ProcessingMeta-Objekt
        simple: Verwende einfache Normalisierung
        
    Returns:
        True wenn erfolgreich, False sonst
    """
    log_start('normalize_audio_files', meta)
    normalizer = AudioNormalizer()
    return normalizer.process_meta(meta, simple)
