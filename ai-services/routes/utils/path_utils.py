import os

def get_karaoke_root():
    """Hilfsfunktion um KARAOKE_ROOT zu bekommen"""
    # Von routes/utils/path_utils.py -> routes/utils -> routes -> ai-services -> Karaoke
    return os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))

def get_ultrastar_dir():
    """Hilfsfunktion um ULTRASTAR_DIR zu bekommen"""
    return os.path.join(get_karaoke_root(), 'songs', 'ultrastar')

def get_youtube_dir():
    """Hilfsfunktion um YOUTUBE_DIR zu bekommen"""
    return os.path.join(get_karaoke_root(), 'songs', 'youtube')

def get_magic_songs_dir():
    """Hilfsfunktion um MAGIC_SONGS_DIR zu bekommen"""
    return os.path.join(get_karaoke_root(), 'songs', 'magic-songs')

def get_magic_videos_dir():
    """Hilfsfunktion um MAGIC_VIDEOS_DIR zu bekommen"""
    return os.path.join(get_karaoke_root(), 'songs', 'magic-videos')

def get_magic_youtube_dir():
    """Hilfsfunktion um MAGIC_YOUTUBE_DIR zu bekommen"""
    return os.path.join(get_karaoke_root(), 'songs', 'magic-youtube')
