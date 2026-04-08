#!/usr/bin/env python3
"""
Transcription Module
Transkribiert Audio zu Text und konvertiert ins UltraStar-Format
"""

import json
import os
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List

import torch
try:
    from faster_whisper import WhisperModel
    FASTER_WHISPER_AVAILABLE = True
except ImportError:
    import whisper
    FASTER_WHISPER_AVAILABLE = False

from .meta import ProcessingMeta, ProcessingStatus
from .logger_utils import log_start, send_processing_status

logger = logging.getLogger(__name__)

# Gemeinsame Default-Konfiguration (Whisper + Platzhalter für Qwen3-Optionen)
TRANSCRIPTION_DEFAULTS: Dict[str, Any] = {
    'transcription_engine': 'qwen3-asr',
    'model': 'large-v3',
    'device': 'auto',
    'language': None,
    'task': 'transcribe',
    'verbose': False,
    'word_timestamps': True,
    'fp16': True,
    'qwen3_asr_model': 'Qwen/Qwen3-ASR-1.7B',
    'qwen3_forced_aligner': 'Qwen/Qwen3-ForcedAligner-0.6B',
    'qwen3_backend': 'transformers',
}


def merge_transcription_config(meta: ProcessingMeta) -> Dict[str, Any]:
    """Merge: Defaults → meta.config → Unterobjekt transcription → Umgebungsvariablen."""
    cfg: Dict[str, Any] = {**TRANSCRIPTION_DEFAULTS}
    if meta.config:
        cfg.update(meta.config)
    nested = cfg.get('transcription')
    if isinstance(nested, dict):
        if nested.get('engine') is not None:
            cfg['transcription_engine'] = nested['engine']
        for k, v in nested.items():
            if k == 'engine':
                continue
            cfg[k] = v
    env_engine = os.environ.get('TRANSCRIPTION_ENGINE') or os.environ.get('KARAOKE_TRANSCRIPTION_ENGINE')
    if env_engine:
        cfg['transcription_engine'] = env_engine.strip()
    try:
        from .transcription_qwen import default_qwen_env_overrides
        cfg.update(default_qwen_env_overrides())
    except ImportError:
        pass
    return cfg


def _normalize_transcription_engine(name: Optional[str]) -> str:
    raw = (name or 'qwen3-asr').strip().lower()
    if 'qwen' in raw.replace('_', '-'):
        return 'qwen3'
    return 'whisper'


def _whisper_only_config(effective: Dict[str, Any]) -> Dict[str, Any]:
    """Nur für Whisper/faster-whisper relevante Keys (qwen3_* und Engine-Identifier rausfiltern)."""
    skip = {'transcription_engine', 'transcription'}
    return {
        k: v
        for k, v in effective.items()
        if k not in skip and not str(k).startswith('qwen3_')
    }


def apply_transcription_request_config(meta: ProcessingMeta, payload: Optional[Dict[str, Any]]) -> None:
    """Übernimmt API-Body-Felder transcription / transcription_engine in meta.config."""
    if not payload:
        return
    tc = payload.get('transcription')
    if isinstance(tc, dict):
        meta.config = {**(meta.config or {})}
        for k, v in tc.items():
            if k == 'engine':
                meta.config['transcription_engine'] = v
            else:
                meta.config[k] = v
    if payload.get('transcription_engine'):
        meta.config = {**(meta.config or {}), 'transcription_engine': payload['transcription_engine']}


def _transcription_raw_basename(meta: ProcessingMeta) -> str:
    if getattr(meta, 'base_filename', None):
        return str(meta.base_filename)
    return f"{meta.artist} - {meta.title}"


def format_transcription_raw_text(result: Dict[str, Any]) -> str:
    """Lesbare Roh-Ausgabe mit Segment- und Wort-Timestamps (vor Post-Processing)."""
    lines: List[str] = [
        "# Raw ASR / transcription (before cleanup)",
        f"language: {result.get('language', '')}",
        "",
        "--- full text ---",
        (result.get('text') or "").strip(),
        "",
        "--- segments ---",
    ]
    segments = result.get('segments') or []
    for i, seg in enumerate(segments):
        st = seg.get('start', 0.0)
        en = seg.get('end', 0.0)
        txt = (seg.get('text') or "").strip()
        lines.append(f"[seg {i}] {st:.3f}s – {en:.3f}s | {txt}")
        for w in seg.get('words') or []:
            word = (w.get('word') or "").strip()
            ws = w.get('start', 0.0)
            we = w.get('end', 0.0)
            lines.append(f"    {ws:.3f}s – {we:.3f}s  {word}")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def save_raw_transcription_artifacts(meta: ProcessingMeta, result: Dict[str, Any]) -> None:
    """JSON + lesbare .txt im Songordner; Logs mit Kurzüberblick."""
    base = _transcription_raw_basename(meta)
    path_json = meta.get_file_path(f"{base}_asr_raw.json")
    path_txt = meta.get_file_path(f"{base}_asr_raw_timestamps.txt")
    try:
        with open(path_json, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2, default=str)
        txt_body = format_transcription_raw_text(result)
        with open(path_txt, "w", encoding="utf-8") as f:
            f.write(txt_body)
        meta.add_output_file(path_json)
        meta.add_output_file(path_txt)
        meta.add_keep_file(os.path.basename(path_json))
        meta.add_keep_file(os.path.basename(path_txt))
    except Exception as ex:
        logger.warning("Konnte Roh-Transkript-Artefakte nicht schreiben: %s", ex, exc_info=True)
        return
    n_seg = len(result.get("segments") or [])
    n_words = sum(len((s.get("words") or [])) for s in (result.get("segments") or []))
    text = result.get("text") or ""
    logger.info(
        "Raw ASR (pre-cleanup): segments=%s words=%s text_len=%s — saved %s and %s",
        n_seg,
        n_words,
        len(text),
        os.path.basename(path_json),
        os.path.basename(path_txt),
    )
    preview = 600
    if len(text) <= preview:
        logger.info("Raw ASR text:\n%s", text)
    else:
        logger.info("Raw ASR text (first %s chars):\n%s…", preview, text[:preview])


# Globale Instanz des Transcribers, um das Modell im Speicher zu halten
# Das verhindert, dass das Modell beim Garbage Collection gelöscht wird und Abstürze verursacht
_global_transcriber = None

class AudioTranscriber:
    """Audio-Transkribierer mit Whisper für UltraStar-Format"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialisiert den Audio-Transkribierer
        
        Args:
            config: Konfiguration für Whisper
        """
        self.config = config or {}
        self.default_config = {**TRANSCRIPTION_DEFAULTS}
        
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
                
                # Verwende faster-whisper falls verfügbar (Windows-kompatibel)
                if FASTER_WHISPER_AVAILABLE:
                    self.model = WhisperModel(model_name, device=device)
                else:
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
        segments_generator = None
        try:
            self._load_model(model_name)
            
            config = {**self.default_config, **self.config}
            
            logger.info(f"Transkribiere Audio: {audio_path}")
            
            # Transkription mit Whisper (unterstützt beide APIs)
            if FASTER_WHISPER_AVAILABLE:
                # faster-whisper API
                segments_generator, info = self.model.transcribe(
                    audio_path,
                    language=config['language'] if config['language'] else None,
                    task=config['task'],
                    word_timestamps=config['word_timestamps'],
                    beam_size=5
                )
                
                # Konvertiere zu openai-whisper Format
                result = {
                    'text': '',
                    'language': info.language if hasattr(info, 'language') else config.get('language', 'en'),
                    'segments': []
                }
                
                full_text = []
                # Stelle sicher, dass der Generator vollständig durchlaufen wird
                try:
                    for segment in segments_generator:
                        seg_dict = {
                            'id': len(result['segments']),
                            'seek': 0,
                            'start': segment.start,
                            'end': segment.end,
                            'text': segment.text,
                            'words': []
                        }
                        
                        # Füge Wörter hinzu falls verfügbar
                        if hasattr(segment, 'words') and segment.words:
                            for word in segment.words:
                                seg_dict['words'].append({
                                    'word': word.word,
                                    'start': word.start,
                                    'end': word.end
                                })
                        
                        result['segments'].append(seg_dict)
                        full_text.append(segment.text)
                except Exception as gen_error:
                    logger.error(f"Fehler beim Durchlaufen des Generators: {gen_error}", exc_info=True)
                    raise
                
                result['text'] = ' '.join(full_text)
                
            else:
                # Original openai-whisper API
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
            logger.error(f"Fehler bei Audio-Transkription: {e}", exc_info=True)
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
    
    def process_meta(
        self,
        meta: ProcessingMeta,
        transcription_cfg: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Transkribiert Audio im Meta-Objekt.

        Args:
            meta: ProcessingMeta-Objekt
            transcription_cfg: Optional vorgemergter Dict (sonst merge_transcription_config(meta))
        """
        log_start('transcription.process_meta', meta)
        send_processing_status(meta, 'transcribing')
        try:
            effective = transcription_cfg if transcription_cfg is not None else merge_transcription_config(meta)
            engine = _normalize_transcription_engine(effective.get('transcription_engine'))

            vocals_file = self.find_vocals_file(meta)
            if not vocals_file:
                logger.error("Keine Vocals-Datei für Transkription gefunden")
                meta.mark_step_failed('transcription')
                return False

            logger.info("Verwende Vocals-Datei: %s | Engine: %s", vocals_file, engine)
            try:
                self._last_vocals_path = vocals_file
            except Exception:
                pass
            meta.status = ProcessingStatus.IN_PROGRESS

            transcription_result: Optional[Dict[str, Any]] = None
            if engine == 'qwen3':
                from .transcription_qwen import transcribe_audio_file_qwen3
                try:
                    transcription_result = transcribe_audio_file_qwen3(vocals_file, effective)
                except Exception as qe:
                    logger.error("Qwen3-ASR Transkription fehlgeschlagen: %s", qe, exc_info=True)
                    transcription_result = None
            else:
                self.config = _whisper_only_config(effective)
                model_name = effective.get('model', 'large-v3')
                transcription_result = self.transcribe_audio(vocals_file, model_name)

            if not transcription_result:
                logger.error("Transkription fehlgeschlagen")
                meta.mark_step_failed('transcription')
                meta.status = ProcessingStatus.FAILED
                send_processing_status(meta, 'failed')
                return False
            
            return self._finalize_transcription(meta, transcription_result, vocals_file)

            
        except Exception as e:
            logger.error(f"Fehler bei Audio-Transkription: {e}", exc_info=True)
            meta.mark_step_failed('transcription')
            meta.status = ProcessingStatus.FAILED
            try:
                send_processing_status(meta, 'failed')
            except Exception as status_error:
                logger.warning(f"Fehler beim Senden des Fehlerstatus: {status_error}")
            
            # Bereinige auch bei Fehlern
            # DEAKTIVIERT: torch.cuda.empty_cache() kann auf Windows zu Abstürzen führen
            try:
                if False and torch.cuda.is_available():  # Deaktiviert
                    # torch.cuda.empty_cache()  # DEAKTIVIERT
                    pass
            except Exception:
                pass
            
            return False

    def _finalize_transcription(
        self,
        meta: ProcessingMeta,
        transcription_result: Dict[str, Any],
        vocals_file: str,
    ) -> bool:
        """Post-Processing, UltraStar, Roh-Text — gemeinsam für Whisper und Qwen3."""
        _ = vocals_file
        try:
            save_raw_transcription_artifacts(meta, dict(transcription_result))
            try:
                transcription_result = self._split_monolithic_asr_segments(
                    dict(transcription_result)
                )
                transcription_result = self._filter_hallucinations(dict(transcription_result))
                transcription_result = self._split_long_segments(dict(transcription_result))
                after_cnt = len(transcription_result.get('segments', []) or [])
                try:
                    long_before = sum(
                        1
                        for s in transcription_result.get('segments', [])
                        if (s.get('end', 0) - s.get('start', 0)) > 4.0
                    )
                    logger.info(
                        "Segmente nach Split: %s, >4s: %s",
                        after_cnt,
                        long_before,
                    )
                except Exception:
                    pass
                if hasattr(self, '_last_vocals_path') and getattr(self, '_last_vocals_path'):
                    try:
                        transcription_result = self._filter_by_volume(
                            transcription_result, getattr(self, '_last_vocals_path')
                        )
                    except Exception as ve:
                        logger.warning(f"Lautstärke-Filterung übersprungen: {ve}")
                transcription_result = self._filter_hallucinations(dict(transcription_result))
            except Exception as e:
                logger.warning(f"Post-Processing übersprungen: {e}")

            ultrastar_content = self.convert_to_ultrastar(transcription_result, meta)
            if not ultrastar_content:
                logger.error("UltraStar-Konvertierung fehlgeschlagen")
                meta.mark_step_failed('transcription')
                meta.status = ProcessingStatus.FAILED
                send_processing_status(meta, 'failed')
                return False

            if getattr(meta, 'base_filename', None):
                filename = f"{meta.base_filename}.txt"
            else:
                filename = f"{meta.artist} - {meta.title}.txt"
            if not self.save_ultrastar_file(ultrastar_content, meta, filename):
                logger.error("Speichern der UltraStar-Datei fehlgeschlagen")
                meta.mark_step_failed('transcription')
                meta.status = ProcessingStatus.FAILED
                send_processing_status(meta, 'failed')
                return False

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
                meta.add_temp_file(raw_filename)

            logger.info("=" * 80)
            logger.info(f"✅ Audio erfolgreich transkribiert für: {meta.artist} - {meta.title}")
            meta.mark_step_completed('transcription')
            meta.status = ProcessingStatus.COMPLETED
            try:
                send_processing_status(meta, 'completed')
            except Exception as status_error:
                logger.warning(f"⚠️ Fehler beim Senden des Erfolgsstatus: {status_error}")
            return True
        except Exception as e:
            logger.error("_finalize_transcription: %s", e, exc_info=True)
            meta.mark_step_failed('transcription')
            meta.status = ProcessingStatus.FAILED
            try:
                send_processing_status(meta, 'failed')
            except Exception:
                pass
            return False

    def _build_segment_from_words(
        self,
        words: List[Dict[str, Any]],
        template: Dict[str, Any],
        idx: int,
    ) -> Dict[str, Any]:
        text = ' '.join(str(w.get('word', '') or '').strip() for w in words).strip()
        base = {k: v for k, v in template.items() if k not in (
            'id', 'seek', 'start', 'end', 'text', 'words'
        )}
        return {
            **base,
            'id': idx,
            'seek': 0,
            'start': float(words[0].get('start', 0)),
            'end': float(words[-1].get('end', 0)),
            'text': text,
            'words': list(words),
        }

    def _split_monolithic_asr_segments(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Qwen3 liefert oft ein einziges langes Segment. Aufteilung an:
        - größeren Pausen zwischen Wort-Timestamps
        - Satzende (. ! ?), sobald genug Tokens im Puffer liegen
        """
        try:
            segments = list(result.get('segments') or [])
            if len(segments) != 1:
                return result
            seg = segments[0]
            words = list(seg.get('words') or [])
            if len(words) < 24:
                return result
            dur = float(seg.get('end', 0)) - float(seg.get('start', 0))
            if dur < 30.0 and len(words) < 64:
                return result

            gap_break = 1.15
            min_flush = 2
            min_for_punct = 4

            new_segs: List[Dict[str, Any]] = []
            buf: List[Dict[str, Any]] = []
            for i, w in enumerate(words):
                buf.append(w)
                if i + 1 >= len(words):
                    break
                nw = words[i + 1]
                gap = float(nw.get('start', 0)) - float(w.get('end', 0))
                wtxt = str(w.get('word', '') or '').strip()
                sentence_break = bool(wtxt) and wtxt[-1] in '.!?'
                if (gap > gap_break and len(buf) >= min_flush) or (
                    sentence_break and len(buf) >= min_for_punct
                ):
                    new_segs.append(self._build_segment_from_words(buf, seg, len(new_segs)))
                    buf = []
            if buf:
                new_segs.append(self._build_segment_from_words(buf, seg, len(new_segs)))
            if len(new_segs) <= 1:
                return result

            out = dict(result)
            out['segments'] = new_segs
            out['text'] = ' '.join((s.get('text') or '').strip() for s in new_segs)
            logger.info(
                'Monolith-Segment aufgeteilt: 1 → %s Teil-Segmente (Pausen/Satzenden).',
                len(new_segs),
            )
            return out
        except Exception as ex:
            logger.warning('Monolith-Segment-Split übersprungen: %s', ex)
            return result

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
            
            if result.get('language', '').lower() in ('en', 'english'):
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
                    if (seg.get('text') or '').strip():
                        cleaned.append(seg)
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
                    # viele Aligner (z. B. Qwen) haben start==end auf Token-Ebene — Segment nicht verwerfen
                    filtered_segments.append(segment)
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

            if not filtered_segments and segments:
                logger.warning(
                    "Lautstärke-Filter: alle Segmente entfernt — behalte Original (%s Segmente).",
                    len(segments),
                )
                return result

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
    global _global_transcriber
    
    try:
        log_start('transcribe_audio', meta)
        
        # Verwende globale Instanz, um das Modell im Speicher zu halten
        # Das verhindert Abstürze beim Garbage Collection
        if _global_transcriber is None:
            _global_transcriber = AudioTranscriber()
        
        transcriber = _global_transcriber
        cfg = merge_transcription_config(meta)
        result = transcriber.process_meta(meta, cfg)
        
        # Das Modell bleibt in _global_transcriber, um Abstürze zu vermeiden
        return result
    except Exception as e:
        logger.error("=" * 80)
        logger.error(f"❌ KRITISCHER FEHLER in transcribe_audio(): {e}", exc_info=True)
        import traceback
        logger.error(f"Exception Type: {type(e).__name__}")
        logger.error(f"Traceback:\n{traceback.format_exc()}")
        logger.error("=" * 80)
        raise

