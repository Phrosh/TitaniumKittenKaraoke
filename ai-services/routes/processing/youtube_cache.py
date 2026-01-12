from flask import Blueprint, jsonify
import os
import logging
import threading
from ..utils import get_youtube_dir

# Erstelle einen Blueprint für YouTube-Cache-Processing
youtube_cache_bp = Blueprint('youtube_cache', __name__)

# Logger für Processing-Module
logger = logging.getLogger(__name__)

@youtube_cache_bp.route('/process_youtube_cache/<folder_name>', methods=['POST'])
def process_youtube_cache(folder_name):
    try:
        from flask import request
        from modules import (
            ProcessingMode,
            create_meta_from_file_path,
            normalize_audio_files,
            cleanup_files
        )
        from modules.logger_utils import meta_to_short_dict, send_processing_status

        # Get song_id from request body if provided
        song_id = None
        if request.is_json:
            song_id = request.json.get('song_id')

        base_dir = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '..', 'songs', 'youtube'))
        folder_path = os.path.join(base_dir, folder_name)
        if not os.path.exists(folder_path):
            return jsonify({'error': 'Folder not found'}), 404
        
        # pick any file for meta
        any_file = None
        for f in os.listdir(folder_path):
            p = os.path.join(folder_path, f)
            if os.path.isfile(p):
                any_file = p
                break
        if not any_file:
            return jsonify({'error': 'No files in folder'}), 400
        
        meta = create_meta_from_file_path(any_file, base_dir, ProcessingMode.YOUTUBE_CACHE)
        
        # Store song_id in meta if provided
        if song_id:
            meta.song_id = song_id
        try:
            videos = [f for f in os.listdir(folder_path) if f.lower().endswith(('.mp4', '.webm', '.mkv'))]
            if videos:
                import os as _os
                meta.base_filename = _os.path.splitext(videos[0])[0]
        except Exception:
            pass

        def _worker():
            try:
                try:
                    logger.info(f"▶ youtube_cache.process | meta={meta_to_short_dict(meta)}")
                except Exception:
                    logger.info(f"▶ youtube_cache.process | meta={getattr(meta, 'folder_name', folder_name)}")
                
                # broadcast processing started
                try:
                    send_processing_status(meta, 'processing')
                except Exception:
                    pass
                
                # 1) normalize (simple)
                normalize_audio_files(meta, simple=True)
                # 2) cleanup
                try:
                    cleanup_files(meta)
                except Exception as cleanup_error:
                    logger.error(f"❌ Cleanup fehlgeschlagen, aber Pipeline wird fortgesetzt: {cleanup_error}", exc_info=True)
                    # Cleanup ist nicht kritisch, Pipeline wird fortgesetzt
                
                # 3) finish - setze korrekte API-URL
                from modules.finish import finish_processing
                finish_processing(meta)
                
                try:
                    send_processing_status(meta, 'finished')
                except Exception:
                    pass
            except Exception as e:
                logger.error(f"Error processing youtube cache (bg): {e}")
                try:
                    send_processing_status(meta, 'failed')
                except Exception:
                    pass

        threading.Thread(target=_worker, daemon=True).start()
        return jsonify({'success': True, 'started': True})
    except Exception as e:
        logger.error(f"Error processing youtube cache: {e}")
        return jsonify({'error': str(e)}), 500
