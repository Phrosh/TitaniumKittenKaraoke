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

@app.route('/separate_audio/ultrastar/<folder_name>', methods=['POST'])
def separate_audio(folder_name):
    """
    Separate audio from video file using UVR5 HP2 and HP5 models
    """
    try:
        # Decode folder name
        folder_name = folder_name.replace('%20', ' ')
        folder_path = os.path.join(ULTRASTAR_DIR, folder_name)
        
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
        
        return jsonify({
            'message': 'Audio separation completed',
            'input_file': os.path.basename(audio_file),
            'results': results
        })
        
    except Exception as e:
        logger.error(f"Error separating audio: {str(e)}")
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

@app.route('/download_youtube/ultrastar/<folder_name>', methods=['POST'])
def download_youtube_video(folder_name):
    """
    Download YouTube video to ultrastar folder
    """
    try:
        # Decode folder name
        folder_name = folder_name.replace('%20', ' ')
        folder_path = os.path.join(ULTRASTAR_DIR, folder_name)
        
        if not os.path.exists(folder_path):
            return jsonify({'error': 'Folder not found'}), 404
        
        # Get YouTube URL from request
        data = request.get_json()
        youtube_url = data.get('youtubeUrl')
        
        if not youtube_url:
            return jsonify({'error': 'YouTube URL is required'}), 400
        
        logger.info(f"Starting YouTube download: {youtube_url} to {folder_path}")
        
        # Generate output filename
        output_filename = f"{folder_name}.%(ext)s"
        output_path = os.path.join(folder_path, output_filename)
        
        # Try to import yt_dlp
        try:
            import yt_dlp
        except ImportError:
            logger.error("yt-dlp not installed")
            return jsonify({'error': 'yt-dlp not installed. Please install it in the AI services environment.'}), 500
        
        # Configure yt-dlp options
        ydl_opts = {
            'outtmpl': output_path,
            'format': 'best[ext=mp4]/best[ext=webm]/best',
            'noplaylist': True,
            'extract_flat': False,
            'quiet': False,
            'no_warnings': False,
        }
        
        # Download the video
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                info = ydl.extract_info(youtube_url, download=True)
                logger.info(f"YouTube download completed successfully")
                
                # Check what file was downloaded
                files = os.listdir(folder_path)
                logger.info(f"Files in folder after download: {files}")
                
                downloaded_video = None
                for file in files:
                    ext = os.path.splitext(file)[1].lower()
                    name = os.path.splitext(file)[0].lower()
                    
                    if (ext in ['.mp4', '.webm'] and 
                        'hp2' not in name and 'hp5' not in name and
                        'vocals' not in name and 'instrumental' not in name and
                        'extracted' not in name):
                        downloaded_video = file
                        break
                
                if downloaded_video:
                    return jsonify({
                        'message': 'YouTube video downloaded successfully',
                        'status': 'success',
                        'downloadedFile': downloaded_video,
                        'folderName': folder_name
                    })
                else:
                    return jsonify({
                        'error': 'Download completed but no video file found',
                        'details': f"Files in folder: {', '.join(files)}"
                    }), 500
                    
            except Exception as download_error:
                logger.error(f"YouTube download failed: {download_error}")
                return jsonify({
                    'error': 'YouTube download failed',
                    'details': str(download_error)
                }), 500
        
    except Exception as e:
        logger.error(f"Error downloading YouTube video: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    logger.info("Starting AI Services server...")
    logger.info(f"Karaoke root: {KARAOKE_ROOT}")
    logger.info(f"Ultrastar directory: {ULTRASTAR_DIR}")
    app.run(host='0.0.0.0', port=6000, debug=True)
