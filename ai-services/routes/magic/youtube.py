from flask import Blueprint, jsonify, request
import os
import logging
from ..utils import get_magic_youtube_dir, sanitize_filename

# Erstelle einen Blueprint für Magic-YouTube
magic_youtube_bp = Blueprint('magic_youtube', __name__)

# Logger für Magic-Module
logger = logging.getLogger(__name__)

@magic_youtube_bp.route('/magic-youtube', methods=['GET'])
def get_magic_youtube():
    """Get all magic YouTube videos"""
    try:
        videos = []
        magic_youtube_dir = get_magic_youtube_dir()
        
        if os.path.exists(magic_youtube_dir):
            for folder_name in os.listdir(magic_youtube_dir):
                folder_path = os.path.join(magic_youtube_dir, folder_name)
                if os.path.isdir(folder_path):
                    # Check for video files
                    video_files = []
                    ultrastar_files = []
                    remuxed_files = []
                    
                    for file in os.listdir(folder_path):
                        file_path = os.path.join(folder_path, file)
                        if os.path.isfile(file_path):
                            if file.lower().endswith(('.mp4', '.webm', '.mkv')):
                                if file.endswith('_remuxed.mp4'):
                                    remuxed_files.append(file)
                                else:
                                    video_files.append(file)
                            elif file.endswith('_ultrastar.txt'):
                                ultrastar_files.append(file)
                    
                    if video_files:
                        videos.append({
                            'folder_name': folder_name,
                            'video_files': video_files,
                            'remuxed_files': remuxed_files,
                            'ultrastar_files': ultrastar_files,
                            'has_ultrastar': len(ultrastar_files) > 0,
                            'is_remuxed': len(remuxed_files) > 0
                        })
        
        return jsonify({'videos': videos})
    
    except Exception as e:
        logger.error(f"Error getting magic YouTube videos: {str(e)}")
        return jsonify({'error': str(e)}), 500


@magic_youtube_bp.route('/process_magic_youtube/<folder_name>', methods=['POST'])
def process_magic_youtube_from_url(folder_name):
    """Process magic YouTube video from URL to generate UltraStar file"""
    try:
        data = request.get_json()
        youtube_url = data.get('youtubeUrl')
        song_id = data.get('songId')  # Extract song ID from request

        # Send initial status
        try:
            send_processing_status(id=song_id, artist="", title="", status='downloading')
        except Exception:
            pass
        
        if not youtube_url:
            return jsonify({'error': 'YouTube URL is required'}), 400
        
        # Sanitize folder name to remove invalid characters
        sanitized_folder_name = sanitize_filename(folder_name)
        
        logger.info(f"Processing Magic YouTube: {folder_name} -> {sanitized_folder_name} with URL: {youtube_url}, Song ID: {song_id}")
        
        # Create folder if it doesn't exist
        folder_path = os.path.join(get_magic_youtube_dir(), sanitized_folder_name)
        os.makedirs(folder_path, exist_ok=True)
        
        # Download YouTube video
        try:
            import yt_dlp
            
            ydl_opts = {
                'outtmpl': os.path.join(folder_path, '%(id)s.%(ext)s'),
                'format': 'best[height<=720]',  # Limit to 720p for faster processing
                'quiet': False,
                'no_warnings': False,
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(youtube_url, download=True)
                video_id = info.get('id')
                video_file = os.path.join(folder_path, f"{video_id}.{info.get('ext', 'mp4')}")
                
                logger.info(f"Downloaded YouTube video: {video_file}")
                
        except Exception as e:
            logger.error(f"Error downloading YouTube video: {str(e)}")
            return jsonify({'error': f'YouTube download failed: {str(e)}'}), 500
        
        # Process with new modular system
        from modules import (
            ProcessingMode,
            create_meta_from_youtube_url,
            normalize_audio_files, separate_audio, 
            remux_videos, dereverb_audio, transcribe_audio, cleanup_files
        )
        from modules.logger_utils import send_processing_status
        
        # Create meta object from YouTube URL with explicit folder info
        meta = create_meta_from_youtube_url(
            youtube_url=youtube_url,
            base_dir=get_magic_youtube_dir(),
            mode=ProcessingMode.MAGIC_YOUTUBE,
            folder_name=sanitized_folder_name,
            folder_path=folder_path,
        )
        # Add song ID to meta object
        if song_id:
            meta.song_id = song_id
        # Stabiler Basis-Dateiname: bei Magic-YouTube die YouTube-ID
        try:
            video_id = os.path.splitext(os.path.basename(video_file))[0]
            meta.base_filename = video_id
        except Exception:
            meta.base_filename = os.path.splitext(os.path.basename(video_file))[0]
        
        # Register downloaded file
        meta.youtube_file = video_file
        meta.add_input_file(video_file)
        meta.add_output_file(video_file)
        
        # Process with modular pipeline
        success = True
        try:
            # 1. Audio extraction/normalization
            if not normalize_audio_files(meta, simple=True):
                raise Exception("Audio extraction/normalization failed")
            
            # 2. Audio separation
            if not separate_audio(meta):
                raise Exception("Audio separation failed")
            
            # 3. Dereverb
            if not dereverb_audio(meta):
                raise Exception("Dereverb failed")
            
            # 4. Video remuxing (remove audio)
            if not remux_videos(meta, remove_audio=True):
                raise Exception("Video remuxing failed")
            
            # 5. Transcription
            if not transcribe_audio(meta):
                raise Exception("Transcription failed")
            
            # 6. Cleanup
            try:
                cleanup_files(meta)
            except Exception as cleanup_error:
                logger.error(f"❌ Cleanup fehlgeschlagen, aber Pipeline wird fortgesetzt: {cleanup_error}", exc_info=True)
                # Cleanup ist nicht kritisch, Pipeline wird fortgesetzt
            
            # Send finished status
            try:
                send_processing_status(id=getattr(meta, 'song_id', None), artist=meta.artist, title=meta.title, status='finished')
            except Exception:
                pass
                
        except Exception as e:
            success = False
            error_msg = str(e)
            logger.error(f"Magic YouTube processing failed: {e}")
            try:
                send_processing_status(meta, 'failed')
            except Exception:
                pass
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Magic YouTube video processed successfully with modular system',
                'output_files': meta.output_files,
                'steps_completed': meta.steps_completed,
                'video_file': video_file
            })
        else:
            return jsonify({
                'success': False,
                'error': error_msg,
                'steps_failed': meta.steps_failed
            }), 500
    
    except Exception as e:
        logger.error(f"Error processing magic YouTube from URL: {str(e)}")
        return jsonify({'error': str(e)}), 500