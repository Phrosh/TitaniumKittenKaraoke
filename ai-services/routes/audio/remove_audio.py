from flask import Blueprint, jsonify
import os
import logging
from ..utils import remove_audio_from_video, get_ultrastar_dir

# Erstelle einen Blueprint für Audio-Entfernung
remove_audio_bp = Blueprint('remove_audio', __name__)

# Logger für Audio-Module
logger = logging.getLogger(__name__)

@remove_audio_bp.route('/remove_audio_from_video/ultrastar/<folder_name>', methods=['POST'])
def remove_audio_from_video_endpoint(folder_name):
    """
    Remove audio track from video file in the specified folder
    """
    try:
        # Decode folder name
        folder_name = folder_name.replace('%20', ' ')
        folder_path = os.path.join(get_ultrastar_dir(), folder_name)
        
        if not os.path.exists(folder_path):
            return jsonify({'error': 'Folder not found'}), 404
        
        # Remove audio from video
        video_result = remove_audio_from_video(folder_path)
        
        if video_result:
            return jsonify({
                'message': 'Audio track successfully removed from video',
                'video_file': os.path.basename(video_result),
                'status': 'success'
            })
        else:
            return jsonify({
                'error': 'Failed to remove audio from video',
                'status': 'failed'
            }), 500
            
    except Exception as e:
        logger.error(f"Error removing audio from video: {str(e)}")
        return jsonify({'error': str(e)}), 500
