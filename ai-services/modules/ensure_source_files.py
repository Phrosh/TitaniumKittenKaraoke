#!/usr/bin/env python3
"""
Ensure Source Files Module
Stellt sicher, dass Audio- und Video-Dateien für die Verarbeitung verfügbar sind
"""

import os
import re
import subprocess
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List
import yt_dlp

from .meta import ProcessingMeta, ProcessingStatus
try:
    from ..constants import AUDIO_EXTENSIONS, VIDEO_EXTENSIONS, is_audio_file, is_video_file
except ImportError:
    try:
        from constants import AUDIO_EXTENSIONS, VIDEO_EXTENSIONS, is_audio_file, is_video_file
    except ImportError:
        # Fallback: define constants and functions locally
        AUDIO_EXTENSIONS = {'.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.wma'}
        VIDEO_EXTENSIONS = {'.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v'}
        
        def is_audio_file(file_path):
            return any(str(file_path).lower().endswith(ext) for ext in AUDIO_EXTENSIONS)
        
        def is_video_file(file_path):
            return any(str(file_path).lower().endswith(ext) for ext in VIDEO_EXTENSIONS)
from .logger_utils import log_start, send_processing_status

logger = logging.getLogger(__name__)

class SourceFileEnsurer:
    """Stellt sicher, dass Audio- und Video-Dateien verfügbar sind"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialisiert den Source File Ensurer
        
        Args:
            config: Konfiguration für FFmpeg und yt-dlp
        """
        self.config = config or {}
        self.default_config = {
            'audio_codec': 'mp3',
            'video_codec': 'mp4',
            'audio_bitrate': '192k',
            'video_quality': 'best'
        }
    
    def extract_video_id_from_txt(self, meta: ProcessingMeta) -> Optional[str]:
        """
        Extrahiert YouTube-Video-ID aus TXT-Datei
        
        Args:
            meta: ProcessingMeta-Objekt
            
        Returns:
            YouTube-Video-ID oder None
        """
        try:
            txt_files = [f for f in os.listdir(meta.folder_path) if f.endswith('.txt')]
            if not txt_files:
                return None
            
            txt_file = os.path.join(meta.folder_path, txt_files[0])
            with open(txt_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Suche nach #VIDEO:v=VIDEO_ID,c pattern
            video_match = re.search(r'#VIDEO:v=([^,]+),c', content)
            if video_match:
                video_id = video_match.group(1)
                logger.info(f"📹 YouTube-Video-ID aus TXT extrahiert: {video_id}")
                return video_id
            
            return None
            
        except Exception as e:
            logger.error(f"❌ Fehler beim Extrahieren der Video-ID aus TXT: {e}")
            return None
    
    def has_audio_track(self, video_file: str) -> bool:
        """
        Prüft, ob eine Video-Datei eine Audio-Spur hat
        
        Args:
            video_file: Pfad zur Video-Datei
            
        Returns:
            True wenn Audio-Spur vorhanden, False sonst
        """
        try:
            cmd = [
                'ffprobe', '-v', 'quiet', '-select_streams', 'a', 
                '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', video_file
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            return result.returncode == 0 and result.stdout.strip() != ''
        except Exception as e:
            logger.error(f"❌ Fehler beim Prüfen der Audio-Spur: {e}")
            return False
    
    def extract_audio_from_video(self, video_file: str, output_file: str) -> bool:
        """
        Extrahiert Audio-Spur aus Video-Datei
        
        Args:
            video_file: Pfad zur Video-Datei
            output_file: Pfad zur Ausgabe-Audio-Datei
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        try:
            cmd = [
                'ffmpeg', '-i', video_file, '-vn', '-acodec', 'mp3',
                '-ab', '192k', '-ar', '44100', '-y', output_file
            ]
            
            logger.info(f"🎵 Extrahiere Audio aus Video: {video_file} -> {output_file}")
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            
            if result.returncode == 0 and os.path.exists(output_file):
                logger.info(f"✅ Audio erfolgreich extrahiert: {output_file}")
                return True
            else:
                logger.error(f"❌ Audio-Extraktion fehlgeschlagen: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Fehler bei Audio-Extraktion: {e}")
            return False
    
    def download_youtube_video(self, video_id: str, output_file: str) -> bool:
        """
        Lädt YouTube-Video herunter
        
        Args:
            video_id: YouTube-Video-ID
            output_file: Pfad zur Ausgabe-Video-Datei
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        try:
            config = {**self.default_config, **self.config}
            
            ydl_opts = {
                'format': 'best[ext=mp4]/best',
                'outtmpl': output_file.replace('.mp4', '.%(ext)s'),
                'quiet': True,
                'no_warnings': True
            }
            
            url = f"https://www.youtube.com/watch?v={video_id}"
            logger.info(f"📥 Lade YouTube-Video herunter: {url}")
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
            
            # Prüfe, ob Datei erstellt wurde
            if os.path.exists(output_file):
                logger.info(f"✅ YouTube-Video erfolgreich heruntergeladen: {output_file}")
                return True
            else:
                logger.error(f"❌ YouTube-Video-Download fehlgeschlagen")
                return False
                
        except Exception as e:
            logger.error(f"❌ Fehler beim YouTube-Download: {e}")
            return False
    
    def remove_audio_from_video(self, video_file: str, output_file: str) -> bool:
        """
        Entfernt Audio-Spur aus Video-Datei
        
        Args:
            video_file: Pfad zur Eingabe-Video-Datei
            output_file: Pfad zur Ausgabe-Video-Datei ohne Audio
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        try:
            cmd = [
                'ffmpeg', '-i', video_file, '-c:v', 'copy', '-an', '-y', output_file
            ]
            
            logger.info(f"🎬 Entferne Audio aus Video: {video_file} -> {output_file}")
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            
            if result.returncode == 0 and os.path.exists(output_file):
                logger.info(f"✅ Audio erfolgreich aus Video entfernt: {output_file}")
                return True
            else:
                logger.error(f"❌ Audio-Entfernung fehlgeschlagen: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Fehler bei Audio-Entfernung: {e}")
            return False
    
    def find_files(self, meta: ProcessingMeta) -> Dict[str, List[str]]:
        """
        Findet vorhandene Audio- und Video-Dateien
        
        Args:
            meta: ProcessingMeta-Objekt
            
        Returns:
            Dictionary mit 'audio' und 'video' Listen
        """
        files = {'audio': [], 'video': []}
        
        try:
            logger.info(f"🔍 Suche Dateien in: {meta.folder_path}")
            logger.info(f"🔍 Meta-Daten: artist='{meta.artist}', title='{meta.title}', folder_name='{meta.folder_name}'")
            
            if not os.path.exists(meta.folder_path):
                logger.error(f"❌ Ordner existiert nicht: {meta.folder_path}")
                return files
            
            for file in os.listdir(meta.folder_path):
                file_path = os.path.join(meta.folder_path, file)
                if os.path.isfile(file_path):
                    ext = Path(file).suffix.lower()
                    
                    # Debug: Log alle gefundenen Dateien
                    logger.debug(f"🔍 Gefundene Datei: {file} (Erweiterung: {ext})")
                    
                    if ext in AUDIO_EXTENSIONS:
                        files['audio'].append(file_path)
                        logger.info(f"🎵 Audio-Datei gefunden: {file}")
                    elif ext in VIDEO_EXTENSIONS:
                        files['video'].append(file_path)
                        logger.info(f"🎬 Video-Datei gefunden: {file}")
                    else:
                        logger.debug(f"📄 Andere Datei ignoriert: {file} (Erweiterung: {ext})")
            
            logger.info(f"📁 Gefundene Dateien - Audio: {len(files['audio'])}, Video: {len(files['video'])}")
            return files
            
        except Exception as e:
            logger.error(f"❌ Fehler beim Suchen der Dateien: {e}")
            return files
    
    def transcode_to_mp4(self, input_file: str, output_file: str) -> bool:
        """
        Transkodiert Video-Datei zu MP4
        
        Args:
            input_file: Pfad zur Eingabe-Video-Datei
            output_file: Pfad zur Ausgabe-MP4-Datei
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        try:
            cmd = [
                'ffmpeg', '-i', input_file, '-c:v', 'libx264', '-c:a', 'aac',
                '-preset', 'medium', '-crf', '23', '-y', output_file
            ]
            
            logger.info(f"🎬 Transkodiere Video zu MP4: {input_file} -> {output_file}")
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
            
            if result.returncode == 0 and os.path.exists(output_file):
                logger.info(f"✅ Video erfolgreich zu MP4 transkodiert: {output_file}")
                return True
            else:
                logger.error(f"❌ Video-Transkodierung fehlgeschlagen: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Fehler bei Video-Transkodierung: {e}")
            return False
    
    def process_meta(self, meta: ProcessingMeta) -> bool:
        """
        Hauptfunktion: Stellt sicher, dass Audio- und Video-Dateien verfügbar sind
        
        Args:
            meta: ProcessingMeta-Objekt
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        log_start('ensure_source_files.process_meta', meta)
        
        try:
            # Finde vorhandene Dateien
            files = self.find_files(meta)
            has_audio = len(files['audio']) > 0
            has_video = len(files['video']) > 0
            
            # Debug: Log die gefundenen Dateien
            logger.info(f"🔍 Gefundene Audio-Dateien: {[Path(f).name for f in files['audio']]}")
            logger.info(f"🔍 Gefundene Video-Dateien: {[Path(f).name for f in files['video']]}")
            
            # Speichere initiale Dateien für spätere Entscheidungen
            meta.metadata['initial_files'] = {
                'audio': has_audio,
                'video': has_video
            }
            
            logger.info(f"📊 Datei-Status: Audio={has_audio}, Video={has_video}")
            
            # Zentraler Check: Transkodiere .avi zu .mp4 falls nötig
            if has_video:
                video_file = files['video'][0]
                video_ext = Path(video_file).suffix.lower()
                
                if video_ext == '.avi':
                    # Prüfe ob bereits .mp4 vorhanden ist
                    base_name = Path(video_file).stem
                    mp4_file = os.path.join(meta.folder_path, f"{base_name}.mp4")
                    
                    if not os.path.exists(mp4_file):
                        logger.info(f"🎬 Video-Datei ist .avi, transkodiere zu MP4")
                        
                        # Sende transcoding Status
                        try:
                            send_processing_status(meta, 'transcoding')
                        except Exception:
                            pass
                        
                        if not self.transcode_to_mp4(video_file, mp4_file):
                            logger.error("❌ Video-Transkodierung fehlgeschlagen")
                            meta.mark_step_failed('ensure_source_files')
                            return False
                        
                        # Dateien zum Meta hinzufügen
                        meta.add_output_file(mp4_file)
                        meta.add_keep_file(f"{base_name}.mp4")
                        meta.metadata['transcoded_video'] = True
                        logger.info("✅ Video erfolgreich zu MP4 transkodiert")
                    else:
                        logger.info("✅ MP4-Version bereits vorhanden, verwende diese")
            
            # Fall 1: Audio und Video vorhanden - nichts zu tun
            if has_audio and has_video:
                logger.info("✅ Audio und Video bereits vorhanden - nichts zu tun")
                meta.mark_step_completed('ensure_source_files')
                return True
            
            # Fall 2: Video vorhanden, Audio nicht vorhanden
            if has_video and not has_audio:
                logger.info("🎬 Video vorhanden, Audio fehlt - prüfe ob Audio-Datei existiert")
                
                video_file = files['video'][0]  # Nimm erste Video-Datei
                base_name = Path(video_file).stem
                extracted_audio = os.path.join(meta.folder_path, f"{base_name}.mp3")
                
                # Prüfe, ob Audio-Datei bereits existiert (falls sie nicht erkannt wurde)
                if os.path.exists(extracted_audio):
                    logger.info(f"✅ Audio-Datei bereits vorhanden: {base_name}.mp3")
                    # Dateien zum Meta hinzufügen
                    meta.add_output_file(extracted_audio)
                    meta.add_keep_file(f"{base_name}.mp3")
                    meta.mark_step_completed('ensure_source_files')
                    return True
                
                logger.info("🎬 Audio-Datei nicht vorhanden - extrahiere Audio")
                
                # Backup erstellen falls Audio-Datei bereits existiert
                if os.path.exists(extracted_audio):
                    backup_file = f"{base_name}.mp3.bak"
                    backup_path = os.path.join(meta.folder_path, backup_file)
                    try:
                        os.rename(extracted_audio, backup_path)
                        logger.info(f"📦 Backup erstellt: {base_name}.mp3 → {backup_file}")
                    except Exception as e:
                        logger.warning(f"⚠️ Konnte Backup nicht erstellen: {e}")
                
                # Prüfe, ob Video Audio-Spur hat
                if self.has_audio_track(video_file):
                    # Audio aus Video extrahieren
                    if not self.extract_audio_from_video(video_file, extracted_audio):
                        logger.error("❌ Audio-Extraktion aus Video fehlgeschlagen")
                        meta.mark_step_failed('ensure_source_files')
                        return False
                else:
                    # Video hat keine Audio-Spur - prüfe TXT für YouTube-ID
                    video_id = self.extract_video_id_from_txt(meta)
                    if not video_id:
                        logger.error("❌ Video hat keine Audio-Spur und keine YouTube-ID in TXT")
                        meta.mark_step_failed('ensure_source_files')
                        return False
                    
                    # YouTube-Video herunterladen
                    # Sende downloading Status
                    try:
                        send_processing_status(meta, 'downloading')
                    except Exception:
                        pass
                    
                    temp_video = os.path.join(meta.folder_path, "tmp.mp4")
                    if not self.download_youtube_video(video_id, temp_video):
                        logger.error("❌ YouTube-Video-Download fehlgeschlagen")
                        meta.mark_step_failed('ensure_source_files')
                        return False
                    
                    # Audio aus YouTube-Video extrahieren
                    if not self.extract_audio_from_video(temp_video, extracted_audio):
                        logger.error("❌ Audio-Extraktion aus YouTube-Video fehlgeschlagen")
                        meta.mark_step_failed('ensure_source_files')
                        return False
                    
                    # Temp-Video löschen
                    try:
                        os.remove(temp_video)
                        logger.info(f"🗑️ Temp-Video gelöscht: {temp_video}")
                    except Exception as e:
                        logger.warning(f"⚠️ Konnte Temp-Video nicht löschen: {e}")
                
                # Dateien zum Meta hinzufügen
                meta.add_output_file(extracted_audio)
                meta.add_keep_file(f"{base_name}.mp3")
                
                logger.info("✅ Audio erfolgreich extrahiert")
                meta.mark_step_completed('ensure_source_files')
                return True
            
            # Fall 3: Audio vorhanden, Video nicht vorhanden
            if has_audio and not has_video:
                logger.info("🎵 Audio vorhanden, Video fehlt")
                
                # Für Ultrastar-Songs ist Video optional - nur Audio reicht
                if meta.mode == 'ultrastar' or str(meta.mode) == 'ProcessingMode.ULTRASTAR' or meta.mode.value == 'ultrastar':
                    logger.info("✅ Ultrastar-Song: Audio vorhanden, Video nicht erforderlich")
                    meta.mark_step_completed('ensure_source_files')
                    return True
                
                # Für andere Modi (magic-songs, magic-videos) ist Video erforderlich
                logger.info("🎬 Video erforderlich - prüfe TXT für YouTube-ID")
                
                # Prüfe TXT für YouTube-ID
                video_id = self.extract_video_id_from_txt(meta)
                if not video_id:
                    logger.error("❌ Keine YouTube-ID in TXT gefunden")
                    meta.mark_step_failed('ensure_source_files')
                    return False
                
                # YouTube-Video herunterladen
                # Sende downloading Status
                try:
                    send_processing_status(meta, 'downloading')
                except Exception:
                    pass
                
                base_name = Path(files['audio'][0]).stem
                video_file = os.path.join(meta.folder_path, f"{base_name}.mp4")
                if not self.download_youtube_video(video_id, video_file):
                    logger.error("❌ YouTube-Video-Download fehlgeschlagen")
                    meta.mark_step_failed('ensure_source_files')
                    return False
                
                # Audio aus Video entfernen
                video_no_audio = os.path.join(meta.folder_path, f"{base_name}_no_audio.mp4")
                if not self.remove_audio_from_video(video_file, video_no_audio):
                    logger.error("❌ Audio-Entfernung aus Video fehlgeschlagen")
                    meta.mark_step_failed('ensure_source_files')
                    return False
                
                # Dateien zum Meta hinzufügen
                meta.add_output_file(video_file)
                meta.add_output_file(video_no_audio)
                meta.add_keep_file(f"{base_name}.mp4")
                
                logger.info("✅ Video heruntergeladen")
                meta.mark_step_completed('ensure_source_files')
                return True
            
            # Fall 4: Weder Audio noch Video vorhanden
            if not has_audio and not has_video:
                logger.info("❌ Weder Audio noch Video vorhanden - prüfe TXT für YouTube-ID")
                
                # Prüfe TXT für YouTube-ID
                video_id = self.extract_video_id_from_txt(meta)
                if not video_id:
                    logger.error("❌ Keine YouTube-ID in TXT gefunden")
                    meta.mark_step_failed('ensure_source_files')
                    return False
                
                # YouTube-Video herunterladen
                # Sende downloading Status
                try:
                    send_processing_status(meta, 'downloading')
                except Exception:
                    pass
                
                base_name = meta.base_filename or f"{meta.artist} - {meta.title}"
                video_file = os.path.join(meta.folder_path, f"{base_name}.mp4")
                if not self.download_youtube_video(video_id, video_file):
                    logger.error("❌ YouTube-Video-Download fehlgeschlagen")
                    meta.mark_step_failed('ensure_source_files')
                    return False
                
                # Audio aus Video extrahieren
                extracted_audio = os.path.join(meta.folder_path, f"{base_name}.mp3")
                
                # Backup erstellen falls Audio-Datei bereits existiert
                if os.path.exists(extracted_audio):
                    backup_file = f"{base_name}.mp3.bak"
                    backup_path = os.path.join(meta.folder_path, backup_file)
                    try:
                        os.rename(extracted_audio, backup_path)
                        logger.info(f"📦 Backup erstellt: {base_name}.mp3 → {backup_file}")
                    except Exception as e:
                        logger.warning(f"⚠️ Konnte Backup nicht erstellen: {e}")
                
                if not self.extract_audio_from_video(video_file, extracted_audio):
                    logger.error("❌ Audio-Extraktion aus Video fehlgeschlagen")
                    meta.mark_step_failed('ensure_source_files')
                    return False
                
                # Dateien zum Meta hinzufügen
                meta.add_output_file(video_file)
                meta.add_output_file(extracted_audio)
                meta.add_output_file(video_no_audio)
                meta.add_keep_file(f"{base_name}.mp4")
                meta.add_keep_file(f"{base_name}.mp3")
                
                logger.info("✅ Video heruntergeladen und Audio extrahiert")
                meta.mark_step_completed('ensure_source_files')
                return True
            
            logger.error("❌ Unbekannter Fall erreicht")
            meta.mark_step_failed('ensure_source_files')
            return False
            
        except Exception as e:
            logger.error(f"❌ Fehler in ensure_source_files: {e}")
            meta.mark_step_failed('ensure_source_files')
            return False


def ensure_source_files(meta: ProcessingMeta) -> bool:
    """
    Hauptfunktion für das ensure_source_files Modul
    
    Args:
        meta: ProcessingMeta-Objekt
        
    Returns:
        True wenn erfolgreich, False sonst
    """
    ensurer = SourceFileEnsurer()
    return ensurer.process_meta(meta)
