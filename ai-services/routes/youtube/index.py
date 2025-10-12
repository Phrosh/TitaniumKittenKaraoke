"""
YouTube processing routes for AI services
"""
import os
import logging
from flask import Blueprint, request, jsonify

from utils.youtube_utils import clean_youtube_url
from utils.file_utils import create_sanitized_folder_name
from utils.video_utils import normalize_audio_in_video

logger = logging.getLogger(__name__)
youtube_bp = Blueprint('youtube', __name__)

# Configuration
KARAOKE_ROOT = os.path.dirname(os.path.dirname(__file__))
ULTRASTAR_DIR = os.path.join(KARAOKE_ROOT, 'songs', 'ultrastar')
YOUTUBE_DIR = os.path.join(KARAOKE_ROOT, 'songs', 'youtube')

@youtube_bp.route('/download_youtube/ultrastar/<folder_name>', methods=['POST'])
def download_youtube_video(folder_name):
    """
    Download YouTube video to ultrastar folder
    """
    try:
        # Decode folder name
        folder_name = folder_name.replace('%20', ' ')
        folder_path = os.path.join(ULTRASTAR_DIR, folder_name)
        
        if not os.path.exists(folder_path):
            return jsonify({'error': 'Folder not found'}), 404
        
        # Get YouTube URL from request
        data = request.get_json()
        youtube_url = clean_youtube_url(data.get('youtubeUrl', ''))
        
        if not youtube_url:
            return jsonify({'error': 'YouTube URL is required'}), 400
        
        logger.info(f"Starting YouTube download: {youtube_url} to {folder_path}")
        
        # Generate output filename
        output_filename = f"{folder_name}.%(ext)s"
        output_path = os.path.join(folder_path, output_filename)
        
        # Try to import yt_dlp
        try:
            import yt_dlp
        except ImportError:
            logger.error("yt-dlp not installed")
            return jsonify({'error': 'yt-dlp not installed. Please install it in the AI services environment.'}), 500
        
        # Configure yt-dlp options
        ydl_opts = {
            'outtmpl': output_path,
            'format': 'best[ext=mp4]/best[ext=webm]/best',
            'noplaylist': True,
            'extract_flat': False,
            'quiet': False,
            'no_warnings': False,
        }
        
        # Download the video
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                info = ydl.extract_info(youtube_url, download=True)
                logger.info(f"YouTube download completed successfully")
                
                # Check what file was downloaded
                files = os.listdir(folder_path)
                logger.info(f"Files in folder after download: {files}")
                
                downloaded_video = None
                for file in files:
                    ext = os.path.splitext(file)[1].lower()
                    name = os.path.splitext(file)[0].lower()
                    
                    if (ext in ['.mp4', '.webm'] and 
                        'hp2' not in name and 'hp5' not in name and
                        'vocals' not in name and 'instrumental' not in name and
                        'extracted' not in name):
                        downloaded_video = file
                        break
                
                if downloaded_video:
                    # Normalize audio in the downloaded video
                    video_path = os.path.join(folder_path, downloaded_video)
                    logger.info(f"Starting audio normalization for: {video_path}")
                    
                    normalized_path = normalize_audio_in_video(video_path)
                    if normalized_path:
                        logger.info(f"Audio normalization completed successfully")
                        normalization_status = 'success'
                    else:
                        logger.warning(f"Audio normalization failed, but video download was successful")
                        normalization_status = 'failed'
                    
                    return jsonify({
                        'message': 'YouTube video downloaded successfully',
                        'status': 'success',
                        'downloadedFile': downloaded_video,
                        'folderName': folder_name,
                        'audioNormalization': normalization_status
                    })
                else:
                    return jsonify({
                        'error': 'Download completed but no video file found',
                        'details': f"Files in folder: {', '.join(files)}"
                    }), 500
                    
            except Exception as download_error:
                logger.error(f"YouTube download failed: {download_error}")
                return jsonify({
                    'error': 'YouTube download failed',
                    'details': str(download_error)
                }), 500
        
    except Exception as e:
        logger.error(f"Error downloading YouTube video: {str(e)}")
        return jsonify({'error': str(e)}), 500

@youtube_bp.route('/download_youtube/youtube/<folder_name>', methods=['POST'])
def download_youtube_video_to_youtube_folder(folder_name):
    """
    Download YouTube video to songs/youtube folder
    """
    try:
        # Decode folder name
        folder_name = folder_name.replace('%20', ' ')
        
        # Get YouTube URL and metadata from request
        data = request.get_json()
        youtube_url = clean_youtube_url(data.get('youtubeUrl', ''))
        video_id = data.get('videoId')
        artist = data.get('artist', 'Unknown Artist')
        title = data.get('title', 'Unknown Title')
        
        # Create sanitized folder name
        sanitized_folder_name = create_sanitized_folder_name(artist, title)
        folder_path = os.path.join(YOUTUBE_DIR, sanitized_folder_name)
        
        # Create folder if it doesn't exist
        if not os.path.exists(folder_path):
            os.makedirs(folder_path, exist_ok=True)
        
        if not youtube_url:
            return jsonify({'error': 'YouTube URL is required'}), 400
        
        logger.info(f"Starting YouTube download: {youtube_url} to {folder_path}")
        
        # Check if video already exists
        if os.path.exists(folder_path):
            existing_files = os.listdir(folder_path)
            video_files = [f for f in existing_files if f.lower().endswith(('.mp4', '.webm', '.avi', '.mov', '.mkv'))]
            
            if video_files:
                return jsonify({
                    'message': 'Video already exists',
                    'status': 'already_exists',
                    'videoFile': video_files[0],
                    'folderName': sanitized_folder_name
                })
        
        # Generate output filename using video ID
        if video_id:
            output_filename = f"{video_id}.%(ext)s"
        else:
            # Fallback to sanitized folder name if no video ID
            output_filename = f"{sanitized_folder_name}.%(ext)s"
        
        output_path = os.path.join(folder_path, output_filename)
        
        # Try to import yt_dlp
        try:
            import yt_dlp
        except ImportError:
            logger.error("yt-dlp not installed")
            return jsonify({'error': 'yt-dlp not installed. Please install it in the AI services environment.'}), 500
        
        # Configure yt-dlp options
        ydl_opts = {
            'outtmpl': output_path,
            'format': 'best[ext=mp4]/best[ext=webm]/best',
            'noplaylist': True,
            'extract_flat': False,
            'quiet': False,
            'no_warnings': False,
        }
        
        # Download the video
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                info = ydl.extract_info(youtube_url, download=True)
                logger.info(f"YouTube download completed successfully")
                
                # Check what file was downloaded
                files = os.listdir(folder_path)
                logger.info(f"Files in folder after download: {files}")
                
                downloaded_video = None
                for file in files:
                    ext = os.path.splitext(file)[1].lower()
                    if ext in ['.mp4', '.webm', '.avi', '.mov', '.mkv']:
                        downloaded_video = file
                        break
                
                if downloaded_video:
                    # Normalize audio in the downloaded video
                    video_path = os.path.join(folder_path, downloaded_video)
                    logger.info(f"Starting audio normalization for: {video_path}")
                    
                    normalized_path = normalize_audio_in_video(video_path)
                    if normalized_path:
                        logger.info(f"Audio normalization completed successfully")
                        normalization_status = 'success'
                    else:
                        logger.warning(f"Audio normalization failed, but video download was successful")
                        normalization_status = 'failed'
                    
                    return jsonify({
                        'message': 'YouTube video downloaded successfully',
                        'status': 'success',
                        'videoFile': downloaded_video,
                        'folderName': sanitized_folder_name,
                        'videoId': video_id,
                        'artist': artist,
                        'title': title,
                        'audioNormalization': normalization_status
                    })
                else:
                    return jsonify({
                        'error': 'Download completed but no video file found',
                        'details': f"Files in folder: {', '.join(files)}"
                    }), 500
                    
            except Exception as download_error:
                logger.error(f"YouTube download failed: {download_error}")
                return jsonify({
                    'error': 'YouTube download failed',
                    'details': str(download_error)
                }), 500
        
    except Exception as e:
        logger.error(f"Error downloading YouTube video: {str(e)}")
        return jsonify({'error': str(e)}), 500

@youtube_bp.route('/process_youtube_cache/<folder_name>', methods=['POST'])
def process_youtube_cache(folder_name):
    try:
        from modules import (
            ProcessingMode,
            create_meta_from_file_path,
            normalize_audio_files,
            cleanup_files
        )
        from modules.logger_utils import meta_to_short_dict, send_processing_status
        import threading

        base_dir = os.path.join(KARAOKE_ROOT, 'songs', 'youtube')
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
                    send_processing_status(artist=meta.artist, title=meta.title, status='processing')
                except Exception:
                    pass
                # 1) normalize (simple)
                normalize_audio_files(meta, simple=True)
                # 2) cleanup
                cleanup_files(meta)
                
                # 3) finish - setze korrekte API-URL
                from modules.finish import finish_processing
                finish_processing(meta)
                
                try:
                    send_processing_status(artist=meta.artist, title=meta.title, status='finished')
                except Exception:
                    pass
            except Exception as e:
                logger.error(f"Error processing youtube cache (bg): {e}")
                try:
                    send_processing_status(artist=meta.artist, title=meta.title, status='failed')
                except Exception:
                    pass

        threading.Thread(target=_worker, daemon=True).start()
        return jsonify({'success': True, 'started': True})
    except Exception as e:
        logger.error(f"Error processing youtube cache: {e}")
        return jsonify({'error': str(e)}), 500
