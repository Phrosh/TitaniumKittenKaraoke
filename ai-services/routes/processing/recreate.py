from flask import Blueprint, jsonify, request
import os
import logging
import threading
import glob
from ..utils import get_ultrastar_dir, sanitize_filename

# Erstelle einen Blueprint für Recreate
recreate_bp = Blueprint('recreate', __name__)

# Logger für Processing-Module
logger = logging.getLogger(__name__)

@recreate_bp.route('/recreate/<folder_name>', methods=['POST'])
def recreate(folder_name):
    """Recreate Magic songs by deleting processed files and running audio_separation → transcription → cleanup"""
    try:
        data = request.get_json(silent=True) or {}
        song_type = data.get('songType', 'magic-songs')
        base_dir = data.get('baseDir', get_ultrastar_dir())
        
        # Basis-Verzeichnis für verschiedene Song-Typen
        if song_type == 'magic-songs':
            base_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '..', 'songs', 'magic-songs')
        elif song_type == 'magic-videos':
            base_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '..', 'songs', 'magic-videos')
        elif song_type == 'magic-youtube':
            base_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '..', 'songs', 'magic-youtube')
        else:
            return jsonify({'success': False, 'error': 'Invalid song type for recreate'}), 400
        
        # Sanitize folder name to ensure valid directory name
        sanitized_folder_name = sanitize_filename(folder_name)
        folder_path = os.path.join(base_dir, sanitized_folder_name)
        
        if not os.path.exists(folder_path):
            return jsonify({'success': False, 'error': 'Folder not found'}), 404
        
        from modules import (
            ProcessingMode,
            create_meta_from_file_path,
            separate_audio,
            dereverb_audio,
            transcribe_audio,
            cleanup_files
        )
        from modules.logger_utils import send_processing_status, meta_to_short_dict, log_start

        # Meta initialisieren
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
        
        logger.info(f"🔄 Recreate request: {folder_name} ({song_type})")
        
        # Start processing in background thread
        def run_recreate_pipeline():
            logger.info("=" * 80)
            logger.info("🚀 RECREATE PIPELINE THREAD START")
            logger.info(f"Thread ID: {threading.current_thread().ident}")
            logger.info(f"Thread Name: {threading.current_thread().name}")
            logger.info("=" * 80)
            try:
                # Delete processed files (.txt, .hp2.mp3, .hp5.mp3)
                files_to_delete = []
                
                # Find .txt files
                txt_files = glob.glob(os.path.join(folder_path, '*.txt'))
                files_to_delete.extend(txt_files)
                
                # Find .hp2.mp3 files
                hp2_files = glob.glob(os.path.join(folder_path, '*.hp2.mp3'))
                files_to_delete.extend(hp2_files)
                
                # Find .hp5.mp3 files
                hp5_files = glob.glob(os.path.join(folder_path, '*.hp5.mp3'))
                files_to_delete.extend(hp5_files)
                
                # Delete files
                for file_path in files_to_delete:
                    try:
                        if os.path.exists(file_path):
                            os.remove(file_path)
                            logger.info(f"🗑️ Deleted: {os.path.basename(file_path)}")
                    except Exception as e:
                        logger.warning(f"⚠️ Could not delete {file_path}: {e}")
                
                logger.info(f"🗑️ Deleted {len(files_to_delete)} processed files")
                
                # Send initial status
                try:
                    send_processing_status(meta, 'separating')
                except Exception:
                    pass
                
                # Run recreate pipeline: audio_separation → dereverb → transcription → cleanup
                logger.info("🔄 Starting audio separation...")
                separate_audio(meta)
                logger.info("✅ Audio separation completed")
                
                logger.info("🔄 Starting dereverb...")
                try:
                    send_processing_status(meta, 'dereverbing')
                except Exception:
                    pass
                dereverb_audio(meta)
                logger.info("✅ Dereverb completed")
                
                logger.info("=" * 80)
                logger.info("🔄 RECREATE PIPELINE: Starting transcription...")
                logger.info(f"Meta: {meta.artist} - {meta.title}")
                logger.info("=" * 80)
                try:
                    send_processing_status(meta, 'transcribing')
                except Exception:
                    pass
                logger.info("📞 Rufe transcribe_audio() auf...")
                logger.info(f"Meta-Objekt: {type(meta).__name__}")
                logger.info(f"Meta-Status vor Aufruf: {meta.status}")
                logger.info(f"Thread ID vor Aufruf: {threading.current_thread().ident}")
                
                # Wrapper um transcribe_audio mit zusätzlichem Logging
                result = None
                try:
                    logger.info("🔍 DIREKT VOR transcribe_audio() Aufruf")
                    logger.info("🔍 Thread ID: " + str(threading.current_thread().ident))
                    result = transcribe_audio(meta)
                    logger.info("🔍 DIREKT NACH transcribe_audio() Aufruf - ERFOLGREICH")
                    logger.info(f"🔍 Result: {result}")
                    logger.info(f"🔍 Result Type: {type(result)}")
                    logger.info("🔍 Thread ID nach Aufruf: " + str(threading.current_thread().ident))
                    logger.info(f"📞 transcribe_audio() zurückgegeben: {result}")
                    logger.info(f"Result Type: {type(result)}")
                    logger.info(f"Meta-Status nach Aufruf: {meta.status}")
                    logger.info(f"Thread ID nach Aufruf: {threading.current_thread().ident}")
                    logger.info(f"📞 transcribe_audio() zurückgegeben: {result}")
                    logger.info(f"Result Type: {type(result)}")
                    logger.info(f"Meta-Status nach Aufruf: {meta.status}")
                    logger.info(f"Thread ID nach Aufruf: {threading.current_thread().ident}")
                except BaseException as transcribe_error:
                    import traceback
                    logger.error("=" * 80)
                    logger.error(f"❌ KRITISCHER FEHLER in transcribe_audio: {transcribe_error}", exc_info=True)
                    logger.error(f"Exception Type: {type(transcribe_error).__name__}")
                    logger.error(f"Traceback:\n{traceback.format_exc()}")
                    logger.error("=" * 80)
                    raise
                finally:
                    logger.info("🔍 FINALLY Block nach transcribe_audio()")
                    logger.info(f"Result im FINALLY: {result}")
                
                logger.info("🔍 NACH dem try/except Block - Code wird fortgesetzt")
                logger.info("✅ Transcription completed")
                logger.info("=" * 80)
                
                logger.info("=" * 80)
                logger.info("🔄 RECREATE PIPELINE: Starting cleanup...")
                logger.info(f"Meta: {meta.artist} - {meta.title}")
                logger.info("=" * 80)
                try:
                    logger.info("📞 Rufe cleanup_files() auf...")
                    result = cleanup_files(meta)
                    logger.info(f"📞 cleanup_files() zurückgegeben: {result}")
                    logger.info("✅ Cleanup completed")
                except Exception as cleanup_error:
                    import traceback
                    logger.error("=" * 80)
                    logger.error(f"❌ Cleanup fehlgeschlagen, aber Pipeline wird fortgesetzt: {cleanup_error}", exc_info=True)
                    logger.error(f"Exception Type: {type(cleanup_error).__name__}")
                    logger.error(f"Traceback:\n{traceback.format_exc()}")
                    logger.error("=" * 80)
                    # Pipeline wird trotzdem fortgesetzt, da Cleanup nicht kritisch ist
                
                # Finish - setze korrekte API-URL
                logger.info("🔄 Starting finish...")
                from modules.finish import finish_processing
                finish_processing(meta)
                logger.info("✅ Finish completed")

                logger.info("🎉 Recreate pipeline completed successfully, sending finished status...")
                try:
                    send_processing_status(meta, 'finished')
                    logger.info("✅ Finished status sent successfully")
                except Exception as e:
                    logger.error(f"❌ Failed to send finished status: {e}")
                    
            except BaseException as e:
                import traceback
                logger.error("=" * 80)
                logger.error(f"❌ KRITISCHER FEHLER in recreate pipeline background thread: {e}", exc_info=True)
                logger.error(f"Exception Type: {type(e).__name__}")
                logger.error(f"Traceback:\n{traceback.format_exc()}")
                logger.error("=" * 80)
                try:
                    send_processing_status(meta, 'failed')
                except Exception:
                    pass
            finally:
                logger.info("=" * 80)
                logger.info("🏁 RECREATE PIPELINE THREAD ENDE")
                logger.info(f"Thread ID: {threading.current_thread().ident}")
                logger.info("=" * 80)

        # Start background thread
        thread = threading.Thread(target=run_recreate_pipeline)
        thread.daemon = True
        thread.start()

        # Return immediately
        return jsonify({'success': True, 'message': 'Recreate pipeline started in background'})
        
    except Exception as e:
        logger.error(f"Error starting recreate pipeline: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
