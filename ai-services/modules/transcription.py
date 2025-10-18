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
from .logger_utils import log_start, send_processing_status

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
        Priorität: .dereverbed.mp3 > .vocals.mp3 > .hp5.mp3 > andere Audio-Dateien
        
        Args:
            meta: ProcessingMeta-Objekt
            
        Returns:
            Pfad zur Vocals-Datei oder None
        """
        # Priorität: .dereverbed.mp3 > .vocals.mp3 > .hp5.mp3 > andere Audio-Dateien
        audio_extensions = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.webm']
        
        # Suche nach dereverbed Vocals-Dateien (höchste Priorität)
        for file in os.listdir(meta.folder_path):
            if file.endswith('.dereverbed.mp3'):
                return meta.get_file_path(file)
        
        # Suche nach normalen Vocals-Dateien
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
        send_processing_status(meta, 'transcribing')
        try:
            # Finde Vocals-Datei
            vocals_file = self.find_vocals_file(meta)
            if not vocals_file:
                logger.error("Keine Vocals-Datei für Transkription gefunden")
                meta.mark_step_failed('transcription')
                return False
            
            logger.info(f"Verwende Vocals-Datei: {vocals_file}")
            # Merke Vocals-Pfad für optionale Lautstärke-Filter
            try:
                self._last_vocals_path = vocals_file
            except Exception:
                pass
            meta.status = ProcessingStatus.IN_PROGRESS
            
            # Transkribiere Audio
            config = {**self.default_config, **self.config}
            model_name = config.get('model', 'large-v3')
            
            transcription_result = self.transcribe_audio(vocals_file, model_name)
            if not transcription_result:
                logger.error("Transkription fehlgeschlagen")
                meta.mark_step_failed('transcription')
                meta.status = ProcessingStatus.FAILED
                send_processing_status(meta, 'failed')
                return False
            
            # Übernehme alte Post-Processing-Pipeline (Segment-Splitting & Halluzinations-Filter)
            try:
                # 1) Erste Filterung
                transcription_result = self._filter_hallucinations(dict(transcription_result))
                # 2) Lange Segmente splitten und optimieren
                before_cnt = len(transcription_result.get('segments', []) or [])
                transcription_result = self._split_long_segments(dict(transcription_result))
                after_cnt = len(transcription_result.get('segments', []) or [])
                # Diagnose: zähle sehr lange Segmente
                try:
                    long_before = sum(1 for s in transcription_result.get('segments', []) if (s.get('end',0)-s.get('start',0))>4.0)
                    logger.info(f"Segmente nach Split: {after_cnt} (vorher unbekannt), >4s: {long_before}")
                except Exception:
                    pass
                # 2b) Lautstärke-basierte Filterung wie früher (logge Entscheidung pro Segment)
                if hasattr(self, '_last_vocals_path') and getattr(self, '_last_vocals_path'):
                    try:
                        transcription_result = self._filter_by_volume(transcription_result, getattr(self, '_last_vocals_path'))
                    except Exception as ve:
                        logger.warning(f"Lautstärke-Filterung übersprungen: {ve}")
                # 3) Zweite Filterung nach dem Split
                transcription_result = self._filter_hallucinations(dict(transcription_result))
            except Exception as e:
                logger.warning(f"Post-Processing übersprungen: {e}")

            # Konvertiere zu UltraStar-Format
            ultrastar_content = self.convert_to_ultrastar(transcription_result, meta)
            if not ultrastar_content:
                logger.error("UltraStar-Konvertierung fehlgeschlagen")
                meta.mark_step_failed('transcription')
                meta.status = ProcessingStatus.FAILED
                send_processing_status(meta, 'failed')
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
            send_processing_status(meta, 'failed')
            return False

    # --- Portierte Hilfsfunktionen aus music_to_lyrics.py (als Klassen-Methoden) ---

    def _filter_hallucinations(self, result: Dict[str, Any]) -> Dict[str, Any]:
        try:
            hallucination_phrases = [
                "thank you.", "thanks.", "goodbye.", "bye.", "see you later.",
                "that's all.", "the end.", "fin", "fin.", "subtitles", "subtitles by",
                "amara.org", "captions", "thanks for watching", "merci d'", "untertitel",
                "copyright", "legendas pela comunidade amara.org",
            ]
            filtered_segments = []
            for segment in result.get('segments', []):
                text = (segment.get('text', '') or '').strip().lower()
                if any(p in text for p in hallucination_phrases):
                    continue
                words = segment.get('words', [])
                if words and len(words) > 1:
                    ends = [w.get('end', 0) for w in words]
                    if len(set(ends)) < len(ends):
                        # Unplausible doppelte Endzeiten → verwerfen
                        continue
                filtered_segments.append(segment)
            result['segments'] = filtered_segments
            if 'text' in result:
                result['text'] = ' '.join((s.get('text', '') or '').strip() for s in filtered_segments)
            return result
        except Exception:
            return result

    def _split_long_segments(self, result: Dict[str, Any]) -> Dict[str, Any]:
        try:
            SEG_MAX = 4.0
            SEG_SHORT = 3.0
            CHAR_MAX = 30
            segments = result.get('segments', [])
            if not segments:
                return result
            new_segments = []
            for segment in segments:
                duration = segment['end'] - segment['start']
                if duration > SEG_MAX:
                    num_segments = int(duration / SEG_SHORT) + 1
                    split = self._split_segment_simple(segment, num_segments)
                    new_segments.extend(split)
                else:
                    new_segments.append(segment)
            # Zähle Segmente mit >30 Zeichen vor der Optimierung
            long_segments_before = sum(1 for s in new_segments if len((s.get('text', '') or '').strip()) > CHAR_MAX)
            logger.info(f"Segmente vor Längen-Optimierung: {len(new_segments)}, davon >{CHAR_MAX} Zeichen: {long_segments_before}")
            
            new_segments = self._optimize_segment_lengths(new_segments, CHAR_MAX)
            
            # Zähle Segmente mit >30 Zeichen nach der Optimierung
            long_segments_after = sum(1 for s in new_segments if len((s.get('text', '') or '').strip()) > CHAR_MAX)
            logger.info(f"Segmente nach Längen-Optimierung: {len(new_segments)}, davon >{CHAR_MAX} Zeichen: {long_segments_after}")
            
            if result.get('language', '').lower() == 'en':
                new_segments = self._optimize_capitalization_segments(new_segments)
            new_segments = self._clean_segments(new_segments)
            result['segments'] = new_segments
            if 'text' in result:
                result['text'] = ' '.join((s.get('text', '') or '').strip() for s in new_segments)
            return result
        except Exception:
            return result

    def _split_segment_simple(self, segment: Dict[str, Any], num_segments: int) -> List[Dict[str, Any]]:
        try:
            start_time = segment['start']
            end_time = segment['end']
            duration = end_time - start_time
            seg_dur = duration / max(num_segments, 1)
            words = segment.get('words', [])
            if not words:
                split_segments = []
                for i in range(num_segments):
                    seg_start = start_time + (i * seg_dur)
                    seg_end = start_time + ((i + 1) * seg_dur)
                    split_segments.append({**segment, 'start': seg_start, 'end': seg_end, 'is_split': True})
                return split_segments
            # Wörter gleichmäßig verteilen
            per_seg = len(words) / num_segments
            out = []
            for i in range(num_segments):
                s = int(i * per_seg)
                e = int((i + 1) * per_seg) if i < num_segments - 1 else len(words)
                seg_words = words[s:e]
                if seg_words:
                    seg_start = seg_words[0]['start']
                    seg_end = seg_words[-1]['end']
                    seg_text = ' '.join(w['word'].strip() for w in seg_words)
                else:
                    seg_start = start_time + (i * seg_dur)
                    seg_end = start_time + ((i + 1) * seg_dur)
                    seg_text = ''
                out.append({**segment, 'start': seg_start, 'end': seg_end, 'text': seg_text, 'words': seg_words, 'is_split': True})
            return out
        except Exception:
            return [segment]

    def _optimize_segment_lengths(self, segments: List[Dict[str, Any]], char_max: int) -> List[Dict[str, Any]]:
        """
        Optimiert Segment-Längen durch rekursive Aufteilung von Segmenten mit >char_max Zeichen
        """
        try:
            out = []
            for i, seg in enumerate(segments):
                txt = (seg.get('text', '') or '').strip()
                if len(txt) <= char_max:
                    out.append(seg)
                    continue
                
                words = seg.get('words', [])
                if not words or len(words) <= 1:
                    logger.warning(f"Segment mit {len(txt)} Zeichen kann nicht aufgeteilt werden (keine/few Wörter): '{txt[:50]}...'")
                    out.append(seg)
                    continue
                
                # Rekursive Aufteilung bis alle Teile <= char_max sind
                split_segments = self._recursive_split_by_length(seg, char_max)
                out.extend(split_segments)
                
            return out
        except Exception as e:
            logger.error(f"Fehler bei Segment-Längen-Optimierung: {e}")
            return segments
    
    def _recursive_split_by_length(self, segment: Dict[str, Any], char_max: int) -> List[Dict[str, Any]]:
        """
        Teilt ein Segment rekursiv auf, bis alle Teile <= char_max Zeichen haben
        """
        try:
            txt = (segment.get('text', '') or '').strip()
            if len(txt) <= char_max:
                return [segment]
            
            words = segment.get('words', [])
            if not words or len(words) <= 1:
                logger.warning(f"Segment mit {len(txt)} Zeichen kann nicht weiter aufgeteilt werden: '{txt[:50]}...'")
                return [segment]
            
            # Aufteilung in der Mitte
            mid = len(words) // 2
            first = words[:mid]
            second = words[mid:]
            
            if not first or not second:
                logger.warning(f"Segment mit {len(txt)} Zeichen kann nicht aufgeteilt werden (ungleiche Verteilung): '{txt[:50]}...'")
                return [segment]
            
            # Erstelle zwei neue Segmente
            s1 = {
                **segment, 
                'start': first[0]['start'], 
                'end': first[-1]['end'], 
                'words': first, 
                'text': ' '.join(w['word'].strip() for w in first), 
                'is_split': True
            }
            s2 = {
                **segment, 
                'start': second[0]['start'], 
                'end': second[-1]['end'], 
                'words': second, 
                'text': ' '.join(w['word'].strip() for w in second), 
                'is_split': True
            }
            
            logger.info(f"Segment aufgeteilt: '{txt[:30]}...' ({len(txt)} Zeichen) -> '{s1['text'][:20]}...' ({len(s1['text'])} Zeichen) + '{s2['text'][:20]}...' ({len(s2['text'])} Zeichen)")
            
            # Rekursive Aufteilung beider Teile
            result = []
            result.extend(self._recursive_split_by_length(s1, char_max))
            result.extend(self._recursive_split_by_length(s2, char_max))
            
            return result
            
        except Exception as e:
            logger.error(f"Fehler bei rekursiver Segment-Aufteilung: {e}")
            return [segment]

    def _optimize_capitalization_segments(self, segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        try:
            out = []
            for i, seg in enumerate(segments):
                words = seg.get('words', [])
                if not words or len(words) <= 1:
                    out.append(seg)
                    continue
                last = words[-1]
                last_text = (last.get('word', '') or '').strip()
                has_punct = any(last_text.endswith(p) for p in ['.', '!', '?', ',', ';', ':'])
                if len(last_text) > 1 and last_text[0].isupper() and not has_punct and i < len(segments) - 1:
                    next_seg = segments[i + 1]
                    next_words = next_seg.get('words', [])
                    next_words.insert(0, last)
                    # update current seg
                    remain = words[:-1]
                    if remain:
                        seg['words'] = remain
                        seg['text'] = ' '.join(w['word'].strip() for w in remain)
                        seg['end'] = remain[-1]['end']
                        seg['is_split'] = True
                        # update next seg
                        next_seg['words'] = next_words
                        next_seg['text'] = ' '.join(w['word'].strip() for w in next_words)
                        next_seg['start'] = next_words[0]['start']
                        next_seg['is_split'] = True
                out.append(seg)
            return out
        except Exception:
            return segments

    def _clean_segments(self, segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        try:
            cleaned = []
            for seg in segments:
                words = seg.get('words', [])
                if not words:
                    continue
                filtered = []
                for w in words:
                    wt = (w.get('word', '') or '').strip()
                    if wt and not wt.replace('.', '').replace(' ', ''):
                        continue
                    filtered.append(w)
                if not filtered:
                    continue
                seg['words'] = filtered
                seg['text'] = ' '.join(w['word'].strip() for w in filtered).strip()
                if not seg['text']:
                    continue
                seg['start'] = filtered[0]['start']
                seg['end'] = filtered[-1]['end']
                cleaned.append(seg)
            return cleaned
        except Exception:
            return segments

    def _filter_by_volume(self, result: Dict[str, Any], vocals_path: str) -> Dict[str, Any]:
        """
        Filtert Segmente basierend auf der Lautstärke der Vocals und loggt die Entscheidung pro Segment.
        """
        try:
            import subprocess
            segments = result.get('segments', []) or []
            filtered_segments: List[Dict[str, Any]] = []
            volume_threshold = -45.0  # dB
            for segment in segments:
                start_time = segment.get('start', 0)
                end_time = segment.get('end', 0)
                duration = max(0, end_time - start_time)
                if duration <= 0:
                    continue
                cmd = [
                    'ffmpeg', '-hide_banner', '-nostats',
                    '-ss', str(start_time), '-t', str(duration), '-i', vocals_path,
                    '-af', 'volumedetect', '-f', 'null', '-'
                ]
                mean_volume = None
                try:
                    result_run = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
                    for line in (result_run.stderr or '').split('\n'):
                        if 'mean_volume:' in line:
                            try:
                                val = line.split('mean_volume:')[1].strip().split()[0]
                                mean_volume = float(val.replace('dB', ''))
                                break
                            except Exception:
                                pass
                except subprocess.TimeoutExpired:
                    logger.warning(f"FFmpeg-Timeout für Segment: '{segment.get('text', '').strip()}'")
                    mean_volume = None
                except Exception as e:
                    logger.warning(f"FFmpeg-Fehler für Segment: {e}")
                    mean_volume = None

                keep = (mean_volume is None) or (mean_volume > volume_threshold)
                if keep:
                    filtered_segments.append(segment)
                    logger.info(f"Segment beibehalten (Lautstärke: {mean_volume if mean_volume is not None else 'n/a'} dB): '{segment.get('text','').strip()}'")
                else:
                    logger.info(f"Segment entfernt (zu leise: {mean_volume:.1f} dB): '{segment.get('text','').strip()}'")

            result['segments'] = filtered_segments
            if 'text' in result:
                result['text'] = ' '.join((s.get('text', '') or '').strip() for s in filtered_segments)
            return result
        except Exception as e:
            logger.warning(f"Fehler bei Lautstärke-Filterung: {e}")
            return result

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

