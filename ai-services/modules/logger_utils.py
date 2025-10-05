#!/usr/bin/env python3
import logging


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
