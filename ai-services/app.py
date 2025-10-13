from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import subprocess
import logging
import re
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from usdb_scraper_improved import USDBScraperImproved, download_from_usdb_improved
from routes.health import health_bp
from routes.video import convert_video_bp, video_info_bp
from routes.audio import separate_audio_bp, remove_audio_bp
from routes.youtube import download_youtube_bp, youtube_folder_bp
from routes.usdb import search_usdb_bp, song_info_bp, usdb_process_bp, usdb_download_bp
from routes.processing import youtube_cache_bp, modular_process_bp, recreate_bp
from routes.magic import magic_songs_bp, magic_videos_bp, magic_youtube_bp

app = Flask(__name__)
CORS(app)

# Registriere Blueprints
app.register_blueprint(health_bp)
app.register_blueprint(convert_video_bp)
app.register_blueprint(video_info_bp)
app.register_blueprint(separate_audio_bp)
app.register_blueprint(remove_audio_bp)
app.register_blueprint(download_youtube_bp)
app.register_blueprint(youtube_folder_bp)
app.register_blueprint(search_usdb_bp)
app.register_blueprint(song_info_bp)
app.register_blueprint(usdb_process_bp)
app.register_blueprint(usdb_download_bp)
app.register_blueprint(youtube_cache_bp)
app.register_blueprint(modular_process_bp)
app.register_blueprint(recreate_bp)
app.register_blueprint(magic_songs_bp)
app.register_blueprint(magic_videos_bp)
app.register_blueprint(magic_youtube_bp)

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
from routes.utils import get_karaoke_root

if __name__ == '__main__':
    logger.info("Starting AI Services server...")
    logger.info(f"Karaoke root: {get_karaoke_root()}")
    app.run(host='0.0.0.0', port=6000, debug=True)
