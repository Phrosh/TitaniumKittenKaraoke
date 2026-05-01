#!/usr/bin/env python3
"""
Finish Module
Setzt die korrekte API-URL basierend auf dem finalen Ordner und Song-Typ
"""

import os
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from urllib.parse import quote

from .meta import ProcessingMeta, ProcessingStatus
from .logger_utils import log_start, send_processing_status

logger = logging.getLogger(__name__)

def determine_api_url(meta: ProcessingMeta) -> Optional[str]:
    """
    Ermittelt die korrekte API-URL basierend auf dem finalen Ordner und Song-Typ
    
    Args:
        meta: ProcessingMeta-Objekt mit finalem Ordner
        
    Returns:
        API-URL oder None
    """
    log_start('determine_api_url', meta)
    
    # Debug: Meta-Objekt komplett ausgeben
    logger.info(f"🔍 Meta-Objekt Debug:")
    meta_attrs = {
        'artist': getattr(meta, 'artist', 'N/A'),
        'title': getattr(meta, 'title', 'N/A'),
        'folder_name': getattr(meta, 'folder_name', 'N/A'),
        'folder_path': getattr(meta, 'folder_path', 'N/A'),
        'mode': getattr(meta, 'mode', 'N/A'),
        'youtube_url': getattr(meta, 'youtube_url', 'N/A'),
        'base_dir': getattr(meta, 'base_dir', 'N/A'),
        'base_filename': getattr(meta, 'base_filename', 'N/A'),
        'song_id': getattr(meta, 'song_id', 'N/A'),
        'use_youtube_id_as_filename': getattr(meta, 'use_youtube_id_as_filename', 'N/A'),
        'temp_folder_name': getattr(meta, 'temp_folder_name', 'N/A'),
        'temp_folder_path': getattr(meta, 'temp_folder_path', 'N/A'),
        'status': getattr(meta, 'status', 'N/A'),
        'alle_attribute': [attr for attr in dir(meta) if not attr.startswith('_')]
    }
    
    for key, value in meta_attrs.items():
        logger.info(f"   {key}: {value}")
    
    if not meta.folder_name or not meta.folder_path:
        logger.error("Kein Ordner-Name oder -Pfad im Meta-Objekt")
        return None
    
    try:
        base_dir = meta.base_dir
        folder_name = meta.folder_name

        if not base_dir or not folder_name:
            logger.error("Kein base_dir oder folder_name im Meta-Objekt")
            return None

        # Extract song type from base_dir, e.g. ".../songs/youtube" -> "youtube"
        song_type = os.path.basename(base_dir)

        # Special handling: YouTube cache videos are served via /api/youtube-videos/<folder>/<filename>
        # (Node server has no /api/youtube/<folder> endpoint)
        if song_type == "youtube":
            folder_path = meta.folder_path
            if not folder_path or not os.path.isdir(folder_path):
                logger.error("Kein gültiger folder_path im Meta-Objekt für YouTube")
                return None

            # Pick a video file (prefer mp4/webm/mkv) from the final folder
            video_exts = (".mp4", ".webm", ".mkv", ".avi", ".mov")
            candidates = []
            for f in os.listdir(folder_path):
                p = os.path.join(folder_path, f)
                if os.path.isfile(p) and f.lower().endswith(video_exts):
                    candidates.append(f)

            if not candidates:
                logger.error(f"Keine Video-Datei im YouTube-Ordner gefunden: {folder_path}")
                return None

            # Prefer file that matches base_filename if available
            base_filename = getattr(meta, "base_filename", None)
            selected = None
            if base_filename:
                for f in candidates:
                    if os.path.splitext(f)[0] == base_filename:
                        selected = f
                        break
            if not selected:
                # Stable choice
                candidates.sort()
                selected = candidates[0]

            api_url = f"/api/youtube-videos/{quote(folder_name)}/{quote(selected)}"
            logger.info(f"✅ API-URL ermittelt (youtube cache): {api_url}")
            return api_url

        # Default: /api/<song_type>/<folder_name>
        api_url = f"/api/{song_type}/{quote(folder_name)}"
        logger.info(f"✅ API-URL ermittelt: {api_url}")
        return api_url

    except Exception as e:
        logger.error(f"❌ Fehler bei der API-URL-Ermittlung: {e}")
        return None

def finish_processing(meta: ProcessingMeta) -> bool:
    """
    Finalisiert die Verarbeitung und setzt die korrekte API-URL
    
    Args:
        meta: ProcessingMeta-Objekt
        
    Returns:
        True wenn erfolgreich, False sonst
    """
    log_start('finish_processing', meta)
    
    try:
        # Ermittle die korrekte API-URL
        api_url = determine_api_url(meta)
        
        if api_url:
            # Setze die korrekte URL im Meta-Objekt
            meta.youtube_url = api_url
            logger.info(f"🔄 API-URL aktualisiert: {api_url}")
            
            meta.mark_step_completed('finish')
            meta.status = ProcessingStatus.COMPLETED
            
            logger.info(f"✅ Finish-Verarbeitung abgeschlossen für: {meta.artist} - {meta.title}")
            return True
        else:
            logger.error(f"❌ Konnte keine API-URL ermitteln für: {meta.artist} - {meta.title}")
            meta.mark_step_failed('finish')
            meta.status = ProcessingStatus.FAILED
            send_processing_status(meta, 'failed')
            return False
            
    except Exception as e:
        logger.error(f"❌ Fehler in finish_processing: {e}")
        meta.mark_step_failed('finish')
        meta.status = ProcessingStatus.FAILED
        send_processing_status(meta, 'failed')
        return False

def finish_song(meta: ProcessingMeta) -> bool:
    """
    Convenience-Funktion für Finish-Verarbeitung
    
    Args:
        meta: ProcessingMeta-Objekt
        
    Returns:
        True wenn erfolgreich, False sonst
    """
    return finish_processing(meta)
