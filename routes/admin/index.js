const express = require('express');
const router = express.Router();
// const { body, validationResult } = require('express-validator');
// const bcrypt = require('bcryptjs');
// const Song = require('../../models/Song');
// const User = require('../../models/User');
const { verifyToken } = require('../auth');
// const db = require('../../config/database');
// const { scanYouTubeSongs, downloadYouTubeVideo, findYouTubeSong } = require('../../utils/youtubeSongs');
// const { broadcastQRCodeToggle, broadcastSongChange, broadcastAdminUpdate, broadcastPlaylistUpdate, broadcastProcessingStatus } = require('../../utils/websocketService');
// const { cleanYouTubeUrl } = require('../../utils/youtubeUrlCleaner');

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


// File Songs Management
// const { scanFileSongs, findFileSong } = require('../../utils/fileSongs');

// // USDB Management
// const axios = require('axios');
// const fs = require('fs');
// const path = require('path');

module.exports = {
  router
};
