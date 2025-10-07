from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import subprocess
import logging
import re
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from usdb_scraper_improved import USDBScraperImproved, download_from_usdb_improved
from boil_down import boil_down, boil_down_match

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

def find_youtube_song_by_video_id_recursive(video_id, youtube_dir):
    """
    Recursively find YouTube song by video ID in all subdirectories
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
        logger.error(f"Error in recursive search for video ID {video_id}: {e}")
    
    return None

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'service': 'ai-services'})

@app.route('/youtube/find-by-video-id/<video_id>', methods=['GET'])
def find_youtube_song_by_video_id_endpoint(video_id):
    """
    Find YouTube song by video ID
    """
    try:
        song = find_youtube_song_by_video_id(video_id, YOUTUBE_DIR)
        
        if song:
            return jsonify({
                'success': True,
                'song': song
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Song not found'
            })
            
    except Exception as e:
        logger.error(f"Error finding YouTube song by video ID {video_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500

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

@app.route('/usdb/search-boildown', methods=['POST'])
def search_usdb_boildown():
    """
    Search for songs on USDB using boil down normalization for better matching
    """
    try:
        data = request.get_json()
        interpret = data.get('interpret', '')
        title = data.get('title', '')
        limit = data.get('limit', 20)
        
        # Support legacy query parameter
        if not interpret and not title:
            query = data.get('query', '')
            if query:
                # Try to parse query into interpret and title
                # Simple heuristic: if query contains " - ", split it
                if ' - ' in query:
                    parts = query.split(' - ', 1)
                    interpret = parts[0].strip()
                    title = parts[1].strip()
                else:
                    # Default to searching in interpret field
                    interpret = query
        
        if not interpret and not title:
            return jsonify({'error': 'Interpret or title is required'}), 400
        
        logger.info(f"Searching USDB with boil down: interpret='{interpret}', title='{title}', limit={limit}")
        
        # Get USDB credentials from environment or request
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'error': 'USDB credentials are required'}), 400
        
        # Import the functions from usdb_find_ids.py
        import sys
        import os
        sys.path.append(os.path.dirname(__file__))
        
        from usdb_find_ids import login, search_all_by_artist
        import requests
        
        # Create session and login
        session = requests.Session()
        session.headers.update({"User-Agent": "Mozilla/5.0"})
        
        try:
            login(session, username, password)
            logger.info("Login successful")
        except Exception as e:
            logger.error(f"Login failed: {str(e)}")
            return jsonify({'error': f'Login failed: {str(e)}'}), 401
        
        # Search for songs
        try:
            songs = search_all_by_artist(session, interpret, title, per_page=limit, max_items=limit)
            logger.info(f"Found {len(songs)} songs")
            
            # Apply boil down matching to filter results
            boiled_interpret = boil_down(interpret)
            boiled_title = boil_down(title)
            
            filtered_songs = []
            for song in songs:
                song_artist = song.get("artist", "Unknown Artist")
                song_title = song["title"]
                
                # Check if song matches using boil down normalization
                if (boil_down_match(song_artist, interpret) or 
                    boil_down_match(song_title, title) or
                    boil_down_match(f"{song_artist} - {song_title}", f"{interpret} - {title}")):
                    filtered_songs.append(song)
            
            logger.info(f"Filtered to {len(filtered_songs)} songs using boil down matching")
            
            # Convert to the expected format
            formatted_songs = []
            for song in filtered_songs:
                formatted_songs.append({
                    "id": song["id"],
                    "artist": song.get("artist", "Unknown Artist"),
                    "title": song["title"],
                    "url": f"https://usdb.animux.de/?link=detail&id={song['id']}"
                })
            
            return jsonify({
                'success': True,
                'songs': formatted_songs,
                'count': len(formatted_songs),
                'boil_down_used': True
            })
            
        except Exception as e:
            logger.error(f"Search failed: {str(e)}")
            return jsonify({'error': f'Search failed: {str(e)}'}), 500
        
    except Exception as e:
        logger.error(f"Error searching USDB with boil down: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/usdb/search', methods=['POST'])
def search_usdb():
    """
    Search for songs on USDB using the proven usdb_find_ids.py script
    """
    try:
        data = request.get_json()
        interpret = data.get('interpret', '')
        title = data.get('title', '')
        limit = data.get('limit', 20)
        
        # Support legacy query parameter
        if not interpret and not title:
            query = data.get('query', '')
            if query:
                # Try to parse query into interpret and title
                # Simple heuristic: if query contains " - ", split it
                if ' - ' in query:
                    parts = query.split(' - ', 1)
                    interpret = parts[0].strip()
                    title = parts[1].strip()
                else:
                    # Default to searching in interpret field
                    interpret = query
        
        if not interpret and not title:
            return jsonify({'error': 'Interpret or title is required'}), 400
        
        logger.info(f"Searching USDB: interpret='{interpret}', title='{title}', limit={limit}")
        
        # Get USDB credentials from environment or request
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'error': 'USDB credentials are required'}), 400
        
        # Import the functions from usdb_find_ids.py
        import sys
        import os
        sys.path.append(os.path.dirname(__file__))
        
        from usdb_find_ids import login, search_all_by_artist
        import requests
        
        # Create session and login
        session = requests.Session()
        session.headers.update({"User-Agent": "Mozilla/5.0"})
        
        try:
            login(session, username, password)
            logger.info("Login successful")
        except Exception as e:
            logger.error(f"Login failed: {str(e)}")
            return jsonify({'error': f'Login failed: {str(e)}'}), 401
        
        # Search for songs
        try:
            songs = search_all_by_artist(session, interpret, title, per_page=limit, max_items=limit)
            logger.info(f"Found {len(songs)} songs")
            
            # Convert to the expected format
            formatted_songs = []
            for song in songs:
                formatted_songs.append({
                    "id": song["id"],
                    "artist": song.get("artist", "Unknown Artist"),
                    "title": song["title"],
                    "url": f"https://usdb.animux.de/?link=detail&id={song['id']}"
                })
            
            return jsonify({
                'success': True,
                'songs': formatted_songs,
                'count': len(formatted_songs)
            })
            
        except Exception as e:
            logger.error(f"Search failed: {str(e)}")
            return jsonify({'error': f'Search failed: {str(e)}'}), 500
        
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

@app.route('/magic-songs/<folder_name>/process', methods=['POST'])
def process_magic_song(folder_name):
    """Process magic song to generate UltraStar file"""
    try:
        folder_path = os.path.join(MAGIC_SONGS_DIR, folder_name)
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
            ProcessingMeta, ProcessingMode, ProcessingStatus,
            create_meta_from_file_path,
            normalize_audio_files, separate_audio, transcribe_audio, cleanup_files
        )
        
        # Create meta object from folder
        meta = create_meta_from_file_path(folder_path, MAGIC_SONGS_DIR, ProcessingMode.MAGIC_SONGS)
        
        # Process with modular pipeline
        success = True
        try:
            # 1. Audio normalization
            if not normalize_audio_files(meta, simple=True):
                raise Exception("Audio normalization failed")
            
            # 2. Audio separation
            if not separate_audio(meta):
                raise Exception("Audio separation failed")
            
            # 3. Transcription
            if not transcribe_audio(meta):
                raise Exception("Transcription failed")
            
            # 4. Cleanup
            if not cleanup_files(meta):
                raise Exception("Cleanup failed")
                
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

@app.route('/magic-videos/<folder_name>/process', methods=['POST'])
def process_magic_video(folder_name):
    """Process magic video to generate UltraStar file"""
    try:
        folder_path = os.path.join(MAGIC_VIDEOS_DIR, folder_name)
        if not os.path.exists(folder_path):
            return jsonify({'error': 'Folder not found'}), 404
        
        # Find video file
        video_file = None
        for file in os.listdir(folder_path):
            if file.lower().endswith(('.mp4', '.avi', '.mkv', '.mov', '.wmv')) and not file.endswith('_remuxed.mp4'):
                video_file = os.path.join(folder_path, file)
                break
        
        if not video_file:
            return jsonify({'error': 'No video file found'}), 400
        
        # Process with new modular system
        from modules import (
            ProcessingMeta, ProcessingMode, ProcessingStatus,
            create_meta_from_file_path,
            normalize_audio_files, separate_audio, remux_videos, 
            transcribe_audio, cleanup_files
        )
        
        # Create meta object from folder
        meta = create_meta_from_file_path(folder_path, MAGIC_VIDEOS_DIR, ProcessingMode.MAGIC_VIDEOS)
        
        # Process with modular pipeline
        success = True
        try:
            # 1. Audio extraction/normalization
            if not normalize_audio_files(meta, simple=True):
                raise Exception("Audio extraction/normalization failed")
            
            # 2. Audio separation
            if not separate_audio(meta):
                raise Exception("Audio separation failed")
            
            # 3. Video remuxing (remove audio)
            if not remux_videos(meta, remove_audio=True):
                raise Exception("Video remuxing failed")
            
            # 4. Transcription
            if not transcribe_audio(meta):
                raise Exception("Transcription failed")
            
            # 5. Cleanup
            if not cleanup_files(meta):
                raise Exception("Cleanup failed")
                
        except Exception as e:
            success = False
            error_msg = str(e)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Magic video processed successfully with modular system',
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
        logger.error(f"Error processing magic video: {str(e)}")
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

@app.route('/magic-youtube/<folder_name>/process', methods=['POST'])
def process_magic_youtube(folder_name):
    """Process magic YouTube video to generate UltraStar file"""
    try:
        folder_path = os.path.join(MAGIC_YOUTUBE_DIR, folder_name)
        if not os.path.exists(folder_path):
            return jsonify({'error': 'Folder not found'}), 404
        
        # Find video file
        video_file = None
        for file in os.listdir(folder_path):
            if file.lower().endswith(('.mp4', '.webm', '.mkv')) and not file.endswith('_remuxed.mp4'):
                video_file = os.path.join(folder_path, file)
                break
        
        if not video_file:
            return jsonify({'error': 'No video file found'}), 400
        
        # Process with new modular system
        from modules import (
            ProcessingMeta, ProcessingMode, ProcessingStatus,
            create_meta_from_file_path,
            normalize_audio_files, separate_audio, remux_videos, 
            transcribe_audio, cleanup_files
        )
        
        # Create meta object from folder
        meta = create_meta_from_file_path(folder_path, MAGIC_YOUTUBE_DIR, ProcessingMode.MAGIC_YOUTUBE)
        
        # Process with modular pipeline
        success = True
        try:
            # 1. Audio extraction/normalization
            if not normalize_audio_files(meta, simple=True):
                raise Exception("Audio extraction/normalization failed")
            
            # 2. Audio separation
            if not separate_audio(meta):
                raise Exception("Audio separation failed")
            
            # 3. Video remuxing (remove audio)
            if not remux_videos(meta, remove_audio=True):
                raise Exception("Video remuxing failed")
            
            # 4. Transcription
            if not transcribe_audio(meta):
                raise Exception("Transcription failed")
            
            # 5. Cleanup
            if not cleanup_files(meta):
                raise Exception("Cleanup failed")
                
        except Exception as e:
            success = False
            error_msg = str(e)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Magic YouTube video processed successfully with modular system',
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
        logger.error(f"Error processing magic YouTube video: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/process_magic_youtube/<folder_name>', methods=['POST'])
def process_magic_youtube_from_url(folder_name):
    """Process magic YouTube video from URL to generate UltraStar file"""
    try:
        data = request.get_json()
        youtube_url = data.get('youtubeUrl')
        song_id = data.get('songId')  # Extract song ID from request
        
        if not youtube_url:
            return jsonify({'error': 'YouTube URL is required'}), 400
        
        logger.info(f"Processing Magic YouTube: {folder_name} with URL: {youtube_url}, Song ID: {song_id}")
        
        # Create folder if it doesn't exist
        folder_path = os.path.join(MAGIC_YOUTUBE_DIR, folder_name)
        os.makedirs(folder_path, exist_ok=True)
        
        # Download YouTube video
        try:
            import yt_dlp
            
            ydl_opts = {
                'outtmpl': os.path.join(folder_path, '%(id)s.%(ext)s'),
                'format': 'best[height<=720]',  # Limit to 720p for faster processing
                'quiet': False,
                'no_warnings': False,
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(youtube_url, download=True)
                video_id = info.get('id')
                video_file = os.path.join(folder_path, f"{video_id}.{info.get('ext', 'mp4')}")
                
                logger.info(f"Downloaded YouTube video: {video_file}")
                
        except Exception as e:
            logger.error(f"Error downloading YouTube video: {str(e)}")
            return jsonify({'error': f'YouTube download failed: {str(e)}'}), 500
        
        # Process with new modular system
        from modules import (
            ProcessingMeta, ProcessingMode, ProcessingStatus,
            create_meta_from_youtube_url,
            normalize_audio_files, separate_audio, 
            remux_videos, transcribe_audio, cleanup_files
        )
        from modules.logger_utils import send_processing_status, meta_to_short_dict
        import threading
        
        # Create meta object from YouTube URL with explicit folder info
        meta = create_meta_from_youtube_url(
            youtube_url=youtube_url,
            base_dir=MAGIC_YOUTUBE_DIR,
            mode=ProcessingMode.MAGIC_YOUTUBE,
            folder_name=folder_name,
            folder_path=folder_path,
        )
        # Add song ID to meta object
        if song_id:
            meta.song_id = song_id
        # Stabiler Basis-Dateiname: bei Magic-YouTube die YouTube-ID
        try:
            video_id = os.path.splitext(os.path.basename(video_file))[0]
            meta.base_filename = video_id
        except Exception:
            meta.base_filename = os.path.splitext(os.path.basename(video_file))[0]
        
        def _worker():
            try:
                # 1. Register downloaded file
                meta.youtube_file = video_file
                meta.add_input_file(video_file)
                meta.add_output_file(video_file)
                try:
                    send_processing_status(id=getattr(meta, 'song_id', None), artist=meta.artist, title=meta.title, status='downloading')
                except Exception:
                    pass
                # 2. Normalize
                if not normalize_audio_files(meta, simple=True):
                    raise Exception("Audio extraction/normalization failed")
                try:
                    send_processing_status(id=getattr(meta, 'song_id', None), artist=meta.artist, title=meta.title, status='separating')
                except Exception:
                    pass
                # 3. Separate
                if not separate_audio(meta):
                    raise Exception("Audio separation failed")
                # 4. Remux (remove audio)
                if not remux_videos(meta, remove_audio=True):
                    raise Exception("Video remuxing failed")
                try:
                    send_processing_status(id=getattr(meta, 'song_id', None), artist=meta.artist, title=meta.title, status='transcribing')
                except Exception:
                    pass
                # 5. Transcribe
                if not transcribe_audio(meta):
                    raise Exception("Transcription failed")
                # 6. Cleanup
                if not cleanup_files(meta):
                    raise Exception("Cleanup failed")
                try:
                    send_processing_status(id=getattr(meta, 'song_id', None), artist=meta.artist, title=meta.title, status='finished')
                except Exception:
                    pass
            except Exception as e:
                logger.error(f"Magic YouTube processing failed: {e}")
                try:
                    send_processing_status(id=getattr(meta, 'song_id', None), artist=meta.artist, title=meta.title, status='failed')
                except Exception:
                    pass

        # Start background worker and respond immediately
        try:
            logger.info(f"▶ magic_youtube.process | meta={meta_to_short_dict(meta)}")
        except Exception:
            pass
        threading.Thread(target=_worker, daemon=True).start()
        return jsonify({'success': True, 'started': True, 'video_file': video_file})
    
    except Exception as e:
        logger.error(f"Error processing magic YouTube from URL: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    logger.info("Starting AI Services server...")
    logger.info(f"Karaoke root: {KARAOKE_ROOT}")
    logger.info(f"Ultrastar directory: {ULTRASTAR_DIR}")
    app.run(host='0.0.0.0', port=6000, debug=True)
