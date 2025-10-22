from flask import Blueprint, jsonify, request
import logging
import sys
import os
from ..utils import get_ultrastar_dir

# Erstelle einen Blueprint für USDB-Suche
search_usdb_bp = Blueprint('search_usdb', __name__)

# Logger für USDB-Module
logger = logging.getLogger(__name__)

@search_usdb_bp.route('/usdb/search', methods=['POST'])
def search_usdb():
    """
    Search for songs on USDB using the proven usdb_find_ids.py script
    """
    try:
        data = request.get_json()
        interpret = data.get('interpret', '')
        title = data.get('title', '')
        limit = data.get('limit', 20)
        
        # Support legacy query parameter
        if not interpret and not title:
            query = data.get('query', '')
            if query:
                # Try to parse query into interpret and title
                # Simple heuristic: if query contains " - ", split it
                if ' - ' in query:
                    parts = query.split(' - ', 1)
                    interpret = parts[0].strip()
                    title = parts[1].strip()
                else:
                    # Default to searching in interpret field
                    interpret = query
        
        if not interpret and not title:
            return jsonify({'error': 'Interpret or title is required'}), 400
        
        logger.info(f"Searching USDB: interpret='{interpret}', title='{title}', limit={limit}")
        
        # Get USDB credentials from environment or request
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'error': 'USDB credentials are required'}), 400
        
        # Import the functions from usdb_find_ids.py
        sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        
        from usdb_find_ids import login, search_all_by_artist
        import requests
        
        # Create session and login
        session = requests.Session()
        session.headers.update({"User-Agent": "Mozilla/5.0"})
        
        try:
            login(session, username, password)
            logger.info("Login successful")
        except Exception as e:
            logger.error(f"Login failed: {str(e)}")
            return jsonify({'error': f'Login failed: {str(e)}'}), 401
        
        # Search for songs
        try:
            songs = search_all_by_artist(session, interpret, title, per_page=limit, max_items=limit)
            logger.info(f"Found {len(songs)} songs")
            
            # Convert to the expected format
            formatted_songs = []
            for song in songs:
                formatted_songs.append({
                    "id": song["id"],
                    "artist": song.get("artist", "Unknown Artist"),
                    "title": song["title"],
                    "url": f"https://usdb.animux.de/?link=detail&id={song['id']}"
                })
            
            return jsonify({
                'success': True,
                'songs': formatted_songs,
                'count': len(formatted_songs)
            })
            
        except Exception as e:
            logger.error(f"Search failed: {str(e)}")
            return jsonify({'error': f'Search failed: {str(e)}'}), 500
        
    except Exception as e:
        logger.error(f"Error searching USDB: {str(e)}")
        return jsonify({'error': str(e)}), 500
