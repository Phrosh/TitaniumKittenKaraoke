export interface User {
  id: number;
  device_id: string;
  name: string;
  created_at: string;
}

export type LegacyStatus = 'none' | 'downloading' | 'downloaded' | 'cached' | 'failed';

export type DownloadStatus = 'downloading' | 'failed' | 'finished' | 'separating' | 'transcribing';

export interface Song {
  id: number;
  user_id: number;
  title: string;
  artist?: string;
  youtube_url?: string;
  mode: 'youtube' | 'server_video' | 'file' | 'ultrastar' | 'youtube_cache';
  modes?: string[];
  status: LegacyStatus;
  download_status?: DownloadStatus;
  download_started_at?: string;
  position: number;
  delay_count: number;
  created_at: string;
  user_name?: string;
  device_id?: string;
  with_background_vocals?: boolean;
  magic?: boolean;
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

export interface YouTubeSong {
  artist: string;
  title: string;
  folderName: string;
  videoFile: string;
  videoFiles?: string[];
  modes: string[];
  hasVideo: boolean;
}

export interface AdminDashboardData {
  playlist: Song[];
  pendingSongs: Song[];
  users: User[];
  currentSong: Song | null;
  youtubeSongs: YouTubeSong[];
  magicYouTubeSongs?: YouTubeSong[];
  stats: {
    totalSongs: number;
    pendingSongs: number;
    totalUsers: number;
    songsWithYoutube: number;
    songsWithoutYoutube: number;
    youtubeCacheSongs: number;
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