from flask import Blueprint, jsonify

# Erstelle einen Blueprint für Health-Routen
health_bp = Blueprint('health', __name__)

@health_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'service': 'ai-services'})
