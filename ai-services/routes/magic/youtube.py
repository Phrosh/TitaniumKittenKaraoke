from flask import Blueprint, jsonify
import os
import logging
from ..utils import get_magic_youtube_dir

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
