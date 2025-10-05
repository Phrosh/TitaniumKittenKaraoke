#!/usr/bin/env python3
"""
Magic Processor - Refactored Version
Verwendet modulare Funktionen für Magic-Songs, Magic-Videos und Magic-YouTube
"""

import os
import sys
import logging
from pathlib import Path

# Import der modularen Funktionen
from modules import (
    ProcessingMeta, ProcessingMode, ProcessingStatus,
    create_meta_from_youtube_url, create_meta_from_file_path,
    download_youtube_video, normalize_audio_files, separate_audio,
    remux_videos, transcribe_audio, download_usdb_file, cleanup_files
)

# Logging konfigurieren
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MagicProcessor:
    """Refactorierter Magic-Processor mit modularen Funktionen"""
    
    def __init__(self, whisper_model="large-v3", device=None):
        """
        Initialisiert den Magic-Processor
        
        Args:
            whisper_model: Whisper-Modell für Transkription
            device: Device für Whisper
        """
        self.whisper_model = whisper_model
        self.device = device
        
        # Konfiguration für die Module
        self.config = {
            'transcription': {
                'model': whisper_model,
                'device': device or 'auto'
            },
            'audio_separation': {
                'model': 'HP2',
                'gain_reduction': 2.0
            },
            'video_remuxing': {
                'overwrite_original': True
            },
            'cleanup': {
                'remove_temp_files': True,
                'organize_files': True
            }
        }
    
    def process_magic_songs(self, songs_dir="songs/magic-songs"):
        """
        Verarbeitet alle Audiodateien in magic-songs
        
        Args:
            songs_dir: Pfad zum magic-songs Ordner
            
        Returns:
            Anzahl der verarbeiteten Dateien
        """
        logger.info(f"Verarbeite Magic-Songs in: {songs_dir}")
        
        if not os.path.exists(songs_dir):
            logger.error(f"Ordner nicht gefunden: {songs_dir}")
            return 0
        
        processed_count = 0
        
        # Durchlaufe alle Ordner
        for folder_name in os.listdir(songs_dir):
            folder_path = os.path.join(songs_dir, folder_name)
            
            if os.path.isdir(folder_path):
                try:
                    # Erstelle Meta-Objekt aus Ordner
                    meta = create_meta_from_file_path(folder_path, songs_dir, ProcessingMode.MAGIC_SONGS)
                    
                    # Verarbeite den Song
                    if self._process_single_song(meta):
                        processed_count += 1
                        logger.info(f"✅ Magic-Song verarbeitet: {meta.artist} - {meta.title}")
                    else:
                        logger.error(f"❌ Magic-Song fehlgeschlagen: {meta.artist} - {meta.title}")
                        
                except Exception as e:
                    logger.error(f"Fehler bei Magic-Song {folder_name}: {e}")
        
        logger.info(f"Magic-Songs verarbeitet: {processed_count} Dateien")
        return processed_count
    
    def process_magic_videos(self, videos_dir="songs/magic-videos"):
        """
        Verarbeitet alle Videodateien in magic-videos
        
        Args:
            videos_dir: Pfad zum magic-videos Ordner
            
        Returns:
            Anzahl der verarbeiteten Dateien
        """
        logger.info(f"Verarbeite Magic-Videos in: {videos_dir}")
        
        if not os.path.exists(videos_dir):
            logger.error(f"Ordner nicht gefunden: {videos_dir}")
            return 0
        
        processed_count = 0
        
        # Durchlaufe alle Ordner
        for folder_name in os.listdir(videos_dir):
            folder_path = os.path.join(videos_dir, folder_name)
            
            if os.path.isdir(folder_path):
                try:
                    # Erstelle Meta-Objekt aus Ordner
                    meta = create_meta_from_file_path(folder_path, videos_dir, ProcessingMode.MAGIC_VIDEOS)
                    
                    # Verarbeite das Video
                    if self._process_single_video(meta):
                        processed_count += 1
                        logger.info(f"✅ Magic-Video verarbeitet: {meta.artist} - {meta.title}")
                    else:
                        logger.error(f"❌ Magic-Video fehlgeschlagen: {meta.artist} - {meta.title}")
                        
                except Exception as e:
                    logger.error(f"Fehler bei Magic-Video {folder_name}: {e}")
        
        logger.info(f"Magic-Videos verarbeitet: {processed_count} Dateien")
        return processed_count
    
    def process_magic_youtube(self, youtube_dir="songs/magic-youtube"):
        """
        Verarbeitet alle YouTube-Videos in magic-youtube
        
        Args:
            youtube_dir: Pfad zum magic-youtube Ordner
            
        Returns:
            Anzahl der verarbeiteten Dateien
        """
        logger.info(f"Verarbeite Magic-YouTube in: {youtube_dir}")
        
        if not os.path.exists(youtube_dir):
            logger.error(f"Ordner nicht gefunden: {youtube_dir}")
            return 0
        
        processed_count = 0
        
        # Durchlaufe alle Ordner
        for folder_name in os.listdir(youtube_dir):
            folder_path = os.path.join(youtube_dir, folder_name)
            
            if os.path.isdir(folder_path):
                try:
                    # Erstelle Meta-Objekt aus Ordner
                    meta = create_meta_from_file_path(folder_path, youtube_dir, ProcessingMode.MAGIC_YOUTUBE)
                    
                    # Verarbeite das YouTube-Video
                    if self._process_single_youtube_video(meta):
                        processed_count += 1
                        logger.info(f"✅ Magic-YouTube verarbeitet: {meta.artist} - {meta.title}")
                    else:
                        logger.error(f"❌ Magic-YouTube fehlgeschlagen: {meta.artist} - {meta.title}")
                        
                except Exception as e:
                    logger.error(f"Fehler bei Magic-YouTube {folder_name}: {e}")
        
        logger.info(f"Magic-YouTube verarbeitet: {processed_count} Dateien")
        return processed_count
    
    def _process_single_song(self, meta: ProcessingMeta) -> bool:
        """
        Verarbeitet einen einzelnen Magic-Song
        
        Args:
            meta: ProcessingMeta-Objekt
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        try:
            logger.info(f"Verarbeite Magic-Song: {meta.artist} - {meta.title}")
            
            # 1. Audio normalisieren
            if not normalize_audio_files(meta, simple=True):
                logger.error("Audio-Normalisierung fehlgeschlagen")
                return False
            
            # 2. Audio trennen
            if not separate_audio(meta):
                logger.error("Audio-Separation fehlgeschlagen")
                return False
            
            # 3. Transkribieren
            if not transcribe_audio(meta):
                logger.error("Transkription fehlgeschlagen")
                return False
            
            # 4. Cleanup
            if not cleanup_files(meta):
                logger.error("Cleanup fehlgeschlagen")
                return False
            
            logger.info(f"✅ Magic-Song erfolgreich verarbeitet: {meta.artist} - {meta.title}")
            return True
            
        except Exception as e:
            logger.error(f"Fehler bei Magic-Song-Verarbeitung: {e}")
            return False
    
    def _process_single_video(self, meta: ProcessingMeta) -> bool:
        """
        Verarbeitet ein einzelnes Magic-Video
        
        Args:
            meta: ProcessingMeta-Objekt
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        try:
            logger.info(f"Verarbeite Magic-Video: {meta.artist} - {meta.title}")
            
            # 1. Audio aus Video extrahieren (bereits in Audio-Normalisierung implementiert)
            if not normalize_audio_files(meta, simple=True):
                logger.error("Audio-Extraktion/Normalisierung fehlgeschlagen")
                return False
            
            # 2. Audio trennen
            if not separate_audio(meta):
                logger.error("Audio-Separation fehlgeschlagen")
                return False
            
            # 3. Video remuxen (Audiospur entfernen)
            if not remux_videos(meta, remove_audio=True):
                logger.error("Video-Remuxing fehlgeschlagen")
                return False
            
            # 4. Transkribieren
            if not transcribe_audio(meta):
                logger.error("Transkription fehlgeschlagen")
                return False
            
            # 5. Cleanup
            if not cleanup_files(meta):
                logger.error("Cleanup fehlgeschlagen")
                return False
            
            logger.info(f"✅ Magic-Video erfolgreich verarbeitet: {meta.artist} - {meta.title}")
            return True
            
        except Exception as e:
            logger.error(f"Fehler bei Magic-Video-Verarbeitung: {e}")
            return False
    
    def _process_single_youtube_video(self, meta: ProcessingMeta) -> bool:
        """
        Verarbeitet ein einzelnes Magic-YouTube-Video
        
        Args:
            meta: ProcessingMeta-Objekt
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        try:
            logger.info(f"Verarbeite Magic-YouTube: {meta.artist} - {meta.title}")
            
            # 1. Audio aus Video extrahieren (bereits in Audio-Normalisierung implementiert)
            if not normalize_audio_files(meta, simple=True):
                logger.error("Audio-Extraktion/Normalisierung fehlgeschlagen")
                return False
            
            # 2. Audio trennen
            if not separate_audio(meta):
                logger.error("Audio-Separation fehlgeschlagen")
                return False
            
            # 3. Video remuxen (Audiospur entfernen)
            if not remux_videos(meta, remove_audio=True):
                logger.error("Video-Remuxing fehlgeschlagen")
                return False
            
            # 4. Transkribieren
            if not transcribe_audio(meta):
                logger.error("Transkription fehlgeschlagen")
                return False
            
            # 5. Cleanup
            if not cleanup_files(meta):
                logger.error("Cleanup fehlgeschlagen")
                return False
            
            logger.info(f"✅ Magic-YouTube erfolgreich verarbeitet: {meta.artist} - {meta.title}")
            return True
            
        except Exception as e:
            logger.error(f"Fehler bei Magic-YouTube-Verarbeitung: {e}")
            return False
    
    def process_youtube_url(self, youtube_url: str, mode: ProcessingMode = ProcessingMode.MAGIC_YOUTUBE) -> bool:
        """
        Verarbeitet eine YouTube-URL direkt
        
        Args:
            youtube_url: YouTube-URL
            mode: Verarbeitungsmodus
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        try:
            # Bestimme Basis-Verzeichnis basierend auf Modus
            if mode == ProcessingMode.MAGIC_YOUTUBE:
                base_dir = "songs/magic-youtube"
            elif mode == ProcessingMode.YOUTUBE_CACHE:
                base_dir = "songs/youtube"
            else:
                base_dir = "songs/magic-youtube"
            
            # Erstelle Meta-Objekt aus YouTube-URL
            meta = create_meta_from_youtube_url(youtube_url, base_dir, mode)
            
            logger.info(f"Verarbeite YouTube-URL: {youtube_url}")
            
            # 1. YouTube-Video herunterladen
            if not download_youtube_video(meta):
                logger.error("YouTube-Download fehlgeschlagen")
                return False
            
            # 2. Je nach Modus weiterverarbeiten
            if mode == ProcessingMode.MAGIC_YOUTUBE:
                return self._process_single_youtube_video(meta)
            elif mode == ProcessingMode.YOUTUBE_CACHE:
                # Für YouTube-Cache nur herunterladen
                logger.info(f"✅ YouTube-Video erfolgreich gecacht: {meta.artist} - {meta.title}")
                return True
            else:
                logger.error(f"Unbekannter Modus: {mode}")
                return False
                
        except Exception as e:
            logger.error(f"Fehler bei YouTube-URL-Verarbeitung: {e}")
            return False
    
    def process_usdb_url(self, usdb_url: str, base_dir: str = "songs/ultrastar") -> bool:
        """
        Verarbeitet eine USDB-URL direkt
        
        Args:
            usdb_url: USDB-URL
            base_dir: Basis-Verzeichnis
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        try:
            # Erstelle Meta-Objekt für USDB
            meta = ProcessingMeta(
                artist="Unknown Artist",
                title="Unknown Title",
                mode=ProcessingMode.ULTRASTAR,
                base_dir=base_dir,
                folder_name="Unknown Artist - Unknown Title",
                usdb_url=usdb_url
            )
            
            logger.info(f"Verarbeite USDB-URL: {usdb_url}")
            
            # USDB-Datei herunterladen
            if not download_usdb_file(meta):
                logger.error("USDB-Download fehlgeschlagen")
                return False
            
            logger.info(f"✅ USDB-Datei erfolgreich heruntergeladen: {meta.artist} - {meta.title}")
            return True
            
        except Exception as e:
            logger.error(f"Fehler bei USDB-URL-Verarbeitung: {e}")
            return False
    
    def process_all(self):
        """
        Verarbeitet alle Magic-Ordner
        
        Returns:
            Gesamtanzahl der verarbeiteten Dateien
        """
        logger.info("Starte Magic-Processing für alle Ordner...")
        
        total_processed = 0
        total_processed += self.process_magic_songs()
        total_processed += self.process_magic_videos()
        total_processed += self.process_magic_youtube()
        
        logger.info(f"Magic-Processing abgeschlossen: {total_processed} Dateien verarbeitet")
        return total_processed

def main():
    """Hauptfunktion"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Magic Processor - Refactored Version")
    parser.add_argument("--songs", action="store_true", help="Verarbeite nur Magic-Songs")
    parser.add_argument("--videos", action="store_true", help="Verarbeite nur Magic-Videos")
    parser.add_argument("--youtube", action="store_true", help="Verarbeite nur Magic-YouTube")
    parser.add_argument("--all", action="store_true", help="Verarbeite alle Magic-Ordner")
    parser.add_argument("--youtube-url", help="Verarbeite eine spezifische YouTube-URL")
    parser.add_argument("--usdb-url", help="Verarbeite eine spezifische USDB-URL")
    parser.add_argument("--model", default="large-v3", choices=["tiny", "base", "small", "medium", "large", "large-v2", "large-v3"], help="Whisper-Modell")
    parser.add_argument("--device", choices=["cuda", "cpu"], help="Device für Whisper")
    
    args = parser.parse_args()
    
    if not any([args.songs, args.videos, args.youtube, args.all, args.youtube_url, args.usdb_url]):
        parser.print_help()
        sys.exit(1)
    
    # Initialisiere Processor
    processor = MagicProcessor(whisper_model=args.model, device=args.device)
    
    # Verarbeite je nach Argumenten
    if args.youtube_url:
        processor.process_youtube_url(args.youtube_url)
    elif args.usdb_url:
        processor.process_usdb_url(args.usdb_url)
    elif args.all:
        processor.process_all()
    elif args.songs:
        processor.process_magic_songs()
    elif args.videos:
        processor.process_magic_videos()
    elif args.youtube:
        processor.process_magic_youtube()

if __name__ == "__main__":
    main()
