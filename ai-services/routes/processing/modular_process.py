from flask import Blueprint, jsonify, request
import os
import logging
import threading
from ..utils import get_ultrastar_dir

# Erstelle einen Blueprint für Modular-Process
modular_process_bp = Blueprint('modular_process', __name__)

# Logger für Processing-Module
logger = logging.getLogger(__name__)

@modular_process_bp.route('/modular-process/<folder_name>', methods=['POST'])
def modular_process(folder_name):
    """Modulare Verarbeitung für alle Song-Typen mit ensure_source_files"""
    try:
        data = request.get_json(silent=True) or {}
        song_type = data.get('songType', 'ultrastar')
        base_dir = data.get('baseDir', get_ultrastar_dir())
        
        # Basis-Verzeichnis für verschiedene Song-Typen
        if song_type == 'magic-songs':
            base_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '..', 'songs', 'magic-songs')
        elif song_type == 'magic-videos':
            base_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '..', 'songs', 'magic-videos')
        else:
            base_dir = get_ultrastar_dir()
        
        folder_path = os.path.join(base_dir, folder_name)
        
        if not os.path.exists(folder_path):
            return jsonify({'success': False, 'error': 'Folder not found'}), 404
        
        from modules import (
            ProcessingMode,
            create_meta_from_file_path,
            ensure_source_files,
            separate_audio,
            dereverb_audio,
            transcribe_audio,
            cleanup_files
        )
        from modules.logger_utils import send_processing_status, meta_to_short_dict, log_start

        # Meta initialisieren - verwende den korrekten Ordner-Pfad
        meta = create_meta_from_file_path(folder_path, base_dir, ProcessingMode.ULTRASTAR)
        
        # Korrigiere die Meta-Daten für den spezifischen Song-Ordner
        meta.folder_name = folder_name
        meta.folder_path = folder_path
        
        # Extrahiere Artist und Title aus dem Ordnernamen
        if ' - ' in folder_name:
            parts = folder_name.split(' - ', 1)
            meta.artist = parts[0]
            meta.title = parts[1]
        else:
            meta.artist = 'Unknown Artist'
            meta.title = folder_name
        
        logger.info(f"📁 Korrigierte Meta-Daten: artist='{meta.artist}', title='{meta.title}', folder_path='{meta.folder_path}'")
        
        # Start processing in background thread
        def run_modular_pipeline():
            try:
                # 1) Ensure Source Files (neues Modul)
                log_start('ensure_source_files.process_meta', meta)
                try:
                    send_processing_status(meta, 'downloading')
                except Exception:
                    pass
                
                if not ensure_source_files(meta):
                    logger.error("❌ Ensure source files failed, pipeline aborted")
                    try: 
                        send_processing_status(meta, 'failed')
                    except Exception: pass
                    return
                
                # Pipeline je nach Song-Typ
                if song_type == 'magic-videos':
                    # Magic-Videos-Pipeline: ensure_source_files → audio_separation → transcription → cleanup
                    
                    # 2) Audio Separation
                    logger.info("🔄 Starting audio separation...")
                    try:
                        send_processing_status(meta, 'separating')
                    except Exception:
                        pass
                    separate_audio(meta)
                    logger.info("✅ Audio separation completed")
                    
                    # 3) Dereverb (vor Transcription)
                    logger.info("🔄 Starting dereverb...")
                    try:
                        send_processing_status(meta, 'dereverbing')
                    except Exception:
                        pass
                    dereverb_audio(meta)
                    logger.info("✅ Dereverb completed")
                    
                    # 4) Transcription
                    logger.info("🔄 Starting transcription...")
                    try:
                        send_processing_status(meta, 'transcribing')
                    except Exception:
                        pass
                    transcribe_audio(meta)
                    logger.info("✅ Transcription completed")
                    
                elif song_type == 'magic-songs':
                    # Magic-Songs-Pipeline: ensure_source_files → audio_separation → transcription → remux_videos → cleanup
                    from modules import remux_videos
                    
                    # 2) Audio Separation
                    logger.info("🔄 Starting audio separation...")
                    try:
                        send_processing_status(meta, 'separating')
                    except Exception:
                        pass
                    separate_audio(meta)
                    logger.info("✅ Audio separation completed")
                    
                    # 3) Dereverb (vor Transcription)
                    logger.info("🔄 Starting dereverb...")
                    try:
                        send_processing_status(meta, 'dereverbing')
                    except Exception:
                        pass
                    dereverb_audio(meta)
                    logger.info("✅ Dereverb completed")
                    
                    # 4) Transcription
                    logger.info("🔄 Starting transcription...")
                    try:
                        send_processing_status(meta, 'transcribing')
                    except Exception:
                        pass
                    transcribe_audio(meta)
                    logger.info("✅ Transcription completed")
                    
                    # 4) Video Remuxing (Audio entfernen)
                    logger.info("🔄 Starting video remuxing...")
                    remux_videos(meta, remove_audio=True)
                    logger.info("✅ Video remuxing completed")
                    
                else:
                    # Ultrastar-Pipeline: ensure_source_files → separate_audio → remux_videos (nur wenn Video zu Beginn fehlte) → cleanup
                    from modules import remux_videos
                    
                    # 2) Audio Separation
                    logger.info("🔄 Starting audio separation...")
                    try:
                        send_processing_status(meta, 'separating')
                    except Exception:
                        pass
                    separate_audio(meta)
                    logger.info("✅ Audio separation completed")
                    
                    # 3) Video Remuxing (nur wenn Video zu Beginn fehlte)
                    # Prüfe ob Video zu Beginn vorhanden war
                    initial_files = meta.metadata.get('initial_files', {})
                    had_video_at_start = initial_files.get('video', False)
                    
                    if not had_video_at_start:
                        logger.info("🔄 Starting video remuxing (Video wurde heruntergeladen)...")
                        remux_videos(meta, remove_audio=True)
                        logger.info("✅ Video remuxing completed")
                    else:
                        logger.info("⏭️ Skipping video remuxing (Video war bereits vorhanden)")
                
                # 4) Cleanup (für alle Song-Typen)
                logger.info("🔄 Starting cleanup...")
                cleanup_files(meta)
                logger.info("✅ Cleanup completed")
                
                # 5) Finish - setze korrekte API-URL
                logger.info("🔄 Starting finish...")
                from modules.finish import finish_processing
                finish_processing(meta)
                logger.info("✅ Finish completed")

                logger.info("🎉 Modular pipeline completed successfully, sending finished status...")
                try:
                    send_processing_status(meta, 'finished')
                    logger.info("✅ Finished status sent successfully")
                except Exception as e:
                    logger.error(f"❌ Failed to send finished status: {e}")
                    
            except Exception as e:
                logger.error(f"Error in modular pipeline background thread: {e}")
                try:
                    send_processing_status(meta, 'failed')
                except Exception:
                    pass

        # Start background thread
        thread = threading.Thread(target=run_modular_pipeline)
        thread.daemon = True
        thread.start()

        # Return immediately
        return jsonify({'success': True, 'message': 'Modular pipeline started in background'})
        
    except Exception as e:
        logger.error(f"Error starting modular pipeline: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
