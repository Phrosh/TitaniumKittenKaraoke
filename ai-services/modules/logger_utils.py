#!/usr/bin/env python3
import logging
import requests


def meta_to_short_dict(meta) -> dict:
    try:
        return {
            'artist': getattr(meta, 'artist', None),
            'title': getattr(meta, 'title', None),
            'mode': getattr(meta, 'mode', None).value if getattr(meta, 'mode', None) else None,
            'folder_name': getattr(meta, 'folder_name', None),
            'folder_path': getattr(meta, 'folder_path', None),
            'youtube_url': getattr(meta, 'youtube_url', None),
            'usdb_url': getattr(meta, 'usdb_url', None),
            'steps_completed': list(getattr(meta, 'steps_completed', []) or []),
            'steps_failed': list(getattr(meta, 'steps_failed', []) or []),
        }
    except Exception:
        return {'meta_repr': repr(meta)}


def log_start(function_name: str, meta) -> None:
    logger = logging.getLogger(__name__)
    logger.info(f"▶ {function_name} | meta={meta_to_short_dict(meta)}")


def send_processing_status(meta, status: str) -> None:
    """Sendet den Verarbeitungs-Status an den Node-Server (HTTP), zur Weiterleitung per WebSocket.

    Args:
        meta: ProcessingMeta-ähnliches Objekt mit artist/title
        status: 'downloading' | 'separating' | 'transcribing' | 'failed' | 'finished'
    """
    logger = logging.getLogger(__name__)
    try:
        artist = getattr(meta, 'artist', None)
        title = getattr(meta, 'title', None)
        song_id = getattr(meta, 'song_id', None)  # Try to get song ID if available
        youtube_url = getattr(meta, 'youtube_url', None)  # Include youtube_url
        payload = { 'artist': artist, 'title': title, 'status': status }
        if song_id:
            payload['id'] = song_id
        if youtube_url:
            payload['youtube_url'] = youtube_url
        logger.info(f"📡 send_processing_status → {payload}")
        # kleiner Timeout, non-blocking Charakter
        requests.post('http://localhost:5000/api/songs/processing-status', json=payload, timeout=3)
    except Exception as e:
        logger.warning(f"⚠️ send_processing_status fehlgeschlagen: {e}")


def send_queue_status(queue_status: dict) -> None:
    """Sendet den Queue-Status an den Node-Server (HTTP), zur Weiterleitung per WebSocket.

    Args:
        queue_status: Dictionary mit Queue-Informationen (queue_length, is_processing, etc.)
    """
    logger = logging.getLogger(__name__)
    try:
        payload = {
            'type': 'queue_status',
            'queue_length': queue_status.get('queue_length', 0),
            'is_processing': queue_status.get('is_processing', False),
            'current_job': queue_status.get('current_job'),
            'finished_jobs': queue_status.get('finished_jobs', 0),
            'total_jobs': queue_status.get('total_jobs', 0)
        }
        logger.info(f"📡 send_queue_status → {payload}")
        # kleiner Timeout, non-blocking Charakter
        requests.post('http://localhost:5000/api/songs/queue-status', json=payload, timeout=3)
    except Exception as e:
        logger.warning(f"⚠️ send_queue_status fehlgeschlagen: {e}")