from flask import Blueprint, jsonify
import os
import logging
from ..utils import get_magic_songs_dir

# Erstelle einen Blueprint für Magic-Songs
magic_songs_bp = Blueprint('magic_songs', __name__)

# Logger für Magic-Module
logger = logging.getLogger(__name__)

@magic_songs_bp.route('/magic-songs', methods=['GET'])
def get_magic_songs():
    """Get all magic songs"""
    try:
        songs = []
        magic_songs_dir = get_magic_songs_dir()
        
        if os.path.exists(magic_songs_dir):
            for folder_name in os.listdir(magic_songs_dir):
                folder_path = os.path.join(magic_songs_dir, folder_name)
                if os.path.isdir(folder_path):
                    # Check for audio files
                    audio_files = []
                    ultrastar_files = []
                    cover_files = []
                    
                    for file in os.listdir(folder_path):
                        file_path = os.path.join(folder_path, file)
                        if os.path.isfile(file_path):
                            if file.lower().endswith(('.mp3', '.wav', '.flac', '.m4a', '.aac')):
                                audio_files.append(file)
                            elif file.endswith('_ultrastar.txt'):
                                ultrastar_files.append(file)
                            elif file.lower().startswith('cover') and file.lower().endswith(('.jpg', '.jpeg', '.png', '.gif')):
                                cover_files.append(file)
                    
                    if audio_files:
                        songs.append({
                            'folder_name': folder_name,
                            'audio_files': audio_files,
                            'ultrastar_files': ultrastar_files,
                            'cover_files': cover_files,
                            'has_ultrastar': len(ultrastar_files) > 0,
                            'has_cover': len(cover_files) > 0
                        })
        
        return jsonify({'songs': songs})
    
    except Exception as e:
        logger.error(f"Error getting magic songs: {str(e)}")
        return jsonify({'error': str(e)}), 500
