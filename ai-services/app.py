from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import subprocess
import logging
import re
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from usdb_scraper_improved import USDBScraperImproved, download_from_usdb_improved

app = Flask(__name__)
CORS(app)

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
KARAOKE_ROOT = os.path.join(os.path.dirname(os.path.dirname(__file__)))
ULTRASTAR_DIR = os.path.join(KARAOKE_ROOT, 'songs', 'ultrastar')
YOUTUBE_DIR = os.path.join(KARAOKE_ROOT, 'songs', 'youtube')
MAGIC_SONGS_DIR = os.path.join(KARAOKE_ROOT, 'songs', 'magic-songs')
MAGIC_VIDEOS_DIR = os.path.join(KARAOKE_ROOT, 'songs', 'magic-videos')
MAGIC_YOUTUBE_DIR = os.path.join(KARAOKE_ROOT, 'songs', 'magic-youtube')

def sanitize_filename(filename):
    """
    Sanitizes a filename by removing or replacing invalid characters
    """
    if not filename or not isinstance(filename, str):
        return ''
    
    # Characters not allowed in Windows/Linux filenames
    invalid_chars = r'[<>:"/\\|?*\x00-\x1f]'
    
    # Replace invalid characters with underscores
    sanitized = re.sub(invalid_chars, '_', filename)
    
    # Remove leading/trailing dots and spaces
    sanitized = re.sub(r'^[.\s]+|[.\s]+$', '', sanitized)
    
    # Replace multiple consecutive underscores with single underscore
    sanitized = re.sub(r'_+', '_', sanitized)
    
    # Remove leading/trailing underscores
    sanitized = re.sub(r'^_+|_+$', '', sanitized)
    
    # Ensure the filename is not empty and not too long
    if not sanitized or len(sanitized) == 0:
        sanitized = 'unnamed'
    
    if len(sanitized) > 200:
        sanitized = sanitized[:200]
    
    return sanitized

def create_sanitized_folder_name(artist, title):
    """
    Creates a sanitized folder name for YouTube downloads
    """
    artist_sanitized = sanitize_filename(artist or 'Unknown Artist')
    title_sanitized = sanitize_filename(title or 'Unknown Title')
    
    return f"{artist_sanitized} - {title_sanitized}"

def clean_youtube_url(url):
    """
    Cleans a YouTube URL to contain only the video ID parameter
    """
    if not url or not isinstance(url, str):
        return ''
    
    url = url.strip()
    
    # Check if it's a valid YouTube URL
    if not is_youtube_url(url):
        return url  # Return original if not a YouTube URL
    
    # Extract video ID from various YouTube URL formats
    video_id = extract_video_id_from_url(url)
    
    if not video_id:
        return url  # Return original if no video ID found
    
    # Return clean URL with only video ID
    return f"https://www.youtube.com/watch?v={video_id}"

def is_youtube_url(url):
    """
    Checks if a URL is a YouTube URL
    """
    if not url or not isinstance(url, str):
        return False
    
    youtube_patterns = [
        r'^https?://(www\.)?youtube\.com',
        r'^https?://youtu\.be',
        r'^https?://m\.youtube\.com',
        r'^https?://music\.youtube\.com'
    ]
    
    return any(re.match(pattern, url) for pattern in youtube_patterns)

def extract_video_id_from_url(url):
    """
    Extracts video ID from various YouTube URL formats
    """
    if not url or not isinstance(url, str):
        return None
    
    # Pattern for youtube.com/watch?v=VIDEO_ID
    match = re.search(r'[?&]v=([^&]+)', url)
    if match:
        return match.group(1)
    
    # Pattern for youtu.be/VIDEO_ID
    match = re.search(r'youtu\.be/([^?&]+)', url)
    if match:
        return match.group(1)
    
    # Pattern for youtube.com/embed/VIDEO_ID
    match = re.search(r'youtube\.com/embed/([^?&]+)', url)
    if match:
        return match.group(1)
    
    # Pattern for youtube.com/v/VIDEO_ID
    match = re.search(r'youtube\.com/v/([^?&]+)', url)
    if match:
        return match.group(1)
    
    # Pattern for youtube.com/shorts/VIDEO_ID
    match = re.search(r'youtube\.com/shorts/([^?&]+)', url)
    if match:
        return match.group(1)
    
    return None

def find_youtube_song_by_video_id(video_id, youtube_dir):
    """
    Find YouTube song by video ID in the YouTube directory (recursive search)
    """
    if not video_id or not os.path.exists(youtube_dir):
        return None
    
    try:
        # Search through all folders in YouTube directory
        for folder_name in os.listdir(youtube_dir):
            folder_path = os.path.join(youtube_dir, folder_name)
            
            if os.path.isdir(folder_path):
                # Check if any video file in this folder starts with the video ID
                for file_name in os.listdir(folder_path):
                    if file_name.startswith(video_id):
                        # Parse folder name to get artist and title
                        parts = folder_name.split(' - ')
                        if len(parts) >= 2:
                            artist = parts[0].strip()
                            title = ' - '.join(parts[1:]).strip()
                            
                            return {
                                'artist': artist,
                                'title': title,
                                'folderName': folder_name,
                                'videoFile': file_name,
                                'videoFiles': [f for f in os.listdir(folder_path) 
                                             if f.lower().endswith(('.mp4', '.webm', '.avi', '.mov', '.mkv'))],
                                'modes': ['youtube'],
                                'hasVideo': True
                            }
    except Exception as e:
        logger.error(f"Error searching for video ID {video_id}: {e}")
    
    return None


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

def normalize_audio_in_video(video_path):
    """
    Normalize audio in video file using ffmpeg loudnorm filter
    """
    try:
        if not os.path.exists(video_path):
            logger.error(f"Video file not found: {video_path}")
            return None
        
        # Create temporary output file
        base_name = os.path.splitext(video_path)[0]
        extension = os.path.splitext(video_path)[1]
        temp_output = f"{base_name}_normalized_temp{extension}"
        
        logger.info(f"Normalizing audio in video: {video_path}")
        
        # Use ffmpeg with loudnorm filter for audio normalization
        cmd = [
            'ffmpeg',
            '-i', video_path,
            '-c:v', 'copy',  # Copy video stream without re-encoding
            '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',  # Audio normalization filter
            '-y',  # Overwrite output file if it exists
            temp_output
        ]
        
        logger.info(f"Running ffmpeg normalization command: {' '.join(cmd)}")
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        
        if result.returncode == 0:
            logger.info(f"Successfully normalized audio in video: {temp_output}")
            
            # Replace original video with normalized version
            try:
                os.replace(temp_output, video_path)
                logger.info(f"Replaced original video with normalized version: {video_path}")
                return video_path
            except Exception as e:
                logger.error(f"Error replacing original video: {e}")
                return temp_output
        else:
            logger.error(f"ffmpeg normalization failed with return code {result.returncode}")
            logger.error(f"ffmpeg stderr: {result.stderr}")
            # Clean up temp file if it exists
            if os.path.exists(temp_output):
                os.remove(temp_output)
            return None
            
    except subprocess.TimeoutExpired:
        logger.error("ffmpeg normalization command timed out")
        # Clean up temp file if it exists
        if os.path.exists(temp_output):
            os.remove(temp_output)
        return None
    except Exception as e:
        logger.error(f"Error normalizing audio in video: {e}")
        # Clean up temp file if it exists
        if 'temp_output' in locals() and os.path.exists(temp_output):
            os.remove(temp_output)
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
        youtube_url = clean_youtube_url(data.get('youtubeUrl', ''))
        
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
                    # Normalize audio in the downloaded video
                    video_path = os.path.join(folder_path, downloaded_video)
                    logger.info(f"Starting audio normalization for: {video_path}")
                    
                    normalized_path = normalize_audio_in_video(video_path)
                    if normalized_path:
                        logger.info(f"Audio normalization completed successfully")
                        normalization_status = 'success'
                    else:
                        logger.warning(f"Audio normalization failed, but video download was successful")
                        normalization_status = 'failed'
                    
                    return jsonify({
                        'message': 'YouTube video downloaded successfully',
                        'status': 'success',
                        'downloadedFile': downloaded_video,
                        'folderName': folder_name,
                        'audioNormalization': normalization_status
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

@app.route('/download_youtube/youtube/<folder_name>', methods=['POST'])
def download_youtube_video_to_youtube_folder(folder_name):
    """
    Download YouTube video to songs/youtube folder
    """
    try:
        # Decode folder name
        folder_name = folder_name.replace('%20', ' ')
        
        # Get YouTube URL and metadata from request
        data = request.get_json()
        youtube_url = clean_youtube_url(data.get('youtubeUrl', ''))
        video_id = data.get('videoId')
        artist = data.get('artist', 'Unknown Artist')
        title = data.get('title', 'Unknown Title')
        
        # Create sanitized folder name
        sanitized_folder_name = create_sanitized_folder_name(artist, title)
        folder_path = os.path.join(YOUTUBE_DIR, sanitized_folder_name)
        
        # Create folder if it doesn't exist
        if not os.path.exists(folder_path):
            os.makedirs(folder_path, exist_ok=True)
        
        if not youtube_url:
            return jsonify({'error': 'YouTube URL is required'}), 400
        
        logger.info(f"Starting YouTube download: {youtube_url} to {folder_path}")
        
        # Check if video already exists
        if os.path.exists(folder_path):
            existing_files = os.listdir(folder_path)
            video_files = [f for f in existing_files if f.lower().endswith(('.mp4', '.webm', '.avi', '.mov', '.mkv'))]
            
            if video_files:
                return jsonify({
                    'message': 'Video already exists',
                    'status': 'already_exists',
                    'videoFile': video_files[0],
                    'folderName': sanitized_folder_name
                })
        
        # Generate output filename using video ID
        if video_id:
            output_filename = f"{video_id}.%(ext)s"
        else:
            # Fallback to sanitized folder name if no video ID
            output_filename = f"{sanitized_folder_name}.%(ext)s"
        
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
                    if ext in ['.mp4', '.webm', '.avi', '.mov', '.mkv']:
                        downloaded_video = file
                        break
                
                if downloaded_video:
                    # Normalize audio in the downloaded video
                    video_path = os.path.join(folder_path, downloaded_video)
                    logger.info(f"Starting audio normalization for: {video_path}")
                    
                    normalized_path = normalize_audio_in_video(video_path)
                    if normalized_path:
                        logger.info(f"Audio normalization completed successfully")
                        normalization_status = 'success'
                    else:
                        logger.warning(f"Audio normalization failed, but video download was successful")
                        normalization_status = 'failed'
                    
                    return jsonify({
                        'message': 'YouTube video downloaded successfully',
                        'status': 'success',
                        'videoFile': downloaded_video,
                        'folderName': sanitized_folder_name,
                        'videoId': video_id,
                        'artist': artist,
                        'title': title,
                        'audioNormalization': normalization_status
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

@app.route('/process_youtube_cache/<folder_name>', methods=['POST'])
def process_youtube_cache(folder_name):
    try:
        from modules import (
            ProcessingMode,
            create_meta_from_file_path,
            normalize_audio_files,
            cleanup_files
        )
        from modules.logger_utils import meta_to_short_dict, send_processing_status
        import threading

        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'songs', 'youtube'))
        folder_path = os.path.join(base_dir, folder_name)
        if not os.path.exists(folder_path):
            return jsonify({'error': 'Folder not found'}), 404
        # pick any file for meta
        any_file = None
        for f in os.listdir(folder_path):
            p = os.path.join(folder_path, f)
            if os.path.isfile(p):
                any_file = p
                break
        if not any_file:
            return jsonify({'error': 'No files in folder'}), 400
        meta = create_meta_from_file_path(any_file, base_dir, ProcessingMode.YOUTUBE_CACHE)
        try:
            videos = [f for f in os.listdir(folder_path) if f.lower().endswith(('.mp4', '.webm', '.mkv'))]
            if videos:
                import os as _os
                meta.base_filename = _os.path.splitext(videos[0])[0]
        except Exception:
            pass

        def _worker():
            try:
                try:
                    logger.info(f"▶ youtube_cache.process | meta={meta_to_short_dict(meta)}")
                except Exception:
                    logger.info(f"▶ youtube_cache.process | meta={getattr(meta, 'folder_name', folder_name)}")
                # broadcast processing started
                try:
                    send_processing_status(artist=meta.artist, title=meta.title, status='processing')
                except Exception:
                    pass
                # 1) normalize (simple)
                normalize_audio_files(meta, simple=True)
                # 2) cleanup
                cleanup_files(meta)
                try:
                    send_processing_status(artist=meta.artist, title=meta.title, status='finished')
                except Exception:
                    pass
            except Exception as e:
                logger.error(f"Error processing youtube cache (bg): {e}")
                try:
                    send_processing_status(artist=meta.artist, title=meta.title, status='failed')
                except Exception:
                    pass

        threading.Thread(target=_worker, daemon=True).start()
        return jsonify({'success': True, 'started': True})
    except Exception as e:
        logger.error(f"Error processing youtube cache: {e}")
        return jsonify({'error': str(e)}), 500

# Magic-Songs API Routes
@app.route('/magic-songs', methods=['GET'])
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


# Magic-Videos API Routes
@app.route('/magic-videos', methods=['GET'])
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


# Magic-YouTube API Routes
@app.route('/magic-youtube', methods=['GET'])
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



@app.route('/modular-process/<folder_name>', methods=['POST'])
def modular_process(folder_name):
    """Modulare Verarbeitung für alle Song-Typen mit ensure_source_files"""
    try:
        data = request.get_json(silent=True) or {}
        song_type = data.get('songType', 'ultrastar')
        base_dir = data.get('baseDir', ULTRASTAR_DIR)
        
        # Basis-Verzeichnis für verschiedene Song-Typen
        if song_type == 'magic-songs':
            base_dir = os.path.join(os.path.dirname(__file__), '..', 'songs', 'magic-songs')
        elif song_type == 'magic-videos':
            base_dir = os.path.join(os.path.dirname(__file__), '..', 'songs', 'magic-videos')
        else:
            base_dir = ULTRASTAR_DIR
        
        folder_path = os.path.join(base_dir, folder_name)
        
        if not os.path.exists(folder_path):
            return jsonify({'success': False, 'error': 'Folder not found'}), 404
        
        from modules import (
            ProcessingMode,
            create_meta_from_file_path,
            ensure_source_files,
            separate_audio,
            transcribe_audio,
            cleanup_files
        )
        from modules.logger_utils import send_processing_status, meta_to_short_dict, log_start

        # Meta initialisieren - verwende den korrekten Ordner-Pfad
        meta = create_meta_from_file_path(folder_path, base_dir, ProcessingMode.ULTRASTAR)
        
        # Korrigiere die Meta-Daten für den spezifischen Song-Ordner
        meta.folder_name = folder_name
        meta.folder_path = folder_path
        
        # Extrahiere Artist und Title aus dem Ordnernamen
        if ' - ' in folder_name:
            parts = folder_name.split(' - ', 1)
            meta.artist = parts[0]
            meta.title = parts[1]
        else:
            meta.artist = 'Unknown Artist'
            meta.title = folder_name
        
        logger.info(f"📁 Korrigierte Meta-Daten: artist='{meta.artist}', title='{meta.title}', folder_path='{meta.folder_path}'")
        
        # Start processing in background thread
        import threading
        
        def run_modular_pipeline():
            try:
                # 1) Ensure Source Files (neues Modul)
                log_start('ensure_source_files.process_meta', meta)
                try:
                    send_processing_status(meta, 'downloading')
                except Exception:
                    pass
                
                if not ensure_source_files(meta):
                    logger.error("❌ Ensure source files failed, pipeline aborted")
                    try: 
                        send_processing_status(meta, 'failed')
                    except Exception: pass
                    return
                
                # Pipeline je nach Song-Typ
                if song_type == 'magic-videos':
                    # Magic-Videos-Pipeline: ensure_source_files → audio_separation → transcription → cleanup
                    
                    # 2) Audio Separation
                    logger.info("🔄 Starting audio separation...")
                    try:
                        send_processing_status(meta, 'separating')
                    except Exception:
                        pass
                    separate_audio(meta)
                    logger.info("✅ Audio separation completed")
                    
                    # 3) Transcription
                    logger.info("🔄 Starting transcription...")
                    try:
                        send_processing_status(meta, 'transcribing')
                    except Exception:
                        pass
                    transcribe_audio(meta)
                    logger.info("✅ Transcription completed")
                    
                elif song_type == 'magic-songs':
                    # Magic-Songs-Pipeline: ensure_source_files → audio_separation → transcription → remux_videos → cleanup
                    from modules import remux_videos
                    
                    # 2) Audio Separation
                    logger.info("🔄 Starting audio separation...")
                    try:
                        send_processing_status(meta, 'separating')
                    except Exception:
                        pass
                    separate_audio(meta)
                    logger.info("✅ Audio separation completed")
                    
                    # 3) Transcription
                    logger.info("🔄 Starting transcription...")
                    try:
                        send_processing_status(meta, 'transcribing')
                    except Exception:
                        pass
                    transcribe_audio(meta)
                    logger.info("✅ Transcription completed")
                    
                    # 4) Video Remuxing (Audio entfernen)
                    logger.info("🔄 Starting video remuxing...")
                    remux_videos(meta, remove_audio=True)
                    logger.info("✅ Video remuxing completed")
                    
                else:
                    # Ultrastar-Pipeline: ensure_source_files → separate_audio → remux_videos (nur wenn Video zu Beginn fehlte) → cleanup
                    from modules import remux_videos
                    
                    # 2) Audio Separation
                    logger.info("🔄 Starting audio separation...")
                    try:
                        send_processing_status(meta, 'separating')
                    except Exception:
                        pass
                    separate_audio(meta)
                    logger.info("✅ Audio separation completed")
                    
                    # 3) Video Remuxing (nur wenn Video zu Beginn fehlte)
                    # Prüfe ob Video zu Beginn vorhanden war
                    initial_files = meta.metadata.get('initial_files', {})
                    had_video_at_start = initial_files.get('video', False)
                    
                    if not had_video_at_start:
                        logger.info("🔄 Starting video remuxing (Video wurde heruntergeladen)...")
                        remux_videos(meta, remove_audio=True)
                        logger.info("✅ Video remuxing completed")
                    else:
                        logger.info("⏭️ Skipping video remuxing (Video war bereits vorhanden)")
                
                # 4) Cleanup (für alle Song-Typen)
                logger.info("🔄 Starting cleanup...")
                cleanup_files(meta)
                logger.info("✅ Cleanup completed")

                logger.info("🎉 Modular pipeline completed successfully, sending finished status...")
                try:
                    send_processing_status(meta, 'finished')
                    logger.info("✅ Finished status sent successfully")
                except Exception as e:
                    logger.error(f"❌ Failed to send finished status: {e}")
                    
            except Exception as e:
                logger.error(f"Error in modular pipeline background thread: {e}")
                try:
                    send_processing_status(meta, 'failed')
                except Exception:
                    pass

        # Start background thread
        thread = threading.Thread(target=run_modular_pipeline)
        thread.daemon = True
        thread.start()

        # Return immediately
        return jsonify({'success': True, 'message': 'Modular pipeline started in background'})
        
    except Exception as e:
        logger.error(f"Error starting modular pipeline: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/usdb/process/<folder_name>', methods=['POST'])
def process_usdb_pipeline(folder_name):
    """USDB-Pipeline mit Modulen: 1) usdb_download → 2) youtube_download → 3) audio_normalization → 4) audio_separation → 5) video_remuxing → 6) cleanup"""
    try:
        data = request.get_json(silent=True) or {}
        song_id = data.get('songId')
        username = data.get('username')
        password = data.get('password')
        batch_id = data.get('batchId')  # Get batch ID from request
        
        # Extract USDB song ID from folder name (USDB_12345 format)
        if not folder_name.startswith('USDB_'):
            return jsonify({'success': False, 'error': 'Invalid folder name format'}), 400
            
        usdb_song_id = folder_name.replace('USDB_', '')
        
        if not username or not password:
            return jsonify({'success': False, 'error': 'USDB credentials are required'}), 400
        
        # Basis-Verzeichnis für Ultrastar-Downloads
        base_dir = ULTRASTAR_DIR
        temp_folder_name = folder_name  # USDB_17878
        temp_folder_path = os.path.join(base_dir, temp_folder_name)
        os.makedirs(temp_folder_path, exist_ok=True)

        from modules import (
            ProcessingMode,
            create_meta_from_file_path,
            download_usdb_song,
            download_youtube_video as mod_yt_download,
            normalize_audio_files,
            separate_audio,
            remux_videos,
            cleanup_files
        )
        from modules.logger_utils import send_processing_status, meta_to_short_dict, log_start

        # Meta initialisieren mit Temp-Ordner
        meta = create_meta_from_file_path(temp_folder_path, base_dir, ProcessingMode.ULTRASTAR)
        if song_id:
            meta.song_id = song_id
        elif batch_id:
            # Use batch ID for WebSocket updates if no song_id is provided
            meta.song_id = batch_id
        
        # Set USDB credentials in meta
        meta.usdb_username = username
        meta.usdb_password = password
        meta.usdb_song_id = usdb_song_id
        
        # For USDB songs, use artist-title as filename instead of YouTube ID
        meta.use_youtube_id_as_filename = False
        
        # Store original temp folder info for cleanup
        meta.temp_folder_name = temp_folder_name
        meta.temp_folder_path = temp_folder_path

        # Start pipeline in background thread
        import threading
        
        def run_usdb_pipeline():
            try:
                # 1) USDB Download (nur TXT notwendig, YouTube-Link extrahieren)
                try:
                    send_processing_status(meta, 'downloading')
                except Exception:
                    pass
                log_start('usdb_download.process_meta', meta)
                
                try:
                    usdb_ok = download_usdb_song(meta)
                    if not usdb_ok:
                        logger.error("❌ USDB-Download fehlgeschlagen, Pipeline wird abgebrochen")
                        try: 
                            send_processing_status(meta, 'failed')
                        except Exception: pass
                        
                        # Lösche den Ordner bei Fehlern
                        try:
                            import shutil
                            if hasattr(meta, 'folder_path') and os.path.exists(meta.folder_path):
                                shutil.rmtree(meta.folder_path)
                                logger.info(f"🗑️ Ordner gelöscht nach USDB-Fehler: {meta.folder_path}")
                        except Exception as cleanup_error:
                            logger.warning(f"⚠️ Konnte Ordner nicht löschen: {cleanup_error}")
                        
                        return  # Pipeline komplett abbrechen
                except Exception as e:
                    logger.error(f"❌ Fehler in USDB-Download: {e}")
                    try: 
                        send_processing_status(meta, 'failed')
                    except Exception: pass
                    
                    # Lösche den Ordner bei Fehlern
                    try:
                        import shutil
                        if hasattr(meta, 'folder_path') and os.path.exists(meta.folder_path):
                            shutil.rmtree(meta.folder_path)
                            logger.info(f"🗑️ Ordner gelöscht nach Fehler: {meta.folder_path}")
                    except Exception as cleanup_error:
                        logger.warning(f"⚠️ Konnte Ordner nicht löschen: {cleanup_error}")
                    
                    return  # Pipeline komplett abbrechen

                # YouTube-Link aus Meta für nächsten Schritt
                youtube_url = getattr(meta, 'youtube_url', None) or getattr(meta, 'youtube_link', None)
                if not youtube_url:
                    # Ohne YouTube-Link ist der Song nicht vollständig → failed
                    try: 
                        send_processing_status(meta, 'failed')
                    except Exception: pass
                    
                    # Lösche den Ordner bei Fehlern
                    try:
                        import shutil
                        if hasattr(meta, 'folder_path') and os.path.exists(meta.folder_path):
                            shutil.rmtree(meta.folder_path)
                            logger.info(f"🗑️ Ordner gelöscht nach Fehler (kein YouTube-URL): {meta.folder_path}")
                    except Exception as cleanup_error:
                        logger.warning(f"⚠️ Konnte Ordner nicht löschen: {cleanup_error}")
                    
                    return

                # 2) YouTube Download (Abbruch bei Fehler, Status/Mode an Node melden)
                log_start('youtube_download.process_meta', meta)
                yt_ok = mod_yt_download(meta)
                if not yt_ok:
                    try:
                        # an Node melden: failed + youtube_url + mode=youtube
                        send_processing_status(meta, 'failed')
                    except Exception:
                        pass
                    
                    # Lösche den Ordner bei Fehlern
                    try:
                        import shutil
                        if hasattr(meta, 'folder_path') and os.path.exists(meta.folder_path):
                            shutil.rmtree(meta.folder_path)
                            logger.info(f"🗑️ Ordner gelöscht nach Fehler (YouTube-Download fehlgeschlagen): {meta.folder_path}")
                    except Exception as cleanup_error:
                        logger.warning(f"⚠️ Konnte Ordner nicht löschen: {cleanup_error}")
                    
                    return

                # 3) Audio Normalization
                logger.info("🔄 Starting audio normalization...")
                normalize_audio_files(meta, simple=True)
                logger.info("✅ Audio normalization completed")
                
                # 4) Audio Separation
                logger.info("🔄 Starting audio separation...")
                separate_audio(meta)
                logger.info("✅ Audio separation completed")
                
                # 5) Video Remuxing (Audio entfernen)
                logger.info("🔄 Starting video remuxing...")
                remux_videos(meta, remove_audio=True)
                logger.info("✅ Video remuxing completed")
                
                # 6) Cleanup
                logger.info("🔄 Starting cleanup...")
                cleanup_files(meta)
                logger.info("✅ Cleanup completed")

                logger.info("🎉 USDB pipeline completed successfully, sending finished status...")
                try:
                    send_processing_status(meta, 'finished')
                    logger.info("✅ Finished status sent successfully")
                except Exception as e:
                    logger.error(f"❌ Failed to send finished status: {e}")
                    
            except Exception as e:
                logger.error(f"Error in USDB pipeline background thread: {e}")
                
                # Lösche den Ordner bei Fehlern
                try:
                    import shutil
                    if hasattr(meta, 'folder_path') and os.path.exists(meta.folder_path):
                        shutil.rmtree(meta.folder_path)
                        logger.info(f"🗑️ Ordner gelöscht nach Pipeline-Fehler: {meta.folder_path}")
                except Exception as cleanup_error:
                    logger.warning(f"⚠️ Konnte Ordner nicht löschen: {cleanup_error}")
                
                try:
                    send_processing_status(meta, 'failed')
                except Exception:
                    pass

        # Start background thread
        thread = threading.Thread(target=run_usdb_pipeline)
        thread.daemon = True
        thread.start()

        # Return immediately
        return jsonify({'success': True, 'message': 'USDB pipeline started in background'})
        
    except Exception as e:
        logger.error(f"Error starting USDB pipeline: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    logger.info("Starting AI Services server...")
    logger.info(f"Karaoke root: {KARAOKE_ROOT}")
    logger.info(f"Ultrastar directory: {ULTRASTAR_DIR}")
    app.run(host='0.0.0.0', port=6000, debug=True)
