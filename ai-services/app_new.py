"""
Modular AI Services Flask Application
"""
from flask import Flask
from flask_cors import CORS
import os
import logging

# Import route blueprints
from routes.health.index import health_bp
from routes.video.index import video_bp
from routes.audio.index import audio_bp
from routes.usdb.index import usdb_bp
from routes.youtube.index import youtube_bp
from routes.magic.index import magic_bp
from routes.processing.index import processing_bp

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

def create_app():
    """Create and configure the Flask application"""
    app = Flask(__name__)
    CORS(app)
    
    # Register blueprints
    app.register_blueprint(health_bp)
    app.register_blueprint(video_bp)
    app.register_blueprint(audio_bp)
    app.register_blueprint(usdb_bp)
    app.register_blueprint(youtube_bp)
    app.register_blueprint(magic_bp)
    app.register_blueprint(processing_bp)
    
    return app

if __name__ == '__main__':
    logger.info("Starting AI Services server...")
    logger.info(f"Karaoke root: {KARAOKE_ROOT}")
    logger.info(f"Ultrastar directory: {ULTRASTAR_DIR}")
    
    app = create_app()
    app.run(host='0.0.0.0', port=6000, debug=True)
