const express = require('express');

const router = express.Router();

// Import and mount sub-routers
router.use('/public', require('./public'));
router.use('/ultrastar', require('./ultrastar'));
router.use('/youtube', require('./youtube'));
router.use('/magic', require('./magic'));
router.use('/processing', require('./processing'));
router.use('/ai-services', require('./ai-services'));
router.use('/settings', require('./settings'));

module.exports = router;
