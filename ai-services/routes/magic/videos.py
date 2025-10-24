from flask import Blueprint, jsonify
import os
import logging
from ..utils import get_magic_videos_dir

# Erstelle einen Blueprint für Magic-Videos
magic_videos_bp = Blueprint('magic_videos', __name__)

# Logger für Magic-Module
logger = logging.getLogger(__name__)

@magic_videos_bp.route('/magic-videos', methods=['GET'])
def get_magic_videos():
    """Get all magic videos"""
    try:
        videos = []
        magic_videos_dir = get_magic_videos_dir()
        
        if os.path.exists(magic_videos_dir):
            for folder_name in os.listdir(magic_videos_dir):
                folder_path = os.path.join(magic_videos_dir, folder_name)
                if os.path.isdir(folder_path):
                    # Check for video files
                    video_files = []
                    ultrastar_files = []
                    remuxed_files = []
                    
                    for file in os.listdir(folder_path):
                        file_path = os.path.join(folder_path, file)
                        if os.path.isfile(file_path):
                            if file.lower().endswith(('.mp4', '.avi', '.mkv', '.mov', '.wmv', '.mpg', '.mpeg')):
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
        logger.error(f"Error getting magic videos: {str(e)}")
        return jsonify({'error': str(e)}), 500


@magic_videos_bp.route('/magic-videos/<folder_name>/process', methods=['POST'])
def process_magic_video(folder_name):
    """Process magic video to generate UltraStar file"""
    try:
        folder_path = os.path.join(get_magic_videos_dir(), folder_name)
        if not os.path.exists(folder_path):
            return jsonify({'error': 'Folder not found'}), 404
        
        # Find video file
        video_file = None
        for file in os.listdir(folder_path):
            if file.lower().endswith(('.mp4', '.avi', '.mkv', '.mov', '.wmv', '.mpg', '.mpeg')) and not file.endswith('_remuxed.mp4'):
                video_file = os.path.join(folder_path, file)
                break
        
        if not video_file:
            return jsonify({'error': 'No video file found'}), 400
        
        # Process with new modular system
        from modules import (
            ProcessingMode,
            create_meta_from_file_path,
            normalize_audio_files, separate_audio, remux_videos, 
            dereverb_audio, transcribe_audio, cleanup_files
        )
        
        # Create meta object from folder
        meta = create_meta_from_file_path(folder_path, get_magic_videos_dir(), ProcessingMode.MAGIC_VIDEOS)
        
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
            
            # 3. Video remuxing (remove audio)
            if not remux_videos(meta, remove_audio=True):
                raise Exception("Video remuxing failed")
            
            # 5. Transcription
            if not transcribe_audio(meta):
                raise Exception("Transcription failed")
            
            # 6. Cleanup
            if not cleanup_files(meta):
                raise Exception("Cleanup failed")
                
        except Exception as e:
            success = False
            error_msg = str(e)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Magic video processed successfully with modular system',
                'output_files': meta.output_files,
                'steps_completed': meta.steps_completed
            })
        else:
            return jsonify({
                'success': False,
                'error': error_msg,
                'steps_failed': meta.steps_failed
            }), 500
    
    except Exception as e:
        logger.error(f"Error processing magic video: {str(e)}")
        return jsonify({'error': str(e)}), 500