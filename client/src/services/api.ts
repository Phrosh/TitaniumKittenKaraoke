import axios from 'axios';

const API_BASE_URL = '/api';


const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
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
  requestSong: (data: { name: string; songInput: string; deviceId?: string }) =>
    api.post('/songs/request', data),
  
  getPlaylist: () =>
    api.get('/songs/playlist'),
  
  getPendingSongs: () =>
    api.get('/songs/pending'),
  
  getQRData: () =>
    api.get('/songs/qr-data'),
  
  getLocalVideos: (search?: string) =>
    api.get('/songs/local-videos', { params: search ? { search } : {} }),
  
  getFileSongs: () =>
    api.get('/admin/settings/file-songs-folder'),
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
  
  updateYouTubeUrl: (songId: number, youtubeUrl: string) =>
    api.put(`/admin/song/${songId}/youtube`, { youtubeUrl }),
  setQRCodeOverlay: (show: boolean) =>
    api.put('/admin/qr-overlay', { show }),
  
  getSong: (songId: number) =>
    api.get(`/admin/song/${songId}`),
  
  updateSong: (songId: number, data: { title: string; artist?: string; youtubeUrl?: string }) =>
    api.put(`/admin/song/${songId}`, data),
  
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
  
  // File Songs Management
  getFileSongsFolder: () =>
    api.get('/admin/settings/file-songs-folder'),
  
  setFileSongsFolder: (folderPath: string) =>
    api.put('/admin/settings/file-songs-folder', { folderPath }),
  
  rescanFileSongs: () =>
    api.post('/admin/settings/rescan-file-songs'),

  // Admin User Management
  getAdminUsers: () => api.get('/admin/admin-users'),
  createAdminUser: (userData: { username: string; password: string }) =>
    api.post('/admin/admin-users', userData),
  deleteAdminUser: (id: number) => api.delete(`/admin/admin-users/${id}`),
  checkAdminExists: () => api.get('/auth/check-admin-exists'),
};

export const showAPI = {
  getCurrentSong: () =>
    api.get('/show'),
};

export default api;