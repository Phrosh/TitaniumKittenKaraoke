from flask import Blueprint, jsonify
import os
import logging
from ..utils import remove_audio_from_video, get_ultrastar_dir

# Erstelle einen Blueprint für Audio-Separation
separate_audio_bp = Blueprint('separate_audio', __name__)

# Logger für Audio-Module
logger = logging.getLogger(__name__)

@separate_audio_bp.route('/separate_audio/ultrastar/<folder_name>', methods=['POST'])
def separate_audio(folder_name):
    """
    Separate audio from video file using UVR5 HP2 and HP5 models
    """
    try:
        # Decode folder name
        folder_name = folder_name.replace('%20', ' ')
        folder_path = os.path.join(get_ultrastar_dir(), folder_name)
        
        if not os.path.exists(folder_path):
            return jsonify({'error': 'Folder not found'}), 404
        
        # Import audio separator
        from audio_separator import separate_audio_with_uvr5, find_audio_file
        
        # Find the main audio file
        audio_file = find_audio_file(folder_path)
        if not audio_file:
            return jsonify({'error': 'No suitable audio file found'}), 404
        
        logger.info(f"Starting audio separation for {audio_file}")
        
        results = []
        
        # Separate with HP2 model
        try:
            hp2_output = separate_audio_with_uvr5(folder_path, 'HP2')
            results.append({
                'model': 'HP2',
                'output_file': os.path.basename(hp2_output),
                'status': 'success'
            })
            logger.info(f"HP2 separation completed: {hp2_output}")
        except Exception as e:
            logger.error(f"HP2 separation failed: {e}")
            results.append({
                'model': 'HP2',
                'status': 'failed',
                'error': str(e)
            })
        
        # Separate with HP5 model
        try:
            hp5_output = separate_audio_with_uvr5(folder_path, 'HP5')
            results.append({
                'model': 'HP5',
                'output_file': os.path.basename(hp5_output),
                'status': 'success'
            })
            logger.info(f"HP5 separation completed: {hp5_output}")
        except Exception as e:
            logger.error(f"HP5 separation failed: {e}")
            results.append({
                'model': 'HP5',
                'status': 'failed',
                'error': str(e)
            })
        
        # After audio separation, remove audio from video
        video_remux_result = None
        try:
            logger.info("Starting video remux to remove audio track...")
            video_result = remove_audio_from_video(folder_path)
            
            if video_result:
                logger.info("Successfully removed audio from video")
                video_remux_result = {
                    'status': 'success',
                    'message': 'Audio track removed from video',
                    'video_file': os.path.basename(video_result)
                }
            else:
                logger.warning("Failed to remove audio from video")
                video_remux_result = {
                    'status': 'failed',
                    'message': 'Failed to remove audio from video'
                }
                
        except Exception as e:
            logger.warning(f"Could not remove audio from video: {str(e)}")
            video_remux_result = {
                'status': 'failed',
                'message': f'Video remux failed: {str(e)}'
            }
        
        return jsonify({
            'message': 'Audio separation completed',
            'input_file': os.path.basename(audio_file),
            'results': results,
            'video_remux': video_remux_result
        })
        
    except Exception as e:
        logger.error(f"Error separating audio: {str(e)}")
        return jsonify({'error': str(e)}), 500
