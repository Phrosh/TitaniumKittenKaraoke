from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import subprocess
import logging
from pathlib import Path

app = Flask(__name__)
CORS(app)

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
KARAOKE_ROOT = os.path.join(os.path.dirname(os.path.dirname(__file__)))
ULTRASTAR_DIR = os.path.join(KARAOKE_ROOT, 'songs', 'ultrastar')

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'service': 'ai-services'})

@app.route('/convert_video/ultrastar/<folder_name>', methods=['POST'])
def convert_video(folder_name):
    """
    Convert video file to WebM format using ffmpeg
    """
    try:
        # Decode folder name
        folder_name = folder_name.replace('%20', ' ')
        folder_path = os.path.join(ULTRASTAR_DIR, folder_name)
        
        if not os.path.exists(folder_path):
            return jsonify({'error': 'Folder not found'}), 404
        
        # Find video files in the folder
        video_files = []
        for file in os.listdir(folder_path):
            if file.lower().endswith(('.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv')):
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

@app.route('/song/ultrastar/<folder_name>/video_info', methods=['GET'])
def get_video_info(folder_name):
    """
    Get information about video files in the folder
    """
    try:
        # Decode folder name
        folder_name = folder_name.replace('%20', ' ')
        folder_path = os.path.join(ULTRASTAR_DIR, folder_name)
        
        if not os.path.exists(folder_path):
            return jsonify({'error': 'Folder not found'}), 404
        
        # Find video files
        video_files = []
        for file in os.listdir(folder_path):
            if file.lower().endswith(('.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm')):
                file_path = os.path.join(folder_path, file)
                file_size = os.path.getsize(file_path)
                video_files.append({
                    'filename': file,
                    'extension': os.path.splitext(file)[1].lower(),
                    'size': file_size
                })
        
        return jsonify({
            'folder_name': folder_name,
            'video_files': video_files,
            'count': len(video_files)
        })
        
    except Exception as e:
        logger.error(f"Error getting video info: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    logger.info("Starting AI Services server...")
    logger.info(f"Karaoke root: {KARAOKE_ROOT}")
    logger.info(f"Ultrastar directory: {ULTRASTAR_DIR}")
    app.run(host='0.0.0.0', port=6000, debug=True)
