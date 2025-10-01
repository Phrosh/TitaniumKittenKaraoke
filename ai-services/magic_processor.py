#!/usr/bin/env python3
"""
Magic Processor - Verarbeitet Magic-Songs, Magic-Videos und Magic-YouTube
"""

import os
import sys
import logging
import subprocess
import re
from pathlib import Path
from music_to_lyrics import MusicToLyricsProcessor
from audio_separator import find_audio_file, extract_audio_from_video

# Logging konfigurieren
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MagicProcessor:
    def __init__(self, whisper_model="large-v3", device=None):
        self.mtl = MusicToLyricsProcessor(whisper_model=whisper_model, device=device)
        
    def process_magic_songs(self, songs_dir="songs/magic-songs"):
        """Verarbeitet alle Audiodateien in magic-songs"""
        logger.info(f"Verarbeite Magic-Songs in: {songs_dir}")
        
        if not os.path.exists(songs_dir):
            logger.error(f"Ordner nicht gefunden: {songs_dir}")
            return
        
        processed_count = 0
        for root, dirs, files in os.walk(songs_dir):
            for file in files:
                if file.lower().endswith(('.mp3', '.wav', '.flac', '.m4a', '.aac')):
                    audio_path = os.path.join(root, file)
                    logger.info(f"Verarbeite: {audio_path}")
                    
                    try:
                        result = self.mtl.process_audio(audio_path)
                        if result["success"]:
                            logger.info(f"✅ Erfolgreich: {audio_path}")
                            processed_count += 1
                        else:
                            logger.error(f"❌ Fehler: {result['error']}")
                    except Exception as e:
                        logger.error(f"❌ Exception: {e}")
        
        logger.info(f"Magic-Songs verarbeitet: {processed_count} Dateien")
        return processed_count
    
    def process_magic_videos(self, videos_dir="songs/magic-videos"):
        """Verarbeitet alle Videodateien in magic-videos"""
        logger.info(f"Verarbeite Magic-Videos in: {videos_dir}")
        
        if not os.path.exists(videos_dir):
            logger.error(f"Ordner nicht gefunden: {videos_dir}")
            return
        
        processed_count = 0
        for root, dirs, files in os.walk(videos_dir):
            for file in files:
                if file.lower().endswith(('.mp4', '.avi', '.mkv', '.mov', '.wmv')):
                    video_path = os.path.join(root, file)
                    logger.info(f"Verarbeite: {video_path}")
                    
                    try:
                        # Extrahiere Audio aus Video
                        audio_path = self._extract_audio_from_video(video_path)
                        if not audio_path:
                            logger.error(f"Audio-Extraktion fehlgeschlagen: {video_path}")
                            continue
                        
                        # Verarbeite Audio
                        result = self.mtl.process_audio(audio_path)
                        if result["success"]:
                            logger.info(f"✅ Erfolgreich: {video_path}")
                            processed_count += 1
                            
                            # Remuxe Video (ersetze Audio mit MP3)
                            self._remux_video_with_mp3(video_path, audio_path)
                        else:
                            logger.error(f"❌ Fehler: {result['error']}")
                    except Exception as e:
                        logger.error(f"❌ Exception: {e}")
        
        logger.info(f"Magic-Videos verarbeitet: {processed_count} Dateien")
        return processed_count
    
    def process_magic_youtube(self, youtube_dir="songs/magic-youtube"):
        """Verarbeitet alle YouTube-Videos in magic-youtube"""
        logger.info(f"Verarbeite Magic-YouTube in: {youtube_dir}")
        
        if not os.path.exists(youtube_dir):
            logger.error(f"Ordner nicht gefunden: {youtube_dir}")
            return
        
        processed_count = 0
        for root, dirs, files in os.walk(youtube_dir):
            for file in files:
                if file.lower().endswith(('.mp4', '.webm', '.mkv')):
                    video_path = os.path.join(root, file)
                    logger.info(f"Verarbeite: {video_path}")
                    
                    try:
                        # Extrahiere Audio aus Video
                        audio_path = self._extract_audio_from_video(video_path)
                        if not audio_path:
                            logger.error(f"Audio-Extraktion fehlgeschlagen: {video_path}")
                            continue
                        
                        # Verarbeite Audio
                        result = self.mtl.process_audio(audio_path)
                        if result["success"]:
                            logger.info(f"✅ Erfolgreich: {video_path}")
                            processed_count += 1
                            
                            # Remuxe Video (ersetze Audio mit MP3)
                            self._remux_video_with_mp3(video_path, audio_path)
                        else:
                            logger.error(f"❌ Fehler: {result['error']}")
                    except Exception as e:
                        logger.error(f"❌ Exception: {e}")
        
        logger.info(f"Magic-YouTube verarbeitet: {processed_count} Dateien")
        return processed_count
    
    def _extract_audio_from_video(self, video_path):
        """Extrahiert Audio aus Video-Datei"""
        try:
            # Verwende die bestehende Funktion aus audio_separator
            audio_path = extract_audio_from_video(video_path)
            return audio_path
        except Exception as e:
            logger.error(f"Fehler bei Audio-Extraktion: {e}")
            return None
    
    def _remux_video_with_mp3(self, video_path, audio_path):
        """Remuxt Video mit MP3-Audio"""
        try:
            # Erstelle MP3-Pfad
            base_name = os.path.splitext(video_path)[0]
            mp3_path = f"{base_name}.mp3"
            
            # Konvertiere Audio zu MP3 falls nötig
            if not audio_path.endswith('.mp3'):
                self._convert_to_mp3(audio_path, mp3_path)
            else:
                mp3_path = audio_path
            
            # Remuxe Video mit MP3
            output_path = f"{base_name}_remuxed.mp4"
            cmd = [
                'ffmpeg',
                '-i', video_path,
                '-i', mp3_path,
                '-c:v', 'copy',  # Video kopieren ohne Re-Encoding
                '-c:a', 'aac',   # Audio zu AAC konvertieren
                '-map', '0:v:0', # Video von erster Eingabe
                '-map', '1:a:0', # Audio von zweiter Eingabe
                '-y',            # Überschreiben ohne Nachfrage
                output_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                logger.info(f"Video remuxt: {output_path}")
                # Lösche temporäre MP3-Datei
                if mp3_path != audio_path and os.path.exists(mp3_path):
                    os.remove(mp3_path)
            else:
                logger.error(f"Remux-Fehler: {result.stderr}")
                
        except Exception as e:
            logger.error(f"Fehler beim Remuxen: {e}")
    
    def _convert_to_mp3(self, input_path, output_path):
        """Konvertiert Audio zu MP3"""
        try:
            cmd = [
                'ffmpeg',
                '-i', input_path,
                '-c:a', 'libmp3lame',
                '-b:a', '192k',
                '-y',
                output_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                logger.info(f"Konvertiert zu MP3: {output_path}")
            else:
                logger.error(f"MP3-Konvertierung fehlgeschlagen: {result.stderr}")
                
        except Exception as e:
            logger.error(f"Fehler bei MP3-Konvertierung: {e}")
    
    def process_all(self):
        """Verarbeitet alle Magic-Ordner"""
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
    
    parser = argparse.ArgumentParser(description="Magic Processor - Verarbeitet Magic-Songs, Videos und YouTube")
    parser.add_argument("--songs", action="store_true", help="Verarbeite nur Magic-Songs")
    parser.add_argument("--videos", action="store_true", help="Verarbeite nur Magic-Videos")
    parser.add_argument("--youtube", action="store_true", help="Verarbeite nur Magic-YouTube")
    parser.add_argument("--all", action="store_true", help="Verarbeite alle Magic-Ordner")
    parser.add_argument("--model", default="large-v3", choices=["tiny", "base", "small", "medium", "large", "large-v2", "large-v3"], help="Whisper-Modell")
    parser.add_argument("--device", choices=["cuda", "cpu"], help="Device für Whisper")
    
    args = parser.parse_args()
    
    if not any([args.songs, args.videos, args.youtube, args.all]):
        parser.print_help()
        sys.exit(1)
    
    # Initialisiere Processor
    processor = MagicProcessor(whisper_model=args.model, device=args.device)
    
    # Verarbeite je nach Argumenten
    if args.all:
        processor.process_all()
    elif args.songs:
        processor.process_magic_songs()
    elif args.videos:
        processor.process_magic_videos()
    elif args.youtube:
        processor.process_magic_youtube()

if __name__ == "__main__":
    main()
