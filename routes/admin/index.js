const express = require('express');
const router = express.Router();
const { verifyToken } = require('../auth');

// All admin routes require authentication
router.use(verifyToken);
// Import modular admin route handlers
const dashboardRoutes = require('./dashboard');
const youtubeRoutes = require('./youtube');
const magicYoutubeRoutes = require('./magicYoutube');
const songsRoutes = require('./songs');
const usersRoutes = require('./users');
const settingsRoutes = require('./settings');
const qrRoutes = require('./qr');
const banlistRoutes = require('./banlist');
const listRoutes = require('./list');
const ultrastarRoutes = require('./ultrastar');
const usdbRoutes = require('./usdb');
const cloudflaredRoutes = require('./cloudflared');
const testRoutes = require('./test');
const backgroundMusicRoutes = require('./backgroundMusic');
const backgroundVideoRoutes = require('./backgroundVideo');
const customPipelineRoutes = require('./customPipeline');

// Mount modular admin routes
router.use('/', dashboardRoutes);
router.use('/', youtubeRoutes);
router.use('/', magicYoutubeRoutes);
router.use('/', songsRoutes);
router.use('/', usersRoutes);
router.use('/', settingsRoutes);
router.use('/', qrRoutes);
router.use('/', banlistRoutes);
router.use('/', listRoutes);
router.use('/', ultrastarRoutes);
router.use('/', usdbRoutes);
router.use('/', cloudflaredRoutes);
router.use('/', testRoutes);
router.use('/', backgroundMusicRoutes);
router.use('/', backgroundVideoRoutes);
router.use('/', customPipelineRoutes);

module.exports = {
  router
};
