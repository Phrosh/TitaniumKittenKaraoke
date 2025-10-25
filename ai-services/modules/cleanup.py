#!/usr/bin/env python3
"""
Cleanup Module
Bereinigt temporäre Dateien und organisiert Ausgabedateien
"""

import os
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List, Set

from .meta import ProcessingMeta, ProcessingStatus
from .logger_utils import log_start, send_processing_status

try:
    from ..constants import AUDIO_EXTENSIONS, VIDEO_EXTENSIONS, LYRICS_EXTENSIONS, COVER_EXTENSIONS
except ImportError:
    try:
        from constants import AUDIO_EXTENSIONS, VIDEO_EXTENSIONS, LYRICS_EXTENSIONS, COVER_EXTENSIONS
    except ImportError:
        # Fallback: define constants locally
        AUDIO_EXTENSIONS = {'.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.wma'}
        VIDEO_EXTENSIONS = {'.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v'}
        LYRICS_EXTENSIONS = {'.txt', '.lrc', '.srt', '.vtt'}
        COVER_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}

logger = logging.getLogger(__name__)

class FileCleaner:
    """Datei-Bereiniger für temporäre und unerwünschte Dateien"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialisiert den Datei-Bereiniger
        
        Args:
            config: Konfiguration für Cleanup
        """
        self.config = config or {}
        self.default_config = {
            'remove_temp_files': True,
            'remove_duplicates': False,
            'organize_files': False,
            'backup_before_cleanup': False,
            'dry_run': False  # Nur simulieren, nicht wirklich löschen
        }
    
    def get_all_files_in_folder(self, folder_path: str) -> List[str]:
        """
        Holt alle Dateien in einem Ordner
        
        Args:
            folder_path: Pfad zum Ordner
            
        Returns:
            Liste der Dateipfade
        """
        files = []
        if os.path.exists(folder_path):
            for file in os.listdir(folder_path):
                file_path = os.path.join(folder_path, file)
                if os.path.isfile(file_path):
                    files.append(file_path)
        return files
    
    def cleanup_special_files(self, meta: ProcessingMeta) -> None:
        """
        Spezielle Cleanup-Operationen:
        - Lösche .vocals Dateien
        - Entferne .normalized aus Dateinamen (umbenennen)
        """
        try:
            # 1) Lösche .vocals Dateien
            for file in os.listdir(meta.folder_path):
                if file.endswith('.vocals.mp3'):
                    file_path = os.path.join(meta.folder_path, file)
                    try:
                        os.remove(file_path)
                        logger.info(f"🗑️ .vocals Datei gelöscht: {file}")
                    except Exception as e:
                        logger.warning(f"⚠️ Konnte .vocals Datei nicht löschen {file}: {e}")
            
            # 2) Entferne .normalized aus Dateinamen
            for file in os.listdir(meta.folder_path):
                if '.normalized.' in file:
                    old_path = os.path.join(meta.folder_path, file)
                    new_name = file.replace('.normalized', '')
                    new_path = os.path.join(meta.folder_path, new_name)
                    
                    # Prüfe ob Ziel-Datei bereits existiert
                    if os.path.exists(new_path):
                        # Ziel existiert bereits - lösche .normalized Datei
                        try:
                            os.remove(old_path)
                            logger.info(f"🗑️ .normalized Datei gelöscht (Ziel existiert): {file}")
                        except Exception as e:
                            logger.warning(f"⚠️ Konnte .normalized Datei nicht löschen {file}: {e}")
                    else:
                        # Ziel existiert nicht - benenne um
                        try:
                            os.rename(old_path, new_path)
                            logger.info(f"📝 .normalized entfernt: {file} → {new_name}")
                        except Exception as e:
                            logger.warning(f"⚠️ Konnte Datei nicht umbenennen {file}: {e}")
                            
        except Exception as e:
            logger.error(f"❌ Fehler bei speziellen Cleanup-Operationen: {e}")
    
    def identify_files_to_keep(self, meta: ProcessingMeta) -> Set[str]:
        """
        Identifiziert Dateien, die behalten werden sollen
        
        Args:
            meta: ProcessingMeta-Objekt
            
        Returns:
            Set der zu behaltenden Dateipfade
        """
        keep_files = set()
        
        # Füge explizit zu behaltende Dateien hinzu
        for file in meta.keep_files:
            file_path = meta.get_file_path(file)
            if os.path.exists(file_path):
                keep_files.add(file_path)
        
        # Whitelist basierend auf base_filename
        base = getattr(meta, 'base_filename', None)
        if base:
            whitelist_names = {
                f"{base}.normalized.mp3",
                f"{base}.hp2.mp3",
                f"{base}.hp5.mp3",
                # f"{base}.dereverbed.mp3",  # Entfernt - wird jetzt gelöscht
                f"{base}.txt",
            }
            for name in whitelist_names:
                path = meta.get_file_path(name)
                if os.path.exists(path):
                    keep_files.add(path)
        
        # Hinweis: Wir behalten NICHT automatisch alle output_files/input_files,
        # da wir nur die Whitelist im Ordner übrig lassen möchten. Unbekannte
        # (nicht dokumentierte) Dateien im Ordner werden unangetastet gelassen,
        # weil wir nur dokumentierte Dateien überhaupt zum Löschen in Betracht ziehen.
        
        return keep_files
    
    def identify_files_to_remove(self, meta: ProcessingMeta) -> Set[str]:
        """
        Identifiziert Dateien, die entfernt werden sollen
        
        Args:
            meta: ProcessingMeta-Objekt
            
        Returns:
            Set der zu entfernenden Dateipfade
        """
        remove_files = set()
        
        # Nur dokumentierte, erstellte Dateien betrachten: output_files + temp_files
        documented_files: Set[str] = set()
        for p in (meta.output_files or []):
            if os.path.exists(p):
                documented_files.add(p)
        for f in (meta.temp_files or []):
            fp = f if os.path.isabs(f) else meta.get_file_path(f)
            if os.path.exists(fp):
                documented_files.add(fp)
        
        keep_files = self.identify_files_to_keep(meta)
        
        # Entferne alle dokumentierten Dateien, die NICHT in der Whitelist/keep_files sind
        for file_path in documented_files:
            if file_path not in keep_files:
                remove_files.add(file_path)
        
        return remove_files
    
    def _is_duplicate_file(self, file_path: str, keep_files: Set[str]) -> bool:
        """
        Prüft ob eine Datei ein Duplikat ist
        
        Args:
            file_path: Pfad zur zu prüfenden Datei
            keep_files: Set der zu behaltenden Dateien
            
        Returns:
            True wenn Duplikat, False sonst
        """
        filename = os.path.basename(file_path)
        name_without_ext = os.path.splitext(filename)[0]
        
        # Prüfe auf ähnliche Dateinamen in keep_files
        for keep_file in keep_files:
            keep_filename = os.path.basename(keep_file)
            keep_name_without_ext = os.path.splitext(keep_filename)[0]
            
            # Wenn die Namen ähnlich sind, aber unterschiedliche Extensions haben
            if name_without_ext == keep_name_without_ext and filename != keep_filename:
                return True
        
        return False
    
    def remove_file_safely(self, file_path: str, dry_run: bool = False) -> bool:
        """
        Entfernt eine Datei sicher
        
        Args:
            file_path: Pfad zur Datei
            dry_run: Nur simulieren
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        try:
            if dry_run:
                logger.info(f"[DRY RUN] Würde entfernen: {file_path}")
                return True
            
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f"✅ Datei entfernt: {file_path}")
                return True
            else:
                logger.warning(f"Datei existiert nicht: {file_path}")
                return False
                
        except Exception as e:
            logger.error(f"Fehler beim Entfernen von {file_path}: {e}")
            return False
    
    def organize_files(self, meta: ProcessingMeta) -> bool:
        """
        Organisiert Dateien im Ordner
        
        Args:
            meta: ProcessingMeta-Objekt
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        try:
            config = {**self.default_config, **self.config}
            
            if not config.get('organize_files', True):
                return True
            
            logger.info(f"Organisiere Dateien in: {meta.folder_path}")
            
            # Erstelle Unterordner falls nötig
            subdirs = {
                'audio': AUDIO_EXTENSIONS,
                'video': VIDEO_EXTENSIONS,
                'lyrics': LYRICS_EXTENSIONS,
                'covers': COVER_EXTENSIONS
            }
            
            for subdir, extensions in subdirs.items():
                subdir_path = os.path.join(meta.folder_path, subdir)
                os.makedirs(subdir_path, exist_ok=True)
                
                # Verschiebe Dateien in entsprechende Unterordner
                for file in os.listdir(meta.folder_path):
                    if os.path.isfile(os.path.join(meta.folder_path, file)):
                        file_ext = os.path.splitext(file)[1].lower()
                        if file_ext in extensions:
                            old_path = os.path.join(meta.folder_path, file)
                            new_path = os.path.join(subdir_path, file)
                            
                            if old_path != new_path:
                                os.rename(old_path, new_path)
                                logger.info(f"Datei organisiert: {file} -> {subdir}/")
            
            logger.info("✅ Dateien erfolgreich organisiert")
            return True
            
        except Exception as e:
            logger.error(f"Fehler bei Datei-Organisation: {e}")
            return False
    
    def create_backup(self, meta: ProcessingMeta) -> bool:
        """
        Erstellt ein Backup vor dem Cleanup
        
        Args:
            meta: ProcessingMeta-Objekt
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        try:
            config = {**self.default_config, **self.config}
            
            if not config.get('backup_before_cleanup', False):
                return True
            
            import shutil
            from datetime import datetime
            
            backup_name = f"{meta.folder_name}_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            backup_path = os.path.join(meta.base_dir, backup_name)
            
            if os.path.exists(meta.folder_path):
                shutil.copytree(meta.folder_path, backup_path)
                logger.info(f"✅ Backup erstellt: {backup_path}")
                return True
            else:
                logger.warning(f"Ordner existiert nicht für Backup: {meta.folder_path}")
                return False
                
        except Exception as e:
            logger.error(f"Fehler beim Erstellen des Backups: {e}")
            return False
    
    def process_meta(self, meta: ProcessingMeta) -> bool:
        """
        Bereinigt Dateien im Meta-Objekt
        
        Args:
            meta: ProcessingMeta-Objekt
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        log_start('cleanup.process_meta', meta)
        try:
            config = {**self.default_config, **self.config}
            dry_run = config.get('dry_run', False)
            
            logger.info(f"Starte Cleanup für: {meta.artist} - {meta.title}")
            meta.status = ProcessingStatus.IN_PROGRESS
            
            # Erstelle Backup falls konfiguriert
            if not dry_run:
                self.create_backup(meta)
            
            # Spezielle Cleanup-Operationen (vor normalem Cleanup)
            self.cleanup_special_files(meta)
            
            # Identifiziere Dateien zum Entfernen
            files_to_remove = self.identify_files_to_remove(meta)
            
            if files_to_remove:
                logger.info(f"Identifiziert {len(files_to_remove)} Dateien zum Entfernen")
                
                removed_count = 0
                for file_path in files_to_remove:
                    if self.remove_file_safely(file_path, dry_run):
                        removed_count += 1
                
                logger.info(f"✅ {removed_count} Dateien entfernt")
            else:
                logger.info("Keine Dateien zum Entfernen gefunden")
            
            # Entferne bekannte, während der Verarbeitung entstandene Unterordner vollständig
            try:
                known_subdirs = ['audio', 'covers', 'lyrics', 'separated', 'video', 'dereverb_vocals', 'dereverb_others']
                for sub in known_subdirs:
                    sub_path = os.path.join(meta.folder_path, sub)
                    if os.path.isdir(sub_path):
                        if dry_run:
                            logger.info(f"[DRY RUN] Würde Ordner entfernen: {sub_path}")
                        else:
                            import shutil
                            shutil.rmtree(sub_path, ignore_errors=True)
                            logger.info(f"Ordner entfernt: {sub_path}")
            except Exception as e:
                logger.warning(f"Konnte Unterordner nicht entfernen: {e}")

            # Entferne explizit Vocals- und Dereverbed-Dateien, wenn vorhanden (nicht whitelisted)
            try:
                base = getattr(meta, 'base_filename', None)
                if base:
                    candidates = [
                        f"{base}.vocals.mp3",
                        f"{base}_vocals.mp3",
                        f"{base}_vocals_temp.mp3",
                        f"{base}.dereverbed.mp3",  # Entferne dereverbed Dateien
                    ]
                    for name in candidates:
                        path = meta.get_file_path(name)
                        if os.path.exists(path) and path not in self.identify_files_to_keep(meta):
                            if dry_run:
                                logger.info(f"[DRY RUN] Würde Datei entfernen: {path}")
                            else:
                                os.remove(path)
                                logger.info(f"Datei entfernt: {path}")
            except Exception as e:
                logger.warning(f"Konnte Dateien nicht entfernen: {e}")
            
            logger.info(f"✅ Cleanup erfolgreich abgeschlossen für: {meta.artist} - {meta.title}")
            meta.mark_step_completed('cleanup')
            meta.status = ProcessingStatus.COMPLETED
            
            return True
            
        except Exception as e:
            logger.error(f"Fehler bei Cleanup: {e}")
            meta.mark_step_failed('cleanup')
            meta.status = ProcessingStatus.FAILED
            return False
    
    def get_folder_summary(self, meta: ProcessingMeta) -> Dict[str, Any]:
        """
        Erstellt eine Zusammenfassung des Ordners
        
        Args:
            meta: ProcessingMeta-Objekt
            
        Returns:
            Zusammenfassung des Ordners
        """
        try:
            all_files = self.get_all_files_in_folder(meta.folder_path)
            keep_files = self.identify_files_to_keep(meta)
            remove_files = self.identify_files_to_remove(meta)
            
            # Gruppiere Dateien nach Typ
            file_types = {}
            for file_path in all_files:
                ext = os.path.splitext(file_path)[1].lower()
                if ext not in file_types:
                    file_types[ext] = []
                file_types[ext].append(os.path.basename(file_path))
            
            return {
                'total_files': len(all_files),
                'files_to_keep': len(keep_files),
                'files_to_remove': len(remove_files),
                'file_types': file_types,
                'folder_size': self._get_folder_size(meta.folder_path),
                'steps_completed': meta.steps_completed,
                'steps_failed': meta.steps_failed
            }
            
        except Exception as e:
            logger.error(f"Fehler bei Ordner-Zusammenfassung: {e}")
            return {}
    
    def _get_folder_size(self, folder_path: str) -> int:
        """
        Berechnet die Größe eines Ordners
        
        Args:
            folder_path: Pfad zum Ordner
            
        Returns:
            Größe in Bytes
        """
        total_size = 0
        try:
            for dirpath, dirnames, filenames in os.walk(folder_path):
                for filename in filenames:
                    file_path = os.path.join(dirpath, filename)
                    if os.path.exists(file_path):
                        total_size += os.path.getsize(file_path)
        except Exception as e:
            logger.error(f"Fehler bei Größenberechnung: {e}")
        
        return total_size

def cleanup_files(meta: ProcessingMeta) -> bool:
    """
    Convenience-Funktion für Datei-Cleanup
    
    Args:
        meta: ProcessingMeta-Objekt
        
    Returns:
        True wenn erfolgreich, False sonst
    """
    log_start('cleanup_files', meta)
    cleaner = FileCleaner()
    return cleaner.process_meta(meta)

def get_folder_summary(meta: ProcessingMeta) -> Dict[str, Any]:
    """
    Convenience-Funktion für Ordner-Zusammenfassung
    
    Args:
        meta: ProcessingMeta-Objekt
        
    Returns:
        Zusammenfassung des Ordners
    """
    log_start('get_folder_summary', meta)
    cleaner = FileCleaner()
    return cleaner.get_folder_summary(meta)
