#!/usr/bin/env python3
"""
Korrekte UVR5 Audio-Separation basierend auf dem Generator
"""

import os
import sys
import torch
import librosa
import soundfile as sf
import numpy as np
import logging
import subprocess
from pathlib import Path

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add UVR5 modules to path
current_dir = os.path.dirname(os.path.abspath(__file__))
uvr5_folder = os.path.join(current_dir, 'uvr5')
if os.path.isdir(uvr5_folder):
    sys.path.insert(0, uvr5_folder)
    logger.info(f"UVR5-Ordner '{uvr5_folder}' wurde dem sys.path hinzugefügt.")

# Set UVR5 weights environment variable
uvr5_weights_folder = os.path.join(current_dir, 'assets', 'uvr5_weights')
if os.path.isdir(uvr5_weights_folder):
    os.environ["weight_uvr5_root"] = uvr5_weights_folder
    logger.info(f"UVR5-Gewichtsordner '{uvr5_weights_folder}' wurde als Umgebungsvariable gesetzt.")

class UVR5Wrapper:
    """Eine Wrapper-Klasse für die UVR5-Funktionalität, die die verschiedenen Modelle vereinheitlicht."""
    
    def __init__(self, model_choice="HP2"):
        self.model_choice = model_choice
        
        # Verbesserte CUDA-Erkennung und Debugging-Ausgaben
        logger.info(f"PyTorch CUDA verfügbar: {torch.cuda.is_available()}")
        if torch.cuda.is_available():
            logger.info(f"CUDA Geräte: {torch.cuda.device_count()}")
            logger.info(f"Aktives CUDA-Gerät: {torch.cuda.current_device()}")
            logger.info(f"CUDA-Gerätename: {torch.cuda.get_device_name(0)}")
        
        # Stelle sicher, dass CUDA verwendet wird, wenn verfügbar
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.is_half = torch.cuda.is_available()
        
        logger.info(f"Verwende Gerät: {self.device}, Half-Precision: {self.is_half}")
        
        # Modellpfade aus dem korrekten Ordner
        model_filename = f"{model_choice}_all_vocals.pth"
        if model_choice == "HP5":
            model_filename = "HP5_only_main_vocal.pth"
            
        model_path = os.path.join(os.environ["weight_uvr5_root"], model_filename)
        
        if not os.path.isfile(model_path):
            logger.error(f"Modell {model_filename} nicht gefunden in {os.environ['weight_uvr5_root']}!")
            logger.info("Verfügbare Modelle:")
            for file in os.listdir(os.environ["weight_uvr5_root"]):
                if file.endswith(".pth"):
                    logger.info(f"  - {file}")
            raise FileNotFoundError(f"Modell {model_filename} nicht gefunden")
        
        logger.info(f"Verwende UVR5-Modell: {model_path}")
        
        # Setze CUDA-Cache für bessere Performance
        if torch.cuda.is_available():
            torch.backends.cudnn.benchmark = True
        
        # Importiere UVR5-Module
        try:
            # Füge lib_v5 zum Pfad hinzu
            lib_v5_path = os.path.join(uvr5_folder, 'lib_v5')
            if lib_v5_path not in sys.path:
                sys.path.insert(0, lib_v5_path)
            
            from vr import AudioPre, AudioPreDeEcho
            logger.info("UVR5-Module erfolgreich importiert.")
        except ImportError as e:
            logger.error(f"Fehler beim Import der UVR5-Module: {e}")
            raise
        
        # Je nach Modellwahl das entsprechende Modell initialisieren
        self.model = AudioPre(
            agg=10,
            model_path=model_path,
            device=self.device,
            is_half=self.is_half
        )
        
        # Überprüfe, ob das Modell auf dem richtigen Gerät ist
        if hasattr(self.model, 'device'):
            logger.info(f"Modell verwendet Gerät: {self.model.device}")
        
        # Überprüfe, ob das Modell half-precision verwendet
        if hasattr(self.model, 'is_half'):
            logger.info(f"Modell verwendet Half-Precision: {self.model.is_half}")
    
    def separate(self, audio_path):
        """Führt die Audio-Separation durch und gibt die Ergebnisse zurück."""
        try:
            # Erstelle temporäre Verzeichnisse für die Ausgabe
            temp_dir = os.path.dirname(audio_path)
            inst_dir = os.path.join(temp_dir, "separated", "instrumental")
            vocal_dir = os.path.join(temp_dir, "separated", "vocals")
            
            os.makedirs(inst_dir, exist_ok=True)
            os.makedirs(vocal_dir, exist_ok=True)
            
            logger.info(f"Führe UVR5-Separation durch für: {audio_path}")
            logger.info(f"Instrumental-Ordner: {inst_dir}")
            logger.info(f"Vocal-Ordner: {vocal_dir}")
            
            # Nutze die _path_audio_ Methode direkt
            self.model._path_audio_(audio_path, inst_dir, vocal_dir, format="wav")
            
            # Finde die generierten Dateien
            vocal_files = [f for f in os.listdir(vocal_dir) if f.endswith(".wav")]
            inst_files = [f for f in os.listdir(inst_dir) if f.endswith(".wav")]
            
            if not vocal_files or not inst_files:
                raise FileNotFoundError("Keine Ausgabedateien gefunden.")
            
            # Lade die Ausgabedateien zurück
            vocal_path = os.path.join(vocal_dir, vocal_files[0])
            inst_path = os.path.join(inst_dir, inst_files[0])
            
            logger.info(f"Vocal-Datei gefunden: {vocal_path}")
            logger.info(f"Instrumental-Datei gefunden: {inst_path}")
            
            # Nutze librosa zum Laden der Dateien
            vocal_data, sample_rate = librosa.load(vocal_path, sr=None, mono=False)
            inst_data, _ = librosa.load(inst_path, sr=None, mono=False)
            
            logger.info(f"Separation erfolgreich. Sample-Rate: {sample_rate}")
            logger.info(f"Vocal-Daten Shape: {vocal_data.shape}")
            logger.info(f"Instrumental-Daten Shape: {inst_data.shape}")
            
            return sample_rate, vocal_data, inst_data
            
        except Exception as e:
            logger.error(f"Fehler bei der UVR5 Separation: {e}")
            raise

def reduce_volume(input_audio, output_wav, reduction_db=-2):
    """Reduziert die Lautstärke der Eingabe-Audiodatei um reduction_db dB und speichert als WAV."""
    # Überprüfe, ob die Eingabedatei existiert
    if not os.path.isfile(input_audio):
        logger.error(f"Die Eingabedatei '{input_audio}' existiert nicht.")
        return False
    
    # Stelle sicher, dass der Ausgabeordner existiert
    output_dir = os.path.dirname(output_wav)
    if output_dir and not os.path.exists(output_dir):
        try:
            os.makedirs(output_dir, exist_ok=True)
            logger.info(f"Ordner '{output_dir}' erstellt.")
        except Exception as e:
            logger.error(f"Fehler beim Erstellen des Ordners '{output_dir}': {e}")
            return False
    
    # FFmpeg-Pfad
    ffmpeg_path = os.path.join(os.path.dirname(__file__), 'ffmpeg.exe')
    if not os.path.exists(ffmpeg_path):
        ffmpeg_path = 'ffmpeg'  # Fallback auf System-FFmpeg
    
    # Verbesserte ffmpeg-Befehlszeile mit expliziten Audio-Parametern
    cmd = [
        ffmpeg_path, "-y", "-i", input_audio,
        "-filter:a", f"volume={reduction_db}dB",
        "-ar", "44100",  # Explizite Sample-Rate
        "-ac", "2",      # Stereo-Ausgabe
        "-acodec", "pcm_s16le",  # 16-bit PCM-Kodierung
        output_wav
    ]
    
    logger.info(f"Reduziere Lautstärke von '{input_audio}' und konvertiere in WAV...")
    
    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        if result.stdout:
            logger.info(f"FFmpeg-Ausgabe: {result.stdout[:500]}...")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"Fehler beim Ausführen des Befehls: {e}")
        if e.stdout:
            logger.error(f"Ausgabe: {e.stdout[:500]}...")
        if e.stderr:
            logger.error(f"Fehlerausgabe: {e.stderr[:500]}...")
        return False
    except Exception as e:
        logger.error(f"Unerwarteter Fehler beim Ausführen des Befehls: {e}")
        return False

def convert_to_mp3(input_wav, output_mp3):
    """Konvertiert eine WAV-Datei in MP3 mithilfe von ffmpeg."""
    # Überprüfe, ob die Eingabedatei existiert
    if not os.path.isfile(input_wav):
        logger.error(f"Die Eingabedatei '{input_wav}' existiert nicht.")
        return False
    
    # Stelle sicher, dass der Ausgabeordner existiert
    output_dir = os.path.dirname(output_mp3)
    if output_dir and not os.path.exists(output_dir):
        try:
            os.makedirs(output_dir, exist_ok=True)
            logger.info(f"Ordner '{output_dir}' erstellt.")
        except Exception as e:
            logger.error(f"Fehler beim Erstellen des Ordners '{output_dir}': {e}")
            return False
    
    # FFmpeg-Pfad
    ffmpeg_path = os.path.join(os.path.dirname(__file__), 'ffmpeg.exe')
    if not os.path.exists(ffmpeg_path):
        ffmpeg_path = 'ffmpeg'  # Fallback auf System-FFmpeg
    
    # Verbesserte ffmpeg-Befehlszeile mit expliziten Audio-Parametern
    cmd = [
        ffmpeg_path, "-y", 
        "-i", input_wav,
        "-codec:a", "libmp3lame",
        "-qscale:a", "2",  # Hohe Qualität (0-9, wobei 0 die beste Qualität ist)
        "-ar", "44100",    # Explizite Sample-Rate
        output_mp3
    ]
    
    logger.info("Konvertiere Instrumental-WAV in MP3...")
    
    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        logger.info("FFmpeg-Befehl erfolgreich ausgeführt")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"Fehler bei der Ausführung von ffmpeg: {e}")
        if e.stdout:
            logger.error(f"ffmpeg-Ausgabe: {e.stdout}")
        if e.stderr:
            logger.error(f"ffmpeg-Fehlerausgabe: {e.stderr}")
        return False

def separate_audio_with_uvr5_correct(folder_path, model_type='HP2'):
    """Hauptfunktion für die Audio-Separation mit korrekter UVR5-Implementierung."""
    try:
        # Finde die Haupt-Audio-Datei
        audio_extensions = ['.mp3', '.flac', '.ogg', '.wav', '.m4a', '.aac']
        audio_file = None
        
        for file in os.listdir(folder_path):
            file_path = os.path.join(folder_path, file)
            if os.path.isfile(file_path):
                name, ext = os.path.splitext(file)
                if ext.lower() in audio_extensions:
                    # Prüfe, ob es nicht bereits eine getrennte Datei ist
                    if not any(suffix in name.lower() for suffix in ['hp2', 'hp5', 'vocals', 'instrumental']):
                        audio_file = file_path
                        break
        
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
        output_file = os.path.join(folder_path, f"{base_name}.{model_type.lower()}.mp3")
        
        # Speichere die Instrumental-Daten als MP3
        logger.info(f"Speichere Instrumental-Audio als: {output_file}")
        
        # Konvertiere zu MP3
        if not convert_to_mp3(temp_file.replace('.wav', '_instrumental.wav'), output_file):
            # Fallback: Speichere direkt mit librosa
            logger.info("Fallback: Speichere direkt mit librosa")
            sf.write(output_file.replace('.mp3', '_temp.wav'), inst_data.T, sample_rate)
            convert_to_mp3(output_file.replace('.mp3', '_temp.wav'), output_file)
            os.remove(output_file.replace('.mp3', '_temp.wav'))
        
        # Bereinige temporäre Dateien
        if os.path.exists(temp_file):
            os.remove(temp_file)
        
        # Bereinige UVR5-Ausgabe-Ordner
        separated_dir = os.path.join(folder_path, "separated")
        if os.path.exists(separated_dir):
            import shutil
            shutil.rmtree(separated_dir)
        
        logger.info(f"Instrumental-Audio erfolgreich gespeichert: {output_file}")
        return output_file
        
    except Exception as e:
        logger.error(f"Fehler in separate_audio_with_uvr5_correct: {e}")
        # Bereinige temporäre Dateien
        temp_file = os.path.join(folder_path, f"temp_volume_reduced_{model_type}.wav")
        if os.path.exists(temp_file):
            os.remove(temp_file)
        
        separated_dir = os.path.join(folder_path, "separated")
        if os.path.exists(separated_dir):
            import shutil
            shutil.rmtree(separated_dir)
        
        raise

if __name__ == "__main__":
    # Test-Funktion
    test_folder = r"..\songs\ultrastar\3 Doors Down - Kryptonite"
    try:
        result = separate_audio_with_uvr5_correct(test_folder, "HP2")
        print(f"Erfolgreich: {result}")
    except Exception as e:
        print(f"Fehler: {e}")
