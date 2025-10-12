/**
 * Admin-Routes für Video-Modi-Management
 * Diese Datei erweitert die bestehenden Admin-Routes um Funktionen zur Verwaltung der Video-Modi
 */

const express = require('express');
const router = express.Router();

// Import der zentralen Video-Modi-Konfiguration
const { 
  getAllModes, 
  getMode, 
  updateModePriority, 
  setModeEnabled 
} = require('../../config/videoModes');

/**
 * GET /api/admin/video-modes
 * Gibt alle verfügbaren Video-Modi zurück
 */
router.get('/video-modes', (req, res) => {
  try {
    const modes = getAllModes();
    res.json({
      success: true,
      modes: modes
    });
  } catch (error) {
    console.error('Error getting video modes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get video modes'
    });
  }
});

/**
 * GET /api/admin/video-modes/:modeId
 * Gibt einen spezifischen Video-Modus zurück
 */
router.get('/video-modes/:modeId', (req, res) => {
  try {
    const { modeId } = req.params;
    const mode = getMode(modeId);
    
    if (!mode) {
      return res.status(404).json({
        success: false,
        error: 'Video mode not found'
      });
    }
    
    res.json({
      success: true,
      mode: mode
    });
  } catch (error) {
    console.error('Error getting video mode:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get video mode'
    });
  }
});

/**
 * PUT /api/admin/video-modes/:modeId/priority
 * Aktualisiert die Priorität eines Video-Modus
 */
router.put('/video-modes/:modeId/priority', (req, res) => {
  try {
    const { modeId } = req.params;
    const { priority } = req.body;
    
    if (typeof priority !== 'number' || priority < 1) {
      return res.status(400).json({
        success: false,
        error: 'Priority must be a positive number'
      });
    }
    
    const mode = getMode(modeId);
    if (!mode) {
      return res.status(404).json({
        success: false,
        error: 'Video mode not found'
      });
    }
    
    updateModePriority(modeId, priority);
    
    res.json({
      success: true,
      message: `Priority updated for ${modeId} to ${priority}`,
      mode: getMode(modeId)
    });
  } catch (error) {
    console.error('Error updating mode priority:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update mode priority'
    });
  }
});

/**
 * PUT /api/admin/video-modes/:modeId/enabled
 * Aktiviert oder deaktiviert einen Video-Modus
 */
router.put('/video-modes/:modeId/enabled', (req, res) => {
  try {
    const { modeId } = req.params;
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Enabled must be a boolean value'
      });
    }
    
    const mode = getMode(modeId);
    if (!mode) {
      return res.status(404).json({
        success: false,
        error: 'Video mode not found'
      });
    }
    
    setModeEnabled(modeId, enabled);
    
    res.json({
      success: true,
      message: `${modeId} ${enabled ? 'enabled' : 'disabled'}`,
      mode: getMode(modeId)
    });
  } catch (error) {
    console.error('Error updating mode enabled status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update mode enabled status'
    });
  }
});

/**
 * POST /api/admin/video-modes/reset
 * Setzt alle Video-Modi auf ihre Standardwerte zurück
 */
router.post('/video-modes/reset', (req, res) => {
  try {
    // Lade die Standard-Konfiguration neu
    delete require.cache[require.resolve('../../config/videoModes')];
    const { getAllModes } = require('../../config/videoModes');
    
    const modes = getAllModes();
    
    res.json({
      success: true,
      message: 'Video modes reset to default configuration',
      modes: modes
    });
  } catch (error) {
    console.error('Error resetting video modes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset video modes'
    });
  }
});

module.exports = router;
