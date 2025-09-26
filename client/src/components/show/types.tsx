export interface CurrentSong {
    id: number;
    user_name: string;
    artist: string;
    title: string;
    youtube_url: string;
    mode: 'youtube' | 'server_video' | 'file' | 'ultrastar' | 'youtube_cache';
    position: number;
    duration_seconds: number | null;
    with_background_vocals: boolean;
  }
  
  export interface ShowData {
    currentSong: CurrentSong | null;
    nextSongs: Song[];
    showQRCodeOverlay: boolean;
    qrCodeDataUrl: string | null;
    overlayTitle: string;
  }
  
  export interface Song {
    id: number;
    user_name: string;
    artist: string;
    title: string;
    position: number;
  }
  
  export interface UltrastarNote {
    type: string;
    startBeat: number;
    duration: number;
    pitch: number;
    text: string;
    line: string;
  }
  
  export interface UltrastarLine {
    startBeat: number;
    endBeat: number;
    notes: UltrastarNote[];
  }
  
  export interface UltrastarSongData {
    title: string;
    artist: string;
    language: string;
    edition: string;
    genre: string;
    year: string;
    mp3: string;
    cover: string;
    video: string;
    videogap: number;
    bpm: number;
    gap: number;
    background: string;
    notes: UltrastarNote[];
    lines: UltrastarLine[];
    version: string;
    audioUrl?: string;
    videoUrl?: string;
    backgroundImageUrl?: string;
  }