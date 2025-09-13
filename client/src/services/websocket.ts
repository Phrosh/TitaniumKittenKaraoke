import { io, Socket } from 'socket.io-client';

export interface ShowUpdateData {
  currentSong: {
    id: number;
    user_name: string;
    artist: string;
    title: string;
    youtube_url: string;
    mode: string;
    position: number;
    duration_seconds: number | null;
    with_background_vocals: boolean;
  } | null;
  nextSongs: Array<{
    id: number;
    user_name: string;
    artist: string;
    title: string;
    position: number;
  }>;
  showQRCodeOverlay: boolean;
  qrCodeDataUrl: string | null;
  overlayTitle: string;
}

export interface AdminUpdateData {
  playlist: Array<{
    id: number;
    user_name: string;
    artist: string;
    title: string;
    position: number;
    priority: number;
    duration_seconds: number | null;
    mode: string;
    youtube_url: string;
    with_background_vocals: boolean;
  }>;
  currentSong: {
    id: number;
    user_name: string;
    artist: string;
    title: string;
    position: number;
    duration_seconds: number | null;
    mode: string;
    youtube_url: string;
    with_background_vocals: boolean;
  } | null;
  maxDelay: number;
  total: number;
  settings: Record<string, string>;
}

export interface PlaylistUpdateData {
  playlist: Array<{
    id: number;
    user_name: string;
    artist: string;
    title: string;
    position: number;
    priority: number;
    duration_seconds: number | null;
    mode: string;
    youtube_url: string;
    with_background_vocals: boolean;
  }>;
  currentSong: {
    id: number;
    user_name: string;
    artist: string;
    title: string;
    position: number;
    duration_seconds: number | null;
    mode: string;
    youtube_url: string;
    with_background_vocals: boolean;
  } | null;
  maxDelay: number;
  total: number;
}

class WebSocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(window.location.origin, {
          transports: ['websocket', 'polling'],
          timeout: 20000,
          forceNew: true
        });

        this.socket.on('connect', () => {
          console.log('🔌 WebSocket connected:', this.socket?.id);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          
          // Join show room
          this.socket?.emit('join-show');
          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          console.log('🔌 WebSocket disconnected:', reason);
          this.isConnected = false;
          
          if (reason === 'io server disconnect') {
            // Server initiated disconnect, don't reconnect
            return;
          }
          
          // Attempt to reconnect
          this.attemptReconnect();
        });

        this.socket.on('connect_error', (error) => {
          console.error('🔌 WebSocket connection error:', error);
          this.isConnected = false;
          reject(error);
        });

        this.socket.on('reconnect', (attemptNumber) => {
          console.log(`🔌 WebSocket reconnected after ${attemptNumber} attempts`);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          
          // Rejoin show room
          this.socket?.emit('join-show');
        });

        this.socket.on('reconnect_error', (error) => {
          console.error('🔌 WebSocket reconnection error:', error);
        });

        this.socket.on('reconnect_failed', () => {
          console.error('🔌 WebSocket reconnection failed');
          this.isConnected = false;
        });

      } catch (error) {
        console.error('🔌 Failed to create WebSocket connection:', error);
        reject(error);
      }
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('🔌 Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    console.log(`🔌 Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (!this.isConnected && this.socket) {
        this.socket.connect();
      }
    }, delay);
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.emit('leave-show');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      console.log('🔌 WebSocket disconnected');
    }
  }

  onShowUpdate(callback: (data: ShowUpdateData) => void): void {
    if (this.socket) {
      this.socket.on('show-update', callback);
    }
  }

  offShowUpdate(callback: (data: ShowUpdateData) => void): void {
    if (this.socket) {
      this.socket.off('show-update', callback);
    }
  }

  joinAdminRoom(): void {
    if (this.socket) {
      this.socket.emit('join-admin');
    }
  }

  leaveAdminRoom(): void {
    if (this.socket) {
      this.socket.emit('leave-admin');
    }
  }

  onAdminUpdate(callback: (data: AdminUpdateData) => void): void {
    if (this.socket) {
      this.socket.on('admin-update', callback);
    }
  }

  offAdminUpdate(callback: (data: AdminUpdateData) => void): void {
    if (this.socket) {
      this.socket.off('admin-update', callback);
    }
  }

  joinPlaylistRoom(): void {
    if (this.socket) {
      this.socket.emit('join-playlist');
    }
  }

  leavePlaylistRoom(): void {
    if (this.socket) {
      this.socket.emit('leave-playlist');
    }
  }

  onPlaylistUpdate(callback: (data: PlaylistUpdateData) => void): void {
    if (this.socket) {
      this.socket.on('playlist-update', callback);
    }
  }

  offPlaylistUpdate(callback: (data: PlaylistUpdateData) => void): void {
    if (this.socket) {
      this.socket.off('playlist-update', callback);
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getSocketId(): string | undefined {
    return this.socket?.id;
  }
}

// Singleton instance
export const websocketService = new WebSocketService();
export default websocketService;
