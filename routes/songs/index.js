const express = require('express');
const router = express.Router();

// Import modular route handlers
const youtubeRoutes = require('./youtube');
const usdbRoutes = require('./usdb');
const playlistRoutes = require('./playlist');
const requestRoutes = require('./request');
const qrRoutes = require('./qr');
const listRoutes = require('./list');
const processingRoutes = require('./processing');
const ultrastarRoutes = require('./ultrastar');
const backgroundMusicRoutes = require('./backgroundMusic');

// Mount modular routes
router.use('/', youtubeRoutes);
router.use('/', usdbRoutes);
router.use('/', playlistRoutes);
router.use('/', requestRoutes);
router.use('/', qrRoutes);
router.use('/', listRoutes);
router.use('/', processingRoutes);
router.use('/', ultrastarRoutes);
router.use('/', backgroundMusicRoutes);

module.exports = {
  router
};