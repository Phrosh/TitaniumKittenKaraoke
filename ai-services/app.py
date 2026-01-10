from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import subprocess
import logging
import re
import sys
import traceback
import signal
import atexit
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
from routes.custom import custom_pipeline_bp

app = Flask(__name__)
CORS(app)

# Logging setup mit detailliertem Format
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Globaler Exception Handler für unerwartete Exceptions
def handle_exception(exc_type, exc_value, exc_traceback):
    """Globaler Exception Handler für alle unerwarteten Exceptions"""
    if issubclass(exc_type, KeyboardInterrupt):
        sys.__excepthook__(exc_type, exc_value, exc_traceback)
        return
    
    logger.critical(
        "UNERWARTETE EXCEPTION - SERVER ABSTURZ!",
        exc_info=(exc_type, exc_value, exc_traceback)
    )
    logger.critical(f"Exception Type: {exc_type}")
    logger.critical(f"Exception Value: {exc_value}")
    logger.critical(f"Traceback:\n{''.join(traceback.format_tb(exc_traceback))}")
    
    # Versuche die Exception normal zu behandeln
    sys.__excepthook__(exc_type, exc_value, exc_traceback)

sys.excepthook = handle_exception

# Signal Handler für Prozess-Beendigung
def signal_handler(signum, frame):
    """Handler für Signale (z.B. SIGTERM, SIGINT)"""
    logger.critical(f"Signal {signum} empfangen! Server wird beendet.")
    logger.critical(f"Frame: {frame}")
    logger.critical(f"Traceback:\n{''.join(traceback.format_stack(frame))}")
    sys.exit(0)

signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

# Exit Handler
def exit_handler():
    """Wird aufgerufen wenn der Prozess beendet wird"""
    logger.critical("Server wird beendet - Exit Handler aufgerufen")

atexit.register(exit_handler)

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
app.register_blueprint(custom_pipeline_bp)

# Configuration
from routes.utils import get_karaoke_root

# Flask Error Handler
@app.errorhandler(Exception)
def handle_error(e):
    """Globaler Flask Error Handler"""
    logger.critical(f"FLASK ERROR HANDLER - Unerwartete Exception: {e}", exc_info=True)
    logger.critical(f"Request: {request.method} {request.path}")
    logger.critical(f"Traceback:\n{traceback.format_exc()}")
    return jsonify({'error': str(e), 'type': type(e).__name__}), 500

if __name__ == '__main__':
    logger.info("=" * 80)
    logger.info("Starting AI Services server...")
    logger.info(f"Karaoke root: {get_karaoke_root()}")
    logger.info(f"Python version: {sys.version}")
    logger.info(f"Working directory: {os.getcwd()}")
    logger.info("=" * 80)
    
    try:
        app.run(host='0.0.0.0', port=6000, debug=True, use_reloader=False)
    except Exception as e:
        logger.critical(f"KRITISCHER FEHLER beim Starten des Servers: {e}", exc_info=True)
        sys.exit(1)
