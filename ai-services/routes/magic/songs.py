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


@magic_songs_bp.route('/magic-songs/<folder_name>/process', methods=['POST'])
def process_magic_song(folder_name):
    """Process magic song to generate UltraStar file"""
    try:
        folder_path = os.path.join(get_magic_songs_dir(), folder_name)
        if not os.path.exists(folder_path):
            return jsonify({'error': 'Folder not found'}), 404
        
        # Find audio file
        audio_file = None
        for file in os.listdir(folder_path):
            if file.lower().endswith(('.mp3', '.wav', '.flac', '.m4a', '.aac')):
                audio_file = os.path.join(folder_path, file)
                break
        
        if not audio_file:
            return jsonify({'error': 'No audio file found'}), 400
        
        # Process with new modular system
        from modules import (
            ProcessingMode,
            create_meta_from_file_path,
            normalize_audio_files, separate_audio, dereverb_audio, transcribe_audio, cleanup_files
        )
        
        # Create meta object from folder
        meta = create_meta_from_file_path(folder_path, get_magic_songs_dir(), ProcessingMode.MAGIC_SONGS)
        
        # Process with modular pipeline
        success = True
        try:
            # 1. Audio normalization
            if not normalize_audio_files(meta, simple=True):
                raise Exception("Audio normalization failed")
            
            # 2. Audio separation
            if not separate_audio(meta):
                raise Exception("Audio separation failed")
            
            # 3. Dereverb
            if not dereverb_audio(meta):
                raise Exception("Dereverb failed")
            
            # 4. Transcription
            if not transcribe_audio(meta):
                raise Exception("Transcription failed")
            
            # 5. Cleanup
            try:
                cleanup_files(meta)
            except Exception as cleanup_error:
                logger.error(f"❌ Cleanup fehlgeschlagen, aber Pipeline wird fortgesetzt: {cleanup_error}", exc_info=True)
                # Cleanup ist nicht kritisch, Pipeline wird fortgesetzt
                
        except Exception as e:
            success = False
            error_msg = str(e)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Magic song processed successfully with modular system',
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
        logger.error(f"Error processing magic song: {str(e)}")
        return jsonify({'error': str(e)}), 500