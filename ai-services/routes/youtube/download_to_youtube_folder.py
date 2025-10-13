from flask import Blueprint, jsonify, request
import os
import logging
from ..utils import normalize_audio_in_video, create_sanitized_folder_name, clean_youtube_url, get_youtube_dir

# Erstelle einen Blueprint für YouTube-Folder-Download
youtube_folder_bp = Blueprint('youtube_folder', __name__)

# Logger für YouTube-Module
logger = logging.getLogger(__name__)

@youtube_folder_bp.route('/download_youtube/youtube/<folder_name>', methods=['POST'])
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
        folder_path = os.path.join(get_youtube_dir(), sanitized_folder_name)
        
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
