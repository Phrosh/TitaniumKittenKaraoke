#!/usr/bin/env python3
"""
Music to Lyrics Feature
======================

Dieses Skript implementiert das "music to lyrics" Feature, das:
1. Eine Audiodatei mit UVR5/HP5 in Vocals und Instrumental separiert
2. Die Vocals mit Whisper Speech-to-Text transkribiert
3. Eine Textdatei mit Word-Timestamps erstellt

Verwendung:
    python music_to_lyrics.py <audio_file_or_folder>
    
Beispiel:
    python music_to_lyrics.py "songs/test/3 Doors Down - Kryptonite.mp3"
"""

import os
import sys
import logging
import argparse
import json
import re
from pathlib import Path
import torch
import whisper
import soundfile as sf
import numpy as np
from mutagen import File as MutagenFile

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MusicToLyrics:
    """Hauptklasse für das Music-to-Lyrics Feature"""
    
    def __init__(self, whisper_model="base", device=None):
        """
        Initialisiert das Music-to-Lyrics System
        
        Args:
            whisper_model (str): Whisper Modell-Größe ("tiny", "base", "small", "medium", "large")
            device (str): Device für Whisper ("cuda", "cpu", None für auto)
        """
        self.whisper_model = whisper_model
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        
        logger.info(f"Initialisiere Music-to-Lyrics mit Whisper {whisper_model} auf {self.device}")
        
        # CUDA-Info
        if torch.cuda.is_available():
            logger.info(f"CUDA verfügbar: {torch.cuda.device_count()} Geräte")
            logger.info(f"Aktives Gerät: {torch.cuda.get_device_name(0)}")
        else:
            logger.warning("CUDA nicht verfügbar, verwende CPU")
        
        # Lade Whisper-Modell
        try:
            self.whisper = whisper.load_model(whisper_model, device=self.device)
            logger.info(f"Whisper-Modell {whisper_model} erfolgreich geladen")
        except Exception as e:
            logger.error(f"Fehler beim Laden des Whisper-Modells: {e}")
            raise
    
    def separate_audio(self, audio_path, model_type="HP5"):
        """
        Separiert Audio in Vocals und Instrumental mit UVR5
        
        Args:
            audio_path (str): Pfad zur Audiodatei
            model_type (str): UVR5 Modell-Typ ("HP2" oder "HP5")
            
        Returns:
            tuple: (vocals_path, instrumental_path)
        """
        try:
            from uvr5_correct import separate_audio_with_uvr5_correct
            
            logger.info(f"Separiere Audio: {audio_path} mit {model_type}")
            
            # Bestimme Ordner der Audiodatei
            folder_path = os.path.dirname(audio_path)
            
            # Führe Separation durch und behalte die Vocals-Datei
            vocals_path, instrumental_path = self._separate_and_keep_vocals(folder_path, model_type)
            
            if not vocals_path:
                raise FileNotFoundError("Vocals-Datei nicht gefunden nach Separation")
            
            logger.info(f"Separation erfolgreich:")
            logger.info(f"  Vocals: {vocals_path}")
            logger.info(f"  Instrumental: {instrumental_path}")
            
            return vocals_path, instrumental_path
            
        except Exception as e:
            logger.error(f"Fehler bei der Audio-Separation: {e}")
            raise
    
    def _separate_and_keep_vocals(self, folder_path, model_type):
        """
        Führt UVR5-Separation durch und behält die Vocals-Datei für weitere Verarbeitung
        
        Returns:
            tuple: (vocals_path, instrumental_path)
        """
        try:
            from uvr5_correct import UVR5Wrapper, reduce_volume, convert_to_mp3
            from audio_separator import find_audio_file
            import shutil
            
            # Finde die Haupt-Audio-Datei
            audio_file = find_audio_file(folder_path)
            if not audio_file:
                raise ValueError("Keine geeignete Audio-Datei gefunden")
            
            logger.info(f"Gefundene Audio-Datei: {audio_file}")
            
            # Erstelle temporäre Datei mit reduzierter Lautstärke
            temp_file = os.path.join(folder_path, f"temp_volume_reduced_{model_type}.wav")
            
            # Reduziere Lautstärke um 2dB
            if not reduce_volume(audio_file, temp_file, reduction_db=-2):
                raise Exception("Fehler beim Reduzieren der Lautstärke")
            
            # Führe UVR5-Separation durch
            uvr5 = UVR5Wrapper(model_choice=model_type)
            sample_rate, vocal_data, inst_data = uvr5.separate(temp_file)
            
            # Generiere Ausgabe-Dateinamen
            base_name = os.path.splitext(os.path.basename(audio_file))[0]
            vocals_path = os.path.join(folder_path, f"{base_name}_vocals.wav")
            instrumental_path = os.path.join(folder_path, f"{base_name}_instrumental.mp3")
            
            # Speichere Vocals als WAV
            logger.info(f"Speichere Vocals: {vocals_path}")
            sf.write(vocals_path, vocal_data.T, sample_rate)
            
            # Speichere Instrumental als MP3
            logger.info(f"Speichere Instrumental: {instrumental_path}")
            inst_wav_path = os.path.join(folder_path, f"{base_name}_instrumental_temp.wav")
            sf.write(inst_wav_path, inst_data.T, sample_rate)
            convert_to_mp3(inst_wav_path, instrumental_path)
            os.remove(inst_wav_path)
            
            # Bereinige temporäre Dateien
            if os.path.exists(temp_file):
                os.remove(temp_file)
            
            # Bereinige UVR5-Ausgabe-Ordner
            separated_dir = os.path.join(folder_path, "separated")
            if os.path.exists(separated_dir):
                shutil.rmtree(separated_dir)
            
            return vocals_path, instrumental_path
            
        except Exception as e:
            logger.error(f"Fehler bei _separate_and_keep_vocals: {e}")
            raise
    
    def transcribe_vocals(self, vocals_path, language=None):
        """
        Transkribiert Vocals mit Whisper und Word-Timestamps
        
        Args:
            vocals_path (str): Pfad zur Vocals-Datei
            language (str): Sprache für Transkription (None für auto-detect)
            
        Returns:
            dict: Whisper-Ergebnis mit Word-Timestamps
        """
        try:
            logger.info(f"Transkribiere Vocals: {vocals_path}")
            
            # Whisper-Transkription mit Word-Timestamps
            result = self.whisper.transcribe(
                vocals_path,
                word_timestamps=True,
                language=language,
                verbose=False
            )
            
            logger.info("Transkription erfolgreich abgeschlossen")
            logger.info(f"Erkannte Sprache: {result.get('language', 'unbekannt')}")
            logger.info(f"Anzahl Segmente: {len(result.get('segments', []))}")
            
            # Zähle Wörter
            word_count = sum(len(segment.get('words', [])) for segment in result.get('segments', []))
            logger.info(f"Anzahl Wörter: {word_count}")
            
            return result
            
        except Exception as e:
            logger.error(f"Fehler bei der Transkription: {e}")
            raise
    
    def save_lyrics(self, transcription_result, output_path, format="txt", audio_path=None):
        """
        Speichert Lyrics in verschiedenen Formaten
        
        Args:
            transcription_result (dict): Whisper-Transkriptionsergebnis
            output_path (str): Ausgabepfad (ohne Extension)
            format (str): Format ("txt", "json", "srt", "vtt", "ultrastar")
            audio_path (str): Pfad zur Original-Audiodatei für Metadaten
        """
        try:
            logger.info(f"Speichere Lyrics in Format: {format}")
            
            if format == "txt":
                self._save_txt(transcription_result, f"{output_path}.txt")
            elif format == "json":
                self._save_json(transcription_result, f"{output_path}.json")
            elif format == "srt":
                self._save_srt(transcription_result, f"{output_path}.srt")
            elif format == "vtt":
                self._save_vtt(transcription_result, f"{output_path}.vtt")
            elif format == "ultrastar":
                self._save_ultrastar(transcription_result, f"{output_path}_ultrastar.txt", audio_path)
            else:
                raise ValueError(f"Unbekanntes Format: {format}")
            
            if format == "ultrastar":
                logger.info(f"Lyrics gespeichert: {output_path}_ultrastar.txt")
            else:
                logger.info(f"Lyrics gespeichert: {output_path}.{format}")
            
        except Exception as e:
            logger.error(f"Fehler beim Speichern der Lyrics: {e}")
            raise
    
    def _save_txt(self, result, output_path):
        """Speichert Lyrics als einfache Textdatei mit Word-Timestamps"""
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("# Music to Lyrics - Word Timestamps\n")
            f.write(f"# Sprache: {result.get('language', 'unbekannt')}\n")
            f.write(f"# Modell: {self.whisper_model}\n\n")
            
            for segment in result.get('segments', []):
                f.write(f"## Segment {segment['id']} ({segment['start']:.2f}s - {segment['end']:.2f}s)\n")
                f.write(f"# Text: {segment['text'].strip()}\n\n")
                
                for word in segment.get('words', []):
                    start = word['start']
                    end = word['end']
                    text = word['word'].strip()
                    confidence = word.get('probability', 0)
                    
                    f.write(f"{start:.3f} - {end:.3f} | {text} | {confidence:.3f}\n")
                
                f.write("\n")
    
    def _save_json(self, result, output_path):
        """Speichert Lyrics als JSON mit vollständigen Metadaten"""
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
    
    def _save_srt(self, result, output_path):
        """Speichert Lyrics als SRT-Untertitel"""
        with open(output_path, 'w', encoding='utf-8') as f:
            segment_id = 1
            for segment in result.get('segments', []):
                start_time = self._format_srt_time(segment['start'])
                end_time = self._format_srt_time(segment['end'])
                text = segment['text'].strip()
                
                f.write(f"{segment_id}\n")
                f.write(f"{start_time} --> {end_time}\n")
                f.write(f"{text}\n\n")
                segment_id += 1
    
    def _save_vtt(self, result, output_path):
        """Speichert Lyrics als WebVTT-Untertitel"""
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("WEBVTT\n\n")
            
            for segment in result.get('segments', []):
                start_time = self._format_vtt_time(segment['start'])
                end_time = self._format_vtt_time(segment['end'])
                text = segment['text'].strip()
                
                f.write(f"{start_time} --> {end_time}\n")
                f.write(f"{text}\n\n")
    
    def _format_srt_time(self, seconds):
        """Formatiert Zeit für SRT"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millisecs = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millisecs:03d}"
    
    def _format_vtt_time(self, seconds):
        """Formatiert Zeit für WebVTT"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = seconds % 60
        return f"{hours:02d}:{minutes:02d}:{secs:06.3f}"
    
    def _extract_metadata(self, audio_path):
        """Extrahiert Metadaten aus der Audiodatei"""
        try:
            audio_file = MutagenFile(audio_path)
            if audio_file is None:
                return self._extract_metadata_from_filename(audio_path)
            
            # Extrahiere Metadaten
            title = None
            artist = None
            
            # Versuche verschiedene Tag-Felder
            if 'TIT2' in audio_file:  # ID3v2 Title
                title = str(audio_file['TIT2'][0])
            elif 'TITLE' in audio_file:  # Vorbis Title
                title = str(audio_file['TITLE'][0])
            elif 'TIT1' in audio_file:  # ID3v2 Content Type
                title = str(audio_file['TIT1'][0])
            
            if 'TPE1' in audio_file:  # ID3v2 Artist
                artist = str(audio_file['TPE1'][0])
            elif 'ARTIST' in audio_file:  # Vorbis Artist
                artist = str(audio_file['ARTIST'][0])
            elif 'TPE2' in audio_file:  # ID3v2 Album Artist
                artist = str(audio_file['TPE2'][0])
            
            # Fallback auf Dateinamen
            if not title or not artist:
                filename_title, filename_artist = self._extract_metadata_from_filename(audio_path)
                title = title or filename_title
                artist = artist or filename_artist
            
            return title, artist
            
        except Exception as e:
            logger.warning(f"Fehler beim Extrahieren der Metadaten: {e}")
            return self._extract_metadata_from_filename(audio_path)
    
    def _extract_metadata_from_filename(self, audio_path):
        """Extrahiert Titel und Interpret aus dem Dateinamen"""
        try:
            filename = os.path.splitext(os.path.basename(audio_path))[0]
            
            # Versuche "Artist - Title" Format
            if ' - ' in filename:
                parts = filename.split(' - ', 1)
                artist = parts[0].strip()
                title = parts[1].strip()
            else:
                # Fallback: Dateiname als Titel, "Unknown" als Artist
                title = filename
                artist = "Unknown"
            
            return title, artist
            
        except Exception as e:
            logger.warning(f"Fehler beim Extrahieren aus Dateinamen: {e}")
            return "Unknown Title", "Unknown Artist"
    
    def _save_ultrastar(self, result, output_path, audio_path):
        """Speichert Lyrics als UltraStar-Datei"""
        try:
            # Extrahiere Metadaten
            title, artist = self._extract_metadata(audio_path) if audio_path else ("Unknown Title", "Unknown Artist")
            
            # Berechne BPM (geschätzt basierend auf Segment-Längen)
            bpm = self._estimate_bpm(result)
            
            # Finde die erste Note und berechne GAP
            first_note_time = None
            if result.get('segments') and len(result['segments']) > 0:
                for segment in result['segments']:
                    words = segment.get('words', [])
                    if words:
                        first_note_time = words[0]['start']
                        break
                    elif segment['text'].strip():
                        first_note_time = segment['start']
                        break
            
            # Berechne GAP basierend auf erster Note
            gap = 0
            if first_note_time is not None:
                # GAP = Zeit bis zur ersten Note in Millisekunden
                gap = int(first_note_time * 1000)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                # UltraStar Header
                f.write(f"#TITLE:{title}\n")
                f.write(f"#ARTIST:{artist}\n")
                f.write(f"#LANGUAGE:{result.get('language', 'English')}\n")
                f.write(f"#GENRE:Pop\n")
                f.write(f"#YEAR:2024\n")
                f.write(f"#MP3:{os.path.basename(audio_path) if audio_path else 'audio.mp3'}\n")
                f.write(f"#BPM:{bpm}\n")
                f.write(f"#GAP:{gap}\n")
                f.write(f"#VERSION:1.1.0\n")
                f.write("\n")
                
                # Konvertiere Whisper-Segmente zu UltraStar-Noten
                current_beat = 0
                note_id = 0
                is_first_note = True
                
                for segment in result.get('segments', []):
                    segment_start = segment['start']
                    segment_text = segment['text'].strip()
                    
                    if not segment_text:
                        continue
                    
                    # Teile Segment in Wörter auf
                    words = segment.get('words', [])
                    if not words:
                        # Fallback: Teile Text manuell
                        word_texts = segment_text.split()
                        word_duration = (segment['end'] - segment['start']) / len(word_texts) if word_texts else 1.0
                        
                        for i, word_text in enumerate(word_texts):
                            word_start = segment_start + (i * word_duration)
                            word_end = word_start + word_duration
                            
                            # Konvertiere zu Beats (relativ zur ersten Note)
                            if is_first_note:
                                start_beat = 0
                                is_first_note = False
                            else:
                                start_beat = int(self._seconds_to_beats(word_start - first_note_time, bpm))
                            
                            duration_beats = int(self._seconds_to_beats(word_end - first_note_time, bpm)) - start_beat
                            
                            # Mindestdauer für UltraStar
                            if duration_beats <= 0:
                                duration_beats = 1
                            
                            # UltraStar Note mit korrektem Leerzeichen
                            if is_first_note or start_beat == 0:
                                f.write(f": {start_beat} {duration_beats} 60 {word_text}\n")
                            else:
                                f.write(f": {start_beat} {duration_beats} 60  {word_text}\n")
                            note_id += 1
                    else:
                        # Verwende Word-Timestamps
                        for word in words:
                            word_start = word['start']
                            word_end = word['end']
                            word_text = word['word'].strip()
                            
                            if not word_text:
                                continue
                            
                            # Konvertiere zu Beats (relativ zur ersten Note)
                            if is_first_note:
                                start_beat = 0
                                is_first_note = False
                            else:
                                start_beat = int(self._seconds_to_beats(word_start - first_note_time, bpm))
                            
                            duration_beats = int(self._seconds_to_beats(word_end - first_note_time, bpm)) - start_beat
                            
                            # Mindestdauer für UltraStar
                            if duration_beats <= 0:
                                duration_beats = 1
                            
                            # UltraStar Note mit korrektem Leerzeichen
                            if is_first_note or start_beat == 0:
                                f.write(f": {start_beat} {duration_beats} 60 {word_text}\n")
                            else:
                                f.write(f": {start_beat} {duration_beats} 60  {word_text}\n")
                            note_id += 1
                    
                    # Zeilenumbruch nach Segment
                    if segment['end'] < result.get('segments', [{}])[-1].get('end', 0):
                        end_beat = int(self._seconds_to_beats(segment['end'] - first_note_time, bpm))
                        f.write(f"- {end_beat}\n")
                
                # Ende der Datei
                f.write("E\n")
            
            logger.info(f"UltraStar-Datei erstellt: {output_path}")
            logger.info(f"  Titel: {title}")
            logger.info(f"  Interpret: {artist}")
            logger.info(f"  BPM: {bpm}")
            logger.info(f"  GAP: {gap}ms")
            logger.info(f"  Noten: {note_id}")
            
        except Exception as e:
            logger.error(f"Fehler beim Erstellen der UltraStar-Datei: {e}")
            raise
    
    def _estimate_bpm(self, result):
        """Schätzt BPM basierend auf Segment-Längen"""
        try:
            segments = result.get('segments', [])
            if not segments:
                return 120  # Default BPM
            
            # Berechne durchschnittliche Segment-Länge
            total_duration = 0
            segment_count = 0
            
            for segment in segments:
                duration = segment['end'] - segment['start']
                if duration > 0.5:  # Ignoriere sehr kurze Segmente
                    total_duration += duration
                    segment_count += 1
            
            if segment_count == 0:
                return 120
            
            avg_segment_duration = total_duration / segment_count
            
            # Schätze BPM basierend auf typischer Segment-Länge
            # Typische Lieder haben 2-4 Sekunden pro Segment
            if avg_segment_duration < 1.5:
                return 140  # Schnelles Lied
            elif avg_segment_duration < 2.5:
                return 120  # Mittleres Tempo
            elif avg_segment_duration < 4.0:
                return 100  # Langsameres Lied
            else:
                return 80   # Sehr langsames Lied
                
        except Exception as e:
            logger.warning(f"Fehler bei BPM-Schätzung: {e}")
            return 120
    
    def _seconds_to_beats(self, seconds, bpm):
        """Konvertiert Sekunden zu UltraStar-Beats"""
        # UltraStar verwendet 1/4 Beats
        # 1 Beat = 60 / BPM Sekunden
        # 1/4 Beat = 15 / BPM Sekunden
        # Umgekehrte Formel: Beats = Sekunden * BPM / 15
        return seconds * bpm / 15
    
    def process_audio(self, audio_path, model_type="HP5", language=None, output_formats=["txt", "json"]):
        """
        Hauptfunktion: Verarbeitet Audio zu Lyrics
        
        Args:
            audio_path (str): Pfad zur Audiodatei
            model_type (str): UVR5 Modell-Typ
            language (str): Sprache für Transkription
            output_formats (list): Ausgabeformate
            
        Returns:
            dict: Verarbeitungsergebnis
        """
        try:
            logger.info(f"Starte Music-to-Lyrics Verarbeitung: {audio_path}")
            
            # 1. Audio-Separation
            vocals_path, instrumental_path = self.separate_audio(audio_path, model_type)
            
            # 2. Transkription
            transcription_result = self.transcribe_vocals(vocals_path, language)
            
            # 3. Speichere Lyrics
            base_name = os.path.splitext(os.path.basename(audio_path))[0]
            output_dir = os.path.dirname(audio_path)
            output_base = os.path.join(output_dir, f"{base_name}_lyrics")
            
            for format in output_formats:
                self.save_lyrics(transcription_result, output_base, format, audio_path)
            
            result = {
                "success": True,
                "audio_path": audio_path,
                "vocals_path": vocals_path,
                "instrumental_path": instrumental_path,
                "output_files": [f"{output_base}.{fmt}" if fmt != "ultrastar" else f"{output_base}_ultrastar.txt" for fmt in output_formats],
                "language": transcription_result.get('language'),
                "word_count": sum(len(segment.get('words', [])) for segment in transcription_result.get('segments', [])),
                "duration": transcription_result.get('segments', [{}])[-1].get('end', 0) if transcription_result.get('segments') else 0
            }
            
            logger.info("Music-to-Lyrics Verarbeitung erfolgreich abgeschlossen")
            logger.info(f"Ergebnis: {result}")
            
            return result
            
        except Exception as e:
            logger.error(f"Fehler bei der Music-to-Lyrics Verarbeitung: {e}")
            return {
                "success": False,
                "error": str(e),
                "audio_path": audio_path
            }


def main():
    """Hauptfunktion für Kommandozeilen-Interface"""
    parser = argparse.ArgumentParser(
        description="Music to Lyrics - Konvertiert Musik in synchronisierte Liedtexte",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Beispiele:
  python music_to_lyrics.py "songs/test/3 Doors Down - Kryptonite.mp3"
  python music_to_lyrics.py "songs/test/" --model large --language en
  python music_to_lyrics.py "audio.mp3" --formats txt json srt
        """
    )
    
    parser.add_argument(
        "audio_path",
        help="Pfad zur Audiodatei oder zum Ordner mit Audiodateien"
    )
    
    parser.add_argument(
        "--model",
        choices=["tiny", "base", "small", "medium", "large"],
        default="base",
        help="Whisper-Modell-Größe (Standard: base)"
    )
    
    parser.add_argument(
        "--uvr-model",
        choices=["HP2", "HP5"],
        default="HP5",
        help="UVR5-Modell für Audio-Separation (Standard: HP5)"
    )
    
    parser.add_argument(
        "--language",
        help="Sprache für Transkription (None für auto-detect)"
    )
    
    parser.add_argument(
        "--formats",
        nargs="+",
        choices=["txt", "json", "srt", "vtt", "ultrastar"],
        default=["txt", "json", "ultrastar"],
        help="Ausgabeformate (Standard: txt json ultrastar)"
    )
    
    parser.add_argument(
        "--device",
        choices=["cuda", "cpu"],
        help="Device für Whisper (Standard: auto)"
    )
    
    args = parser.parse_args()
    
    # Validiere Eingabe
    if not os.path.exists(args.audio_path):
        logger.error(f"Pfad existiert nicht: {args.audio_path}")
        sys.exit(1)
    
    try:
        # Initialisiere Music-to-Lyrics
        mtl = MusicToLyrics(
            whisper_model=args.model,
            device=args.device
        )
        
        # Verarbeite Audio
        if os.path.isfile(args.audio_path):
            # Einzelne Datei
            result = mtl.process_audio(
                args.audio_path,
                model_type=args.uvr_model,
                language=args.language,
                output_formats=args.formats
            )
            
            if result["success"]:
                print(f"✅ Erfolgreich verarbeitet: {args.audio_path}")
                print(f"📁 Ausgabedateien: {', '.join(result['output_files'])}")
                print(f"🌍 Sprache: {result['language']}")
                print(f"📝 Wörter: {result['word_count']}")
                print(f"⏱️  Dauer: {result['duration']:.1f}s")
            else:
                print(f"❌ Fehler: {result['error']}")
                sys.exit(1)
        
        elif os.path.isdir(args.audio_path):
            # Ordner mit mehreren Dateien
            audio_extensions = ['.mp3', '.flac', '.ogg', '.wav', '.m4a', '.aac']
            audio_files = []
            
            for file in os.listdir(args.audio_path):
                if any(file.lower().endswith(ext) for ext in audio_extensions):
                    audio_files.append(os.path.join(args.audio_path, file))
            
            if not audio_files:
                logger.error(f"Keine Audiodateien gefunden in: {args.audio_path}")
                sys.exit(1)
            
            print(f"🎵 Verarbeite {len(audio_files)} Audiodateien...")
            
            successful = 0
            failed = 0
            
            for audio_file in audio_files:
                print(f"\n📀 Verarbeite: {os.path.basename(audio_file)}")
                
                result = mtl.process_audio(
                    audio_file,
                    model_type=args.uvr_model,
                    language=args.language,
                    output_formats=args.formats
                )
                
                if result["success"]:
                    successful += 1
                    print(f"  ✅ Erfolgreich")
                else:
                    failed += 1
                    print(f"  ❌ Fehler: {result['error']}")
            
            print(f"\n📊 Zusammenfassung:")
            print(f"  ✅ Erfolgreich: {successful}")
            print(f"  ❌ Fehlgeschlagen: {failed}")
            
            if failed > 0:
                sys.exit(1)
        
    except KeyboardInterrupt:
        print("\n⏹️  Verarbeitung abgebrochen")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unerwarteter Fehler: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
