from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import subprocess
import logging
from pathlib import Path
from usdb_scraper_improved import USDBScraperImproved, download_from_usdb_improved

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

def remove_audio_from_video(folder_path):
    """
    Remove audio track from video file using ffmpeg
    """
    try:
        # Find video files in the folder
        video_files = []
        for file in os.listdir(folder_path):
            if file.lower().endswith(('.mp4', '.webm', '.avi', '.mov', '.mkv', '.wmv', '.flv')):
                video_files.append(file)
        
        if not video_files:
            logger.warning(f"No video files found in {folder_path}")
            return None
        
        # Use the first video file found
        input_file = video_files[0]
        input_path = os.path.join(folder_path, input_file)
        
        # Create output filename (keep original extension)
        base_name = os.path.splitext(input_file)[0]
        extension = os.path.splitext(input_file)[1]
        output_file = f"{base_name}_no_audio{extension}"
        output_path = os.path.join(folder_path, output_file)
        
        logger.info(f"Removing audio from video: {input_path} -> {output_path}")
        
        # Use ffmpeg to remove audio track
        cmd = [
            'ffmpeg',
            '-i', input_path,
            '-c:v', 'copy',  # Copy video stream without re-encoding
            '-an',           # Remove audio stream
            '-y',            # Overwrite output file if it exists
            output_path
        ]
        
        logger.info(f"Running ffmpeg command: {' '.join(cmd)}")
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        
        if result.returncode == 0:
            logger.info(f"Successfully removed audio from video: {output_path}")
            
            # Replace original video with the one without audio
            try:
                os.replace(output_path, input_path)
                logger.info(f"Replaced original video with audio-free version: {input_path}")
                return input_path
            except Exception as e:
                logger.error(f"Error replacing original video: {e}")
                return output_path
        else:
            logger.error(f"ffmpeg failed with return code {result.returncode}")
            logger.error(f"ffmpeg stderr: {result.stderr}")
            return None
            
    except subprocess.TimeoutExpired:
        logger.error("ffmpeg command timed out")
        return None
    except Exception as e:
        logger.error(f"Error removing audio from video: {e}")
        return None

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

@app.route('/remove_audio_from_video/ultrastar/<folder_name>', methods=['POST'])
def remove_audio_from_video_endpoint(folder_name):
    """
    Remove audio track from video file in the specified folder
    """
    try:
        # Decode folder name
        folder_name = folder_name.replace('%20', ' ')
        folder_path = os.path.join(ULTRASTAR_DIR, folder_name)
        
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

@app.route('/usdb/search', methods=['POST'])
def search_usdb():
    """
    Search for songs on USDB
    """
    try:
        data = request.get_json()
        query = data.get('query', '')
        limit = data.get('limit', 20)
        
        if not query:
            return jsonify({'error': 'Search query is required'}), 400
        
        logger.info(f"Searching USDB for: {query}")
        
        scraper = USDBScraperImproved()
        songs = scraper.search_songs(query, limit)
        
        return jsonify({
            'success': True,
            'songs': songs,
            'count': len(songs)
        })
        
    except Exception as e:
        logger.error(f"Error searching USDB: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/usdb/download', methods=['POST'])
def download_usdb_song():
    """
    Download a song from USDB
    """
    try:
        data = request.get_json()
        song_id = data.get('songId')
        username = data.get('username')
        password = data.get('password')
        
        if not song_id:
            return jsonify({'error': 'Song ID is required'}), 400
        
        if not username or not password:
            return jsonify({'error': 'USDB credentials are required'}), 400
        
        # Create output directory for the song
        song_folder_name = f"USDB_{song_id}"
        output_dir = os.path.join(ULTRASTAR_DIR, song_folder_name)
        
        logger.info(f"Downloading USDB song {song_id} to {output_dir}")
        
        # Download the song using improved scraper
        result = download_from_usdb_improved(song_id, username, password, output_dir)
        
        # Verify download - check if video file exists
        video_files = [f for f in result['files'] if f.endswith(('.mp4', '.webm'))]
        if not video_files:
            # No video found, delete the folder and return error
            import shutil
            if os.path.exists(result['output_dir']):
                shutil.rmtree(result['output_dir'])
                logger.warning(f"Deleted folder {result['output_dir']} - no video file found")
            
            return jsonify({
                'success': False,
                'error': 'Download fehlgeschlagen: Kein Video gefunden. Der Ordner wurde gelöscht.',
                'message': 'Download fehlgeschlagen: Kein Video gefunden'
            }), 500
        
        # Prepare response data
        response_data = {
            'success': True,
            'message': 'Song downloaded successfully',
            'song_info': result['song_info'],
            'folder_name': song_folder_name,
            'files': result['files'],
            'audio_separation': None
        }
        
        # Check if video was downloaded and start audio separation (separate try-catch)
        if result['success'] and result['song_info'].get('video_url'):
            # Check if video files exist
            video_files = [f for f in result['files'] if f.endswith(('.mp4', '.webm'))]
            if video_files:
                try:
                    logger.info("Starting audio separation for downloaded video...")
                    
                    # Use the existing separate_audio function
                    folder_name = result['folder_name']
                    audio_result = separate_audio(folder_name)
                    
                    if isinstance(audio_result, tuple):
                        # If it's a tuple (response, status_code), extract the JSON
                        response_data_audio, status_code = audio_result
                        if status_code == 200:
                            response_data['audio_separation'] = response_data_audio.get_json()
                            logger.info("Audio separation completed successfully")
                        else:
                            logger.warning(f"Audio separation failed with status {status_code}")
                            response_data['audio_separation'] = {'status': 'failed', 'message': f'Audio separation failed with status {status_code}'}
                    else:
                        # If it's already a JSON response
                        response_data['audio_separation'] = audio_result.get_json() if hasattr(audio_result, 'get_json') else audio_result
                        if response_data['audio_separation']:
                            logger.info("Audio separation completed successfully")
                        
                except Exception as e:
                    logger.warning(f"Could not separate audio: {str(e)}")
                    response_data['audio_separation'] = {'status': 'failed', 'message': f'Audio separation failed: {str(e)}'}
                
                # After audio separation, remove audio from video (separate try-catch)
                try:
                    logger.info("Starting video remux to remove audio track...")
                    
                    # Remove audio from video
                    folder_path = os.path.join(ULTRASTAR_DIR, result['folder_name'])
                    video_result = remove_audio_from_video(folder_path)
                    
                    if video_result:
                        logger.info("Successfully removed audio from video")
                        response_data['video_remux'] = {
                            'status': 'success',
                            'message': 'Audio track removed from video',
                            'video_file': os.path.basename(video_result)
                        }
                    else:
                        logger.warning("Failed to remove audio from video")
                        response_data['video_remux'] = {
                            'status': 'failed',
                            'message': 'Failed to remove audio from video'
                        }
                        
                except Exception as e:
                    logger.warning(f"Could not remove audio from video: {str(e)}")
                    response_data['video_remux'] = {
                        'status': 'failed',
                        'message': f'Video remux failed: {str(e)}'
                    }
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error downloading USDB song: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/usdb/song/<song_id>', methods=['GET'])
def get_usdb_song_info(song_id):
    """
    Get information about a specific USDB song
    """
    try:
        scraper = USDBScraperImproved()
        song_info = scraper.get_song_info(song_id)
        
        return jsonify({
            'success': True,
            'song_info': song_info
        })
        
    except Exception as e:
        logger.error(f"Error getting USDB song info: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    logger.info("Starting AI Services server...")
    logger.info(f"Karaoke root: {KARAOKE_ROOT}")
    logger.info(f"Ultrastar directory: {ULTRASTAR_DIR}")
    app.run(host='0.0.0.0', port=6000, debug=True)
