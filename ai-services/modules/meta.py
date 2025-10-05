#!/usr/bin/env python3
"""
Meta-Objekt für modulare Audio/Video-Verarbeitung
Enthält alle wichtigen Informationen und Metadaten für die Verarbeitung
"""

import os
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from enum import Enum

class ProcessingMode(Enum):
    """Verfügbare Verarbeitungsmodi"""
    YOUTUBE_CACHE = "youtube_cache"
    ULTRASTAR = "ultrastar"
    MAGIC_SONGS = "magic_songs"
    MAGIC_VIDEOS = "magic_videos"
    MAGIC_YOUTUBE = "magic_youtube"
    FILE = "file"
    SERVER_VIDEO = "server_video"

class ProcessingStatus(Enum):
    """Status der Verarbeitung"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"

@dataclass
class ProcessingMeta:
    """
    Meta-Objekt für die Verarbeitung von Audio/Video-Dateien
    Enthält alle wichtigen Informationen und verfolgt den Verarbeitungsfortschritt
    """
    
    # Grundlegende Informationen
    artist: str
    title: str
    mode: ProcessingMode
    
    # Pfade und Dateien
    base_dir: str  # Basis-Verzeichnis (z.B. songs/magic-youtube)
    folder_name: str  # Ordnername (z.B. "Artist - Title")
    folder_path: str  # Vollständiger Pfad zum Ordner
    
    # URLs und Links
    youtube_url: Optional[str] = None
    usdb_url: Optional[str] = None
    
    # Verarbeitungsstatus
    status: ProcessingStatus = ProcessingStatus.PENDING
    
    # Dateien-Tracking
    input_files: List[str] = field(default_factory=list)  # Eingabedateien
    output_files: List[str] = field(default_factory=list)  # Ausgabedateien
    temp_files: List[str] = field(default_factory=list)  # Temporäre Dateien
    keep_files: List[str] = field(default_factory=list)  # Zu behaltende Dateien
    
    # Verarbeitungsschritte
    steps_completed: List[str] = field(default_factory=list)
    steps_failed: List[str] = field(default_factory=list)
    
    # Metadaten
    metadata: Dict[str, Any] = field(default_factory=dict)

    # Stabiler Basis-Dateiname für generierte Outputs (ohne Suffixe/Endungen)
    base_filename: Optional[str] = None
    
    # Konfiguration
    config: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        """Initialisierung nach der Erstellung"""
        if not self.folder_path:
            self.folder_path = os.path.join(self.base_dir, self.folder_name)
        
        # Erstelle Ordner falls er nicht existiert
        os.makedirs(self.folder_path, exist_ok=True)
    
    def add_input_file(self, file_path: str):
        """Fügt eine Eingabedatei hinzu"""
        if file_path not in self.input_files:
            self.input_files.append(file_path)
    
    def add_output_file(self, file_path: str):
        """Fügt eine Ausgabedatei hinzu"""
        if file_path not in self.output_files:
            self.output_files.append(file_path)
    
    def add_temp_file(self, file_path: str):
        """Fügt eine temporäre Datei hinzu"""
        if file_path not in self.temp_files:
            self.temp_files.append(file_path)
    
    def add_keep_file(self, file_path: str):
        """Fügt eine zu behaltende Datei hinzu"""
        if file_path not in self.keep_files:
            self.keep_files.append(file_path)
    
    def mark_step_completed(self, step_name: str):
        """Markiert einen Schritt als abgeschlossen"""
        if step_name not in self.steps_completed:
            self.steps_completed.append(step_name)
        if step_name in self.steps_failed:
            self.steps_failed.remove(step_name)
    
    def mark_step_failed(self, step_name: str):
        """Markiert einen Schritt als fehlgeschlagen"""
        if step_name not in self.steps_failed:
            self.steps_failed.append(step_name)
        if step_name in self.steps_completed:
            self.steps_completed.remove(step_name)
    
    def get_file_path(self, filename: str) -> str:
        """Gibt den vollständigen Pfad zu einer Datei zurück"""
        return os.path.join(self.folder_path, filename)
    
    def file_exists(self, filename: str) -> bool:
        """Prüft ob eine Datei existiert"""
        return os.path.exists(self.get_file_path(filename))
    
    def get_relative_path(self, file_path: str) -> str:
        """Gibt den relativen Pfad zur Basis zurück"""
        return os.path.relpath(file_path, self.base_dir)
    
    def update_metadata(self, key: str, value: Any):
        """Aktualisiert Metadaten"""
        self.metadata[key] = value
    
    def get_metadata(self, key: str, default: Any = None) -> Any:
        """Holt Metadaten"""
        return self.metadata.get(key, default)
    
    def to_dict(self) -> Dict[str, Any]:
        """Konvertiert das Objekt zu einem Dictionary"""
        return {
            'artist': self.artist,
            'title': self.title,
            'mode': self.mode.value,
            'base_dir': self.base_dir,
            'folder_name': self.folder_name,
            'folder_path': self.folder_path,
            'youtube_url': self.youtube_url,
            'usdb_url': self.usdb_url,
            'status': self.status.value,
            'input_files': self.input_files,
            'output_files': self.output_files,
            'temp_files': self.temp_files,
            'keep_files': self.keep_files,
            'steps_completed': self.steps_completed,
            'steps_failed': self.steps_failed,
            'metadata': self.metadata,
            'config': self.config
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ProcessingMeta':
        """Erstellt ein Objekt aus einem Dictionary"""
        meta = cls(
            artist=data['artist'],
            title=data['title'],
            mode=ProcessingMode(data['mode']),
            base_dir=data['base_dir'],
            folder_name=data['folder_name'],
            folder_path=data['folder_path'],
            youtube_url=data.get('youtube_url'),
            usdb_url=data.get('usdb_url'),
            status=ProcessingStatus(data.get('status', 'pending'))
        )
        
        meta.input_files = data.get('input_files', [])
        meta.output_files = data.get('output_files', [])
        meta.temp_files = data.get('temp_files', [])
        meta.keep_files = data.get('keep_files', [])
        meta.steps_completed = data.get('steps_completed', [])
        meta.steps_failed = data.get('steps_failed', [])
        meta.metadata = data.get('metadata', {})
        meta.config = data.get('config', {})
        meta.base_filename = data.get('base_filename')
        
        return meta

def create_meta_from_youtube_url(
    youtube_url: str,
    base_dir: str,
    mode: ProcessingMode,
    folder_name: str,
    folder_path: str,
) -> ProcessingMeta:
    """
    Erstellt ein Meta-Objekt aus einer YouTube-URL
    Extrahiert automatisch Artist und Title aus der URL oder Metadaten
    """
    import re
    
    # Bestmögliche Erkennung: aus dem Ordnernamen "Artist - Title"
    artist = "Unknown Artist"
    title = "Unknown Title"
    if ' - ' in folder_name:
        parts = folder_name.split(' - ', 1)
        artist = parts[0].strip() or artist
        title = parts[1].strip() or title
    
    # Versuche aus der URL zu extrahieren (falls möglich)
    try:
        # Einfache Heuristik: Wenn die URL einen Titel enthält
        if "watch?v=" in youtube_url:
            # Könnte später mit yt-dlp erweitert werden
            pass
    except:
        pass
    
    return ProcessingMeta(
        artist=artist,
        title=title,
        mode=mode,
        base_dir=base_dir,
        folder_name=folder_name,
        folder_path=folder_path,
        youtube_url=youtube_url
    )

def create_meta_from_file_path(file_path: str, base_dir: str, mode: ProcessingMode) -> ProcessingMeta:
    """
    Erstellt ein Meta-Objekt aus einem Dateipfad
    Extrahiert Artist und Title aus dem Dateinamen oder Ordnernamen
    """
    path_obj = Path(file_path)
    
    # Versuche Artist und Title aus dem Pfad zu extrahieren
    if path_obj.parent.name != base_dir:
        # Ordner-basierte Extraktion
        folder_name = path_obj.parent.name
    else:
        # Datei-basierte Extraktion
        folder_name = path_obj.stem
    
    # Parse "Artist - Title" Format
    if ' - ' in folder_name:
        parts = folder_name.split(' - ', 1)
        artist = parts[0].strip()
        title = parts[1].strip()
    else:
        artist = "Unknown Artist"
        title = folder_name
    
    return ProcessingMeta(
        artist=artist,
        title=title,
        mode=mode,
        base_dir=base_dir,
        folder_name=folder_name,
        folder_path=str(path_obj.parent)
    )
