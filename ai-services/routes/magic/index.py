"""
Magic songs/videos/youtube routes for AI services
"""
import os
import logging
from flask import Blueprint, jsonify

logger = logging.getLogger(__name__)
magic_bp = Blueprint('magic', __name__)

# Configuration
KARAOKE_ROOT = os.path.dirname(os.path.dirname(__file__))
MAGIC_SONGS_DIR = os.path.join(KARAOKE_ROOT, 'songs', 'magic-songs')
MAGIC_VIDEOS_DIR = os.path.join(KARAOKE_ROOT, 'songs', 'magic-videos')
MAGIC_YOUTUBE_DIR = os.path.join(KARAOKE_ROOT, 'songs', 'magic-youtube')

@magic_bp.route('/magic-songs', methods=['GET'])
def get_magic_songs():
    """Get all magic songs"""
    try:
        songs = []
        if os.path.exists(MAGIC_SONGS_DIR):
            for folder_name in os.listdir(MAGIC_SONGS_DIR):
                folder_path = os.path.join(MAGIC_SONGS_DIR, folder_name)
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

@magic_bp.route('/magic-videos', methods=['GET'])
def get_magic_videos():
    """Get all magic videos"""
    try:
        videos = []
        if os.path.exists(MAGIC_VIDEOS_DIR):
            for folder_name in os.listdir(MAGIC_VIDEOS_DIR):
                folder_path = os.path.join(MAGIC_VIDEOS_DIR, folder_name)
                if os.path.isdir(folder_path):
                    # Check for video files
                    video_files = []
                    ultrastar_files = []
                    remuxed_files = []
                    
                    for file in os.listdir(folder_path):
                        file_path = os.path.join(folder_path, file)
                        if os.path.isfile(file_path):
                            if file.lower().endswith(('.mp4', '.avi', '.mkv', '.mov', '.wmv')):
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

@magic_bp.route('/magic-youtube', methods=['GET'])
def get_magic_youtube():
    """Get all magic YouTube videos"""
    try:
        videos = []
        if os.path.exists(MAGIC_YOUTUBE_DIR):
            for folder_name in os.listdir(MAGIC_YOUTUBE_DIR):
                folder_path = os.path.join(MAGIC_YOUTUBE_DIR, folder_name)
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
