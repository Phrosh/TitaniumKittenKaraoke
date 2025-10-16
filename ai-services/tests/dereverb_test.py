#!/usr/bin/env python3
"""
Testskript für Dereverb (UVR5 MDXNet)

Beispielaufruf (PowerShell):
  python ai-services/tests/dereverb_test.py "D:\\Arbeit\\Karaoke\\songs\\magic-youtube\\WIND ROSE - Drunken Dwarves _ Napalm Records\\f4azillbpqU.vocals.mp3"

Optionale Umgebungsvariablen:
  UVR5_STRICT_CUDA=1          # erzwingt reinen CUDA-Betrieb (kein Fallback)
  UVR5_CUDA_DEVICE_ID=0       # wählt die GPU (Standard 0)
"""

import os
import sys
import logging
from pathlib import Path

# Logging konfigurieren
logging.basicConfig(level=logging.INFO, format='%(levelname)s:%(name)s:%(message)s')
logger = logging.getLogger("dereverb_test")

def main():
    if len(sys.argv) < 2:
        print("Usage: python ai-services/tests/dereverb_test.py <path-to-audio>")
        sys.exit(1)

    audio_path = Path(sys.argv[1]).resolve()
    if not audio_path.exists():
        print(f"File not found: {audio_path}")
        sys.exit(2)

    # Projektwurzel ableiten (dieses Skript liegt unter ai-services/tests)
    script_dir = Path(__file__).resolve().parent
    ai_services_dir = script_dir.parent
    project_root = ai_services_dir.parent

    # Für modulare Imports sicherstellen, dass ai-services im Pfad liegt
    if str(ai_services_dir) not in sys.path:
        sys.path.insert(0, str(ai_services_dir))

    # Imports aus den Modulen
    from modules.meta import create_meta_from_file_path, ProcessingMode
    from modules.audio_dereverb import AudioDereverb

    # Meta aus dem Datei-/Ordnerpfad erstellen
    meta = create_meta_from_file_path(str(audio_path), base_dir=str(project_root / 'songs' / 'magic-youtube'), mode=ProcessingMode.MAGIC_YOUTUBE)

    # base_filename stabilisieren, falls möglich
    try:
        if not getattr(meta, 'base_filename', None):
            # Basisname aus der Vocals-Datei ableiten (Suffixe entfernen übernimmt das Modul intern auch)
            meta.base_filename = audio_path.stem.replace('.vocals', '')
    except Exception:
        pass

    # Ausgabeordner ist der Ordner der Datei
    meta.folder_name = audio_path.parent.name
    meta.folder_path = str(audio_path.parent)

    logger.info(f"Input: {audio_path}")
    logger.info(f"Folder: {meta.folder_path}")

    # Dereverb ausführen
    dereverb = AudioDereverb()
    ok = dereverb.process_meta(meta)

    # Ergebnis protokollieren
    out_main = Path(meta.folder_path) / f"{meta.base_filename}.dereverbed.mp3"
    out_others = Path(meta.folder_path) / f"{meta.base_filename}.others.mp3"
    if ok and out_main.exists():
        logger.info(f"✅ Dereverbed erstellt: {out_main}")
    else:
        logger.error("❌ Dereverb fehlgeschlagen oder Ausgabedatei nicht gefunden")
    if out_others.exists():
        logger.info(f"ℹ️ Others erstellt: {out_others}")

if __name__ == '__main__':
    main()


