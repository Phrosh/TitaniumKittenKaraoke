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
from music_to_lyrics import MusicToLyrics
from audio_separator import find_audio_file, extract_audio_from_video

# Logging konfigurieren
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MagicProcessor:
    def __init__(self, whisper_model="large-v3", device=None):
        self.mtl = MusicToLyrics(whisper_model=whisper_model, device=device)
        
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
                        
                        # Verarbeite Audio (erstellt bereits separate Dateien)
                        result = self.mtl.process_audio(audio_path)
                        if result["success"]:
                            logger.info(f"✅ Erfolgreich: {video_path}")
                            processed_count += 1
                            
                            # Musik-Verarbeitung erstellt bereits alle Dateien im UltraStar-Schema
                            # Nur noch Video remuxen (ersetze Audio mit MP3)
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
                        
                        # Verarbeite Audio (erstellt bereits separate Dateien)
                        # WICHTIG: Audio-Verarbeitung BEVOR Video remuxt wird
                        result = self.mtl.process_audio(audio_path)
                        if result["success"]:
                            logger.info(f"✅ Erfolgreich: {video_path}")
                            processed_count += 1
                            
                            # Musik-Verarbeitung erstellt bereits alle Dateien im UltraStar-Schema
                            # Jetzt Video remuxen (Audio entfernen für Karaoke)
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
            # Erstelle Output-Ordner im gleichen Verzeichnis wie das Video
            video_dir = os.path.dirname(video_path)
            
            # Verwende die bestehende Funktion aus audio_separator
            audio_path = extract_audio_from_video(video_path, video_dir)
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
            
            # Remuxe Video OHNE Audio (für Karaoke)
            output_path = f"{base_name}_remuxed.mp4"
            cmd = [
                'ffmpeg',
                '-i', video_path,
                '-c:v', 'copy',  # Video kopieren ohne Re-Encoding
                '-an',           # Kein Audio (Audio entfernen)
                '-y',            # Überschreiben ohne Nachfrage
                output_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                logger.info(f"Video remuxt: {output_path}")
                
                # Überschreibe Original-Video mit Remuxed-Version
                original_video = video_path  # Das Original-Video ist das Input-Video
                
                if os.path.exists(output_path):
                    try:
                        # Lösche zuerst das Original-Video falls es existiert
                        if os.path.exists(original_video):
                            os.remove(original_video)
                            logger.info(f"Original-Video gelöscht: {original_video}")
                        
                        # Dann verschiebe das remuxed Video
                        os.rename(output_path, original_video)
                        logger.info(f"Original-Video überschrieben: {original_video}")
                    except PermissionError as e:
                        logger.error(f"Zugriff verweigert beim Überschreiben: {e}")
                        logger.info(f"Remuxed-Video bleibt unter: {output_path}")
                
                # Lösche temporäre MP3-Datei
                if mp3_path != audio_path and os.path.exists(mp3_path):
                    os.remove(mp3_path)
            else:
                logger.error(f"Remux-Fehler: {result.stderr}")
                
        except Exception as e:
            logger.error(f"Fehler beim Remuxen: {e}")
    
    def _create_hp_files(self, video_path, audio_path):
        """Erstellt HP2 und HP5 Dateien aus den separaten Audiospuren"""
        try:
            # Extrahiere YouTube-ID aus Video-Dateinamen (z.B. "_lK4cX5xGiQ" aus "_lK4cX5xGiQ.mp4")
            video_filename = os.path.basename(video_path)
            youtube_id = os.path.splitext(video_filename)[0]  # YouTube-ID ist der komplette Dateiname ohne Extension
            
            # HP2 (Instrumental ohne Vocal) - umbenennen von _extracted_instrumental.mp3
            instrumental_path = f"{os.path.splitext(audio_path)[0]}_instrumental.mp3"
            hp2_path = os.path.join(os.path.dirname(video_path), f"{youtube_id}_extracted.hp2.mp3")
            
            if os.path.exists(instrumental_path):
                os.rename(instrumental_path, hp2_path)
                logger.info(f"HP2 erstellt: {hp2_path}")
            else:
                logger.warning(f"Instrumental-Datei nicht gefunden: {instrumental_path}")
            
            # HP5 (Nur Vocal) - umbenennen von _extracted_vocals.wav zu _extracted.hp5.mp3
            vocals_path = f"{os.path.splitext(audio_path)[0]}_vocals.wav"
            hp5_path = os.path.join(os.path.dirname(video_path), f"{youtube_id}_extracted.hp5.mp3")
            
            if os.path.exists(vocals_path):
                # Konvertiere Vocals von WAV zu MP3
                self._convert_to_mp3(vocals_path, hp5_path)
                # Lösche temporäre WAV-Datei
                os.remove(vocals_path)
                logger.info(f"HP5 erstellt: {hp5_path}")
            else:
                logger.warning(f"Vocals-Datei nicht gefunden: {vocals_path}")
                
        except Exception as e:
            logger.error(f"Fehler bei HP-Dateien-Erstellung: {e}")
    
    def _create_hp_files_from_existing(self, video_path, audio_path):
        """Erstellt HP2 und HP5 Dateien aus bereits existierenden separaten Audios"""
        try:
            # Extrahiere YouTube-ID aus Video-Dateinamen
            video_filename = os.path.basename(video_path)
            youtube_id = os.path.splitext(video_filename)[0]  # YouTube-ID ist der komplette Dateiname ohne Extension
            
            # HP2 (Instrumental ohne Vocal) - von _extracted_instrumental.mp3
            instrumental_path = f"{os.path.splitext(audio_path)[0]}_instrumental.mp3"
            hp2_path = os.path.join(os.path.dirname(video_path), f"{youtube_id}.hp2.mp3")
            
            if os.path.exists(instrumental_path):
                os.rename(instrumental_path, hp2_path)
                logger.info(f"HP2 erstellt: {hp2_path}")
            else:
                logger.warning(f"Instrumental-Datei nicht gefunden: {instrumental_path}")
            
            # HP5 (Nur Vocal) - von _extracted_vocals.wav zu _extracted.hp5.mp3
            vocals_path = f"{os.path.splitext(audio_path)[0]}_vocals.wav"
            hp5_path = os.path.join(os.path.dirname(video_path), f"{youtube_id}.hp5.mp3")
            
            if os.path.exists(vocals_path):
                # Konvertiere Vocals von WAV zu MP3
                self._convert_to_mp3(vocals_path, hp5_path)
                # Lösche temporäre WAV-Datei
                os.remove(vocals_path)
                logger.info(f"HP5 erstellt: {hp5_path}")
            else:
                logger.warning(f"Vocals-Datei nicht gefunden: {vocals_path}")
                
        except Exception as e:
            logger.error(f"Fehler bei HP-Dateien-Erstellung aus existierenden Dateien: {e}")
    
    def _rename_to_ultrastar_schema(self, video_path, audio_path):
        """Benennt Audio- und Lyrics-Dateien ins Ultrastar-Schema um"""
        try:
            video_filename = os.path.basename(video_path)
            youtube_id = os.path.splitext(video_filename)[0]  # YouTube-ID ist der komplette Dateiname ohne Extension
            dir_path = os.path.dirname(video_path)
            
            # Umbenennen der extracted.mp3 Datei
            extracted_mp3_path = f"{os.path.splitext(audio_path)[0]}.mp3"
            renamed_mp3_path = os.path.join(dir_path, f"{youtube_id}.mp3")
            if os.path.exists(extracted_mp3_path):
                os.rename(extracted_mp3_path, renamed_mp3_path)
                logger.info(f"Audio-Datei umbenannt: {renamed_mp3_path}")
            
            # Umbenennen der UltraStar.txt Datei
            ultrastar_txt_path = f"{os.path.splitext(audio_path)[0]}_lyrics_ultrastar.txt"
            renamed_txt_path = os.path.join(dir_path, f"{youtube_id}.txt")
            if os.path.exists(ultrastar_txt_path):
                os.rename(ultrastar_txt_path, renamed_txt_path)
                logger.info(f"UltraStar-Datei umbenannt: {renamed_txt_path}")
                
        except Exception as e:
            logger.error(f"Fehler bei Ultrasstar-Schema-Umbenennung: {e}")
    
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
