# Modular Audio/Video Processing Architecture

This documentation describes the new modular architecture for audio and video processing in the Karaoke system.

## Overview

The modular architecture breaks down the complex audio/video processing pipeline into reusable, independent modules. Each module handles a specific aspect of the processing workflow and can be combined in different ways to create various processing pipelines.

## Architecture Components

### 1. Meta Object (`meta.py`)
The central data structure that carries all processing information and tracks progress.

**Key Features:**
- Tracks processing status and completed steps
- Manages file lists (input, output, temp, keep)
- Stores metadata and configuration
- Provides utility methods for file operations

**Usage:**
```python
from modules import ProcessingMeta, ProcessingMode

meta = ProcessingMeta(
    artist="Artist Name",
    title="Song Title", 
    mode=ProcessingMode.MAGIC_YOUTUBE,
    base_dir="songs/magic-youtube",
    folder_name="Artist Name - Song Title"
)
```

### 2. YouTube Download Module (`youtube_download.py`)
Downloads YouTube videos and extracts metadata.

**Features:**
- Downloads videos or audio-only
- Extracts video metadata (title, artist, duration)
- Handles different YouTube URL formats
- Updates meta object with extracted information

**Usage:**
```python
from modules import download_youtube_video

success = download_youtube_video(meta)
```

### 3. Audio Normalization Module (`audio_normalization.py`)
Normalizes audio files for better processing quality.

**Features:**
- Loudness normalization (LUFS)
- Sample rate and bit depth conversion
- Multiple normalization algorithms
- Automatic audio file detection

**Usage:**
```python
from modules import normalize_audio_files

success = normalize_audio_files(meta, simple=False)
```

### 4. Audio Separation Module (`audio_separation.py`)
Separates audio into instrumental and vocal tracks using UVR5.

**Features:**
- UVR5 integration for high-quality separation
- FFmpeg fallback for basic separation
- Gain reduction before processing
- Automatic file renaming to HP2/HP5 format

**Usage:**
```python
from modules import separate_audio

success = separate_audio(meta)
```

### 5. Video Remuxing Module (`video_remuxing.py`)
Remuxes videos and manages audio tracks.

**Features:**
- Remove audio tracks for karaoke
- Replace audio tracks
- Format conversion
- Video information extraction

**Usage:**
```python
from modules import remux_videos

success = remux_videos(meta, remove_audio=True)
```

### 6. Transcription Module (`transcription.py`)
Transcribes audio to text and converts to UltraStar format.

**Features:**
- Whisper integration for transcription
- Automatic language detection
- UltraStar format conversion
- Word-level timestamps

**Usage:**
```python
from modules import transcribe_audio

success = transcribe_audio(meta)
```

### 7. USDB Download Module (`usdb_download.py`)
Downloads UltraStar files from USDB.

**Features:**
- USDB URL parsing and ID extraction
- Metadata extraction from UltraStar files
- Search functionality
- Automatic file organization

**Usage:**
```python
from modules import download_usdb_file, search_and_download_usdb

success = download_usdb_file(meta)
# or
success = search_and_download_usdb(meta, "search query")
```

### 8. Cleanup Module (`cleanup.py`)
Cleans up temporary files and organizes output.

**Features:**
- Identifies files to keep vs. remove
- Removes temporary files
- Organizes files into subdirectories
- Creates backups before cleanup
- Dry-run mode for testing

**Usage:**
```python
from modules import cleanup_files, get_folder_summary

success = cleanup_files(meta)
summary = get_folder_summary(meta)
```

## Processing Pipelines

### Magic Songs Pipeline
```python
# 1. Audio normalization
normalize_audio_files(meta, simple=True)

# 2. Audio separation  
separate_audio(meta)

# 3. Transcription
transcribe_audio(meta)

# 4. Cleanup
cleanup_files(meta)
```

### Magic Videos Pipeline
```python
# 1. Audio extraction/normalization
normalize_audio_files(meta, simple=True)

# 2. Audio separation
separate_audio(meta)

# 3. Video remuxing (remove audio)
remux_videos(meta, remove_audio=True)

# 4. Transcription
transcribe_audio(meta)

# 5. Cleanup
cleanup_files(meta)
```

### Magic YouTube Pipeline
```python
# 1. YouTube download
download_youtube_video(meta)

# 2. Audio extraction/normalization
normalize_audio_files(meta, simple=True)

# 3. Audio separation
separate_audio(meta)

# 4. Video remuxing (remove audio)
remux_videos(meta, remove_audio=True)

# 5. Transcription
transcribe_audio(meta)

# 6. Cleanup
cleanup_files(meta)
```

### USDB Download Pipeline
```python
# 1. USDB download
download_usdb_file(meta)

# 2. Cleanup (optional)
cleanup_files(meta)
```

## Configuration

Each module accepts configuration parameters:

```python
config = {
    'transcription': {
        'model': 'large-v3',
        'device': 'auto',
        'language': None
    },
    'audio_separation': {
        'model': 'HP2',
        'gain_reduction': 2.0,
        'aggression': 10
    },
    'video_remuxing': {
        'overwrite_original': True,
        'video_codec': 'copy'
    },
    'cleanup': {
        'remove_temp_files': True,
        'organize_files': True,
        'backup_before_cleanup': False
    }
}
```

## Error Handling

Each module provides comprehensive error handling:

- **Status Tracking**: Each step is marked as completed, failed, or skipped
- **Detailed Logging**: Comprehensive logging for debugging
- **Graceful Degradation**: Fallback options when primary methods fail
- **File Safety**: Backup creation and safe file operations

## Benefits

1. **Modularity**: Each function can be used independently
2. **Reusability**: Modules can be combined in different ways
3. **Maintainability**: Changes to one module don't affect others
4. **Testability**: Each module can be tested independently
5. **Extensibility**: New modules can be easily added
6. **Consistency**: Centralized meta object ensures data consistency
7. **Debugging**: Detailed logging and status tracking

## Migration from Old System

The refactored `magic_processor_refactored.py` demonstrates how the old monolithic processing has been broken down into modular components. The old `magic_processor.py` can be gradually replaced by the new modular system.

## Future Enhancements

Potential additions to the modular system:

1. **Batch Processing Module**: Process multiple files in parallel
2. **Quality Assessment Module**: Analyze audio/video quality
3. **Format Detection Module**: Automatic format detection and conversion
4. **Metadata Enhancement Module**: Enrich metadata from external sources
5. **Validation Module**: Validate processing results
6. **Progress Reporting Module**: Real-time progress updates
7. **Plugin System**: Allow custom modules to be added dynamically

The modular architecture provides a solid foundation for future enhancements while maintaining backward compatibility and ease of use.
