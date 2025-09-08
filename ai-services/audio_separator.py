import os
import logging

logger = logging.getLogger(__name__)

def find_audio_file(folder_path):
    """Find the main audio file (not HP2/HP5) in the folder"""
    audio_extensions = ['.mp3', '.flac', '.ogg', '.wav', '.m4a', '.aac']
    
    for file in os.listdir(folder_path):
        file_path = os.path.join(folder_path, file)
        if os.path.isfile(file_path):
            name, ext = os.path.splitext(file)
            if ext.lower() in audio_extensions:
                # Check if it's not already a separated file
                if not any(suffix in name.lower() for suffix in ['hp2', 'hp5', 'vocals', 'instrumental']):
                    return file_path
    
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