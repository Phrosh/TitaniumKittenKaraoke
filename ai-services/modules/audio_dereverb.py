#!/usr/bin/env python3
"""
Audio Dereverb Module
Entfernt Reverb und Echo aus Vocals-Audio mit UVR5 MDXNetDereverb
"""

import os
import logging
from pathlib import Path
from typing import Optional, Dict, Any

from .meta import ProcessingMeta, ProcessingStatus
from .logger_utils import log_start, send_processing_status

logger = logging.getLogger(__name__)

class AudioDereverb:
    """Audio-Dereverb mit UVR5 MDXNetDereverb für Reverb/Echo-Entfernung"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialisiert den Audio-Dereverb
        
        Args:
            config: Konfiguration für Dereverb
        """
        self.config = config or {}
        self.default_config = {
            # Backend-Auswahl: 'onnx' (MDXNet) oder 'vr' (PyTorch .pth)
            'backend': 'vr',  # Verwende VR/PyTorch Backend für bessere CUDA-Kompatibilität
            # ONNX (MDXNet)
            'model': 'onnx_dereverb_By_FoxJoy',
            'chunks': 15,
            # VR/PyTorch (.pth) – absoluter Pfad zu RVC-Modell
            'vr_model_path': r'J:\Karaoke\Tools\RVC1006Nvidia\assets\uvr5_weights\VR-DeEchoDeReverb.pth',
            'agg': 5,  # Reduzierte Aggressivität für bessere Vocals-Qualität
            # Allgemein
            'output_format': 'mp3',
            'device': 'auto',  # 'auto', 'cuda', 'cpu'
            'denoise': True,
            'margin': 44100,
            'shifts': 10,
            'mixing': 'min_mag'
        }
        
        self.dereverb_model = None
        self.model_name = None
    
    def _load_model(self, model_name: str, device: str):
        """
        Lädt das Dereverb-Modell
        
        Args:
            model_name: Name des Dereverb-Modells
            device: Device für Verarbeitung
        """
        if self.dereverb_model is None or self.model_name != model_name:
            config = {**self.default_config, **self.config}
            backend = str(config.get('backend', 'onnx')).lower()
            try:
                import sys
                current_dir = os.path.dirname(os.path.abspath(__file__))
                uvr5_path = os.path.join(current_dir, '..', 'uvr5')
                if uvr5_path not in sys.path:
                    sys.path.insert(0, uvr5_path)

                if backend == 'vr':
                    # VR/PyTorch Backend (AudioPreDeEcho), nutzt .pth Models
                    from vr import AudioPreDeEcho
                    import torch
                    # Modellpfad auflösen
                    vr_model_path = config.get('vr_model_path') or ''
                    if vr_model_path and not os.path.isabs(vr_model_path):
                        vr_model_path = os.path.abspath(os.path.join(current_dir, '..', 'assets', 'uvr5_weights', vr_model_path))
                    if not vr_model_path or not os.path.exists(vr_model_path):
                        raise FileNotFoundError(f"VR model (.pth) not found: {vr_model_path}")

                    is_cuda = (device == 'cuda') and torch.cuda.is_available()
                    is_half = bool(is_cuda)
                    agg = int(config.get('agg', 10))

                    logger.info(f"Lade VR Dereverb (.pth) '{os.path.basename(vr_model_path)}' auf {('cuda' if is_cuda else 'cpu')} (half={is_half})")
                    self.dereverb_model = AudioPreDeEcho(
                        agg=agg,
                        model_path=vr_model_path,
                        device=('cuda' if is_cuda else 'cpu'),
                        is_half=is_half,
                        tta=False,
                    )
                    self.model_name = f"vr::{os.path.basename(vr_model_path)}"
                    logger.info(f"✅ VR Dereverb-Modell geladen: {self.model_name}")
                else:
                    # ONNX/MDXNet Backend
                    from mdxnet import MDXNetDereverb
                    chunks = config.get('chunks', 15)
                    logger.info(f"Lade ONNX Dereverb '{model_name}' auf {device}")
                    self.dereverb_model = MDXNetDereverb(chunks=chunks, device=device)
                    self.model_name = model_name
                    logger.info(f"✅ Dereverb-Modell '{model_name}' erfolgreich geladen")

            except Exception as e:
                logger.error(f"Fehler beim Laden des Dereverb-Modells: {e}")
                raise
    
    def find_vocals_file(self, meta: ProcessingMeta) -> Optional[str]:
        """
        Findet die beste Vocals-Datei für Dereverb
        
        Args:
            meta: ProcessingMeta-Objekt
            
        Returns:
            Pfad zur Vocals-Datei oder None
        """
        # Suche nach .vocals.mp3 Datei
        for file in os.listdir(meta.folder_path):
            if file.endswith('.vocals.mp3'):
                return meta.get_file_path(file)
        
        # Fallback: Suche nach anderen Audio-Dateien
        audio_extensions = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.webm']
        for file in os.listdir(meta.folder_path):
            if any(file.lower().endswith(ext) for ext in audio_extensions):
                return meta.get_file_path(file)
        
        return None
    
    def _normalize_audio(self, input_path: str, output_dir: str, base_name: str) -> Optional[str]:
        """
        Normalisiert eine Audio-Datei vor der Dereverb-Verarbeitung
        
        Args:
            input_path: Eingabedatei
            output_dir: Ausgabeordner
            base_name: Basis-Name für Ausgabedateien
            
        Returns:
            Pfad zur normalisierten Datei oder None bei Fehler
        """
        try:
            import librosa
            import soundfile as sf
            import numpy as np
            
            logger.info(f"Normalisiere Audio: {input_path}")
            
            # Lade Audio
            audio, sr = librosa.load(input_path, sr=None, mono=False)
            
            # Konvertiere zu Mono falls Stereo
            if audio.ndim > 1:
                audio = librosa.to_mono(audio)
            
            # Normalisiere Lautstärke (Peak-Normalisierung auf -3dB)
            peak = np.max(np.abs(audio))
            if peak > 0:
                target_peak = 0.7  # -3dB
                audio = audio * (target_peak / peak)
            
            # Erstelle normalisierte Datei
            normalized_path = os.path.join(output_dir, f"{base_name}.normalized_for_dereverb.wav")
            sf.write(normalized_path, audio, sr)
            
            logger.info(f"✅ Audio normalisiert: {normalized_path}")
            return normalized_path
            
        except Exception as e:
            logger.error(f"Fehler bei Audio-Normalisierung: {e}")
            return None
    
    def dereverb_audio(self, input_path: str, output_dir: str, base_name: str, format: str = 'mp3', meta: Optional[ProcessingMeta] = None) -> bool:
        """
        Entfernt Reverb/Echo aus einer Audio-Datei
        
        Args:
            input_path: Eingabedatei
            output_dir: Ausgabeordner
            base_name: Basis-Name für Ausgabedateien
            format: Ausgabeformat
            meta: ProcessingMeta-Objekt für Dokumentation (optional)
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        try:
            config = {**self.default_config, **self.config}
            model_name = config.get('model', 'onnx_dereverb_By_FoxJoy')
            
            # Bestimme Device
            device = config.get('device', 'auto')
            if device == 'auto':
                import torch
                device = 'cuda' if torch.cuda.is_available() else 'cpu'
            
            # Lade Modell
            self._load_model(model_name, device)
            
            logger.info(f"Dereverb-Verarbeitung: {input_path}")
            
            # Normalisiere Eingabedatei vor Dereverbing
            normalized_input = self._normalize_audio(input_path, output_dir, base_name)
            if not normalized_input:
                logger.warning("Audio-Normalisierung fehlgeschlagen, verwende Original")
                normalized_input = input_path
            else:
                logger.info(f"✅ Audio normalisiert: {normalized_input}")
            
            # Erstelle temporäre Ordner für Dereverb-Ausgabe
            vocal_root = os.path.join(output_dir, 'dereverb_vocals')
            others_root = os.path.join(output_dir, 'dereverb_others')
            os.makedirs(vocal_root, exist_ok=True)
            os.makedirs(others_root, exist_ok=True)
            
            # Führe Dereverb-Verarbeitung durch – abhängig vom Backend
            backend = str(config.get('backend', 'onnx')).lower()
            if backend == 'vr':
                # VR/PyTorch Backend
                # Für reine Vocals-Eingabe: Das Backend trennt in "vocals" (Reverb) und "instruments" (eigentliche Vocals)
                # Da unsere Eingabe nur Vocals enthält, wollen wir die "instruments" Ausgabe (die eigentlichen Vocals)
                logger.info("Verwende VR-Backend für reine Vocals-Verarbeitung")
                try:
                    # Verwende ins_root für die eigentlichen Vocals (ohne Reverb)
                    self.dereverb_model._path_audio_(normalized_input, vocal_root=None, ins_root=vocal_root, format=format, is_hp3=False)
                except TypeError:
                    # Fallback für ältere Signaturen
                    self.dereverb_model._path_audio_(normalized_input, None, vocal_root, format)
            else:
                # ONNX/MDXNet Backend
                self.dereverb_model._path_audio_(normalized_input, vocal_root, others_root, format)
            
            # Prüfe Ergebnisse und konvertiere zu finalen Dateien
            success = self._process_dereverb_output(vocal_root, others_root, output_dir, base_name, format)
            
            # Dokumentiere erzeugte Dateien und Ordner im Meta-Objekt
            if success and meta:
                # .dereverbed.mp3 Datei als temporär markieren (wird vom Cleanup gelöscht)
                dereverbed_file = os.path.join(output_dir, f"{base_name}.dereverbed.mp3")
                if os.path.exists(dereverbed_file):
                    meta.add_output_file(dereverbed_file)
                    meta.add_temp_file(dereverbed_file)
                    logger.info(f"📝 Dereverbed-Datei als temporär dokumentiert: {base_name}.dereverbed.mp3")
            
            # Dokumentiere temporäre Ordner für Cleanup
            if meta:
                if os.path.exists(vocal_root):
                    meta.add_temp_file(vocal_root)
                    logger.debug(f"📝 Temporärer Ordner dokumentiert: {vocal_root}")
                if os.path.exists(others_root):
                    meta.add_temp_file(others_root)
                    logger.debug(f"📝 Temporärer Ordner dokumentiert: {others_root}")
            
            # Aufräumen: Lösche temporäre normalisierte Datei
            if normalized_input != input_path and os.path.exists(normalized_input):
                try:
                    os.remove(normalized_input)
                    logger.debug(f"🗑️ Temporäre normalisierte Datei gelöscht: {normalized_input}")
                except Exception as e:
                    logger.warning(f"Konnte temporäre Datei nicht löschen: {e}")
            
            if success:
                logger.info(f"✅ Dereverb erfolgreich abgeschlossen: {base_name}")
                return True
            else:
                logger.error(f"❌ Dereverb-Verarbeitung fehlgeschlagen: {base_name}")
                return False
                
        except Exception as e:
            logger.error(f"Fehler bei Dereverb-Verarbeitung: {e}")
            return False
    
    def _process_dereverb_output(self, vocal_root: str, others_root: str, output_dir: str, base_name: str, format: str) -> bool:
        """
        Verarbeitet die Dereverb-Ausgabe und erstellt finale Dateien
        
        Args:
            vocal_root: Ordner mit dereverbed Vocals
            others_root: Ordner mit anderen Komponenten
            output_dir: Finaler Ausgabeordner
            base_name: Basis-Name für Dateien
            format: Ausgabeformat
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        try:
            success = False
            
            # Suche nach dereverbed Vocals (verschiedene mögliche Namen)
            vocal_files = []
            if os.path.exists(vocal_root):
                for file in os.listdir(vocal_root):
                    # VR-Backend erstellt verschiedene Dateinamen
                    # Für reine Vocals-Eingabe: "instrument" Dateien enthalten die eigentlichen Vocals (ohne Reverb)
                    if (file.endswith('_main_vocal.wav') or file.endswith('_main_vocal.flac') or
                        file.endswith('_vocal.wav') or file.endswith('_vocal.flac') or
                        file.endswith('_vocals.wav') or file.endswith('_vocals.flac') or
                        file.endswith('_vocal_10.wav') or file.endswith('_vocal_10.flac') or
                        file.endswith('_vocal_10.mp3') or file.endswith('_vocals.mp3') or
                        file.endswith('_instrument.wav') or file.endswith('_instrument.flac') or
                        file.endswith('_instrument_10.wav') or file.endswith('_instrument_10.flac') or
                        file.endswith('_instrument_10.mp3') or file.endswith('_instrument.mp3')):
                        vocal_files.append(os.path.join(vocal_root, file))
                        logger.debug(f"Gefundene Vocals-Datei: {file}")
            
            # Konvertiere zu MP3 falls nötig
            if vocal_files:
                input_vocal = vocal_files[0]
                output_vocal = os.path.join(output_dir, f"{base_name}.dereverbed.mp3")
                
                logger.info(f"Verarbeite {os.path.basename(input_vocal)} zu {os.path.basename(output_vocal)}")
                
                # Wenn bereits MP3, kopiere direkt
                if input_vocal.lower().endswith('.mp3'):
                    import shutil
                    try:
                        shutil.copy2(input_vocal, output_vocal)
                        success = True
                        logger.info(f"✅ Dereverbed Vocals kopiert: {output_vocal}")
                    except Exception as e:
                        logger.error(f"❌ Kopieren der MP3-Datei fehlgeschlagen: {e}")
                else:
                    # Konvertiere von WAV/FLAC zu MP3
                    if self._convert_to_mp3(input_vocal, output_vocal):
                        success = True
                        logger.info(f"✅ Dereverbed Vocals konvertiert: {output_vocal}")
                    else:
                        logger.error(f"❌ Konvertierung der dereverbed Vocals fehlgeschlagen")
            else:
                logger.error(f"❌ Keine Vocals-Dateien in {vocal_root} gefunden")
                # Debug: Liste alle Dateien im Ordner
                if os.path.exists(vocal_root):
                    all_files = os.listdir(vocal_root)
                    logger.info(f"🔍 Alle Dateien in {vocal_root}: {all_files}")
                    
                    # Versuche alle Audio-Dateien zu finden
                    audio_files = [f for f in all_files if f.lower().endswith(('.wav', '.mp3', '.flac'))]
                    if audio_files:
                        logger.info(f"🎵 Gefundene Audio-Dateien: {audio_files}")
                        # Verwende die erste Audio-Datei als Fallback
                        input_vocal = os.path.join(vocal_root, audio_files[0])
                        output_vocal = os.path.join(output_dir, f"{base_name}.dereverbed.mp3")
                        
                        logger.info(f"🔄 Fallback: Verwende {audio_files[0]} als Vocals-Datei")
                        
                        if input_vocal.lower().endswith('.mp3'):
                            import shutil
                            try:
                                shutil.copy2(input_vocal, output_vocal)
                                success = True
                                logger.info(f"✅ Dereverbed Vocals (Fallback) kopiert: {output_vocal}")
                            except Exception as e:
                                logger.error(f"❌ Fallback-Kopieren fehlgeschlagen: {e}")
                        else:
                            if self._convert_to_mp3(input_vocal, output_vocal):
                                success = True
                                logger.info(f"✅ Dereverbed Vocals (Fallback) konvertiert: {output_vocal}")
                            else:
                                logger.error(f"❌ Fallback-Konvertierung fehlgeschlagen")
            
            return success
            
        except Exception as e:
            logger.error(f"Fehler bei Dereverb-Ausgabe-Verarbeitung: {e}")
            return False
    
    def _convert_to_mp3(self, input_path: str, output_path: str) -> bool:
        """
        Konvertiert eine Audio-Datei zu MP3
        
        Args:
            input_path: Eingabedatei
            output_path: Ausgabedatei
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        try:
            import subprocess
            
            # Normalisiere Pfade für Windows-Kompatibilität
            input_path = os.path.normpath(input_path)
            output_path = os.path.normpath(output_path)
            
            cmd = [
                'ffmpeg',
                '-i', input_path,
                '-c:a', 'libmp3lame',
                '-b:a', '192k',
                '-y',
                output_path
            ]
            
            logger.debug(f"FFmpeg-Kommando: {' '.join(cmd)}")
            
            result = subprocess.run(cmd, capture_output=True, text=True, shell=False)
            
            if result.returncode == 0 and os.path.exists(output_path):
                logger.debug(f"FFmpeg-Konvertierung erfolgreich: {output_path}")
                return True
            else:
                logger.error(f"FFmpeg-Konvertierung fehlgeschlagen (Code {result.returncode}): {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Fehler bei MP3-Konvertierung: {e}")
            return False
    
    def process_meta(self, meta: ProcessingMeta) -> bool:
        """
        Entfernt Reverb/Echo aus Vocals im Meta-Objekt
        
        Args:
            meta: ProcessingMeta-Objekt
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        log_start('audio_dereverb.process_meta', meta)
        send_processing_status(meta, 'dereverbing')
        
        try:
            # Finde Vocals-Datei
            vocals_file = self.find_vocals_file(meta)
            if not vocals_file:
                logger.error("Keine Vocals-Datei für Dereverb gefunden")
                meta.mark_step_failed('audio_dereverb')
                return False
            
            logger.info(f"Verwende Vocals-Datei: {vocals_file}")
            meta.status = ProcessingStatus.IN_PROGRESS
            
            # Bestimme Basis-Name für Ausgabedateien
            if getattr(meta, 'base_filename', None):
                base_name = meta.base_filename
            else:
                base_name = Path(vocals_file).stem
                # Entferne .vocals Suffix falls vorhanden
                if base_name.endswith('.vocals'):
                    base_name = base_name[:-7]
            
            # Führe Dereverb-Verarbeitung durch
            config = {**self.default_config, **self.config}
            output_format = config.get('output_format', 'mp3')
            
            if not self.dereverb_audio(vocals_file, meta.folder_path, base_name, output_format, meta):
                logger.error("Dereverb-Verarbeitung fehlgeschlagen")
                meta.mark_step_failed('audio_dereverb')
                meta.status = ProcessingStatus.FAILED
                send_processing_status(meta, 'failed')
                return False
            
            # Die Meta-Dokumentation erfolgt bereits in dereverb_audio()
            # Prüfe nur ob die finale Datei existiert
            dereverbed_file = meta.get_file_path(f"{base_name}.dereverbed.mp3")
            
            if os.path.exists(dereverbed_file):
                logger.info(f"✅ Dereverbed Vocals erstellt: {base_name}.dereverbed.mp3")
                logger.info(f"✅ Audio-Dereverb erfolgreich abgeschlossen für: {meta.artist} - {meta.title}")
                meta.mark_step_completed('audio_dereverb')
                meta.status = ProcessingStatus.COMPLETED
                return True
            else:
                logger.error("Dereverbed-Datei wurde nicht erstellt")
                meta.mark_step_failed('audio_dereverb')
                meta.status = ProcessingStatus.FAILED
                send_processing_status(meta, 'failed')
                return False
            
        except Exception as e:
            logger.error(f"Fehler bei Audio-Dereverb: {e}")
            meta.mark_step_failed('audio_dereverb')
            meta.status = ProcessingStatus.FAILED
            send_processing_status(meta, 'failed')
            return False

def dereverb_audio(meta: ProcessingMeta) -> bool:
    """
    Convenience-Funktion für Audio-Dereverb
    
    Args:
        meta: ProcessingMeta-Objekt
        
    Returns:
        True wenn erfolgreich, False sonst
    """
    log_start('dereverb_audio', meta)
    dereverb = AudioDereverb()
    return dereverb.process_meta(meta)
