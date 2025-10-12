"""
USDB (UltraStar Database) routes for AI services
"""
import os
import logging
from flask import Blueprint, request, jsonify

from usdb_scraper_improved import USDBScraperImproved, download_from_usdb_improved

logger = logging.getLogger(__name__)
usdb_bp = Blueprint('usdb', __name__)

# Configuration
KARAOKE_ROOT = os.path.dirname(os.path.dirname(__file__))
ULTRASTAR_DIR = os.path.join(KARAOKE_ROOT, 'songs', 'ultrastar')

@usdb_bp.route('/usdb/download', methods=['POST'])
def download_usdb_song():
    """
    Download a song from USDB
    """
    try:
        data = request.get_json()
        song_id = data.get('songId')
        username = data.get('username')
        password = data.get('password')
        
        if not song_id:
            return jsonify({'error': 'Song ID is required'}), 400
        
        if not username or not password:
            return jsonify({'error': 'USDB credentials are required'}), 400
        
        # Create output directory for the song
        song_folder_name = f"USDB_{song_id}"
        output_dir = os.path.join(ULTRASTAR_DIR, song_folder_name)
        
        logger.info(f"Downloading USDB song {song_id} to {output_dir}")
        
        # Download the song using improved scraper
        result = download_from_usdb_improved(song_id, username, password, output_dir)
        
        # Verify download - check if video file exists
        video_files = [f for f in result['files'] if f.endswith(('.mp4', '.webm'))]
        if not video_files:
            # No video found, delete the folder and return error
            import shutil
            if os.path.exists(result['output_dir']):
                shutil.rmtree(result['output_dir'])
                logger.warning(f"Deleted folder {result['output_dir']} - no video file found")
            
            return jsonify({
                'success': False,
                'error': 'Download fehlgeschlagen: Kein Video gefunden. Der Ordner wurde gelöscht.',
                'message': 'Download fehlgeschlagen: Kein Video gefunden'
            }), 500
        
        # Prepare response data
        response_data = {
            'success': True,
            'message': 'Song downloaded successfully',
            'song_info': result['song_info'],
            'folder_name': song_folder_name,
            'files': result['files'],
            'audio_separation': None
        }
        
        # Check if video was downloaded and start audio separation (separate try-catch)
        if result['success'] and result['song_info'].get('video_url'):
            # Check if video files exist
            video_files = [f for f in result['files'] if f.endswith(('.mp4', '.webm'))]
            if video_files:
                try:
                    logger.info("Starting audio separation for downloaded video...")
                    
                    # Use the existing separate_audio function
                    folder_name = result['folder_name']
                    audio_result = separate_audio(folder_name)
                    
                    if isinstance(audio_result, tuple):
                        # If it's a tuple (response, status_code), extract the JSON
                        response_data_audio, status_code = audio_result
                        if status_code == 200:
                            response_data['audio_separation'] = response_data_audio.get_json()
                            logger.info("Audio separation completed successfully")
                        else:
                            logger.warning(f"Audio separation failed with status {status_code}")
                            response_data['audio_separation'] = {'status': 'failed', 'message': f'Audio separation failed with status {status_code}'}
                    else:
                        # If it's already a JSON response
                        response_data['audio_separation'] = audio_result.get_json() if hasattr(audio_result, 'get_json') else audio_result
                        if response_data['audio_separation']:
                            logger.info("Audio separation completed successfully")
                        
                except Exception as e:
                    logger.warning(f"Could not separate audio: {str(e)}")
                    response_data['audio_separation'] = {'status': 'failed', 'message': f'Audio separation failed: {str(e)}'}
                
                # After audio separation, remove audio from video (separate try-catch)
                try:
                    logger.info("Starting video remux to remove audio track...")
                    
                    # Remove audio from video
                    folder_path = os.path.join(ULTRASTAR_DIR, result['folder_name'])
                    from utils.video_utils import remove_audio_from_video
                    video_result = remove_audio_from_video(folder_path)
                    
                    if video_result:
                        logger.info("Successfully removed audio from video")
                        response_data['video_remux'] = {
                            'status': 'success',
                            'message': 'Audio track removed from video',
                            'video_file': os.path.basename(video_result)
                        }
                    else:
                        logger.warning("Failed to remove audio from video")
                        response_data['video_remux'] = {
                            'status': 'failed',
                            'message': 'Failed to remove audio from video'
                        }
                        
                except Exception as e:
                    logger.warning(f"Could not remove audio from video: {str(e)}")
                    response_data['video_remux'] = {
                        'status': 'failed',
                        'message': f'Video remux failed: {str(e)}'
                    }
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error downloading USDB song: {str(e)}")
        return jsonify({'error': str(e)}), 500

@usdb_bp.route('/usdb/search', methods=['POST'])
def search_usdb():
    """
    Search for songs on USDB using the proven usdb_find_ids.py script
    """
    try:
        data = request.get_json()
        interpret = data.get('interpret', '')
        title = data.get('title', '')
        limit = data.get('limit', 20)
        
        # Support legacy query parameter
        if not interpret and not title:
            query = data.get('query', '')
            if query:
                # Try to parse query into interpret and title
                # Simple heuristic: if query contains " - ", split it
                if ' - ' in query:
                    parts = query.split(' - ', 1)
                    interpret = parts[0].strip()
                    title = parts[1].strip()
                else:
                    # Default to searching in interpret field
                    interpret = query
        
        if not interpret and not title:
            return jsonify({'error': 'Interpret or title is required'}), 400
        
        logger.info(f"Searching USDB: interpret='{interpret}', title='{title}', limit={limit}")
        
        # Get USDB credentials from environment or request
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'error': 'USDB credentials are required'}), 400
        
        # Import the functions from usdb_find_ids.py
        import sys
        import os
        sys.path.append(os.path.dirname(__file__))
        
        from usdb_find_ids import login, search_all_by_artist
        import requests
        
        # Create session and login
        session = requests.Session()
        session.headers.update({"User-Agent": "Mozilla/5.0"})
        
        try:
            login(session, username, password)
            logger.info("Login successful")
        except Exception as e:
            logger.error(f"Login failed: {str(e)}")
            return jsonify({'error': f'Login failed: {str(e)}'}), 401
        
        # Search for songs
        try:
            songs = search_all_by_artist(session, interpret, title, per_page=limit, max_items=limit)
            logger.info(f"Found {len(songs)} songs")
            
            # Convert to the expected format
            formatted_songs = []
            for song in songs:
                formatted_songs.append({
                    "id": song["id"],
                    "artist": song.get("artist", "Unknown Artist"),
                    "title": song["title"],
                    "url": f"https://usdb.animux.de/?link=detail&id={song['id']}"
                })
            
            return jsonify({
                'success': True,
                'songs': formatted_songs,
                'count': len(formatted_songs)
            })
            
        except Exception as e:
            logger.error(f"Search failed: {str(e)}")
            return jsonify({'error': f'Search failed: {str(e)}'}), 500
        
    except Exception as e:
        logger.error(f"Error searching USDB: {str(e)}")
        return jsonify({'error': str(e)}), 500

@usdb_bp.route('/usdb/song/<song_id>', methods=['GET'])
def get_usdb_song_info(song_id):
    """
    Get information about a specific USDB song
    """
    try:
        scraper = USDBScraperImproved()
        song_info = scraper.get_song_info(song_id)
        
        return jsonify({
            'success': True,
            'song_info': song_info
        })
        
    except Exception as e:
        logger.error(f"Error getting USDB song info: {str(e)}")
        return jsonify({'error': str(e)}), 500

@usdb_bp.route('/usdb/process/<folder_name>', methods=['POST'])
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
        base_dir = ULTRASTAR_DIR
        temp_folder_name = folder_name  # USDB_17878
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
        import threading
        
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
                            import shutil
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
                        import shutil
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
                        import shutil
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
                        import shutil
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
                cleanup_files(meta)
                logger.info("✅ Cleanup completed")
                
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
                    import shutil
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
