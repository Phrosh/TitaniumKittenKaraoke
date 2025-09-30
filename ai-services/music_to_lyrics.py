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
from pathlib import Path
import torch
import whisper
import soundfile as sf
import numpy as np

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
    
    def save_lyrics(self, transcription_result, output_path, format="txt"):
        """
        Speichert Lyrics in verschiedenen Formaten
        
        Args:
            transcription_result (dict): Whisper-Transkriptionsergebnis
            output_path (str): Ausgabepfad (ohne Extension)
            format (str): Format ("txt", "json", "srt", "vtt")
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
            else:
                raise ValueError(f"Unbekanntes Format: {format}")
            
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
                self.save_lyrics(transcription_result, output_base, format)
            
            result = {
                "success": True,
                "audio_path": audio_path,
                "vocals_path": vocals_path,
                "instrumental_path": instrumental_path,
                "output_files": [f"{output_base}.{fmt}" for fmt in output_formats],
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
        choices=["txt", "json", "srt", "vtt"],
        default=["txt", "json"],
        help="Ausgabeformate (Standard: txt json)"
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
