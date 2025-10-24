from flask import Blueprint, jsonify
import os
import subprocess
import logging
from ..utils import get_ultrastar_dir

# Erstelle einen Blueprint für Video-Konvertierung
convert_video_bp = Blueprint('convert_video', __name__)

# Logger für Video-Module
logger = logging.getLogger(__name__)

@convert_video_bp.route('/convert_video/ultrastar/<folder_name>', methods=['POST'])
def convert_video(folder_name):
    """
    Convert video file to WebM format using ffmpeg
    """
    try:
        # Decode folder name
        folder_name = folder_name.replace('%20', ' ')
        folder_path = os.path.join(get_ultrastar_dir(), folder_name)
        
        if not os.path.exists(folder_path):
            return jsonify({'error': 'Folder not found'}), 404
        
        # Find video files in the folder
        video_files = []
        for file in os.listdir(folder_path):
            if file.lower().endswith(('.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.mpg', '.mpeg')):
                video_files.append(file)
        
        if not video_files:
            return jsonify({'error': 'No video files found'}), 404
        
        # Use the first video file found
        input_file = video_files[0]
        input_path = os.path.join(folder_path, input_file)
        
        # Generate output filename (replace extension with .webm)
        output_filename = os.path.splitext(input_file)[0] + '.webm'
        output_path = os.path.join(folder_path, output_filename)
        
        # Check if output already exists
        if os.path.exists(output_path):
            return jsonify({
                'message': 'WebM file already exists',
                'output_file': output_filename,
                'status': 'already_exists'
            })
        
        logger.info(f"Converting {input_file} to {output_filename}")
        
        # # Strategy 1: Try to remux to MP4 first (fast, no re-encoding)
        # mp4_filename = os.path.splitext(input_file)[0] + '.mp4'
        # mp4_path = os.path.join(folder_path, mp4_filename)
        
        # logger.info(f"Attempting fast remux to MP4: {mp4_filename}")
        
        # # Try remuxing first (copy streams without re-encoding)
        # remux_cmd = [
        #     'ffmpeg',
        #     '-i', input_path,
        #     '-c', 'copy',  # Copy streams without re-encoding
        #     '-an',  # Remove audio
        #     '-y',  # Overwrite output file
        #     mp4_path
        # ]
        
        # remux_result = subprocess.run(remux_cmd, capture_output=True, text=True)
        
        # if remux_result.returncode == 0:
        #     logger.info(f"Successfully remuxed {input_file} to {mp4_filename}")
        #     return jsonify({
        #         'message': 'Video remuxed successfully to MP4',
        #         'input_file': input_file,
        #         'output_file': mp4_filename,
        #         'method': 'remux',
        #         'status': 'success'
        #     })
        
        # Strategy 2: If remuxing fails, transcode to WebM
        logger.info(f"Remuxing failed, falling back to WebM transcoding")
        
        ffmpeg_cmd = [
            'ffmpeg',
            '-hwaccel', 'cuda',
            '-i', input_path,
            '-an',  # Remove audio for video-only conversion
            '-c:v', 'libvpx-vp9',  # WebM-compatible codec
            '-b:v', '0',
            '-crf', '28',
            '-row-mt', '1',
            '-pix_fmt', 'yuv420p',
            '-y',  # Overwrite output file
            output_path
        ]
        
        # Run ffmpeg transcoding
        result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            logger.info(f"Successfully transcoded {input_file} to {output_filename}")
            return jsonify({
                'message': 'Video transcoded successfully to WebM',
                'input_file': input_file,
                'output_file': output_filename,
                'method': 'transcode',
                'status': 'success'
            })
        else:
            logger.error(f"FFmpeg transcoding error: {result.stderr}")
            return jsonify({
                'error': 'Video conversion failed',
                'details': result.stderr,
                'status': 'error'
            }), 500
            
    except Exception as e:
        logger.error(f"Error converting video: {str(e)}")
        return jsonify({'error': str(e)}), 500
