from flask import Blueprint, jsonify
import logging
from ..utils import get_ultrastar_dir

# Erstelle einen Blueprint für USDB-Song-Info
song_info_bp = Blueprint('song_info', __name__)

# Logger für USDB-Module
logger = logging.getLogger(__name__)

@song_info_bp.route('/usdb/song/<song_id>', methods=['GET'])
def get_usdb_song_info(song_id):
    """
    Get information about a specific USDB song
    """
    try:
        # Import USDBScraperImproved from the main directory
        import sys
        import os
        sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        
        from usdb_scraper_improved import USDBScraperImproved
        
        scraper = USDBScraperImproved()
        song_info = scraper.get_song_info(song_id)
        
        return jsonify({
            'success': True,
            'song_info': song_info
        })
        
    except Exception as e:
        logger.error(f"Error getting USDB song info: {str(e)}")
        return jsonify({'error': str(e)}), 500
