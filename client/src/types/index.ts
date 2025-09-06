export interface User {
  id: number;
  device_id: string;
  name: string;
  created_at: string;
}

export interface Song {
  id: number;
  user_id: number;
  title: string;
  artist?: string;
  youtube_url?: string;
  mode: 'youtube' | 'server_video' | 'file' | 'ultrastar';
  status: string;
  position: number;
  delay_count: number;
  created_at: string;
  user_name?: string;
  device_id?: string;
}

export interface ServerVideo {
  filename: string;
  artist: string;
  title: string;
  extension: string;
  fullPath: string;
}

export interface PlaylistResponse {
  playlist: Song[];
  currentSong: Song | null;
  total: number;
}

export interface AdminDashboardData {
  playlist: Song[];
  pendingSongs: Song[];
  users: User[];
  currentSong: Song | null;
  stats: {
    totalSongs: number;
    pendingSongs: number;
    totalUsers: number;
    songsWithYoutube: number;
    songsWithoutYoutube: number;
  };
}

export interface SongRequestData {
  name: string;
  songInput: string;
  deviceId?: string;
}

export interface QRData {
  url: string;
  timestamp: string;
}

export interface LoginData {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: number;
    username: string;
  };
}

export interface ShowData {
  currentSong: Song | null;
  nextSongs: Song[];
  showQRCodeOverlay: boolean;
  qrCodeDataUrl: string | null;
  overlayTitle: string;
}

export interface AdminUser {
  id: number;
  username: string;
  created_at: string;
}