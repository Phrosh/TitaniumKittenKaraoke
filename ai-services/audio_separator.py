import os
import logging
import subprocess

logger = logging.getLogger(__name__)

def find_audio_file(folder_path):
    """Find the main audio file (not HP2/HP5) in the folder, or extract audio from video if no audio file exists"""
    audio_extensions = ['.mp3', '.flac', '.ogg', '.wav', '.m4a', '.aac']
    video_extensions = ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm']
    
    # First, look for existing audio files
    for file in os.listdir(folder_path):
        file_path = os.path.join(folder_path, file)
        if os.path.isfile(file_path):
            name, ext = os.path.splitext(file)
            if ext.lower() in audio_extensions:
                # Check if it's not already a separated file or extracted audio
                if not any(suffix in name.lower() for suffix in ['hp2', 'hp5', 'vocals', 'instrumental', 'extracted']):
                    return file_path
    
    # If no audio file found, look for video files and extract audio
    logger.info("No audio file found, looking for video files to extract audio from...")
    
    for file in os.listdir(folder_path):
        file_path = os.path.join(folder_path, file)
        if os.path.isfile(file_path):
            name, ext = os.path.splitext(file)
            if ext.lower() in video_extensions:
                # Check if it's not already a processed video file
                if not any(suffix in name.lower() for suffix in ['hp2', 'hp5', 'vocals', 'instrumental']):
                    logger.info(f"Found video file: {file}, extracting audio...")
                    extracted_audio = extract_audio_from_video(file_path, folder_path)
                    if extracted_audio:
                        return extracted_audio
    
    return None

def extract_audio_from_video(video_path, output_folder):
    """Extract audio from video file using ffmpeg"""
    try:
        # Generate output filename
        video_name = os.path.splitext(os.path.basename(video_path))[0]
        output_audio_path = os.path.join(output_folder, f"{video_name}_extracted.mp3")
        
        # Check if audio already extracted
        if os.path.exists(output_audio_path):
            logger.info(f"Audio already extracted: {output_audio_path}")
            return output_audio_path
        
        logger.info(f"Extracting audio from {video_path} to {output_audio_path}")
        
        # Use ffmpeg to extract audio
        ffmpeg_cmd = [
            'ffmpeg',
            '-i', video_path,
            '-vn',  # No video
            '-acodec', 'mp3',
            '-ab', '192k',  # Audio bitrate
            '-ar', '44100',  # Sample rate
            '-y',  # Overwrite output file
            output_audio_path
        ]
        
        result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            logger.info(f"Successfully extracted audio: {output_audio_path}")
            return output_audio_path
        else:
            logger.error(f"FFmpeg error extracting audio: {result.stderr}")
            return None
            
    except Exception as e:
        logger.error(f"Error extracting audio from video: {e}")
        return None

def separate_audio_with_uvr5(folder_path, model_type='HP2'):
    """Main function to separate audio using UVR5 with correct implementation"""
    try:
        # Import the correct UVR5 implementation
        from uvr5_correct import separate_audio_with_uvr5_correct
        
        logger.info(f"Using correct UVR5 implementation for {model_type}")
        
        # Call the correct implementation
        result = separate_audio_with_uvr5_correct(folder_path, model_type)
        
        logger.info(f"Audio separation completed: {result}")
        return result
        
    except Exception as e:
        logger.error(f"Error in separate_audio_with_uvr5: {e}")
        raise