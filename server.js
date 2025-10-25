const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Import song cache for initialization
const songCache = require('./utils/songCache');

const { router: authRoutes } = require('./routes/auth');
const songRoutes = require('./routes/songs').router;
const playlistRoutes = require('./routes/playlist');
const adminRoutes = require('./routes/admin').router;
const showRoutes = require('./routes/show');
const i18nRoutes = require('./routes/i18n');
const videoModesRoutes = require('./routes/videoModes');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: true, // Allow all origins in development, restrict in production
    credentials: true
  }
});
const PORT = process.env.PORT || 5000;

// Trust proxy for ngrok and other tunneling services
app.set('trust proxy', true);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      frameSrc: ["'self'", "https://www.youtube.com", "https://youtube.com"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "https://www.youtube.com", "https://youtube.com", "http://localhost:*"],
      frameAncestors: ["'none'"],
    },
  },
}));
app.use(cors({
  origin: true, // Allow all origins in development, restrict in production
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000 // More lenient in development
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Add ngrok-skip-browser-warning header to all responses
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/songs', songRoutes);

// Serve magic songs directly under /api/magic-songs
app.get('/api/magic-songs/:folderName/:filename', (req, res) => {
  const path = require('path');
  const fs = require('fs');
  const { MAGIC_SONGS_DIR } = require('./utils/magicSongs');
  
  try {
    const folderName = decodeURIComponent(req.params.folderName);
    const filename = decodeURIComponent(req.params.filename);
    const filePath = path.join(MAGIC_SONGS_DIR, folderName, filename);
    
    console.log(`🎵 Magic song request: ${req.params.folderName}/${req.params.filename} -> ${folderName}/${filename} -> ${filePath}`);
    
    // Security check: ensure the file is within the magic-songs directory
    if (!filePath.startsWith(MAGIC_SONGS_DIR)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Magic song file not found' });
    }
    
    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'audio/mpeg';
    if (ext === '.wav') {
      contentType = 'audio/wav';
    } else if (ext === '.flac') {
      contentType = 'audio/flac';
    } else if (ext === '.m4a') {
      contentType = 'audio/mp4';
    } else if (ext === '.aac') {
      contentType = 'audio/aac';
    }
    
    // Set appropriate headers for audio streaming
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      // Handle range requests for audio streaming
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      // Serve entire file
      const head = {
        'Content-Length': fileSize,
        'Content-Type': contentType,
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    console.error('Error serving magic song:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Serve magic videos directly under /api/magic-videos
app.get('/api/magic-videos/:folderName/:filename', (req, res) => {
  const path = require('path');
  const fs = require('fs');
  const { MAGIC_VIDEOS_DIR } = require('./utils/magicVideos');
  
  try {
    const folderName = decodeURIComponent(req.params.folderName);
    const filename = decodeURIComponent(req.params.filename);
    const videoPath = path.join(MAGIC_VIDEOS_DIR, folderName, filename);
    
    console.log(`🎬 Magic video request: ${req.params.folderName}/${req.params.filename} -> ${folderName}/${filename} -> ${videoPath}`);
    
    // Security check: ensure the file is within the magic-videos directory
    if (!videoPath.startsWith(MAGIC_VIDEOS_DIR)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Check if file exists
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ message: 'Magic video not found' });
    }
    
    // Set appropriate headers for video streaming
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'video/mp4';
    if (ext === '.webm') {
      contentType = 'video/webm';
    } else if (ext === '.avi') {
      contentType = 'video/x-msvideo';
    } else if (ext === '.mov') {
      contentType = 'video/quicktime';
    } else if (ext === '.mkv') {
      contentType = 'video/x-matroska';
    } else if (ext === '.wmv') {
      contentType = 'video/x-ms-wmv';
    }
    
    if (range) {
      // Handle range requests for video streaming
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      // Serve entire file
      const head = {
        'Content-Length': fileSize,
        'Content-Type': contentType,
      };
      res.writeHead(200, head);
      fs.createReadStream(videoPath).pipe(res);
    }
  } catch (error) {
    console.error('Error serving magic video:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Serve video files from any song directory
app.get('/api/video/:songType/:folderName/:filename', (req, res) => {
  const path = require('path');
  const fs = require('fs');
  const { boilDownMatch } = require('./utils/boilDown');
  
  try {
    const songType = req.params.songType;
    const folderName = decodeURIComponent(req.params.folderName);
    const filename = decodeURIComponent(req.params.filename);
    
    console.log(`🎬 Video request: ${songType}/${folderName}/${filename}`);
    
    // Get the appropriate directory based on song type
    let baseDir;
    switch (songType) {
      case 'ultrastar':
        baseDir = require('./utils/ultrastarSongs').ULTRASTAR_DIR;
        break;
      case 'magic-songs':
        baseDir = require('./utils/magicSongs').MAGIC_SONGS_DIR;
        break;
      case 'magic-videos':
        baseDir = require('./utils/magicVideos').MAGIC_VIDEOS_DIR;
        break;
      case 'magic-youtube':
        baseDir = require('./utils/magicYouTube').MAGIC_YOUTUBE_DIR;
        break;
      case 'youtube':
        baseDir = require('./utils/youtubeSongs').YOUTUBE_DIR;
        break;
      default:
        return res.status(400).json({ message: 'Invalid song type' });
    }
    
    // First try direct path match
    let videoPath = path.join(baseDir, folderName, filename);
    
    // If direct path doesn't exist, try flexible matching
    if (!fs.existsSync(videoPath)) {
      console.log(`📁 Direct path not found, trying flexible matching for folder: ${folderName}`);
      
      // Get all folders in the directory
      const folders = fs.readdirSync(baseDir).filter(item => {
        const itemPath = path.join(baseDir, item);
        return fs.statSync(itemPath).isDirectory();
      });
      
      // Find matching folder using boilDown comparison
      const matchingFolder = folders.find(folder => {
        return boilDownMatch(folder, folderName);
      });
      
      if (matchingFolder) {
        videoPath = path.join(baseDir, matchingFolder, filename);
        console.log(`✅ Found matching folder: ${folderName} -> ${matchingFolder}`);
      }
    }
    
    // Security check: ensure the file is within the base directory
    if (!videoPath.startsWith(baseDir)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Check if file exists
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ message: 'Video file not found' });
    }
    
    // Set appropriate headers for video streaming
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(200, head);
      fs.createReadStream(videoPath).pipe(res);
    }
    
  } catch (error) {
    console.error('Error serving video:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Serve audio files from any song directory
app.get('/api/audio/:songType/:folderName/:filename', (req, res) => {
  const path = require('path');
  const fs = require('fs');
  const { boilDownMatch } = require('./utils/boilDown');
  
  try {
    const songType = req.params.songType;
    const folderName = decodeURIComponent(req.params.folderName);
    const filename = decodeURIComponent(req.params.filename);
    
    console.log(`🎵 Audio request: ${songType}/${folderName}/${filename}`);
    
    // Get the appropriate directory based on song type
    let baseDir;
    switch (songType) {
      case 'ultrastar':
        baseDir = require('./utils/ultrastarSongs').ULTRASTAR_DIR;
        break;
      case 'magic-songs':
        baseDir = require('./utils/magicSongs').MAGIC_SONGS_DIR;
        break;
      case 'magic-videos':
        baseDir = require('./utils/magicVideos').MAGIC_VIDEOS_DIR;
        break;
      case 'magic-youtube':
        baseDir = require('./utils/magicYouTube').MAGIC_YOUTUBE_DIR;
        break;
      case 'youtube':
        baseDir = require('./utils/youtubeSongs').YOUTUBE_DIR;
        break;
      default:
        return res.status(400).json({ message: 'Invalid song type' });
    }
    
    // First try direct path match
    let audioPath = path.join(baseDir, folderName, filename);
    
    // If direct path doesn't exist, try flexible matching
    if (!fs.existsSync(audioPath)) {
      console.log(`📁 Direct path not found, trying flexible matching for folder: ${folderName}`);
      
      // Get all folders in the directory
      const folders = fs.readdirSync(baseDir).filter(item => {
        const itemPath = path.join(baseDir, item);
        return fs.statSync(itemPath).isDirectory();
      });
      
      // Find matching folder using boilDown comparison
      const matchingFolder = folders.find(folder => {
        return boilDownMatch(folder, folderName);
      });
      
      if (matchingFolder) {
        audioPath = path.join(baseDir, matchingFolder, filename);
        console.log(`✅ Found matching folder: ${folderName} -> ${matchingFolder}`);
      }
    }
    
    // Security check: ensure the file is within the base directory
    if (!audioPath.startsWith(baseDir)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Check if file exists
    if (!fs.existsSync(audioPath)) {
      return res.status(404).json({ message: 'Audio file not found' });
    }
    
    // Set appropriate headers for audio streaming
    const stat = fs.statSync(audioPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(audioPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'audio/mpeg',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'audio/mpeg',
      };
      res.writeHead(200, head);
      fs.createReadStream(audioPath).pipe(res);
    }
    
  } catch (error) {
    console.error('Error serving audio:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Serve local videos directly under /api/videos
app.get('/api/videos/:filename', (req, res) => {
  const path = require('path');
  const fs = require('fs');
  const { VIDEOS_DIR } = require('./utils/localVideos');
  
  try {
    const filename = decodeURIComponent(req.params.filename);
    const videoPath = path.join(VIDEOS_DIR, filename);
    
    console.log(`🎬 Video request: ${req.params.filename} -> ${filename} -> ${videoPath}`);
    
    // Security check: ensure the file is within the videos directory
    if (!videoPath.startsWith(VIDEOS_DIR)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Check if file exists
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    // Set appropriate headers for video streaming
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      // Handle range requests for video streaming
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      // Serve entire file
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(200, head);
      fs.createReadStream(videoPath).pipe(res);
    }
  } catch (error) {
    console.error('Error serving video:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Serve YouTube videos directly under /api/youtube-videos
app.get('/api/youtube-videos/:folderName/:filename', (req, res) => {
  const path = require('path');
  const fs = require('fs');
  const { YOUTUBE_DIR } = require('./utils/youtubeSongs');
  
  try {
    const folderName = decodeURIComponent(req.params.folderName);
    const filename = decodeURIComponent(req.params.filename);
    const videoPath = path.join(YOUTUBE_DIR, folderName, filename);
    
    console.log(`🎬 YouTube video request: ${req.params.folderName}/${req.params.filename} -> ${folderName}/${filename} -> ${videoPath}`);
    
    // Security check: ensure the file is within the YouTube directory
    if (!videoPath.startsWith(YOUTUBE_DIR)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Check if file exists
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ message: 'YouTube video not found' });
    }
    
    // Set appropriate headers for video streaming
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'video/mp4';
    if (ext === '.webm') {
      contentType = 'video/webm';
    } else if (ext === '.avi') {
      contentType = 'video/x-msvideo';
    } else if (ext === '.mov') {
      contentType = 'video/quicktime';
    } else if (ext === '.mkv') {
      contentType = 'video/x-matroska';
    }
    
    if (range) {
      // Handle range requests for video streaming
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      // Serve entire file
      const head = {
        'Content-Length': fileSize,
        'Content-Type': contentType,
      };
      res.writeHead(200, head);
      fs.createReadStream(videoPath).pipe(res);
    }
  } catch (error) {
    console.error('Error serving YouTube video:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
app.use('/api/playlist', playlistRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', videoModesRoutes);
app.use('/api/show', showRoutes);
app.use('/api/i18n', i18nRoutes);

// Serve static files from React app (both production and development)
app.use(express.static(path.join(__dirname, 'client/build'), {
  setHeaders: (res, path) => {
    // Add ngrok-skip-browser-warning header to all static files
    res.setHeader('ngrok-skip-browser-warning', 'true');
  }
}));

// Catch all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  // Add ngrok-skip-browser-warning header
  res.setHeader('ngrok-skip-browser-warning', 'true');
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  
  // Join show room for real-time updates
  socket.on('join-show', () => {
    socket.join('show');
    console.log(`📺 Client ${socket.id} joined show room`);
  });
  
  // Leave show room
  socket.on('leave-show', () => {
    socket.leave('show');
    console.log(`📺 Client ${socket.id} left show room`);
  });

  // Join admin room for real-time updates
  socket.on('join-admin', () => {
    socket.join('admin');
    console.log(`📊 Client ${socket.id} joined admin room`);
  });
  
  // Leave admin room
  socket.on('leave-admin', () => {
    socket.leave('admin');
    console.log(`📊 Client ${socket.id} left admin room`);
  });

  // Join playlist room for real-time updates
  socket.on('join-playlist', () => {
    socket.join('playlist');
    console.log(`📋 Client ${socket.id} joined playlist room`);
  });
  
  // Leave playlist room
  socket.on('leave-playlist', () => {
    socket.leave('playlist');
    console.log(`📋 Client ${socket.id} left playlist room`);
  });
  
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Make io available to routes
app.set('io', io);

server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔌 WebSocket server ready`);
  
  // Organize loose TXT files on server startup
  try {
    const { organizeLooseTxtFiles } = require('./utils/ultrastarSongs');
    const organizedCount = organizeLooseTxtFiles();
    if (organizedCount > 0) {
      console.log(`📁 Server startup: Organized ${organizedCount} loose TXT files`);
    }
  } catch (error) {
    console.error('Error organizing loose TXT files on startup:', error);
  }
  
  // Initialize song cache on server startup
  try {
    console.log('🚀 Initialisiere Song-Cache beim Serverstart...');
    await songCache.buildCache();
    console.log('✅ Song-Cache erfolgreich initialisiert');
  } catch (error) {
    console.error('❌ Fehler beim Initialisieren des Song-Caches:', error);
  }
});

// Export the io instance for use in other modules
module.exports = { io };