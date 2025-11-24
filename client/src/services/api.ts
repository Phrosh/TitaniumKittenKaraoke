import axios from 'axios';

const API_BASE_URL = '/api';


const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true', // Skip ngrok browser warning
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('adminToken');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

export const songAPI = {
  requestSong: (data: { name: string; songInput: string; deviceId?: string; withBackgroundVocals?: boolean; youtubeMode?: 'karaoke' | 'magic'; artist?: string; title?: string }) =>
    api.post('/songs/request', data),
  
  getPlaylist: () =>
    api.get('/songs/playlist'),
  
  getPendingSongs: () =>
    api.get('/songs/pending'),
  
  getQRData: () =>
    api.get('/songs/qr-data'),
  
  getServerVideos: (search?: string) =>
    api.get('/songs/server-videos', { params: search ? { search } : {} }),
  
  getUltrastarSongs: (search?: string) =>
    api.get('/songs/ultrastar-songs', { params: search ? { search } : {} }),
  
  
  getUltrastarSongData: (folderName: string, withBackgroundVocals?: string) =>
    api.get(`/songs/ultrastar/${encodeURIComponent(folderName)}/data`, { 
      params: withBackgroundVocals ? { withBackgroundVocals } : {} 
    }),
  
  getFileSongs: () =>
    api.get('/songs/file-songs'), // Public endpoint for file songs
  
  getYouTubeSongs: () =>
    api.get('/songs/youtube-songs'),
  
  getMagicSongs: () =>
    api.get('/songs/magic-songs'),
  
  getMagicVideos: () =>
    api.get('/songs/magic-videos'),
  
  getMagicYouTube: () =>
    api.get('/songs/magic-youtube'), // Public endpoint for YouTube cache songs
  
  getYouTubeEnabled: () => api.get('/songs/youtube-enabled'), // Public endpoint for YouTube enabled setting
  getUSDBSearchEnabled: () => api.get('/songs/usdb-search-enabled'), // Public endpoint for USDB search enabled setting
  searchUSDB: (interpret?: string, title?: string, limit?: number) =>
    api.post('/songs/usdb-search', { interpret, title, limit }), // Public endpoint for USDB search
  searchYouTube: (query: string, maxResults?: number) =>
    api.post('/songs/youtube/search', { query, maxResults }), // Public endpoint for YouTube search
  getInvisibleSongs: () => api.get('/songs/invisible-songs'), // Public endpoint for invisible songs
  getUltrastarAudioSettings: () => api.get('/songs/ultrastar-audio-settings'), // Public endpoint for ultrastar audio settings
  
  // Modular processing for all song types
  modularProcess: (folderName: string, songType: string) =>
    api.post(`/songs/modular-process/${encodeURIComponent(folderName)}`, { songType }),
  
  // Recreate Magic songs (delete processed files and recreate)
  recreateSong: (folderName: string, songType: string) =>
    api.post(`/songs/recreate/${encodeURIComponent(folderName)}`, { songType }),
  
  // Organize loose TXT files
  organizeLooseFiles: () =>
    api.post('/songs/ultrastar/organize-loose-files')
};

export const playlistAPI = {
  getPlaylist: () =>
    api.get('/playlist'),
  
  reorderPlaylist: (songId: number, newPosition: number) =>
    api.put('/playlist/reorder', { songId, newPosition }),
  
  setCurrentSong: (songId: number) =>
    api.put('/playlist/current', { songId }),
  
  nextSong: () =>
    api.post('/playlist/next'),
  
  previousSong: () =>
    api.post('/playlist/previous'),
  
  togglePlayPause: () =>
    api.post('/playlist/toggle-play-pause'),
  
  restartSong: () =>
    api.post('/playlist/restart'),
  
  deleteSong: (songId: number) =>
    api.delete(`/playlist/${songId}`),
  
  updateMaxDelay: (maxDelay: number) =>
    api.put('/playlist/max-delay', { maxDelay }),
};

export const adminAPI = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  
  initAdmin: (username: string, password: string) =>
    api.post('/auth/init-admin', { username, password }),
  
  getDashboard: () =>
    api.get('/admin/dashboard'),
  
  // Background Music API
  updateBackgroundMusicSettings: (data: { enabled?: boolean; volume?: number; selectedSongs?: string[] }) =>
    api.put('/admin/background-music/settings', data),
  
  updateYouTubeUrl: (songId: number, youtubeUrl: string) =>
    api.put(`/admin/song/${songId}/youtube`, { youtubeUrl }),
  
  processMagicYouTube: (songId: number, youtubeUrl: string) =>
    api.post(`/admin/song/${songId}/magic-youtube`, { youtubeUrl }),
  setQRCodeOverlay: (show: boolean) =>
    api.put('/admin/qr-overlay', { show }),
  
  setBackgroundVideo: (enabled: boolean) =>
    api.put('/admin/background-video', { enabled }),
  
  getSong: (songId: number) =>
    api.get(`/admin/song/${songId}`),
  
  updateSong: (songId: number, data: { title: string; artist?: string; youtubeUrl?: string; singerName?: string; withBackgroundVocals?: boolean }) =>
    api.put(`/admin/song/${songId}`, data),
  
  refreshSongClassification: (songId: number) =>
    api.put(`/admin/song/${songId}/refresh-classification`),
  
  getUsers: () =>
    api.get('/admin/users'),
  
  getUserSongs: (userId: number) =>
    api.get(`/admin/user/${userId}/songs`),
  
  clearAllSongs: () =>
    api.delete('/admin/clear-all'),
  
  getSettings: () =>
    api.get('/admin/settings'),
  
  updateRegressionValue: (value: number) =>
    api.put('/admin/settings/regression', { value }),
  updateCustomUrl: (customUrl: string) =>
    api.put('/admin/settings/custom-url', { customUrl }),
  updateOverlayTitle: (overlayTitle: string) =>
    api.put('/admin/settings/overlay-title', { overlayTitle }),

  updateYouTubeEnabled: (youtubeEnabled: boolean) =>
    api.put('/admin/settings/youtube-enabled', { youtubeEnabled }),
  
  updateAutoApproveSongs: (autoApproveSongs: boolean) =>
    api.put('/admin/settings/auto-approve-songs', { autoApproveSongs }),
  
  updateUSDBSearchEnabled: (usdbSearchEnabled: boolean) =>
    api.put('/admin/settings/usdb-search-enabled', { usdbSearchEnabled }),
  
  // Song Approval Management
  getSongApprovals: () =>
    api.get('/admin/song-approvals'),
  
  approveSong: (id: number, data: { singerName: string; artist: string; title: string; youtubeUrl?: string; withBackgroundVocals: boolean }) =>
    api.post(`/admin/song-approvals/${id}/approve`, data),
  
  rejectSong: (id: number) =>
    api.post(`/admin/song-approvals/${id}/reject`),
  
  
  // File Songs Management
  getFileSongsFolder: () =>
    api.get('/admin/settings/file-songs-folder'),
  
  setFileSongsFolder: (folderPath: string, port?: number) =>
    api.put('/admin/settings/file-songs-folder', { folderPath, port }),
  
  rescanFileSongs: () =>
    api.post('/admin/settings/rescan-file-songs'),
  
  removeFileSongs: () =>
    api.post('/admin/settings/remove-file-songs'),

  // Admin User Management
  getAdminUsers: () => api.get('/admin/admin-users'),
  createAdminUser: (userData: { username: string; password: string }) =>
    api.post('/admin/admin-users', userData),
  deleteAdminUser: (id: number) => api.delete(`/admin/admin-users/${id}`),
  checkAdminExists: () => api.get('/auth/check-admin-exists'),

  // Banlist Management
  getBanlist: () => api.get('/admin/banlist'),
  addToBanlist: (deviceId: string, reason?: string) =>
    api.post('/admin/banlist', { deviceId, reason }),
  removeFromBanlist: (deviceId: string) =>
    api.delete(`/admin/banlist/${deviceId}`),

  // Invisible Songs Management
  getInvisibleSongs: () => api.get('/admin/invisible-songs'),
  addToInvisibleSongs: (artist: string, title: string) =>
    api.post('/admin/invisible-songs', { artist, title }),
  removeFromInvisibleSongs: (id: number) =>
    api.delete(`/admin/invisible-songs/${id}`),

  // Ultrastar Audio Settings Management
  getUltrastarAudioSettings: () => api.get('/admin/ultrastar-audio-settings'),
  setUltrastarAudioSetting: (artist: string, title: string, audioPreference: string) =>
    api.post('/admin/ultrastar-audio-settings', { artist, title, audioPreference }),
  removeUltrastarAudioSetting: (artist: string, title: string) =>
    api.delete('/admin/ultrastar-audio-settings', { data: { artist, title } }),

  // USDB Management
  getUSDBCredentials: () => api.get('/admin/usdb-credentials'),
  saveUSDBCredentials: (username: string, password: string) =>
    api.post('/admin/usdb-credentials', { username, password }),
  deleteUSDBCredentials: () => api.delete('/admin/usdb-credentials'),
  downloadFromUSDB: (usdbUrl: string, batchId?: string) =>
    api.post('/admin/usdb-download', { usdbUrl, batchId }),
  searchUSDB: (interpret?: string, title?: string, limit?: number) =>
    api.post('/admin/usdb-search', { interpret, title, limit }),
  getUSDBSongInfo: (songId: string) =>
    api.get(`/admin/usdb-song/${songId}`),
  
  testSong: (songData: { artist: string; title: string; mode?: string; youtubeUrl?: string }) =>
    api.post('/admin/song/test', songData),
  
  restoreOriginalSong: () =>
    api.post('/admin/restore-original-song'),
  
  // YouTube Cache Song Management
  renameYouTubeCacheSong: (oldArtist: string, oldTitle: string, newArtist: string, newTitle: string) =>
    api.post('/admin/youtube-cache/rename', { oldArtist, oldTitle, newArtist, newTitle }),
  
  // General Song Rename (for all song types)
  renameSong: (oldArtist: string, oldTitle: string, newArtist: string, newTitle: string) =>
    api.post('/admin/song/rename', { oldArtist, oldTitle, newArtist, newTitle }),
  
  // General Song Delete (for all song types)
  deleteSong: (artist: string, title: string) =>
    api.post('/admin/song/delete', { artist, title }),

  // Cloudflared Management
  getCloudflaredStatus: () => api.get('/admin/cloudflared/status'),
  installCloudflared: () => api.post('/admin/cloudflared/install'),
  startCloudflaredTunnel: () => api.post('/admin/cloudflared/start'),
  stopCloudflaredTunnel: () => api.post('/admin/cloudflared/stop'),
};

export const showAPI = {
  getCurrentSong: () =>
    api.get('/show'),
  
  getQRCode: () =>
    api.get('/songs/qr-data'),
  
  toggleQRCodeOverlay: (show: boolean) =>
    api.put('/songs/qr-overlay', { show }),
};

export default api;