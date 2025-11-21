from flask import Blueprint, jsonify, request
import os
import logging
import threading
import shutil
from ..utils import get_ultrastar_dir, sanitize_filename

# Erstelle einen Blueprint für USDB-Process
usdb_process_bp = Blueprint('usdb_process', __name__)

# Logger für USDB-Module
logger = logging.getLogger(__name__)

@usdb_process_bp.route('/usdb/process/<folder_name>', methods=['POST'])
def process_usdb_pipeline(folder_name):
    """USDB-Pipeline mit Modulen: 1) usdb_download → 2) youtube_download → 3) audio_normalization → 4) audio_separation → 5) video_remuxing → 6) cleanup"""
    try:
        data = request.get_json(silent=True) or {}
        song_id = data.get('songId')
        username = data.get('username')
        password = data.get('password')
        batch_id = data.get('batchId')  # Get batch ID from request
        
        # Extract USDB song ID from folder name (USDB_12345 format)
        if not folder_name.startswith('USDB_'):
            return jsonify({'success': False, 'error': 'Invalid folder name format'}), 400
            
        usdb_song_id = folder_name.replace('USDB_', '')
        
        if not username or not password:
            return jsonify({'success': False, 'error': 'USDB credentials are required'}), 400
        
        # Basis-Verzeichnis für Ultrastar-Downloads
        base_dir = get_ultrastar_dir()
        # Sanitize folder name to ensure valid directory name
        temp_folder_name = sanitize_filename(folder_name)  # USDB_17878
        temp_folder_path = os.path.join(base_dir, temp_folder_name)
        os.makedirs(temp_folder_path, exist_ok=True)

        from modules import (
            ProcessingMode,
            create_meta_from_file_path,
            download_usdb_song,
            download_youtube_video as mod_yt_download,
            normalize_audio_files,
            separate_audio,
            remux_videos,
            cleanup_files
        )
        from modules.logger_utils import send_processing_status, meta_to_short_dict, log_start

        # Meta initialisieren mit Temp-Ordner
        meta = create_meta_from_file_path(temp_folder_path, base_dir, ProcessingMode.ULTRASTAR)
        if song_id:
            meta.song_id = song_id
        elif batch_id:
            # Use batch ID for WebSocket updates if no song_id is provided
            meta.song_id = batch_id
        
        # Set USDB credentials in meta
        meta.usdb_username = username
        meta.usdb_password = password
        meta.usdb_song_id = usdb_song_id
        
        # For USDB songs, use artist-title as filename instead of YouTube ID
        meta.use_youtube_id_as_filename = False
        
        # Store original temp folder info for cleanup
        meta.temp_folder_name = temp_folder_name
        meta.temp_folder_path = temp_folder_path

        # Start pipeline in background thread
        def run_usdb_pipeline():
            try:
                # 1) USDB Download (nur TXT notwendig, YouTube-Link extrahieren)
                try:
                    send_processing_status(meta, 'downloading')
                except Exception:
                    pass
                log_start('usdb_download.process_meta', meta)
                
                try:
                    usdb_ok = download_usdb_song(meta)
                    if not usdb_ok:
                        logger.error("❌ USDB-Download fehlgeschlagen, Pipeline wird abgebrochen")
                        try: 
                            send_processing_status(meta, 'failed')
                        except Exception: pass
                        
                        # Lösche den Ordner bei Fehlern
                        try:
                            if hasattr(meta, 'folder_path') and os.path.exists(meta.folder_path):
                                shutil.rmtree(meta.folder_path)
                                logger.info(f"🗑️ Ordner gelöscht nach USDB-Fehler: {meta.folder_path}")
                        except Exception as cleanup_error:
                            logger.warning(f"⚠️ Konnte Ordner nicht löschen: {cleanup_error}")
                        
                        return  # Pipeline komplett abbrechen
                except Exception as e:
                    logger.error(f"❌ Fehler in USDB-Download: {e}")
                    try: 
                        send_processing_status(meta, 'failed')
                    except Exception: pass
                    
                    # Lösche den Ordner bei Fehlern
                    try:
                        if hasattr(meta, 'folder_path') and os.path.exists(meta.folder_path):
                            shutil.rmtree(meta.folder_path)
                            logger.info(f"🗑️ Ordner gelöscht nach Fehler: {meta.folder_path}")
                    except Exception as cleanup_error:
                        logger.warning(f"⚠️ Konnte Ordner nicht löschen: {cleanup_error}")
                    
                    return  # Pipeline komplett abbrechen

                # YouTube-Link aus Meta für nächsten Schritt
                youtube_url = getattr(meta, 'youtube_url', None) or getattr(meta, 'youtube_link', None)
                if not youtube_url:
                    # Ohne YouTube-Link ist der Song nicht vollständig → failed
                    try: 
                        send_processing_status(meta, 'failed')
                    except Exception: pass
                    
                    # Lösche den Ordner bei Fehlern
                    try:
                        if hasattr(meta, 'folder_path') and os.path.exists(meta.folder_path):
                            shutil.rmtree(meta.folder_path)
                            logger.info(f"🗑️ Ordner gelöscht nach Fehler (kein YouTube-URL): {meta.folder_path}")
                    except Exception as cleanup_error:
                        logger.warning(f"⚠️ Konnte Ordner nicht löschen: {cleanup_error}")
                    
                    return

                # 2) YouTube Download (Abbruch bei Fehler, Status/Mode an Node melden)
                log_start('youtube_download.process_meta', meta)
                yt_ok = mod_yt_download(meta)
                if not yt_ok:
                    try:
                        # an Node melden: failed + youtube_url + mode=youtube
                        send_processing_status(meta, 'failed')
                    except Exception:
                        pass
                    
                    # Lösche den Ordner bei Fehlern
                    try:
                        if hasattr(meta, 'folder_path') and os.path.exists(meta.folder_path):
                            shutil.rmtree(meta.folder_path)
                            logger.info(f"🗑️ Ordner gelöscht nach Fehler (YouTube-Download fehlgeschlagen): {meta.folder_path}")
                    except Exception as cleanup_error:
                        logger.warning(f"⚠️ Konnte Ordner nicht löschen: {cleanup_error}")
                    
                    return

                # 3) Audio Normalization
                logger.info("🔄 Starting audio normalization...")
                normalize_audio_files(meta, simple=True)
                logger.info("✅ Audio normalization completed")
                
                # 4) Audio Separation
                logger.info("🔄 Starting audio separation...")
                separate_audio(meta)
                logger.info("✅ Audio separation completed")
                
                # 5) Video Remuxing (Audio entfernen)
                logger.info("🔄 Starting video remuxing...")
                remux_videos(meta, remove_audio=True)
                logger.info("✅ Video remuxing completed")
                
                # 6) Cleanup
                logger.info("🔄 Starting cleanup...")
                try:
                    cleanup_files(meta)
                    logger.info("✅ Cleanup completed")
                except Exception as cleanup_error:
                    logger.error(f"❌ Cleanup fehlgeschlagen, aber Pipeline wird fortgesetzt: {cleanup_error}", exc_info=True)
                    # Pipeline wird trotzdem fortgesetzt, da Cleanup nicht kritisch ist
                
                # 7) Finish - setze korrekte API-URL
                logger.info("🔄 Starting finish...")
                from modules.finish import finish_processing
                finish_processing(meta)
                logger.info("✅ Finish completed")

                logger.info("🎉 USDB pipeline completed successfully, sending finished status...")
                try:
                    send_processing_status(meta, 'finished')
                    logger.info("✅ Finished status sent successfully")
                except Exception as e:
                    logger.error(f"❌ Failed to send finished status: {e}")
                    
            except Exception as e:
                logger.error(f"Error in USDB pipeline background thread: {e}")
                
                # Lösche den Ordner bei Fehlern
                try:
                    if hasattr(meta, 'folder_path') and os.path.exists(meta.folder_path):
                        shutil.rmtree(meta.folder_path)
                        logger.info(f"🗑️ Ordner gelöscht nach Pipeline-Fehler: {meta.folder_path}")
                except Exception as cleanup_error:
                    logger.warning(f"⚠️ Konnte Ordner nicht löschen: {cleanup_error}")
                
                try:
                    send_processing_status(meta, 'failed')
                except Exception:
                    pass

        # Start background thread
        thread = threading.Thread(target=run_usdb_pipeline)
        thread.daemon = True
        thread.start()

        # Return immediately
        return jsonify({'success': True, 'message': 'USDB pipeline started in background'})
        
    except Exception as e:
        logger.error(f"Error starting USDB pipeline: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
