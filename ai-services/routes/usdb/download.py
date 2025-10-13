from flask import Blueprint, jsonify, request
import os
import logging
import shutil
from ..utils import remove_audio_from_video, get_ultrastar_dir

# Erstelle einen Blueprint für USDB-Download
usdb_download_bp = Blueprint('usdb_download', __name__)

# Logger für USDB-Module
logger = logging.getLogger(__name__)

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

@usdb_download_bp.route('/usdb/download', methods=['POST'])
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
        output_dir = os.path.join(get_ultrastar_dir(), song_folder_name)
        
        logger.info(f"Downloading USDB song {song_id} to {output_dir}")
        
        # Import USDB scraper
        import sys
        import os as _os
        sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        from usdb_scraper_improved import download_from_usdb_improved
        
        # Download the song using improved scraper
        result = download_from_usdb_improved(song_id, username, password, output_dir)
        
        # Verify download - check if video file exists
        video_files = [f for f in result['files'] if f.endswith(('.mp4', '.webm'))]
        if not video_files:
            # No video found, delete the folder and return error
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
                    folder_path = os.path.join(get_ultrastar_dir(), result['folder_name'])
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
