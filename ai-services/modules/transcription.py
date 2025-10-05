#!/usr/bin/env python3
"""
Transcription Module
Transkribiert Audio zu Text und konvertiert ins UltraStar-Format
"""

import os
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List
import whisper
import torch

from .meta import ProcessingMeta, ProcessingStatus
from .logger_utils import log_start

logger = logging.getLogger(__name__)

class AudioTranscriber:
    """Audio-Transkribierer mit Whisper für UltraStar-Format"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialisiert den Audio-Transkribierer
        
        Args:
            config: Konfiguration für Whisper
        """
        self.config = config or {}
        self.default_config = {
            'model': 'large-v3',
            'device': 'auto',  # 'auto', 'cuda', 'cpu'
            'language': None,  # None für automatische Erkennung
            'task': 'transcribe',
            'verbose': False,
            'word_timestamps': True,
            'fp16': True
        }
        
        self.model = None
        self.model_name = None
    
    def _load_model(self, model_name: str):
        """
        Lädt das Whisper-Modell
        
        Args:
            model_name: Name des Whisper-Modells
        """
        if self.model is None or self.model_name != model_name:
            try:
                config = {**self.default_config, **self.config}
                
                # Bestimme Device
                device = config['device']
                if device == 'auto':
                    device = 'cuda' if torch.cuda.is_available() else 'cpu'
                
                logger.info(f"Lade Whisper-Modell '{model_name}' auf {device}")
                
                self.model = whisper.load_model(model_name, device=device)
                self.model_name = model_name
                
                logger.info(f"✅ Whisper-Modell '{model_name}' erfolgreich geladen")
                
            except Exception as e:
                logger.error(f"Fehler beim Laden des Whisper-Modells: {e}")
                raise
    
    def find_vocals_file(self, meta: ProcessingMeta) -> Optional[str]:
        """
        Findet die beste Vocals-Datei für die Transkription
        
        Args:
            meta: ProcessingMeta-Objekt
            
        Returns:
            Pfad zur Vocals-Datei oder None
        """
        # Priorität: .vocals.mp3 > .hp5.mp3 > andere Audio-Dateien
        audio_extensions = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.webm']
        
        # Suche nach Vocals-Dateien
        for file in os.listdir(meta.folder_path):
            if file.endswith('.vocals.mp3'):
                return meta.get_file_path(file)
        
        # Suche nach HP5-Dateien
        for file in os.listdir(meta.folder_path):
            if file.endswith('.hp5.mp3'):
                return meta.get_file_path(file)
        
        # Suche nach anderen Audio-Dateien
        for file in os.listdir(meta.folder_path):
            if any(file.lower().endswith(ext) for ext in audio_extensions):
                return meta.get_file_path(file)
        
        return None
    
    def transcribe_audio(self, audio_path: str, model_name: str = 'large-v3') -> Optional[Dict[str, Any]]:
        """
        Transkribiert eine Audio-Datei
        
        Args:
            audio_path: Pfad zur Audio-Datei
            model_name: Whisper-Modell
            
        Returns:
            Transkriptions-Ergebnis oder None
        """
        try:
            self._load_model(model_name)
            
            config = {**self.default_config, **self.config}
            
            logger.info(f"Transkribiere Audio: {audio_path}")
            
            # Transkription mit Whisper
            result = self.model.transcribe(
                audio_path,
                language=config['language'],
                task=config['task'],
                verbose=config['verbose'],
                word_timestamps=config['word_timestamps'],
                fp16=config['fp16']
            )
            
            logger.info(f"✅ Audio erfolgreich transkribiert: {audio_path}")
            return result
            
        except Exception as e:
            logger.error(f"Fehler bei Audio-Transkription: {e}")
            return None
    
    def convert_to_ultrastar(self, transcription_result: Dict[str, Any], meta: ProcessingMeta) -> str:
        """
        Konvertiert Whisper-Ergebnis ins UltraStar-Format
        
        Args:
            transcription_result: Whisper-Transkriptions-Ergebnis
            meta: ProcessingMeta-Objekt
            
        Returns:
            UltraStar-Format-String
        """
        try:
            # 1) Halluzinationen filtern wie im alten Code
            try:
                filtered = self._filter_hallucinations(dict(transcription_result))  # type: ignore
                transcription_result = filtered or transcription_result
            except Exception:
                pass

            # 2) Header-Parameter wie im alten Code
            bpm = 400  # ULTRASTAR_BPM
            language = transcription_result.get('language', 'English')

            # 3) Erste Note/GAP bestimmen
            first_note_time = None
            segments = transcription_result.get('segments', [])
            if segments:
                for segment in segments:
                    words = segment.get('words', [])
                    if words:
                        first_note_time = words[0]['start']
                        break
                    elif segment.get('text', '').strip():
                        first_note_time = segment['start']
                        break
            gap = int(first_note_time * 1000) if first_note_time is not None else 0

            # 4) Header schreiben – identisch zu music_to_lyrics
            title = meta.title
            artist = meta.artist
            audio_mp3 = f"{meta.base_filename}.mp3" if getattr(meta, 'base_filename', None) else 'audio.mp3'
            lines: List[str] = []
            lines.append(f"#TITLE:{title}")
            lines.append(f"#ARTIST:{artist}")
            lines.append(f"#LANGUAGE:{language}")
            lines.append(f"#GENRE:Pop")
            lines.append(f"#YEAR:2024")
            lines.append(f"#MP3:{audio_mp3}")
            lines.append(f"#BPM:{bpm}")
            lines.append(f"#GAP:{gap}")
            lines.append(f"#VERSION:1.1.0")
            lines.append("")

            # 5) Noten generieren – exakt wie im alten Code inkl. Leerzeichen-Handling
            def seconds_to_beats(seconds: float) -> float:
                return seconds * bpm / 15

            is_first_note = True
            note_id = 0
            for segment in segments:
                segment_start = segment['start']
                segment_end = segment['end']
                segment_text = segment.get('text', '').strip()
                if not segment_text:
                    continue
                words = segment.get('words', [])
                if not words:
                    # Fallback: Text in Wörter teilen
                    word_texts = segment_text.split()
                    word_duration = (segment_end - segment_start) / len(word_texts) if word_texts else 1.0
                    for i, word_text in enumerate(word_texts):
                        word_start = segment_start + (i * word_duration)
                        word_end = word_start + word_duration
                        # Beats relativ zur ersten Note
                        if is_first_note:
                            start_beat = 0
                            is_first_note = False
                        else:
                            start_beat = int(seconds_to_beats(word_start - (first_note_time or 0)))
                        duration_beats = int(seconds_to_beats(word_end - (first_note_time or 0))) - start_beat
                        if duration_beats <= 0:
                            duration_beats = 1
                        # Leerzeichen-Handling wie zuvor: erste Note/Startbeat 0 = ein Leerzeichen, sonst zwei
                        if start_beat == 0 and note_id == 0:
                            lines.append(f": {start_beat} {duration_beats} 0 {word_text}")
                        elif start_beat == 0:
                            lines.append(f": {start_beat} {duration_beats} 0 {word_text}")
                        else:
                            lines.append(f": {start_beat} {duration_beats} 0  {word_text}")
                        note_id += 1
                else:
                    for word in words:
                        word_text = word['word'].strip()
                        if not word_text:
                            continue
                        word_start = word['start']
                        word_end = word['end']
                        if is_first_note:
                            start_beat = 0
                            is_first_note = False
                        else:
                            start_beat = int(seconds_to_beats(word_start - (first_note_time or 0)))
                        duration_beats = int(seconds_to_beats(word_end - (first_note_time or 0))) - start_beat
                        if duration_beats <= 0:
                            duration_beats = 1
                        if start_beat == 0 and note_id == 0:
                            lines.append(f": {start_beat} {duration_beats} 0 {word_text}")
                        elif start_beat == 0:
                            lines.append(f": {start_beat} {duration_beats} 0 {word_text}")
                        else:
                            lines.append(f": {start_beat} {duration_beats} 0  {word_text}")
                        note_id += 1

                # Segment-Trenner wie im alten Code
                if segments and segment is not segments[-1]:
                    end_beat = int(seconds_to_beats(segment_end - (first_note_time or 0)))
                    lines.append(f"- {end_beat}")

            lines.append("E")
            return "\n".join(lines)
            
        except Exception as e:
            logger.error(f"Fehler bei UltraStar-Konvertierung: {e}")
            return ""
    
    def save_ultrastar_file(self, content: str, meta: ProcessingMeta, filename: str = None) -> bool:
        """
        Speichert UltraStar-Inhalt in eine Datei
        
        Args:
            content: UltraStar-Inhalt
            meta: ProcessingMeta-Objekt
            filename: Dateiname (optional)
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        try:
            if not filename:
                filename = f"{meta.artist} - {meta.title}.txt"
            
            file_path = meta.get_file_path(filename)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            meta.add_output_file(file_path)
            meta.add_keep_file(filename)
            
            logger.info(f"✅ UltraStar-Datei gespeichert: {filename}")
            return True
            
        except Exception as e:
            logger.error(f"Fehler beim Speichern der UltraStar-Datei: {e}")
            return False
    
    def process_meta(self, meta: ProcessingMeta) -> bool:
        """
        Transkribiert Audio im Meta-Objekt
        
        Args:
            meta: ProcessingMeta-Objekt
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        log_start('transcription.process_meta', meta)
        try:
            # Finde Vocals-Datei
            vocals_file = self.find_vocals_file(meta)
            if not vocals_file:
                logger.error("Keine Vocals-Datei für Transkription gefunden")
                meta.mark_step_failed('transcription')
                return False
            
            logger.info(f"Verwende Vocals-Datei: {vocals_file}")
            meta.status = ProcessingStatus.IN_PROGRESS
            
            # Transkribiere Audio
            config = {**self.default_config, **self.config}
            model_name = config.get('model', 'large-v3')
            
            transcription_result = self.transcribe_audio(vocals_file, model_name)
            if not transcription_result:
                logger.error("Transkription fehlgeschlagen")
                meta.mark_step_failed('transcription')
                meta.status = ProcessingStatus.FAILED
                return False
            
            # Konvertiere zu UltraStar-Format
            ultrastar_content = self.convert_to_ultrastar(transcription_result, meta)
            if not ultrastar_content:
                logger.error("UltraStar-Konvertierung fehlgeschlagen")
                meta.mark_step_failed('transcription')
                meta.status = ProcessingStatus.FAILED
                return False
            
            # Speichere UltraStar-Datei (benenne nach stabilem Basisnamen, falls vorhanden)
            if getattr(meta, 'base_filename', None):
                filename = f"{meta.base_filename}.txt"
            else:
                filename = f"{meta.artist} - {meta.title}.txt"
            if not self.save_ultrastar_file(ultrastar_content, meta, filename):
                logger.error("Speichern der UltraStar-Datei fehlgeschlagen")
                meta.mark_step_failed('transcription')
                meta.status = ProcessingStatus.FAILED
                return False
            
            # Speichere auch Roh-Transkription (temporär, wird beim Cleanup entfernt)
            if getattr(meta, 'base_filename', None):
                raw_filename = f"{meta.base_filename}_raw.txt"
            else:
                raw_filename = f"{meta.artist} - {meta.title}_raw.txt"
            raw_content = transcription_result.get('text', '')
            if raw_content:
                raw_path = meta.get_file_path(raw_filename)
                with open(raw_path, 'w', encoding='utf-8') as f:
                    f.write(raw_content)
                meta.add_output_file(raw_path)
                meta.add_temp_file(raw_filename)  # Als temporär markieren
            
            logger.info(f"✅ Audio erfolgreich transkribiert für: {meta.artist} - {meta.title}")
            meta.mark_step_completed('transcription')
            meta.status = ProcessingStatus.COMPLETED
            return True
            
        except Exception as e:
            logger.error(f"Fehler bei Audio-Transkription: {e}")
            meta.mark_step_failed('transcription')
            meta.status = ProcessingStatus.FAILED
            return False

def transcribe_audio(meta: ProcessingMeta) -> bool:
    """
    Convenience-Funktion für Audio-Transkription
    
    Args:
        meta: ProcessingMeta-Objekt
        
    Returns:
        True wenn erfolgreich, False sonst
    """
    log_start('transcribe_audio', meta)
    transcriber = AudioTranscriber()
    return transcriber.process_meta(meta)
