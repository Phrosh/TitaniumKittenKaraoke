const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const playlistChangeLog = require('../../utils/playlistChangeLog');

// Get playlist change log entries + enabled flag
router.get('/playlist-change-log', async (req, res) => {
  try {
    const limit = req.query.limit;
    const offset = req.query.offset;
    const [entries, count, enabled] = await Promise.all([
      playlistChangeLog.getEntries({ limit, offset }),
      playlistChangeLog.getCount(),
      playlistChangeLog.isEnabled(),
    ]);

    res.json({ entries, count, enabled });
  } catch (error) {
    console.error('Error getting playlist change log:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Enable / disable logging
router.put(
  '/playlist-change-log/enabled',
  [body('enabled').isBoolean().withMessage('enabled muss ein Boolean sein')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { enabled } = req.body;
      await playlistChangeLog.setEnabled(!!enabled);
      res.json({ enabled: !!enabled });
    } catch (error) {
      console.error('Error updating playlist change log enabled:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Clear entire log
router.delete('/playlist-change-log', async (req, res) => {
  try {
    const result = await playlistChangeLog.clear();
    res.json({ message: 'Log gelöscht', deleted: result.deleted });
  } catch (error) {
    console.error('Error clearing playlist change log:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
