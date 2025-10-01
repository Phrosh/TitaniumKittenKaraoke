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
            
            # Speichere Vocals-Pfad für spätere Lautstärke-Analyse
            self._last_vocals_path = vocals_path
            
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
            
            # Post-Processing: Entferne Halluzinationen
            result = self._filter_hallucinations(result)
            
            # Post-Processing: Unterteile lange Segmente für Karaoke
            result = self._split_long_segments(result)
            
            # Post-Processing: Entferne Halluzinationen nach Segment-Splitting
            result = self._filter_hallucinations(result)
            
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
            
            for i, segment in enumerate(result.get('segments', [])):
                # Prüfe ob Segment künstlich getrennt wurde
                is_split = segment.get('is_split', False)
                split_marker = " [GETRENNT]" if is_split else ""
                
                f.write(f"## Segment {i} ({segment['start']:.2f}s - {segment['end']:.2f}s){split_marker}\n")
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
            
            # Extrahiere Cover falls vorhanden
            cover_path = self._extract_cover(audio_file, audio_path)
            
            return title, artist, cover_path
            
        except Exception as e:
            logger.warning(f"Fehler beim Extrahieren der Metadaten: {e}")
            title, artist = self._extract_metadata_from_filename(audio_path)
            return title, artist, None
    
    def _extract_metadata_from_filename(self, audio_path):
        """Extrahiert Titel und Interpret aus dem Unterordner oder Dateinamen"""
        try:
            # Versuche zuerst den Unterordner zu verwenden
            parent_dir = os.path.basename(os.path.dirname(audio_path))
            
            # Prüfe ob es ein magic-* Ordner ist
            if parent_dir.startswith('magic-'):
                # Für magic-* Ordner: verwende den Unterordner des Unterordners
                grandparent_dir = os.path.basename(os.path.dirname(os.path.dirname(audio_path)))
                if ' - ' in grandparent_dir:
                    parts = grandparent_dir.split(' - ', 1)
                    artist = parts[0].strip()
                    title = parts[1].strip()
                    return title, artist
            
            # Fallback: Dateiname verwenden
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
    
    def _extract_cover(self, audio_file, audio_path):
        """Extrahiert Cover aus Audiodatei-Metadaten"""
        try:
            # Suche nach Cover in verschiedenen Tag-Feldern
            cover_data = None
            
            # ID3v2 APIC (Album Picture)
            if 'APIC:' in audio_file:
                cover_data = audio_file['APIC:'].data
            elif 'APIC' in audio_file:
                cover_data = audio_file['APIC'].data
            
            # Vorbis METADATA_BLOCK_PICTURE
            elif 'METADATA_BLOCK_PICTURE' in audio_file:
                import base64
                cover_data = base64.b64decode(audio_file['METADATA_BLOCK_PICTURE'][0])
            
            if cover_data:
                # Bestimme Dateierweiterung basierend auf MIME-Type
                mime_type = None
                if 'APIC:' in audio_file:
                    mime_type = audio_file['APIC:'].mime
                elif 'APIC' in audio_file:
                    mime_type = audio_file['APIC'].mime
                
                # Bestimme Dateierweiterung
                if mime_type:
                    if 'jpeg' in mime_type or 'jpg' in mime_type:
                        ext = '.jpg'
                    elif 'png' in mime_type:
                        ext = '.png'
                    elif 'gif' in mime_type:
                        ext = '.gif'
                    else:
                        ext = '.jpg'  # Fallback
                else:
                    ext = '.jpg'  # Fallback
                
                # Speichere Cover
                output_dir = os.path.dirname(audio_path)
                cover_path = os.path.join(output_dir, f"cover{ext}")
                
                with open(cover_path, 'wb') as f:
                    f.write(cover_data)
                
                logger.info(f"Cover extrahiert: {cover_path}")
                return cover_path
            
            return None
            
        except Exception as e:
            logger.warning(f"Fehler beim Extrahieren des Covers: {e}")
            return None
    
    def _save_ultrastar(self, result, output_path, audio_path):
        """Speichert Lyrics als UltraStar-Datei"""
        try:
            # Extrahiere Metadaten
            if audio_path:
                metadata_result = self._extract_metadata(audio_path)
                if len(metadata_result) == 3:
                    title, artist, cover_path = metadata_result
                else:
                    title, artist = metadata_result
                    cover_path = None
            else:
                title, artist, cover_path = "Unknown Title", "Unknown Artist", None
            
            # Verwende feste BPM
            bpm = 400  # ULTRSTAR_BPM
            
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
                                f.write(f": {start_beat} {duration_beats} 0 {word_text}\n")
                            else:
                                f.write(f": {start_beat} {duration_beats} 0  {word_text}\n")
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
                                f.write(f": {start_beat} {duration_beats} 0 {word_text}\n")
                            else:
                                f.write(f": {start_beat} {duration_beats} 0  {word_text}\n")
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
    
    def _filter_hallucinations(self, result):
        """
        Filtert bekannte Whisper-Halluzinationen aus dem Ergebnis
        
        Args:
            result (dict): Whisper-Transkriptionsergebnis
            
        Returns:
            dict: Bereinigtes Ergebnis
        """
        try:
            # Bekannte Halluzinations-Phrasen
            hallucination_phrases = [
                "thank you.",
                "thanks.",
                "goodbye.",
                "bye.",
                "see you later.",
                "that's all.",
                "the end.",
                "fin",
                "fin.",
                "subtitles",
                "subtitles by",
                "subtitles by the",
                "subtitles by the amara",
                "subtitles by the amara.org",
                "subtitles by the amara.org community",
                "by the amara",
                "by the amara.org",
                "by the amara.org community",
                "amara.org",
                "amara.org community",
                "captions",
                "captions by",
                "captions by the",
                "captions by the amara",
                "captions by the amara.org",
                "captions by the amara.org community",

                # Weitere Halluzinationen aus GitHub-Diskussion
                "thanks for watching",
                "thanks for watching!",
                "thank you for watching",
                "thank you for watching!",
                "merci d'avoir regardé cette vidéo",
                "merci d'avoir regardé cette vidéo!",
                "merci d'avoir regardé la vidéo",
                "j'espère que vous avez apprécié la vidéo",
                "je vous remercie de vous abonner",
                "sous-titres réalisés para la communauté d'amara.org",
                "merci d'avoir regardé!",
                "❤️ par soustitreur.com",
                "— sous-titrage st'501 —",
                "ondertitels ingediend door de amara.org gemeenschap",
                "ondertiteld door de amara.org gemeenschap",
                "ondertiteling door de amara.org gemeenschap",
                "untertitelung aufgrund der amara.org-community",
                "untertitel im auftrag des zdf für funk, 2017",
                "untertitel von stephanie geiges",
                "untertitel der amara.org-community",
                "untertitel im auftrag des zdf, 2017",
                "untertitel im auftrag des zdf, 2020",
                "untertitel im auftrag des zdf, 2018",
                "untertitel im auftrag des zdf, 2021",
                "untertitelung im auftrag des zdf, 2021",
                "copyright wdr 2021",
                "legendas pela comunidade amara.org",
                "sottotitoli e revisione a cura di qtss",
                "ming pao canada",
                "ming pao toronto",
                "ccosp4",
                "figure skating",
                "ice skating",
                # Arabische Zeichen und unmögliche Phrasen
                "mother mother",
                "mother mother سو",
                "mother mother temporyon",
                "mother mother سоält",
                "mother mother سو تو onions",
                "mother mother سو fois",
                "سو",
                "temporyon",
                "سоält",
                "تو",
                "onions",
                "fois",
                # Weitere Halluzinationen
                "bah bah bah",
            ]
            
            # Filtere Segmente
            filtered_segments = []
            removed_count = 0
            
            for segment in result.get('segments', []):
                segment_text = segment.get('text', '').strip().lower()
                
                # Prüfe ob Segment eine Halluzination ist
                is_hallucination = False
                for phrase in hallucination_phrases:
                    if phrase in segment_text:
                        is_hallucination = True
                        break
                
                # Prüfe auf unmögliche Word-Timestamps (alle Wörter haben gleiche Timestamps)
                if not is_hallucination:
                    words = segment.get('words', [])
                    if words and len(words) > 1:
                        # Prüfe ob alle Wörter den gleichen Start-Zeitpunkt haben
                        word_starts = [w.get('start', 0) for w in words]
                        word_ends = [w.get('end', 0) for w in words]
                        
                        # Prüfe ob mindestens zwei Wörter dieselbe End-Zeit haben
                        end_time_counts = {}
                        for end_time in word_ends:
                            end_time_counts[end_time] = end_time_counts.get(end_time, 0) + 1
                        
                        # Wenn mindestens zwei Wörter dieselbe End-Zeit haben, ist es eine Halluzination
                        max_count = max(end_time_counts.values())
                        if max_count >= 2:
                            is_hallucination = True
                            logger.info(f"Entfernt unmögliche Word-Timestamps ({max_count}/{len(words)} gleiche End-Zeit): '{segment.get('text', '').strip()}'")
                
                # Zusätzliche Prüfung: Sehr kurze Segmente am Ende
                if not is_hallucination and len(segment_text) <= 3:
                    # Prüfe ob es am Ende der Transkription ist
                    total_duration = result.get('segments', [{}])[-1].get('end', 0)
                    segment_end = segment.get('end', 0)
                    
                    # Wenn Segment in den letzten 10% der Transkription ist
                    if segment_end > total_duration * 0.9:
                        is_hallucination = True
                
                if not is_hallucination:
                    filtered_segments.append(segment)
                else:
                    removed_count += 1
                    logger.info(f"Entfernt Halluzination: '{segment.get('text', '').strip()}'")
            
            # Aktualisiere Ergebnis
            result['segments'] = filtered_segments
            
            # Aktualisiere Gesamttext
            if 'text' in result:
                result['text'] = ' '.join(segment.get('text', '').strip() for segment in filtered_segments)
            
            if removed_count > 0:
                logger.info(f"Entfernt {removed_count} Halluzination(en)")
            
            return result
            
        except Exception as e:
            logger.warning(f"Fehler beim Filtern von Halluzinationen: {e}")
            return result
    
    def _split_long_segments(self, result):
        """
        Unterteilt lange Segmente für bessere Karaoke-Darstellung
        
        Args:
            result (dict): Whisper-Transkriptionsergebnis
            
        Returns:
            dict: Ergebnis mit unterteilten Segmenten
        """
        try:
            # Konstanten
            SEG_MAX = 4.0  # Maximale Segment-Dauer in Sekunden (wenn überschritten, wird geteilt)
            SEG_SHORT = 3.0  # Maximale Dauer der resultierenden Segmente
            CHAR_MAX = 30  # Maximale Zeichen pro Segment
            
            # Konstanten für UltraStar
            ULTRSTAR_BPM = 400  # Feste BPM für UltraStar-Dateien
            ULTRSTAR_PITCH = 0  # Fester Pitch für alle Noten
            
            segments = result.get('segments', [])
            if not segments:
                return result
            
            new_segments = []
            split_count = 0
            
            for segment in segments:
                segment_duration = segment['end'] - segment['start']
                
                # Prüfe ob Segment länger als SEG_MAX ist
                if segment_duration > SEG_MAX:
                    # Berechne Anzahl der benötigten Segmente
                    num_segments = int(segment_duration / SEG_SHORT) + 1
                    split_segments = self._split_segment_simple(segment, num_segments)
                    new_segments.extend(split_segments)
                    split_count += len(split_segments) - 1
                else:
                    new_segments.append(segment)
            
            # Zweite Runde: Optimiere Segmente mit zu vielen Zeichen
            new_segments = self._optimize_segment_lengths(new_segments, CHAR_MAX)
            
            # Dritte Runde: Optimiere Segmente basierend auf Großbuchstaben (nur für englische Texte)
            if result.get('language', '').lower() == 'en':
                new_segments = self._optimize_capitalization_segments(new_segments)
            
            # Vierte Runde: Prüfe Lautstärke der Segmente (nur wenn vocals_path verfügbar)
            if hasattr(self, '_last_vocals_path') and self._last_vocals_path:
                new_segments = self._filter_by_volume(new_segments, self._last_vocals_path)
            
            # Fünfte Runde: Entferne Punkte-Wörter und leere Segmente
            new_segments = self._clean_segments(new_segments)
            
            # Aktualisiere Ergebnis
            result['segments'] = new_segments
            
            # Aktualisiere Gesamttext
            if 'text' in result:
                result['text'] = ' '.join(segment.get('text', '').strip() for segment in new_segments)
            
            if split_count > 0:
                logger.info(f"Unterteilt {split_count} Segment(e) für bessere Karaoke-Darstellung")
            
            return result
            
        except Exception as e:
            logger.warning(f"Fehler beim Unterteilen von Segmenten: {e}")
            return result
    
    def _split_segment_simple(self, segment, num_segments):
        """
        Teilt ein Segment in gleichgroße Teile auf
        
        Args:
            segment (dict): Original-Segment
            num_segments (int): Anzahl der gewünschten Segmente
            
        Returns:
            list: Liste der aufgeteilten Segmente
        """
        try:
            start_time = segment['start']
            end_time = segment['end']
            duration = end_time - start_time
            segment_duration = duration / num_segments
            
            words = segment.get('words', [])
            if not words:
                # Fallback: Teile nur die Zeit auf
                split_segments = []
                for i in range(num_segments):
                    seg_start = start_time + (i * segment_duration)
                    seg_end = start_time + ((i + 1) * segment_duration)
                    
                    new_segment = {
                        'id': segment.get('id', 0) + i,
                        'seek': segment.get('seek', 0),
                        'start': seg_start,
                        'end': seg_end,
                        'text': segment.get('text', '').strip(),
                        'tokens': segment.get('tokens', []),
                        'temperature': segment.get('temperature', 0.0),
                        'avg_logprob': segment.get('avg_logprob', 0.0),
                        'compression_ratio': segment.get('compression_ratio', 0.0),
                        'no_speech_prob': segment.get('no_speech_prob', 0.0),
                        'words': [],
                        'is_split': True
                    }
                    split_segments.append(new_segment)
                return split_segments
            
            # Teile Wörter gleichmäßig auf
            words_per_segment = len(words) / num_segments
            split_segments = []
            
            for i in range(num_segments):
                word_start_idx = int(i * words_per_segment)
                word_end_idx = int((i + 1) * words_per_segment)
                
                # Letztes Segment bekommt alle restlichen Wörter
                if i == num_segments - 1:
                    word_end_idx = len(words)
                
                segment_words = words[word_start_idx:word_end_idx]
                
                if segment_words:
                    seg_start = segment_words[0]['start']
                    seg_end = segment_words[-1]['end']
                    seg_text = ' '.join(w['word'].strip() for w in segment_words)
                else:
                    # Fallback für leere Segmente
                    seg_start = start_time + (i * segment_duration)
                    seg_end = start_time + ((i + 1) * segment_duration)
                    seg_text = ""
                
                new_segment = {
                    'id': segment.get('id', 0) + i,
                    'seek': segment.get('seek', 0),
                    'start': seg_start,
                    'end': seg_end,
                    'text': seg_text,
                    'tokens': segment.get('tokens', []),
                    'temperature': segment.get('temperature', 0.0),
                    'avg_logprob': segment.get('avg_logprob', 0.0),
                    'compression_ratio': segment.get('compression_ratio', 0.0),
                    'no_speech_prob': segment.get('no_speech_prob', 0.0),
                    'words': segment_words,
                    'is_split': True
                }
                split_segments.append(new_segment)
            
            return split_segments
            
        except Exception as e:
            logger.warning(f"Fehler beim Aufteilen des Segments: {e}")
            return [segment]

    def _optimize_segment_lengths(self, segments, char_max):
        """
        Optimiert Segmente, die zu viele Zeichen haben
        
        Args:
            segments (list): Liste der Segmente
            char_max (int): Maximale Zeichen pro Segment
            
        Returns:
            list: Optimierte Segmente
        """
        try:
            optimized_segments = []
            
            for i, segment in enumerate(segments):
                segment_text = segment.get('text', '').strip()
                segment_length = len(segment_text)
                
                if segment_length <= char_max:
                    optimized_segments.append(segment)
                    continue
                
                # Segment hat zu viele Zeichen - versuche Wörter zu verschieben
                words = segment.get('words', [])
                if not words or len(words) <= 1:
                    optimized_segments.append(segment)
                    continue
                
                # Versuche erstes Wort zum vorherigen Segment zu verschieben
                if i > 0 and len(words) > 1:
                    prev_segment = optimized_segments[-1]
                    first_word = words[0]
                    remaining_words = words[1:]
                    
                    # Prüfe ob Verschiebung sinnvoll ist
                    prev_text = prev_segment.get('text', '').strip()
                    new_prev_length = len(prev_text + ' ' + first_word['word'].strip())
                    new_current_length = len(' '.join(w['word'].strip() for w in remaining_words))
                    
                    if (new_prev_length <= char_max and 
                        new_current_length <= char_max and
                        new_prev_length < segment_length):
                        
                        # Verschiebe erstes Wort zum vorherigen Segment
                        prev_segment['text'] = prev_text + ' ' + first_word['word'].strip()
                        prev_segment['words'].append(first_word)
                        prev_segment['end'] = first_word['end']
                        prev_segment['is_split'] = True
                        
                        # Aktualisiere aktuelles Segment
                        segment['text'] = ' '.join(w['word'].strip() for w in remaining_words)
                        segment['words'] = remaining_words
                        segment['start'] = remaining_words[0]['start'] if remaining_words else segment['start']
                        segment['is_split'] = True
                        
                        optimized_segments.append(segment)
                        continue
                
                # Versuche letztes Wort zum nächsten Segment zu verschieben
                if i < len(segments) - 1 and len(words) > 1:
                    next_segment = segments[i + 1]
                    last_word = words[-1]
                    remaining_words = words[:-1]
                    
                    # Prüfe ob Verschiebung sinnvoll ist
                    next_text = next_segment.get('text', '').strip()
                    new_next_length = len(last_word['word'].strip() + ' ' + next_text)
                    new_current_length = len(' '.join(w['word'].strip() for w in remaining_words))
                    
                    if (new_next_length <= char_max and 
                        new_current_length <= char_max and
                        new_current_length < segment_length):
                        
                        # Verschiebe letztes Wort zum nächsten Segment
                        next_segment['text'] = last_word['word'].strip() + ' ' + next_text
                        next_segment['words'].insert(0, last_word)
                        next_segment['start'] = last_word['start']
                        next_segment['is_split'] = True
                        
                        # Aktualisiere aktuelles Segment
                        segment['text'] = ' '.join(w['word'].strip() for w in remaining_words)
                        segment['words'] = remaining_words
                        segment['end'] = remaining_words[-1]['end'] if remaining_words else segment['end']
                        segment['is_split'] = True
                        
                        optimized_segments.append(segment)
                        continue
                
                # Wenn Verschiebung nicht möglich, teile das Segment weiter
                if len(words) > 2:
                    # Teile in zwei Hälften
                    mid_point = len(words) // 2
                    first_half = words[:mid_point]
                    second_half = words[mid_point:]
                    
                    # Erstelle zwei neue Segmente
                    first_segment = {
                        'id': segment.get('id', 0),
                        'seek': segment.get('seek', 0),
                        'start': first_half[0]['start'],
                        'end': first_half[-1]['end'],
                        'text': ' '.join(w['word'].strip() for w in first_half),
                        'tokens': segment.get('tokens', []),
                        'temperature': segment.get('temperature', 0.0),
                        'avg_logprob': segment.get('avg_logprob', 0.0),
                        'compression_ratio': segment.get('compression_ratio', 0.0),
                        'no_speech_prob': segment.get('no_speech_prob', 0.0),
                        'words': first_half,
                        'is_split': True
                    }
                    
                    second_segment = {
                        'id': segment.get('id', 0) + 1,
                        'seek': segment.get('seek', 0),
                        'start': second_half[0]['start'],
                        'end': second_half[-1]['end'],
                        'text': ' '.join(w['word'].strip() for w in second_half),
                        'tokens': segment.get('tokens', []),
                        'temperature': segment.get('temperature', 0.0),
                        'avg_logprob': segment.get('avg_logprob', 0.0),
                        'compression_ratio': segment.get('compression_ratio', 0.0),
                        'no_speech_prob': segment.get('no_speech_prob', 0.0),
                        'words': second_half,
                        'is_split': True
                    }
                    
                    optimized_segments.extend([first_segment, second_segment])
                else:
                    # Segment hat nur 1-2 Wörter, behalte es
                    optimized_segments.append(segment)
            
            return optimized_segments
            
        except Exception as e:
            logger.warning(f"Fehler beim Optimieren der Segment-Längen: {e}")
            return segments

    def _clean_segments(self, segments):
        """
        Entfernt Punkte-Wörter und leere Segmente
        
        Args:
            segments (list): Liste der Segmente
            
        Returns:
            list: Bereinigte Segmente
        """
        try:
            cleaned_segments = []
            
            for segment in segments:
                words = segment.get('words', [])
                if not words:
                    continue
                
                # Filtere Punkte-Wörter heraus
                filtered_words = []
                for word in words:
                    word_text = word.get('word', '').strip()
                    # Prüfe ob Wort nur aus Punkten besteht
                    if word_text and not word_text.replace('.', '').replace(' ', ''):
                        logger.info(f"Entfernt Punkte-Wort: '{word_text}'")
                        continue
                    filtered_words.append(word)
                
                # Prüfe ob Segment nach Filterung leer ist
                if not filtered_words:
                    logger.info(f"Entfernt leeres Segment: '{segment.get('text', '')}'")
                    continue
                
                # Aktualisiere Segment
                segment['words'] = filtered_words
                segment['text'] = ' '.join(w['word'].strip() for w in filtered_words).strip()
                
                # Prüfe ob Text leer ist
                if not segment['text']:
                    logger.info(f"Entfernt Segment mit leerem Text")
                    continue
                
                # Aktualisiere Start- und End-Zeit
                if filtered_words:
                    segment['start'] = filtered_words[0]['start']
                    segment['end'] = filtered_words[-1]['end']
                
                cleaned_segments.append(segment)
            
            return cleaned_segments
            
        except Exception as e:
            logger.warning(f"Fehler beim Bereinigen der Segmente: {e}")
            return segments

    def _optimize_capitalization_segments(self, segments):
        """
        Optimiert Segmente basierend auf Großbuchstaben (nur für englische Texte)
        
        Args:
            segments (list): Liste der Segmente
            
        Returns:
            list: Optimierte Segmente
        """
        try:
            optimized_segments = []
            
            for i, segment in enumerate(segments):
                words = segment.get('words', [])
                if not words or len(words) <= 1:
                    optimized_segments.append(segment)
                    continue
                
                # Prüfe das letzte Wort
                last_word = words[-1]
                last_word_text = last_word.get('word', '').strip()
                
                # Prüfe ob letztes Wort mit Großbuchstaben anfängt und mehr als einen Buchstaben hat
                # Aber nicht wenn es mit Satzzeichen endet
                has_punctuation = any(last_word_text.endswith(p) for p in ['.', '!', '?', ',', ';', ':'])
                
                if (len(last_word_text) > 1 and 
                    last_word_text[0].isupper() and 
                    not has_punctuation and
                    i < len(segments) - 1):  # Es gibt ein nächstes Segment
                    
                    # Entferne letztes Wort aus aktuellem Segment
                    remaining_words = words[:-1]
                    next_segment = segments[i + 1]
                    next_words = next_segment.get('words', [])
                    
                    # Füge das Wort an den Anfang des nächsten Segments hinzu
                    next_words.insert(0, last_word)
                    
                    # Aktualisiere aktuelles Segment
                    if remaining_words:
                        segment['words'] = remaining_words
                        segment['text'] = ' '.join(w['word'].strip() for w in remaining_words).strip()
                        segment['end'] = remaining_words[-1]['end']
                        segment['is_split'] = True
                    else:
                        # Segment wird leer, überspringe es
                        continue
                    
                    # Aktualisiere nächstes Segment
                    next_segment['words'] = next_words
                    next_segment['text'] = ' '.join(w['word'].strip() for w in next_words).strip()
                    next_segment['start'] = next_words[0]['start']
                    next_segment['is_split'] = True
                    
                    logger.info(f"Verschoben Wort '{last_word_text}' von Segment {i} zu Segment {i+1}")
                
                optimized_segments.append(segment)
            
            return optimized_segments
            
        except Exception as e:
            logger.warning(f"Fehler beim Optimieren der Großbuchstaben-Segmente: {e}")
            return segments

    def _filter_by_volume(self, segments, vocals_path):
        """
        Filtert Segmente basierend auf der Lautstärke der Vocals
        
        Args:
            segments (list): Liste der Segmente
            vocals_path (str): Pfad zur Vocals-Datei
            
        Returns:
            list: Gefilterte Segmente
        """
        try:
            import subprocess
            import json
            
            filtered_segments = []
            volume_threshold = -30.0  # dB Schwellwert für minimale Lautstärke
            
            for segment in segments:
                start_time = segment.get('start', 0)
                end_time = segment.get('end', 0)
                duration = end_time - start_time
                
                if duration <= 0:
                    continue
                
                # FFmpeg-Befehl für Lautstärke-Analyse
                cmd = [
                    'ffmpeg',
                    '-i', vocals_path,
                    '-ss', str(start_time),
                    '-t', str(duration),
                    '-af', 'volumedetect',
                    '-f', 'null',
                    '-'
                ]
                
                try:
                    # Führe FFmpeg-Befehl aus
                    result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
                    
                    # Parse FFmpeg-Ausgabe für mittlere Lautstärke
                    output = result.stderr
                    mean_volume = None
                    
                    for line in output.split('\n'):
                        if 'mean_volume:' in line:
                            # Extrahiere dB-Wert
                            parts = line.split('mean_volume:')
                            if len(parts) > 1:
                                volume_str = parts[1].strip().split()[0]
                                try:
                                    mean_volume = float(volume_str.replace('dB', ''))
                                    break
                                except ValueError:
                                    continue
                    
                    # Prüfe Lautstärke
                    if mean_volume is not None and mean_volume > volume_threshold:
                        filtered_segments.append(segment)
                        logger.info(f"Segment beibehalten (Lautstärke: {mean_volume:.1f}dB): '{segment.get('text', '').strip()}'")
                    else:
                        logger.info(f"Entfernt Segment (zu leise: {mean_volume}dB): '{segment.get('text', '').strip()}'")
                        
                except subprocess.TimeoutExpired:
                    logger.warning(f"FFmpeg-Timeout für Segment: '{segment.get('text', '').strip()}'")
                    filtered_segments.append(segment)  # Bei Timeout behalten
                except Exception as e:
                    logger.warning(f"FFmpeg-Fehler für Segment: {e}")
                    filtered_segments.append(segment)  # Bei Fehler behalten
            
            return filtered_segments
            
        except Exception as e:
            logger.warning(f"Fehler bei Lautstärke-Filterung: {e}")
            return segments

    def _split_segment(self, segment, max_duration, max_length, min_length):
        """
        Unterteilt ein einzelnes Segment in kleinere Teile
        
        Args:
            segment (dict): Zu unterteilendes Segment
            max_duration (float): Maximale Dauer pro Teil
            max_length (int): Maximale Zeichen-Länge pro Teil
            min_length (int): Minimale Zeichen-Länge pro Teil
            
        Returns:
            list: Liste von unterteilten Segmenten
        """
        words = segment.get('words', [])
        if not words:
            # Fallback: Teile Text manuell
            return self._split_segment_by_text(segment, max_duration, max_length, min_length)
        
        split_segments = []
        current_start = segment['start']
        current_words = []
        current_text_length = 0
        segment_id = segment.get('id', 0)
        
        for i, word in enumerate(words):
            word_start = word['start']
            word_end = word['end']
            word_text = word['word'].strip()
            word_length = len(word_text)
            
            # Prüfe ob aktuelles Segment zu lang wird (Zeit oder Zeichen)
            time_exceeded = current_words and (word_end - current_start) > max_duration
            length_exceeded = current_words and (current_text_length + word_length + 1) > max_length  # +1 für Leerzeichen
            
            # Prüfe ob Segment mindestens min_length Zeichen hat
            current_segment_text = ' '.join(w['word'].strip() for w in current_words)
            current_segment_length = len(current_segment_text)
            
            if time_exceeded or length_exceeded:
                # Prüfe ob aktuelles Segment mindestens min_length Zeichen hat
                if current_segment_length >= min_length:
                    # Erstelle Segment aus aktuellen Wörtern
                    split_segment = self._create_segment_from_words(
                        current_words, current_start, segment_id, len(split_segments)
                    )
                    split_segments.append(split_segment)
                    
                    # Starte neues Segment
                    current_start = word_start
                    current_words = [word]
                    current_text_length = word_length
                else:
                    # Segment zu kurz, füge Wort hinzu
                    current_words.append(word)
                    current_text_length += word_length + (1 if current_text_length > 0 else 0)
            else:
                current_words.append(word)
                current_text_length += word_length + (1 if current_text_length > 0 else 0)  # +1 für Leerzeichen
        
        # Füge letztes Segment hinzu
        if current_words:
            split_segment = self._create_segment_from_words(
                current_words, current_start, segment_id, len(split_segments)
            )
            split_segments.append(split_segment)
        
        return split_segments
    
    def _split_segment_by_text(self, segment, max_duration, max_length, min_length):
        """
        Fallback: Unterteilt Segment basierend auf Text-Länge
        
        Args:
            segment (dict): Zu unterteilendes Segment
            max_duration (float): Maximale Dauer pro Teil
            max_length (int): Maximale Zeichen-Länge pro Teil
            min_length (int): Minimale Zeichen-Länge pro Teil
            
        Returns:
            list: Liste von unterteilten Segmenten
        """
        text = segment.get('text', '').strip()
        if not text:
            return [segment]
        
        # Teile Text in Wörter
        words = text.split()
        if len(words) <= 1:
            return [segment]
        
        split_segments = []
        segment_id = segment.get('id', 0)
        segment_duration = segment['end'] - segment['start']
        
        current_words = []
        current_text_length = 0
        
        for word in words:
            word_length = len(word)
            
            # Prüfe ob aktuelles Segment zu lang wird (Zeit oder Zeichen)
            time_exceeded = current_words and (len(current_words) * segment_duration / len(words)) > max_duration
            length_exceeded = current_words and (current_text_length + word_length + 1) > max_length  # +1 für Leerzeichen
            
            # Prüfe ob Segment mindestens min_length Zeichen hat
            current_segment_text = ' '.join(current_words)
            current_segment_length = len(current_segment_text)
            
            if time_exceeded or length_exceeded:
                # Prüfe ob aktuelles Segment mindestens min_length Zeichen hat
                if current_segment_length >= min_length:
                    # Erstelle Segment aus aktuellen Wörtern
                    segment_text = ' '.join(current_words)
                    segment_ratio = len(current_words) / len(words)
                    segment_start = segment['start'] + (segment_duration * (len(split_segments) * len(current_words)) / len(words))
                    segment_end = segment['start'] + (segment_duration * ((len(split_segments) + 1) * len(current_words)) / len(words))
                    
                    split_segment = {
                        'id': segment_id + len(split_segments),
                        'seek': segment.get('seek', 0),
                        'start': segment_start,
                        'end': segment_end,
                        'text': segment_text,
                        'tokens': segment.get('tokens', []),
                        'temperature': segment.get('temperature', 0.0),
                        'avg_logprob': segment.get('avg_logprob', 0.0),
                        'compression_ratio': segment.get('compression_ratio', 0.0),
                        'no_speech_prob': segment.get('no_speech_prob', 0.0),
                        'words': [],  # Keine Word-Timestamps verfügbar
                        'is_split': True  # Markiere als künstlich getrennt
                    }
                    
                    split_segments.append(split_segment)
                    
                    # Starte neues Segment
                    current_words = [word]
                    current_text_length = word_length
                else:
                    # Segment zu kurz, füge Wort hinzu
                    current_words.append(word)
                    current_text_length += word_length + (1 if current_text_length > 0 else 0)
            else:
                current_words.append(word)
                current_text_length += word_length + (1 if current_text_length > 0 else 0)  # +1 für Leerzeichen
        
        # Füge letztes Segment hinzu
        if current_words:
            segment_text = ' '.join(current_words)
            segment_ratio = len(current_words) / len(words)
            segment_start = segment['start'] + (segment_duration * (len(split_segments) * len(current_words)) / len(words))
            segment_end = segment['end']
            
            split_segment = {
                'id': segment_id + len(split_segments),
                'seek': segment.get('seek', 0),
                'start': segment_start,
                'end': segment_end,
                'text': segment_text,
                'tokens': segment.get('tokens', []),
                'temperature': segment.get('temperature', 0.0),
                'avg_logprob': segment.get('avg_logprob', 0.0),
                'compression_ratio': segment.get('compression_ratio', 0.0),
                'no_speech_prob': segment.get('no_speech_prob', 0.0),
                'words': [],  # Keine Word-Timestamps verfügbar
                'is_split': True  # Markiere als künstlich getrennt
            }
            
            split_segments.append(split_segment)
        
        return split_segments
    
    def _create_segment_from_words(self, words, start_time, original_id, segment_index):
        """
        Erstellt ein neues Segment aus einer Liste von Wörtern
        
        Args:
            words (list): Liste von Wörtern
            start_time (float): Startzeit des Segments
            original_id (int): Originale Segment-ID
            segment_index (int): Index des neuen Segments
            
        Returns:
            dict: Neues Segment
        """
        if not words:
            return None
        
        end_time = words[-1]['end']
        segment_text = ' '.join(word['word'].strip() for word in words)
        
        return {
            'id': original_id + segment_index,
            'seek': 0,
            'start': start_time,
            'end': end_time,
            'text': segment_text,
            'tokens': [],
            'temperature': 0.0,
            'avg_logprob': 0.0,
            'compression_ratio': 0.0,
            'no_speech_prob': 0.0,
            'words': words,
            'is_split': True  # Markiere als künstlich getrennt
        }
    
    def _redistribute_last_segment(self, segments, min_duration):
        """
        Verteilt das letzte Segment neu, falls es zu kurz ist
        
        Args:
            segments (list): Liste von Segmenten
            min_duration (float): Minimale Segment-Dauer
            
        Returns:
            list: Neu verteilte Segmente
        """
        if not segments:
            return segments
        
        last_segment = segments[-1]
        last_duration = last_segment['end'] - last_segment['start']
        
        # Wenn letztes Segment zu kurz ist
        if last_duration < min_duration and len(segments) > 1:
            # Entferne letztes Segment
            segments_without_last = segments[:-1]
            
            # Verteile Wörter des letzten Segments auf vorherige Segmente
            last_words = last_segment.get('words', [])
            if last_words:
                # Verteile Wörter gleichmäßig auf vorherige Segmente
                words_per_segment = len(last_words) // len(segments_without_last)
                remaining_words = len(last_words) % len(segments_without_last)
                
                word_index = 0
                for i, segment in enumerate(segments_without_last):
                    # Berechne Anzahl Wörter für dieses Segment
                    words_to_add = words_per_segment
                    if i < remaining_words:
                        words_to_add += 1
                    
                    # Füge Wörter hinzu
                    if words_to_add > 0:
                        segment['words'].extend(last_words[word_index:word_index + words_to_add])
                        word_index += words_to_add
                        
                        # Aktualisiere Segment-Ende
                        if segment['words']:
                            segment['end'] = segment['words'][-1]['end']
                            segment['text'] = ' '.join(word['word'].strip() for word in segment['words'])
            
            logger.info(f"Letztes Segment ({last_duration:.2f}s) neu verteilt")
            return segments_without_last
        
        return segments
    
    def _clean_empty_segments(self, segments):
        """
        Entfernt leere Segmente aus der Liste
        
        Args:
            segments (list): Liste von Segmenten
            
        Returns:
            list: Bereinigte Segmente
        """
        cleaned_segments = []
        
        for segment in segments:
            # Prüfe ob Segment leer ist
            text = segment.get('text', '').strip()
            words = segment.get('words', [])
            
            # Behalte Segment nur wenn es Text oder Wörter hat
            if text or words:
                cleaned_segments.append(segment)
        
        return cleaned_segments
    
    def process_audio(self, audio_path, model_type="HP5", language=None, output_formats=["ultrastar"]):
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
        choices=["tiny", "base", "small", "medium", "large", "large-v2", "large-v3"],
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
        default=["ultrastar"],
        help="Ausgabeformate (Standard: ultrastar)"
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
