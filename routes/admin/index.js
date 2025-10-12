const express = require('express');
const { verifyToken } = require('../auth/index');

const router = express.Router();

// All admin routes require authentication
router.use(verifyToken);

// Import sub-routes
const dashboardRoutes = require('./dashboard');
const songsRoutes = require('./songs');

// Mount sub-routes
router.use('/dashboard', dashboardRoutes);
router.use('/songs', songsRoutes);

module.exports = router;
