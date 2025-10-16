#!/usr/bin/env python3
"""
Audio Utils Module
Hilfsfunktionen für Audio-Datei-Operationen mit Fallback-Mechanismus
"""

import os
import logging
from pathlib import Path
from typing import Optional

from .meta import ProcessingMeta

logger = logging.getLogger(__name__)

def find_best_vocals_file(meta: ProcessingMeta) -> Optional[str]:
    """
    Findet die beste Vocals-Datei mit Fallback-Mechanismus
    Priorität: .dereverbed.mp3 > .vocals.mp3 > .hp5.mp3 > andere Audio-Dateien
    
    Args:
        meta: ProcessingMeta-Objekt
        
    Returns:
        Pfad zur besten Vocals-Datei oder None
    """
    audio_extensions = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.webm']
    
    # Suche nach dereverbed Vocals-Dateien (höchste Priorität)
    for file in os.listdir(meta.folder_path):
        if file.endswith('.dereverbed.mp3'):
            vocals_path = meta.get_file_path(file)
            logger.info(f"Verwende dereverbed Vocals: {file}")
            return vocals_path
    
    # Suche nach normalen Vocals-Dateien
    for file in os.listdir(meta.folder_path):
        if file.endswith('.vocals.mp3'):
            vocals_path = meta.get_file_path(file)
            logger.info(f"Verwende normale Vocals: {file}")
            return vocals_path
    
    # Suche nach HP5-Dateien
    for file in os.listdir(meta.folder_path):
        if file.endswith('.hp5.mp3'):
            vocals_path = meta.get_file_path(file)
            logger.info(f"Verwende HP5-Datei als Vocals: {file}")
            return vocals_path
    
    # Suche nach anderen Audio-Dateien
    for file in os.listdir(meta.folder_path):
        if any(file.lower().endswith(ext) for ext in audio_extensions):
            vocals_path = meta.get_file_path(file)
            logger.info(f"Verwende Audio-Datei als Vocals: {file}")
            return vocals_path
    
    logger.warning("Keine Vocals-Datei gefunden")
    return None

def find_best_audio_source(meta: ProcessingMeta) -> Optional[str]:
    """
    Findet die beste Audio-Quelle für Verarbeitung mit Fallback-Mechanismus
    Priorität: dereverbed.mp3 > normalized.mp3 > andere Audio-Dateien
    
    Args:
        meta: ProcessingMeta-Objekt
        
    Returns:
        Pfad zur besten Audio-Quelle oder None
    """
    audio_extensions = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.webm']
    
    # Suche nach dereverbed Datei (höchste Priorität)
    for file in os.listdir(meta.folder_path):
        if file.endswith('.dereverbed.mp3'):
            audio_path = meta.get_file_path(file)
            logger.info(f"Verwende dereverbed Audio: {file}")
            return audio_path
    
    # Wenn ein stabiler Basisname vorhanden ist, priorisiere [base].normalized.mp3
    if getattr(meta, 'base_filename', None):
        candidate = meta.get_file_path(f"{meta.base_filename}.normalized.mp3")
        if os.path.exists(candidate):
            logger.info(f"Verwende normalisierte Audio: {meta.base_filename}.normalized.mp3")
            return candidate
    
    # Suche nach normalisierter Datei (allgemein)
    for file in os.listdir(meta.folder_path):
        if file.endswith('.normalized.mp3'):
            audio_path = meta.get_file_path(file)
            logger.info(f"Verwende normalisierte Audio: {file}")
            return audio_path
    
    # Suche nach anderen Audio-Dateien
    for file in os.listdir(meta.folder_path):
        if any(file.lower().endswith(ext) for ext in audio_extensions):
            audio_path = meta.get_file_path(file)
            logger.info(f"Verwende Audio-Datei: {file}")
            return audio_path
    
    # Suche in Eingabedateien
    for file_path in meta.input_files:
        if any(file_path.lower().endswith(ext) for ext in audio_extensions):
            logger.info(f"Verwende Eingabe-Audio: {os.path.basename(file_path)}")
            return file_path
    
    logger.warning("Keine Audio-Quelle gefunden")
    return None

def get_base_filename_from_path(file_path: str) -> str:
    """
    Extrahiert den Basis-Dateinamen aus einem Pfad und entfernt bekannte Suffixe
    
    Args:
        file_path: Pfad zur Datei
        
    Returns:
        Bereinigter Basis-Name
    """
    base_name = Path(file_path).stem
    
    # Entferne bekannte Suffixe
    suffixes_to_remove = ['.extracted', '.reduced', '.normalized', '.vocals', '.dereverbed']
    for suffix in suffixes_to_remove:
        if base_name.endswith(suffix):
            base_name = base_name[:-len(suffix)]
            break
    
    return base_name
