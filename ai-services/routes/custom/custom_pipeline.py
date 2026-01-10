from flask import Blueprint, jsonify, request
import os
import logging
import threading
from ..utils import get_custom_dir, sanitize_filename, clean_youtube_url

# Erstelle einen Blueprint für Custom Pipeline
custom_pipeline_bp = Blueprint('custom_pipeline', __name__)

# Logger für Custom Pipeline
logger = logging.getLogger(__name__)

@custom_pipeline_bp.route('/custom-pipeline', methods=['POST'])
def process_custom_pipeline():
    """Custom Pipeline für YouTube-Videos mit auswählbaren Schritten"""
    try:
        data = request.get_json()
        youtube_url = data.get('youtubeUrl')
        selected_steps = data.get('selectedSteps', [])
        
        if not youtube_url:
            return jsonify({'error': 'YouTube URL is required'}), 400
        
        if not selected_steps:
            return jsonify({'error': 'At least one processing step must be selected'}), 400
        
        # Clean YouTube URL
        youtube_url = clean_youtube_url(youtube_url)
        
        # Extract video ID for folder name
        try:
            import yt_dlp
            with yt_dlp.YoutubeDL({'quiet': True}) as ydl:
                info = ydl.extract_info(youtube_url, download=False)
                video_id = info.get('id', 'unknown')
        except Exception as e:
            logger.warning(f"Could not extract video ID, using timestamp: {e}")
            import time
            video_id = f"custom_{int(time.time())}"
        
        # Create folder name from video ID
        folder_name = f"custom_{video_id}"
        sanitized_folder_name = sanitize_filename(folder_name)
        
        # Create folder path
        folder_path = os.path.join(get_custom_dir(), sanitized_folder_name)
        os.makedirs(folder_path, exist_ok=True)
        
        logger.info(f"Processing custom pipeline: {youtube_url} to {folder_path} with steps: {selected_steps}")
        
        # Run processing in background thread
        def run_custom_pipeline():
            try:
                from modules import (
                    ProcessingMode,
                    create_meta_from_youtube_url,
                    download_youtube_video,
                    normalize_audio_files,
                    separate_audio,
                    dereverb_audio,
                    remux_videos,
                    transcribe_audio,
                    cleanup_files
                )
                
                # Create meta object
                meta = create_meta_from_youtube_url(
                    youtube_url=youtube_url,
                    base_dir=get_custom_dir(),
                    mode=ProcessingMode.MAGIC_YOUTUBE,  # Use similar mode
                    folder_name=sanitized_folder_name,
                    folder_path=folder_path,
                )
                
                # Set base filename
                meta.base_filename = video_id
                
                success = True
                error_msg = None
                
                try:
                    # 1. YouTube Download (if selected)
                    if 'youtube_download' in selected_steps:
                        logger.info("🔄 Starting YouTube download...")
                        download_success = download_youtube_video(meta)
                        if download_success:
                            # Find the downloaded video file
                            video_files = [f for f in os.listdir(folder_path) 
                                         if f.lower().endswith(('.mp4', '.webm', '.mkv'))]
                            if video_files:
                                video_file = os.path.join(folder_path, video_files[0])
                                meta.youtube_file = video_file
                                meta.add_input_file(video_file)
                                meta.add_output_file(video_file)
                            logger.info("✅ YouTube download completed")
                        else:
                            raise Exception("YouTube download failed")
                    
                    # 2. Audio Normalization (if selected)
                    if 'audio_normalization' in selected_steps:
                        logger.info("🔄 Starting audio normalization...")
                        if not normalize_audio_files(meta, simple=True):
                            raise Exception("Audio normalization failed")
                        logger.info("✅ Audio normalization completed")
                    
                    # 3. Audio Separation (if selected)
                    if 'audio_separation' in selected_steps:
                        logger.info("🔄 Starting audio separation...")
                        if not separate_audio(meta):
                            raise Exception("Audio separation failed")
                        logger.info("✅ Audio separation completed")
                    
                    # 4. Dereverb (if selected)
                    if 'dereverb' in selected_steps:
                        logger.info("🔄 Starting dereverb...")
                        if not dereverb_audio(meta):
                            raise Exception("Dereverb failed")
                        logger.info("✅ Dereverb completed")
                    
                    # 5. Video Remuxing (if selected)
                    if 'video_remuxing' in selected_steps:
                        logger.info("🔄 Starting video remuxing...")
                        if not remux_videos(meta, remove_audio=True):
                            raise Exception("Video remuxing failed")
                        logger.info("✅ Video remuxing completed")
                    
                    # 6. Transcription (if selected)
                    if 'transcription' in selected_steps:
                        logger.info("🔄 Starting transcription...")
                        if not transcribe_audio(meta):
                            raise Exception("Transcription failed")
                        logger.info("✅ Transcription completed")
                    
                    # 7. Cleanup (if selected)
                    if 'cleanup' in selected_steps:
                        logger.info("🔄 Starting cleanup...")
                        try:
                            cleanup_files(meta)
                            logger.info("✅ Cleanup completed")
                        except Exception as cleanup_error:
                            logger.warning(f"⚠️ Cleanup fehlgeschlagen, aber Pipeline wird fortgesetzt: {cleanup_error}")
                    
                except Exception as e:
                    success = False
                    error_msg = str(e)
                    logger.error(f"Custom pipeline processing failed: {e}")
                
                if success:
                    logger.info(f"🎉 Custom pipeline completed successfully: {folder_path}")
                else:
                    logger.error(f"❌ Custom pipeline failed: {error_msg}")
                    
            except Exception as e:
                logger.error(f"Error in custom pipeline thread: {e}", exc_info=True)
        
        # Start processing in background
        thread = threading.Thread(target=run_custom_pipeline, daemon=True)
        thread.start()
        
        return jsonify({
            'success': True,
            'message': 'Custom pipeline started',
            'folder_name': sanitized_folder_name,
            'folder_path': folder_path
        })
    
    except Exception as e:
        logger.error(f"Error processing custom pipeline: {str(e)}")
        return jsonify({'error': str(e)}), 500
