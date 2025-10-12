"""
Video processing utility functions for AI services
"""
import os
import subprocess
import logging

logger = logging.getLogger(__name__)

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
