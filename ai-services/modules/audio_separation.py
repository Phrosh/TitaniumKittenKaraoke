#!/usr/bin/env python3
"""
Audio Separation Module
Trennt Audio in Instrumental und Vocals mit UVR5
"""

import os
import subprocess
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List

from .meta import ProcessingMeta, ProcessingStatus
from .logger_utils import log_start, send_processing_status

logger = logging.getLogger(__name__)

class AudioSeparator:
    """Audio-Separator mit UVR5 für Vocal/Instrumental-Trennung"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialisiert den Audio-Separator
        
        Args:
            config: Konfiguration für UVR5
        """
        self.config = config or {}
        self.default_config = {
            'uvr_path': 'uvr5',  # Pfad zum UVR5-Skript
            'model': 'HP2',  # Standard-Modell
            'output_format': 'mp3',
            'gain_reduction': 2.0,  # dB Reduktion vor Separation
            'aggression': 10,  # UVR5 Aggression-Level
            'window_size': 512,
            'hop_length': 128
        }
    
    def find_audio_source(self, meta: ProcessingMeta) -> Optional[str]:
        """
        Findet die beste Audio-Quelle für die Separation
        Priorität: dereverbed.mp3 > normalized.mp3 > andere Audio-Dateien > Audio aus Video extrahieren
        
        Args:
            meta: ProcessingMeta-Objekt
            
        Returns:
            Pfad zur Audio-Quelle oder None
        """
        # Priorität: dereverbed.mp3 > normalized.mp3 > andere Audio-Dateien > Audio aus Video extrahieren
        audio_extensions = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.webm']
        
        # Suche nach dereverbed Datei (höchste Priorität)
        for file in os.listdir(meta.folder_path):
            if file.endswith('.dereverbed.mp3'):
                return meta.get_file_path(file)
        
        # Wenn ein stabiler Basisname vorhanden ist, priorisiere [base].normalized.mp3
        if getattr(meta, 'base_filename', None):
            candidate = meta.get_file_path(f"{meta.base_filename}.normalized.mp3")
            if os.path.exists(candidate):
                return candidate
        # Suche nach normalisierter Datei (allgemein)
        for file in os.listdir(meta.folder_path):
            if file.endswith('.normalized.mp3'):
                return meta.get_file_path(file)
        
        # Suche nach anderen Audio-Dateien
        for file in os.listdir(meta.folder_path):
            if any(file.lower().endswith(ext) for ext in audio_extensions):
                return meta.get_file_path(file)
        
        # Suche in Eingabedateien
        for file_path in meta.input_files:
            if any(file_path.lower().endswith(ext) for ext in audio_extensions):
                return file_path
        
        # Falls keine Audio-Datei gefunden wurde, prüfe auf Video-Dateien und extrahiere Audio
        video_extensions = ['.mp4', '.mkv', '.webm', '.mov', '.avi']
        for file in os.listdir(meta.folder_path):
            if any(file.lower().endswith(ext) for ext in video_extensions):
                video_path = meta.get_file_path(file)
                # Benennung: [base].extracted.mp3, wenn base vorhanden, sonst vom Videonamen abgeleitet
                extracted_stem = meta.base_filename or Path(video_path).stem
                # Entferne etwaige bereits vorhandene Suffixe wie .extracted oder .reduced
                if extracted_stem.endswith('.extracted'):
                    extracted_stem = extracted_stem[:-10]
                if extracted_stem.endswith('.reduced'):
                    extracted_stem = extracted_stem[:-8]
                extracted = meta.get_file_path(f"{extracted_stem}.extracted.mp3")
                try:
                    cmd = [
                        'ffmpeg',
                        '-i', video_path,
                        '-vn',
                        '-acodec', 'libmp3lame',
                        '-b:a', '192k',
                        '-y',
                        extracted
                    ]
                    logger.info(f"Extrahiere Audio aus Video: {video_path} -> {extracted}")
                    result = subprocess.run(cmd, capture_output=True, text=True)
                    if result.returncode == 0 and os.path.exists(extracted):
                        meta.add_input_file(extracted)
                        meta.add_output_file(extracted)
                        return extracted
                    else:
                        logger.error(f"Audio-Extraktion fehlgeschlagen: {result.stderr}")
                except Exception as e:
                    logger.error(f"Fehler bei Audio-Extraktion: {e}")
        
        return None
    
    def reduce_gain(self, input_path: str, output_path: str, reduction_db: float = 2.0) -> bool:
        """
        Reduziert den Gain einer Audio-Datei
        
        Args:
            input_path: Eingabedatei
            output_path: Ausgabedatei
            reduction_db: Reduktion in dB
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        try:
            cmd = [
                'ffmpeg',
                '-i', input_path,
                '-af', f'volume=-{reduction_db}dB',
                '-c:a', 'libmp3lame',
                '-b:a', '192k',
                '-y',
                output_path
            ]
            
            logger.info(f"Reduziere Gain um {reduction_db}dB: {input_path} -> {output_path}")
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                logger.info(f"✅ Gain erfolgreich reduziert: {output_path}")
                return True
            else:
                logger.error(f"❌ Gain-Reduktion fehlgeschlagen: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Fehler bei Gain-Reduktion: {e}")
            return False
    
    def separate_with_uvr5(self, input_path: str, output_dir: str, base_root: str) -> bool:
        """
        Trennt Audio mit UVR5 über den vorhandenen Wrapper und erzeugt Ziel-Dateien:
        [base].hp2.mp3, [base].hp5.mp3, optional [base].vocals.mp3
        """
        # Lade UVR5Wrapper per Dateipfad, damit kein Paketname benötigt wird
        try:
            import importlib.util
            wrapper_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'uvr5_correct.py'))
            spec = importlib.util.spec_from_file_location('uvr5_correct', wrapper_path)
            if spec is None or spec.loader is None:
                logger.error('Konnte Spec für uvr5_correct.py nicht erstellen')
                return False
            uvr5_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(uvr5_module)
            UVR5Wrapper = getattr(uvr5_module, 'UVR5Wrapper')
        except Exception as e:
            logger.error(f"UVR5-Wrapper konnte nicht geladen werden: {e}")
            return False
        
        try:
            # 1) HP5-Separation (liefert Vocals und auch eine Instrumentalspur nach HP5-Modell)
            wrapper_hp5 = UVR5Wrapper(model_choice="HP5")
            wrapper_hp5.separate(input_path)
            sep_dir = os.path.join(os.path.dirname(input_path), 'separated')
            hp5_vocals_dir = os.path.join(sep_dir, 'vocals')
            hp5_inst_dir = os.path.join(sep_dir, 'instrumental')
            hp5_vocals_wavs = [f for f in os.listdir(hp5_vocals_dir) if f.lower().endswith('.wav')] if os.path.isdir(hp5_vocals_dir) else []
            hp5_inst_wavs = [f for f in os.listdir(hp5_inst_dir) if f.lower().endswith('.wav')] if os.path.isdir(hp5_inst_dir) else []

            # 2) HP2-Separation für alternative Instrumentalspur
            wrapper_hp2 = UVR5Wrapper(model_choice="HP2")
            wrapper_hp2.separate(input_path)
            # Nach dem zweiten Lauf zeigen die Ordner auf HP2-Ergebnis
            hp2_vocals_dir = os.path.join(sep_dir, 'vocals')
            hp2_inst_dir = os.path.join(sep_dir, 'instrumental')
            hp2_inst_wavs = [f for f in os.listdir(hp2_inst_dir) if f.lower().endswith('.wav')] if os.path.isdir(hp2_inst_dir) else []

            # Ziel-Dateien
            hp2_mp3 = os.path.join(output_dir, f"{base_root}.hp2.mp3")
            hp5_mp3 = os.path.join(output_dir, f"{base_root}.hp5.mp3")
            vocals_mp3 = os.path.join(output_dir, f"{base_root}.vocals.mp3")

            # Konvertierer
            def wav_to_mp3(src: str, dst: str) -> bool:
                cmd = ['ffmpeg', '-i', src, '-c:a', 'libmp3lame', '-b:a', '192k', '-y', dst]
                res = subprocess.run(cmd, capture_output=True, text=True)
                return res.returncode == 0 and os.path.exists(dst)

            success_any = False
            # Erzeuge hp2 aus HP2-Instrumental, falls vorhanden, sonst fallback auf HP5-Instrumental
            if hp2_inst_wavs:
                if wav_to_mp3(os.path.join(hp2_inst_dir, hp2_inst_wavs[0]), hp2_mp3):
                    success_any = True
            elif hp5_inst_wavs:
                if wav_to_mp3(os.path.join(hp5_inst_dir, hp5_inst_wavs[0]), hp2_mp3):
                    success_any = True

            # Erzeuge hp5 aus HP5-Instrumental
            if hp5_inst_wavs:
                if wav_to_mp3(os.path.join(hp5_inst_dir, hp5_inst_wavs[0]), hp5_mp3):
                    success_any = True

            # Erzeuge vocals.mp3 aus HP5-Vocals
            if hp5_vocals_wavs:
                if wav_to_mp3(os.path.join(hp5_vocals_dir, hp5_vocals_wavs[0]), vocals_mp3):
                    success_any = True

            return success_any
        except Exception as e:
            logger.error(f"Fehler bei UVR5-Separation: {e}")
            return False
    
    def separate_with_ffmpeg(self, input_path: str, output_dir: str, base_root: str) -> bool:
        """
        Einfache Audio-Separation mit FFmpeg (Fallback)
        
        Args:
            input_path: Eingabedatei
            output_dir: Ausgabeordner
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        try:
            # Erstelle Ausgabedateien mit stabiler Benennung
            instrumental_path = os.path.join(output_dir, f"{base_root}.hp2.mp3")
            vocals_path = os.path.join(output_dir, f"{base_root}.hp5.mp3")
            
            # Einfache Trennung mit FFmpeg (nicht sehr effektiv, aber als Fallback)
            # Hier würde normalerweise UVR5 verwendet werden
            
            # Für jetzt kopieren wir die Datei als Instrumental
            cmd_instrumental = [
                'ffmpeg',
                '-i', input_path,
                '-c:a', 'libmp3lame',
                '-b:a', '192k',
                '-y',
                instrumental_path
            ]
            
            cmd_vocals = [
                'ffmpeg',
                '-i', input_path,
                '-af', 'highpass=f=200',  # Einfacher Highpass-Filter
                '-c:a', 'libmp3lame',
                '-b:a', '192k',
                '-y',
                vocals_path
            ]
            
            logger.info(f"Trenne Audio mit FFmpeg (Fallback): {input_path}")
            
            # Führe beide Kommandos aus
            result1 = subprocess.run(cmd_instrumental, capture_output=True, text=True)
            result2 = subprocess.run(cmd_vocals, capture_output=True, text=True)
            
            if result1.returncode == 0 and result2.returncode == 0:
                logger.info(f"✅ Audio erfolgreich getrennt mit FFmpeg")
                return True
            else:
                logger.error(f"❌ FFmpeg-Separation fehlgeschlagen")
                return False
                
        except Exception as e:
            logger.error(f"Fehler bei FFmpeg-Separation: {e}")
            return False
    
    def rename_separated_files(self, meta: ProcessingMeta, base_name: str) -> bool:
        """
        Benennt die getrennten Dateien um
        
        Args:
            meta: ProcessingMeta-Objekt
            base_name: Basis-Name für die Dateien
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        try:
            renamed_files = []
            
            # Suche nach getrennten Dateien
            for file in os.listdir(meta.folder_path):
                file_path = meta.get_file_path(file)
                
                # HP2 (Instrumental)
                if file.endswith('_instrumental.mp3') or 'instrumental' in file.lower():
                    hp2_name = f"{base_name}.hp2.mp3"
                    hp2_path = meta.get_file_path(hp2_name)
                    os.rename(file_path, hp2_path)
                    meta.add_output_file(hp2_path)
                    meta.add_keep_file(hp2_name)
                    renamed_files.append(hp2_name)
                    logger.info(f"HP2 erstellt: {hp2_name}")
                
                # HP5 (Vocals)
                elif file.endswith('_vocals.mp3') or 'vocals' in file.lower():
                    hp5_name = f"{base_name}.hp5.mp3"
                    hp5_path = meta.get_file_path(hp5_name)
                    os.rename(file_path, hp5_path)
                    meta.add_output_file(hp5_path)
                    meta.add_keep_file(hp5_name)
                    renamed_files.append(hp5_name)
                    logger.info(f"HP5 erstellt: {hp5_name}")
                
                # Vocals (zusätzliche Datei)
                elif file.endswith('_vocals.wav'):
                    vocals_name = f"{base_name}.vocals.mp3"
                    vocals_path = meta.get_file_path(vocals_name)
                    
                    # Konvertiere WAV zu MP3
                    cmd = [
                        'ffmpeg',
                        '-i', file_path,
                        '-c:a', 'libmp3lame',
                        '-b:a', '192k',
                        '-y',
                        vocals_path
                    ]
                    
                    result = subprocess.run(cmd, capture_output=True, text=True)
                    if result.returncode == 0:
                        meta.add_output_file(vocals_path)
                        meta.add_keep_file(vocals_name)
                        renamed_files.append(vocals_name)
                        logger.info(f"Vocals erstellt: {vocals_name}")
                        
                        # Lösche WAV-Datei
                        os.remove(file_path)
            
            if renamed_files:
                logger.info(f"✅ {len(renamed_files)} Dateien erfolgreich umbenannt")
                return True
            else:
                logger.warning("Keine Dateien zum Umbenennen gefunden")
                return False
                
        except Exception as e:
            logger.error(f"Fehler beim Umbenennen der getrennten Dateien: {e}")
            return False
    
    def process_meta(self, meta: ProcessingMeta) -> bool:
        """
        Trennt Audio im Meta-Objekt
        
        Args:
            meta: ProcessingMeta-Objekt
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        log_start('audio_separation.process_meta', meta)
        send_processing_status(meta, 'separating')
        try:
            # Finde Audio-Quelle
            audio_source = self.find_audio_source(meta)
            if not audio_source:
                logger.error("Keine Audio-Quelle für Separation gefunden")
                meta.mark_step_failed('audio_separation')
                return False
            
            logger.info(f"Verwende Audio-Quelle: {audio_source}")
            meta.status = ProcessingStatus.IN_PROGRESS
            
            # Reduziere Gain falls nötig
            config = {**self.default_config, **self.config}
            # Stabiler Basisname: meta.base_filename, sonst vom audio_source abgeleitet
            if getattr(meta, 'base_filename', None):
                base_root = meta.base_filename
            else:
                base_name = Path(audio_source).stem
                if base_name.endswith('.extracted'):
                    base_root = base_name[:-10]
                elif base_name.endswith('.reduced'):
                    base_root = base_name[:-8]
                else:
                    base_root = base_name
            
            if config.get('gain_reduction', 0) > 0:
                # Benennung: [filename].reduced.mp3 (Suffixe nicht verkettet)
                reduced_name = f"{base_root}.reduced.mp3"
                reduced_path = meta.get_file_path(reduced_name)
                
                if not self.reduce_gain(audio_source, reduced_path, config['gain_reduction']):
                    logger.warning("Gain-Reduktion fehlgeschlagen, verwende Original")
                    reduced_path = audio_source
                    reduced_name = Path(audio_source).name
                else:
                    meta.add_temp_file(reduced_path)
            else:
                reduced_path = audio_source
                reduced_name = Path(audio_source).name
            
            # Trenne Audio
            model = config.get('model', 'HP2')
            separation_success = False
            
            # Versuche UVR5 zuerst
            if self.separate_with_uvr5(reduced_path, meta.folder_path, base_root):
                separation_success = True
            else:
                logger.warning("UVR5-Separation fehlgeschlagen, verwende FFmpeg-Fallback")
                # Fallback erzeugt direkt [base].hp2.mp3 und [base].hp5.mp3
                hp2 = meta.get_file_path(f"{base_root}.hp2.mp3")
                hp5 = meta.get_file_path(f"{base_root}.hp5.mp3")
                if self.separate_with_ffmpeg(reduced_path, meta.folder_path, base_root):
                    # Falls separate_with_ffmpeg andere Namen erzeugt hat, überspringen wir rename und prüfen vorhandene
                    # Trage erwartete Dateien ein, wenn vorhanden
                    if os.path.exists(hp2):
                        meta.add_output_file(hp2)
                        meta.add_keep_file(hp2)
                    if os.path.exists(hp5):
                        meta.add_output_file(hp5)
                        meta.add_keep_file(hp5)
                    separation_success = True
            
            if not separation_success:
                logger.error("Audio-Separation fehlgeschlagen")
                meta.mark_step_failed('audio_separation')
                meta.status = ProcessingStatus.FAILED
                send_processing_status(meta, 'failed')
                return False
            
            # Wenn Ziel-Dateien bereits vorhanden sind, direkt erfolgreich
            hp2 = meta.get_file_path(f"{base_root}.hp2.mp3")
            hp5 = meta.get_file_path(f"{base_root}.hp5.mp3")
            vocals = meta.get_file_path(f"{base_root}.vocals.mp3")
            if any(os.path.exists(p) for p in [hp2, hp5, vocals]):
                for p in [hp2, hp5, vocals]:
                    if os.path.exists(p):
                        meta.add_output_file(p)
                        meta.add_keep_file(os.path.basename(p))
                logger.info(f"✅ Audio erfolgreich getrennt für: {meta.artist} - {meta.title}")
                meta.mark_step_completed('audio_separation')
                meta.status = ProcessingStatus.COMPLETED
                return True
            
            # Benenne Dateien um mit stabilem Basisnamen (base_root) – falls Artefakte vorhanden
            if self.rename_separated_files(meta, base_root):
                logger.info(f"✅ Audio erfolgreich getrennt für: {meta.artist} - {meta.title}")
                meta.mark_step_completed('audio_separation')
                meta.status = ProcessingStatus.COMPLETED
                return True
            else:
                logger.error("Umbenennung der getrennten Dateien fehlgeschlagen")
                meta.mark_step_failed('audio_separation')
                meta.status = ProcessingStatus.FAILED
                send_processing_status(meta, 'failed')
                return False
                
        except Exception as e:
            logger.error(f"Fehler bei Audio-Separation: {e}")
            meta.mark_step_failed('audio_separation')
            meta.status = ProcessingStatus.FAILED
            send_processing_status(meta, 'failed')
            return False

def separate_audio(meta: ProcessingMeta) -> bool:
    """
    Convenience-Funktion für Audio-Separation
    
    Args:
        meta: ProcessingMeta-Objekt
        
    Returns:
        True wenn erfolgreich, False sonst
    """
    log_start('separate_audio', meta)
    separator = AudioSeparator()
    return separator.process_meta(meta)
