import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { showAPI, songAPI } from '../services/api';

// Constants will be moved inside component to use dynamic settings

let globalUltrastarData: UltrastarSongData | null = null;

interface CurrentSong {
  id: number;
  user_name: string;
  artist: string;
  title: string;
  youtube_url: string;
  mode: 'youtube' | 'server_video' | 'file' | 'ultrastar';
  position: number;
  duration_seconds?: number;
  with_background_vocals?: boolean;
}

interface ShowData {
  currentSong: CurrentSong | null;
  nextSongs: Song[];
  showQRCodeOverlay: boolean;
  qrCodeDataUrl: string | null;
  overlayTitle: string;
}

interface Song {
  id: number;
  user_name: string;
  artist: string;
  title: string;
  position: number;
}

interface UltrastarNote {
  type: string;
  startBeat: number;
  duration: number;
  pitch: number;
  text: string;
  line: string;
}

interface UltrastarLine {
  startBeat: number;
  endBeat: number;
  notes: UltrastarNote[];
}

interface UltrastarSongData {
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

const HIGHLIGHT_COLOR = '#4e91c9'; // Default helles Blau

const ShowContainer = styled.div<{ $cursorVisible: boolean }>`
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  cursor: ${props => props.$cursorVisible ? 'default' : 'none'};
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
`;

const VideoWrapper = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
`;

const VideoIframe = styled.iframe`
  width: 100%;
  height: 100%;
  border: none;
`;

const VideoElement = styled.video`
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: black;
`;

const AudioElement = styled.audio`
  position: absolute;
  top: 50px;
  left: 50%;
  transform: translateX(-50%);
  width: 80%;
  max-width: 600px;
  height: 60px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 10px;
  padding: 10px;
  z-index: 33;
`;

const BackgroundVideo = styled.video`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 1;
`;

const BackgroundImage = styled.div<{ $imageUrl: string }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: url(${props => props.$imageUrl});
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  filter: blur(8px);
  transform: scale(1.1);
  z-index: 1;
`;

// createLyricsDisplay removed - now using inline styles

// createCurrentLyric removed - now using inline styles

const PreviewLyric = styled.div`
  font-size: 3rem;
  color: #ffffff;
  text-align: center;
  margin-bottom: 5px;
  text-shadow: 4px 4px 8px rgba(0, 0, 0, 1);
  min-height: 3.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const HighlightedSyllable = styled.span`
  background: linear-gradient(45deg, #ff6b6b, #ffd700);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 900;
  text-shadow: 4px 4px px rgba(0, 0, 0, 1);
`;

const CurrentSyllable = styled.span`
  color: #ffffff;
  font-weight: bold;
  transform: scale(1.1);
  transition: transform 0.2s ease-in-out;
  display: inline-block;
`;


const Header = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  padding: 20px 40px;
  z-index: 10;
`;

const HeaderContent = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
`;

const CurrentSongInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const SingerName = styled.div`
  font-size: 1.8rem;
  font-weight: 700;
  color: #fff;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SongTitle = styled.div`
  font-size: 1.2rem;
  color: #ffd700;
  font-weight: 500;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TimerDisplay = styled.div`
  font-size: 1rem;
  color: #fff;
  font-weight: 600;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  background: rgba(0, 0, 0, 0.3);
  padding: 5px 10px;
  border-radius: 15px;
  margin-left: 20px;
`;

const Footer = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  padding: 20px 40px;
  z-index: 10;
`;

const FooterContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`;

const NextSongsTitle = styled.div`
  font-size: 1rem;
  color: #ccc;
  margin-bottom: 10px;
  font-weight: 600;
`;

const NextSongsList = styled.div`
  display: flex;
  gap: 20px;
  width: 100%;
`;

const NextSongItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
`;

const NextSingerName = styled.div`
  font-size: 0.9rem;
  color: #fff;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const NextSongTitle = styled.div`
  font-size: 0.8rem;
  color: #ffd700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TransitionOverlay = styled.div<{ $isVisible: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
  opacity: ${props => props.$isVisible ? 1 : 0};
  visibility: ${props => props.$isVisible ? 'visible' : 'hidden'};
  transition: all 0.5s ease;
`;

const TransitionContent = styled.div`
  text-align: center;
  max-width: 800px;
  padding: 40px;
`;

const TransitionTitle = styled.h1`
  font-size: 3rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 30px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
`;

const NextSongInfo = styled.div`
  background: rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 30px;
  margin-bottom: 40px;
  backdrop-filter: blur(10px);
`;

const NextSinger = styled.div`
  font-size: 2.5rem;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 15px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
`;

const NextSong = styled.div`
  font-size: 1.8rem;
  color: #fff;
  font-weight: 500;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
`;

const QRCodeContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
`;

const QRCodeImage = styled.img`
  width: 200px;
  height: 200px;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
`;

const QRCodeText = styled.div`
  font-size: 1.2rem;
  color: #fff;
  text-align: center;
  max-width: 400px;
  line-height: 1.5;
`;

// QR Code Overlay Components
const QRCodeOverlay = styled.div<{ $isVisible: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 200;
  padding: 40px;
  opacity: ${props => props.$isVisible ? 1 : 0};
  visibility: ${props => props.$isVisible ? 'visible' : 'hidden'};
  transition: opacity 0.5s ease-in-out, visibility 0.5s ease-in-out;
`;

const QRCodeHeader = styled.h1`
  position: absolute;
  top: 40px;
  left: 50%;
  transform: translateX(-50%);
  color: #fff;
  font-size: 3rem;
  margin: 0;
  font-weight: bold;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
  text-align: center;
  z-index: 201;
`;

const QRCodeContent = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 60px;
  max-width: 1200px;
  width: 100%;
`;

const QRCodeLeftSide = styled.div`
  flex: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
`;

const QRCodeTitle = styled.h1`
  color: #fff;
  font-size: 4rem;
  margin: 0 0 40px 0;
  font-weight: bold;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
`;

const QRCodeNextSongInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: center;
`;

const QRCodeNextSinger = styled.h2`
  font-size: 3rem;
  margin: 0;
  font-weight: 600;
  color: #fff;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
`;

const QRCodeNextSongTitle = styled.h3`
  font-size: 2.5rem;
  margin: 0;
  font-weight: normal;
  color: #ffd700;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
`;

const QRCodeRightSide = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
`;

const QRCodeImageLarge = styled.img`
  width: 300px;
  height: 300px;
  border-radius: 15px;
  border: 20px solid white;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
`;

const QRCodeTextLarge = styled.p`
  color: #fff;
  font-size: 1.4rem;
  margin: 0;
  text-align: center;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  max-width: 300px;
`;

const QRCodeCloseButton = styled.button`
  background: #e74c3c;
  color: white;
  border: none;
  padding: 15px 30px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 1.2rem;
  font-weight: 600;
  margin-top: 30px;

  &:hover {
    background: #c0392b;
  }
`;

const FullscreenButton = styled.button`
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1.1rem;
  font-weight: 600;
  z-index: 20;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);

  &:hover {
    background: rgba(0, 0, 0, 0.9);
    border-color: rgba(255, 255, 255, 0.6);
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const ProgressOverlay = styled.div<{ $isVisible: boolean }>`
  position: absolute;
  top: calc(50vh - 200px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 50;
  opacity: ${props => props.$isVisible ? 1 : 0};
  visibility: ${props => props.$isVisible ? 'visible' : 'hidden'};
  transition: opacity 0.3s ease-in-out, visibility 0.3s ease-in-out;
`;

const ProgressBarContainer = styled.div`
  width: 50vw;
  height: 40px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 4px;
  border: 5px solid ${HIGHLIGHT_COLOR};
  overflow: hidden;
  box-shadow: 0 0 20px rgba(0, 0, 0, 1);
`;

const ProgressBarFill = styled.div<{ $progress: number }>`
  width: ${props => props.$progress}%;
  height: 100%;
  background: ${HIGHLIGHT_COLOR};
  border-radius: 0px;
  transition: width 0.1s ease-out;
  box-shadow: 0 0 10px rgba(78, 145, 201, 0.5);
`;

const NoVideoMessage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  font-size: 1.2rem;
  color: #666;
  background: #f8f9fa;
  border-radius: 15px;
  border: 2px dashed #dee2e6;
`;

const LoadingMessage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  font-size: 1.2rem;
  color: #666;
  background: #f8f9fa;
  border-radius: 15px;
`;

const ShowView: React.FC = () => {
  const [currentSong, setCurrentSong] = useState<CurrentSong | null>(null);
  const [nextSongs, setNextSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSongId, setLastSongId] = useState<number | null>(null);
  // const [showTransition, setShowTransition] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [videoStartTime, setVideoStartTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [showQRCodeOverlay, setShowQRCodeOverlay] = useState(false);
  const [overlayTitle, setOverlayTitle] = useState('Willkommen beim Karaoke');
  
  // Cursor visibility state
  const [cursorVisible, setCursorVisible] = useState(true);
  const cursorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Ultrastar-specific state
  const [ultrastarData, setUltrastarData] = useState<UltrastarSongData | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const currentLyricRef = useRef<HTMLDivElement | null>(null);
  const nextLyricRef = useRef<HTMLDivElement | null>(null);
  const nextNextLyricRef = useRef<HTMLDivElement | null>(null);
  const lastLoggedText = useRef<string>('');
  // Constants for display settings
  const UNSUNG_COLOR = '#ffffff';
  const CURRENT_LINE_OPACITY = 1;
  const NEXT_LINE_OPACITY = 0.7;
  const NEXT_NEXT_LINE_OPACITY = 0.3;
  const LYRICS_FADE_DURATION = '4s';
  const COUNTDOWN_SECONDS = 3;
  const FADE_IN_ATTACK_SECONDS = 10;
  const FADE_IN_DURATION_SECONDS = 4;
  
  // Constants for fade-out/fade-in timing
  const FADE_OUT_THRESHOLD_MS = 5000; // 5 seconds - trigger fade-out if pause > 5s
  const FADE_IN_THRESHOLD_MS = 5000; // 5 seconds - trigger fade-in if next line starts within 5s
  const [showLyrics, setShowLyrics] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [canAutoPlay, setCanAutoPlay] = useState(false);
  const [isFadeOutMode, setIsFadeOutMode] = useState(false);
  const [fadeOutLineIndex, setFadeOutLineIndex] = useState<number | null>(null);
  const [fadeOutLineIndices, setFadeOutLineIndices] = useState<Set<number>>(new Set());
  const [lyricsScale, setLyricsScale] = useState<number>(1);
  const [lyricsTransitionEnabled, setLyricsTransitionEnabled] = useState(false);
  
  // Progress bar state
  const [progressVisible, setProgressVisible] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // CSS styles using constants
  const lyricsDisplayStyle = {
    position: 'absolute' as const,
    top: '55%',
    left: 0,
    right: 0,
    transform: `translateY(-50%) scale(${lyricsScale})`,
    width: '100%',
    height: `334px`,
    background: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 0,
    padding: '40px 20px',
    zIndex: 10,
    display: 'flex', //lyricsDisplay,
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: showLyrics ? 1 : 0,
    transition: `${lyricsTransitionEnabled ? `opacity ${LYRICS_FADE_DURATION} ease-in-out, height 1s ease-in-out, min-height 1s ease-in-out, padding 1s ease-in-out` : 'none'}`,
    whiteSpace: 'pre' as const,
    overflow: 'hidden' as const
  };

  const currentLyricStyle = {
    fontSize: '5rem',
    fontWeight: 'bold',
    color: UNSUNG_COLOR,
    textAlign: 'center' as const,
    marginBottom: '10px',
    textShadow: '4px 4px 8px rgba(0, 0, 0, 1)',
    minHeight: '5.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const previewLyricStyle = {
    fontSize: '3rem',
    color: UNSUNG_COLOR,
    textAlign: 'center' as const,
    marginBottom: '5px',
    opacity: 0.7,
    textShadow: '4px 4px 8px rgba(0, 0, 0, 1)',
    minHeight: '3.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  // Helper functions for lyrics display
  const getLineText = (line: any) => {
    return line.notes.map((note: any) => note.text).join('');
  };


  const setLyricContent = (ref: React.RefObject<HTMLDivElement>, line: any, color: string, opacity: number) => {
    if (ref.current) {
      if (line) {
        const lineText = getLineText(line);
        ref.current.innerHTML = `<span style="color: ${color}; opacity: ${opacity};">${lineText}</span>`;
      } else {
        ref.current.textContent = '';
      }
    }
  };

  const clearAllLyrics = () => {
    if (currentLyricRef.current) currentLyricRef.current.textContent = '';
    if (nextLyricRef.current) nextLyricRef.current.textContent = '';
    if (nextNextLyricRef.current) nextNextLyricRef.current.textContent = '';
  };

  const updateLyricsDisplay = (currentLine: any, nextLine: any, nextNextLine: any, isActive: boolean = false) => {
    if (isActive) {
      // Active line - current line gets full opacity, others get reduced
      setLyricContent(currentLyricRef, currentLine, '#ffd700', CURRENT_LINE_OPACITY);
      setLyricContent(nextLyricRef, nextLine, UNSUNG_COLOR, NEXT_LINE_OPACITY);
      setLyricContent(nextNextLyricRef, nextNextLine, UNSUNG_COLOR, NEXT_NEXT_LINE_OPACITY);
    } else {
      // Preview mode - all lines get unsung color with different opacities
      setLyricContent(currentLyricRef, currentLine, UNSUNG_COLOR, CURRENT_LINE_OPACITY);
      setLyricContent(nextLyricRef, nextLine, UNSUNG_COLOR, NEXT_LINE_OPACITY);
      setLyricContent(nextNextLyricRef, nextNextLine, UNSUNG_COLOR, NEXT_NEXT_LINE_OPACITY);
    }
  };

  // Progress bar functions
  const stopProgress = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setProgressVisible(false);
    setProgressValue(0);
  }, []);

  const startProgress = useCallback((secondsUntilNextLine: number) => {
    // Only start progress if there's enough time (at least 3 seconds)
    if (secondsUntilNextLine < COUNTDOWN_SECONDS) {
      return;
    }

    console.log('🎵 Starting progress bar:', { secondsUntilNextLine });
    
    // Clear any existing progress
    stopProgress();
    
    setProgressValue(100); // Start at 100%
    setProgressVisible(true);
    
    // Start progress animation: full → empty
    const startTime = Date.now();
    const totalDuration = COUNTDOWN_SECONDS * 1000; // 3 seconds total
    
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / totalDuration;
      
      // Full → empty (100% → 0%)
      const emptyProgress = (1 - progress) * 100;
      setProgressValue(emptyProgress);
      
      if (progress >= 1) {
        stopProgress();
      }
    }, 50); // Update every 50ms for smooth animation
  }, [stopProgress]);

  // Ultrastar functions
  const stopUltrastarTiming = useCallback(() => {
    if (timingIntervalRef.current) {
      clearInterval(timingIntervalRef.current);
      timingIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    // Also stop progress when stopping ultrastar timing
    stopProgress();
  }, [stopProgress]);

  const startUltrastarTiming = useCallback((songData: UltrastarSongData, fadeOutIndices: Set<number>) => {
    // Clear existing interval
    stopUltrastarTiming();
    
    if (!songData.audioUrl || songData.bpm <= 0) {
      console.warn('Cannot start Ultrastar timing: missing audio URL or invalid BPM');
      return;
    }
    
    console.log('🎵 Starting Ultrastar timing:', {
      bpm: songData.bpm,
      gap: songData.gap,
      notesCount: songData.notes.length,
      fadeOutIndices: Array.from(fadeOutIndices)
    });
    
    // Calculate beat duration in milliseconds
    const beatDuration = (60000 / (songData.bpm)) / 4; // 60 seconds / BPM
    
      console.log('🎵 Starting requestAnimationFrame timing:', { 
        bpm: songData.bpm,
        beatDuration: Math.round(beatDuration), 
        beatsPerSecond: songData.bpm / 60
      });
      
    
    // Use requestAnimationFrame for smooth 60fps updates
    const updateLyrics = () => {
      if (!audioRef.current) return;
      
      const currentTime = audioRef.current.currentTime * 1000; // Convert to milliseconds
      const songTime = currentTime - songData.gap; // Subtract gap
      
      if (songTime < 0) {
        // Before song starts, continue animation loop
        animationFrameRef.current = requestAnimationFrame(updateLyrics);
        return;
      }
      
      // Find current note based on time
      const currentBeat = songTime / beatDuration;
      
      // Find notes that should be active now
      const activeNotes = songData.notes.filter((note: UltrastarNote) => {
        const noteStartTime = note.startBeat * beatDuration;
        const noteEndTime = (note.startBeat + note.duration) * beatDuration;
        return currentBeat >= note.startBeat && currentBeat < note.startBeat + note.duration;
      });
      
      
      // Find current line and update display
      const currentLineIndex = songData.lines.findIndex((line: UltrastarLine) => 
        currentBeat >= line.startBeat && currentBeat < line.endBeat
      );
      
      // Check if lyrics should be shown (5 seconds before next line starts)
      const nextLineIndex = songData.lines.findIndex((line: UltrastarLine) => 
        currentBeat < line.startBeat
      );
      
      let shouldShowLyrics = false;
      
      if (currentLineIndex >= 0) {
        // Currently in a line - always show
        shouldShowLyrics = true;
        // console.log('🎵 Currently in line - showing lyrics');
      } else if (nextLineIndex >= 0) {
        // Check if next line starts within 10 seconds
        const nextLine = songData.lines[nextLineIndex];
        const timeUntilNextLine = (nextLine.startBeat - currentBeat) * beatDuration;

        // Show lyrics within 10 seconds of any line
        if (timeUntilNextLine <= 10000) {
          shouldShowLyrics = true;
          // console.log('🎵 Within 10 seconds of next line - showing lyrics');
        } else {
          shouldShowLyrics = false;
          // console.log('🎵 Too far from next line - hiding lyrics');
        }
      } else {
        // No more lines - check if current line ended less than 10 seconds ago
        const lastLine = songData.lines[songData.lines.length - 1];
        if (lastLine) {
          const timeSinceLastLine = (currentBeat - lastLine.endBeat) * beatDuration;
          shouldShowLyrics = timeSinceLastLine <= 10000; // 10 seconds
          console.log('🎵 After last line:', {
            timeSinceLastLine: Math.round(timeSinceLastLine),
            shouldShowLyrics
          });
        }
      }
      
      
      // Update lyrics visibility
      setShowLyrics(shouldShowLyrics);
      
      if (currentLineIndex >= 0) {
        // Stop progress when we're actively singing a line
        stopProgress();
        
        const currentLine = songData.lines[currentLineIndex];
        const nextLine = songData.lines[currentLineIndex + 1];
        const nextNextLine = songData.lines[currentLineIndex + 2];
        
        // Find current syllable within the line
        const currentSyllable = currentLine.notes.find((note: UltrastarNote) => 
          currentBeat >= note.startBeat && currentBeat < note.startBeat + note.duration
        );
        
        // Update current line with highlighted syllable
        if (currentLyricRef.current) {
          if (currentSyllable && currentSyllable.text.trim()) {
            // Clear and rebuild the line wie, soth proper spacing
            if (currentLyricRef.current) {
              currentLyricRef.current.innerHTML = '';
              
              currentLine.notes.forEach((note: UltrastarNote, index: number) => {
                const isSung = note.startBeat < currentSyllable.startBeat;
                const isCurrent = note.startBeat === currentSyllable.startBeat;
                const isLast = index === currentLine.notes.length - 1;
                
                // Create note span
                const noteSpan = document.createElement('span');
                
                if (isSung) {
                  // Already sung - highlight color
                  noteSpan.style.color = HIGHLIGHT_COLOR;
                  noteSpan.style.fontWeight = 'bold';
                  noteSpan.textContent = note.text;
                } else if (isCurrent) {
                  // Currently singing - animated from left to right with scaling
                  const progress = (currentBeat - note.startBeat) / note.duration;
                  const width = Math.min(100, Math.max(0, progress * 100));
                  
                  noteSpan.style.position = 'relative';
                  noteSpan.style.display = 'inline-block';
                  noteSpan.style.transform = 'scale(1.0)';
                  noteSpan.style.transition = 'transform 0.5s ease-in-out';
                  
                  // Apply scaling after DOM is ready
                  setTimeout(() => {
                    noteSpan.style.transform = 'scale(1.1)';
                  }, 0);
                  
                  const whiteSpan = document.createElement('span');
                  whiteSpan.style.color = 'white';
                  whiteSpan.textContent = note.text;
                  
                  const highlightSpan = document.createElement('span');
                  highlightSpan.style.position = 'absolute';
                  highlightSpan.style.top = '0';
                  highlightSpan.style.left = '0';
                  highlightSpan.style.width = `${width}%`;
                  highlightSpan.style.overflow = 'hidden';
                  highlightSpan.style.color = HIGHLIGHT_COLOR;
                  highlightSpan.style.fontWeight = 'bold';
                  highlightSpan.textContent = note.text;
                  
                  noteSpan.appendChild(whiteSpan);
                  noteSpan.appendChild(highlightSpan);
                } else {
                  // Not yet sung - white
                  noteSpan.style.color = 'white';
                  noteSpan.textContent = note.text;
                }
                
                if (currentLyricRef.current) {
                currentLyricRef.current.appendChild(noteSpan);
                }
                
              });
            }
          } else {
            // No active syllable, but show already sung syllables in highlight color
            if (currentLyricRef.current) {
              currentLyricRef.current.innerHTML = '';
              
              currentLine.notes.forEach((note: UltrastarNote, index: number) => {
                const isSung = note.startBeat < currentBeat;
                const isLast = index === currentLine.notes.length - 1;
                
                // Create note span
                const noteSpan = document.createElement('span');
                
                if (isSung) {
                  // Already sung - highlight color
                  noteSpan.style.color = HIGHLIGHT_COLOR;
                  noteSpan.style.fontWeight = 'bold';
                  noteSpan.textContent = note.text;
                } else {
                  // Not yet sung - white
                  noteSpan.style.color = 'white';
                  noteSpan.textContent = note.text;
                }
                
                if (currentLyricRef.current) {
                currentLyricRef.current.appendChild(noteSpan);
                }
              });
            }
          }
        }
        
        // Update next lines using helper function (but keep current line with syllable logic)
        // Check if next line (Zeile 2) is a fade-out line - hide only next next line (Zeile 3)
        if (fadeOutIndices.has(currentLineIndex + 1)) {
          console.log('🎵 Zeile 2 ist Fade-out-Zeile - verstecke nur Zeile 3');
          setLyricContent(nextLyricRef, nextLine, UNSUNG_COLOR, NEXT_LINE_OPACITY);
          setLyricContent(nextNextLyricRef, null, UNSUNG_COLOR, NEXT_NEXT_LINE_OPACITY);
        } else if (fadeOutIndices.has(currentLineIndex)) {
          // Current line (Zeile 1) is a fade-out line - hide next lines (Zeile 2 und 3)
          console.log('🎵 Zeile 1 ist Fade-out-Zeile - verstecke Zeile 2 und 3');
          setLyricContent(nextLyricRef, null, UNSUNG_COLOR, NEXT_LINE_OPACITY);
          setLyricContent(nextNextLyricRef, null, UNSUNG_COLOR, NEXT_NEXT_LINE_OPACITY);
        } else {
          // No fade-out line - show all lines
        setLyricContent(nextLyricRef, nextLine, UNSUNG_COLOR, NEXT_LINE_OPACITY);
        setLyricContent(nextNextLyricRef, nextNextLine, UNSUNG_COLOR, NEXT_NEXT_LINE_OPACITY);
        }
      } else if (shouldShowLyrics && nextLineIndex >= 0) {
        // Show preview of upcoming line (FADE_IN_THRESHOLD_MS before it starts)
        const nextLine = songData.lines[nextLineIndex];
        const nextNextLine = songData.lines[nextLineIndex + 1];
        const nextNextNextLine = songData.lines[nextLineIndex + 2];
        
        // Calculate time until next line starts
        const timeUntilNextLine = (nextLine.startBeat - currentBeat) * beatDuration;
        const secondsUntilNextLine = timeUntilNextLine / 1000;
        
        // Start progress if we're showing lyrics and there's exactly 3 seconds left
        if (secondsUntilNextLine >= COUNTDOWN_SECONDS && secondsUntilNextLine <= COUNTDOWN_SECONDS + 0.5) {
          startProgress(secondsUntilNextLine);
        }
        
        // Check if any of the preview lines is a fade-out line
        if (fadeOutIndices.has(nextLineIndex + 1)) {
          // Next line (Preview-Zeile 1) is a fade-out line - show next line, hide line after fade-out
          setIsFadeOutMode(true);
          setFadeOutLineIndex(nextLineIndex + 1);
          updateLyricsDisplay(nextLine, nextNextLine, null, false);
        } else if (fadeOutIndices.has(nextLineIndex)) {
          // Current preview line is a fade-out line - show only this line
          updateLyricsDisplay(nextLine, null, null, false);
        } else {
          // No fade-out line in preview - normal mode
        updateLyricsDisplay(nextLine, nextNextLine, nextNextNextLine, false);
        }
      } else if (shouldShowLyrics && songData.lines.length > 0 && currentBeat < songData.lines[0].startBeat) {
        // Show preview of first line (before song starts, accounting for GAP)
        const firstLine = songData.lines[0];
        const secondLine = songData.lines[1];
        const thirdLine = songData.lines[2];
        
        // Calculate time until first line starts
        const timeUntilFirstLine = (firstLine.startBeat - currentBeat) * beatDuration;
        const secondsUntilFirstLine = timeUntilFirstLine / 1000;
        
        // Start progress if we're showing lyrics and there's exactly 3 seconds left
        if (secondsUntilFirstLine >= COUNTDOWN_SECONDS && secondsUntilFirstLine <= COUNTDOWN_SECONDS + 0.5) {
          startProgress(secondsUntilFirstLine);
        }
        
        // Check if any of the first lines is a fade-out line
        if (fadeOutIndices.has(1)) {
          // Second line is a fade-out line - show first and second line, hide third line
          console.log('🎵 Zweite Zeile ist Fade-out-Zeile (Index 1) - zeige erste und zweite Zeile, verstecke dritte');
          setIsFadeOutMode(true);
          setFadeOutLineIndex(1);
          updateLyricsDisplay(firstLine, secondLine, null, false);
        } else if (fadeOutIndices.has(0)) {
          // First line is a fade-out line - show only first line
          console.log('🎵 Erste Zeile ist Fade-out-Zeile (Index 0) - zeige nur erste Zeile');
          updateLyricsDisplay(firstLine, null, null, false);
        } else {
          // No fade-out line in first lines - normal mode
        updateLyricsDisplay(firstLine, secondLine, thirdLine, false);
        }
      } else if (shouldShowLyrics && songData.lines.length > 0 && currentBeat > songData.lines[songData.lines.length - 1].endBeat) {
        // All lines are sung - hide entire lyrics container
        const lastLine = songData.lines[songData.lines.length - 1];
        const timeSinceLastLine = (currentBeat - lastLine.endBeat) * beatDuration;
        
        if (timeSinceLastLine <= 3000) {
          // Show last line for 3 seconds with fade-out styling
          console.log('🎵 Alle Zeilen gesungen - zeige letzte Zeile für 3 Sekunden');
          
          if (currentLyricRef.current) {
            currentLyricRef.current.innerHTML = '';
            currentLyricRef.current.style.color = HIGHLIGHT_COLOR;
            currentLyricRef.current.style.fontWeight = 'bold';
            currentLyricRef.current.style.opacity = '1';
            currentLyricRef.current.textContent = getLineText(lastLine);
          }
          
          // Hide next lines
          setLyricContent(nextLyricRef, null, UNSUNG_COLOR, NEXT_LINE_OPACITY);
          setLyricContent(nextNextLyricRef, null, UNSUNG_COLOR, NEXT_NEXT_LINE_OPACITY);
        } else {
          // After 3 seconds - hide entire lyrics container
          console.log('🎵 Alle Zeilen gesungen - verstecke gesamten Lyrics-Container');
          setShowLyrics(false);
        }
      } else {
        // No active line and shouldn't show lyrics - clear all
        clearAllLyrics();
        // Reset last logged text when no active notes
        lastLoggedText.current = '';
      }
      
      // Continue animation loop
      animationFrameRef.current = requestAnimationFrame(updateLyrics);
    };
    
    // Start the animation loop
    animationFrameRef.current = requestAnimationFrame(updateLyrics);
  }, [stopUltrastarTiming]);



  const analyzeFadeOutLines = useCallback((songData: UltrastarSongData): Set<number> => {
    if (!songData.lines || songData.lines.length === 0) {
      return new Set();
    }

    const beatDuration = (60000 / songData.bpm) / 4; // Beat duration in milliseconds
    const fadeOutLines: Array<{index: number, text: string, timeUntilNext: number}> = [];
    
    
    for (let i = 0; i < songData.lines.length - 1; i++) {
      const currentLine = songData.lines[i];
      const nextLine = songData.lines[i + 1];
      
      if (currentLine && nextLine) {
        // Calculate pause between end of current line and start of next line
        const pauseBetweenLines = (nextLine.startBeat - currentLine.endBeat) * beatDuration;
        
        
        // If there's more than FADE_OUT_THRESHOLD_MS gap, this is a fade-out line
        if (pauseBetweenLines > FADE_OUT_THRESHOLD_MS) {
          const lineText = getLineText(currentLine);
          fadeOutLines.push({
            index: i,
            text: lineText,
            timeUntilNext: pauseBetweenLines
          });
        }
      }
    }
    
    if (fadeOutLines.length > 0) {
      console.log('🎵 Gefundene Fade-out-Zeilen:', fadeOutLines.length);
      const fadeOutIndices = new Set<number>();
      fadeOutLines.forEach((fadeOutLine, index) => {
        fadeOutIndices.add(fadeOutLine.index);
      });
      setFadeOutLineIndices(fadeOutIndices);
      return fadeOutIndices;
    } else {
      console.log(`🎵 Keine Fade-out-Zeilen gefunden (alle Zeilen haben <${FADE_OUT_THRESHOLD_MS/1000}s Pause)`);
      setFadeOutLineIndices(new Set());
      return new Set();
    }
    
  }, [getLineText]);

  const loadUltrastarData = useCallback(async (song: CurrentSong) => {
    try {
      // Extract folder name from youtube_url (e.g., "/api/ultrastar/Artist - Title" -> "Artist - Title")
      const encodedFolderName = song.youtube_url.replace('/api/ultrastar/', '');
      const folderName = decodeURIComponent(encodedFolderName);
      console.log('🎵 Loading Ultrastar data for:', folderName);
      
      // Pass withBackgroundVocals preference as query parameter
      const withBackgroundVocals = song.with_background_vocals ? 'true' : 'false';
      const response = await songAPI.getUltrastarSongData(folderName, withBackgroundVocals);
      const songData = response.data.songData;
      
      setUltrastarData(songData);
      setCurrentNoteIndex(0);
      
      // Disable transition before hiding lyrics container
      setShowLyrics(false); // Reset lyrics visibility for new song
      console.log('lyrics scale from loadUltrastarData');
      setLyricsScale(0);
    
      setIsFadeOutMode(false); // Reset fade-out mode for new song
      setFadeOutLineIndex(null); // Reset fade-out line index for new song
      setFadeOutLineIndices(new Set()); // Reset fade-out line indices for new song
      
      // Reset progress for new song
      stopProgress();
      
      console.log('🎵 Ultrastar data loaded:', {
        title: songData.title,
        artist: songData.artist,
        bpm: songData.bpm,
        gap: songData.gap,
        notesCount: songData.notes.length,
        audioUrl: songData.audioUrl
      });
      
      // Analyze and log all fade-out lines
      const fadeOutIndices = analyzeFadeOutLines(songData);
      
      
      
      // Start timing if audio is available
      if (songData.audioUrl) {
        startUltrastarTiming(songData, fadeOutIndices);
      }
    } catch (error) {
      console.error('Error loading Ultrastar data:', error);
    }
  }, [startUltrastarTiming, stopProgress]);

  // Show lyrics immediately when ultrastar data is loaded
  useEffect(() => {
    if (ultrastarData && ultrastarData.lines && ultrastarData.lines.length > 0) {
      const firstLine = ultrastarData.lines[0];
      const secondLine = ultrastarData.lines[1];
      const thirdLine = ultrastarData.lines[2];
      
      // Show preview of first lines
      updateLyricsDisplay(firstLine, secondLine, thirdLine, false);
    }
  }, [ultrastarData]);

  const fetchCurrentSong = async () => {
    try {
      const response = await showAPI.getCurrentSong();
      const newSong = response.data.currentSong;
      const nextSongs = response.data.nextSongs || [];
      const overlayStatus = response.data.showQRCodeOverlay || false;
      const qrCodeDataUrl = response.data.qrCodeDataUrl;
      const title = response.data.overlayTitle || 'Willkommen beim Karaoke';
      
      
      // Update overlay status from API
      setShowQRCodeOverlay(overlayStatus);
      
      // Update QR code if provided
      if (qrCodeDataUrl) {
        setQrCodeUrl(qrCodeDataUrl);
      }
      
      // Update overlay title
      setOverlayTitle(title);
      
      // Nur State aktualisieren wenn sich der Song geändert hat
      if (!newSong || newSong.id !== lastSongId) {
        setCurrentSong(newSong);
        setLastSongId(newSong?.id || null);
        setError(null);
        
        // Automatically hide overlay when song changes
        if (showQRCodeOverlay) {
          showAPI.toggleQRCodeOverlay(false).catch(error => {
            console.error('Error hiding overlay:', error);
          });
        }
        
        
        // Load Ultrastar data if it's an ultrastar song
        if (newSong && newSong.mode === 'ultrastar') {
          await loadUltrastarData(newSong);
        } else {
          // Clear ultrastar data for non-ultrastar songs
          setUltrastarData(null);
          
          setShowLyrics(false); // Hide lyrics when switching away from ultrastar
          console.log('lyrics scale from fetch current song');
          setLyricsScale(0);
        
          setIsFadeOutMode(false); // Reset fade-out mode when switching away from ultrastar
          setFadeOutLineIndex(null); // Reset fade-out line index when switching away from ultrastar
          setFadeOutLineIndices(new Set()); // Reset fade-out line indices when switching away from ultrastar
          stopUltrastarTiming();
          stopProgress(); // Reset progress when switching away from ultrastar
        }
        
        // Start timer for new song
        if (newSong && newSong.duration_seconds) {
          setVideoStartTime(Date.now());
          setTimeRemaining(newSong.duration_seconds);
        } else {
          setVideoStartTime(null);
          setTimeRemaining(null);
        }
      }
      
      setNextSongs(nextSongs);
      setLoading(false);
    } catch (error: any) {
      console.error('❌ Error fetching current song:', error);
      setError('Fehler beim Laden des aktuellen Songs');
      setCurrentSong(null);
      setNextSongs([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentSong();
    
    // Refresh every 2 seconds to catch song changes
    const interval = setInterval(fetchCurrentSong, 2000);
    
    return () => {
      clearInterval(interval);
      stopUltrastarTiming(); // Cleanup ultrastar timing
    };
  }, [lastSongId]);

  // Timer effect
  useEffect(() => {
    if (!videoStartTime || !timeRemaining) return;

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - videoStartTime) / 1000);
      const remaining = Math.max(0, timeRemaining - elapsed);
      
      setTimeRemaining(remaining);
    
      // Video ended - show transition
      if (remaining <= 0) {
        setVideoStartTime(null);
        setTimeRemaining(null);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [videoStartTime, timeRemaining, currentSong?.duration_seconds]);

  const getYouTubeEmbedUrl = (url: string) => {
    if (!url) return null;
    
    // Extract video ID from various YouTube URL formats
    const videoIdMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    
    if (videoIdMatch) {
      const videoId = videoIdMatch[1];
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
    }
    
    return null;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isServerVideo = currentSong?.mode === 'server_video';
  const isFileVideo = currentSong?.mode === 'file';
  const isUltrastar = currentSong?.mode === 'ultrastar';
  const isYouTubeCache = currentSong?.mode === 'youtube_cache';
  const embedUrl = currentSong?.youtube_url && !isServerVideo && !isFileVideo && !isUltrastar && !isYouTubeCache ? getYouTubeEmbedUrl(currentSong.youtube_url) : null;

  useEffect(() => {
    globalUltrastarData = ultrastarData;
  }, [ultrastarData]);
  // Define useCallback hooks outside of conditional rendering
  const handleAudioLoadStart = useCallback(() => {
    console.log('🎵 handleAudioLoadStart called - Ultrastar audio loading started:', { 
      songId: currentSong?.id, 
      title: currentSong?.title,
      audioUrl: ultrastarData?.audioUrl,
      mode: currentSong?.mode,
      bpm: ultrastarData?.bpm,
      gap: ultrastarData?.gap
    });
  }, [ultrastarData, currentSong?.id, currentSong?.title]);

  const handleAudioLoadedData = useCallback(() => {
    console.log('🎵 handleAudioLoadedData called - Ultrastar audio loaded:', { 
      songId: currentSong?.id, 
      title: currentSong?.title,
      audioUrl: ultrastarData?.audioUrl
    });
    setAudioLoaded(true);
  }, [ultrastarData, currentSong?.id, currentSong?.title]);

  const handleAudioCanPlay = useCallback(() => {
    console.log('🎵 handleAudioCanPlay called - Ultrastar audio can play:', { 
      songId: currentSong?.id, 
      title: currentSong?.title
    });
    setAudioLoaded(true);
  }, [currentSong?.id, currentSong?.title]);

  const [songChanged, setSongChanged] = useState(true);

  useEffect(() => {
    setSongChanged(true);
  }, [ultrastarData?.gap]);

  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    console.log("hurr", {
      songChanged,
      playing,
      gap: ultrastarData?.gap
    })
    if (!songChanged || !playing || typeof ultrastarData?.gap === 'undefined') return;
    if (ultrastarData && ultrastarData?.lines && ultrastarData?.lines.length > 0) {
      const firstLine = ultrastarData.lines[0];
      const beatDuration = (60000 / ultrastarData.bpm) / 4; // Beat duration in milliseconds
      const firstLineStartTime = ultrastarData.gap + (firstLine.startBeat * beatDuration);
      const fadeInDuration = 1000 * FADE_IN_DURATION_SECONDS; // 4 seconds
      const showTime = Math.max(0, firstLineStartTime - 1000 * FADE_IN_ATTACK_SECONDS); // 10 seconds before first line
      
      // Calculate time until first line starts (for progress bar)
      const timeUntilFirstLine = firstLineStartTime;
      const secondsUntilFirstLine = timeUntilFirstLine / 1000;
        
      if (showTime <= fadeInDuration) {
        // Show immediately if not enough time for fade-in
        console.log('🎵 Not enough time for fade-in - showing lyrics immediately');
        setLyricsTransitionEnabled(false);
        console.log('lyrics scale from useEffect');
        setLyricsScale(1);
        setShowLyrics(true);
        console.log('🎵 Showing lyrics immediately');
      } else {
        setLyricsTransitionEnabled(true);
        setTimeout(() => {
          console.log('lyrics scale from timeout');
          setLyricsScale(1);
          setShowLyrics(true);
          
          // Start progress bar for first lyrics if there's enough time
          setTimeout(() => {
            console.log('🎵 Starting progress bar for first lyrics:', { secondsUntilFirstLine });
            startProgress(secondsUntilFirstLine);
          }, (FADE_IN_ATTACK_SECONDS - COUNTDOWN_SECONDS) * 1000);
        }, showTime);
      }
    }
    setSongChanged(false);
  }, [ultrastarData?.gap, songChanged, playing, setLyricsScale, setShowLyrics, setLyricsTransitionEnabled, startProgress]);

  // console.log('🎵 lyricsTransitionEnabled', lyricsTransitionEnabled);
  // console.log('🎵 lyricsScale', lyricsScale);
  // console.log('🎵 showLyrics', showLyrics);

  const handleAudioPlay = useCallback(async () => {
    console.log('🎵 handleAudioPlay called - Ultrastar audio started playing:', { 
      songId: currentSong?.id, 
      title: currentSong?.title,
      gap: globalUltrastarData?.gap
    });
    
    // Reset lyrics container height to 0 at video start
    // console.log('lyrics scale from handleAudioPlay');
    // setLyricsScale(0);
    setShowLyrics(false);
    setPlaying(true);
    
    // Sync video with audio
    if (videoRef.current && ultrastarData?.videoUrl) {
      videoRef.current.muted = true;
      videoRef.current.currentTime = ultrastarData.videogap;
      videoRef.current.play().catch(console.error);
    }
  }, [ultrastarData, ultrastarData?.gap, currentSong?.id, currentSong?.title, setShowLyrics]);

  const handleAudioPause = useCallback(() => {
    setPlaying(false);
    console.log('🎵 Ultrastar audio paused:', { 
      songId: currentSong?.id, 
      title: currentSong?.title 
    });
    
    // Pause video when audio is paused
    if (videoRef.current && ultrastarData?.videoUrl) {
      videoRef.current.pause();
    }
  }, [ultrastarData, currentSong?.id, currentSong?.title]);

  const handleAudioEnded = useCallback(async () => {
    console.log('🎵 Ultrastar audio ended:', { 
      songId: currentSong?.id, 
      title: currentSong?.title 
    });
    
    // Stop video when audio ends
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    
    stopUltrastarTiming();
    
    // Check if this was a test song and restore original song
    try {
      const { adminAPI } = await import('../services/api');
      await adminAPI.restoreOriginalSong();
      console.log('🎤 Test song ended - original song restored');
    } catch (error) {
      console.error('Error restoring original song:', error);
    }
    
    // Automatically show QR overlay when audio ends
    showAPI.toggleQRCodeOverlay(true).catch(error => {
      console.error('Error showing overlay:', error);
    });
  }, [currentSong?.id, currentSong?.title, stopUltrastarTiming]);

  // Handle click on screen to toggle play/pause
  const handleScreenClick = useCallback(() => {
    if (isUltrastar && audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play().catch(error => {
          console.error('🎵 Error resuming playback:', error);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isUltrastar, currentSong?.id, currentSong?.title]);

  // Cursor management functions
  const hideCursor = useCallback(() => {
    setCursorVisible(false);
  }, []);

  const showCursor = useCallback(() => {
    setCursorVisible(true);
    // Clear existing timeout
    if (cursorTimeoutRef.current) {
      clearTimeout(cursorTimeoutRef.current);
    }
    // Set new timeout to hide cursor after 3 seconds
    cursorTimeoutRef.current = setTimeout(hideCursor, 3000);
  }, [hideCursor]);

  const handleMouseMove = useCallback(() => {
    showCursor();
  }, [showCursor]);

  // Fullscreen functions
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      // Enter fullscreen
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      // Exit fullscreen
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch((err) => {
        console.error('Error attempting to exit fullscreen:', err);
      });
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Check if both audio and video/background are ready for autoplay
  const checkMediaReady = useCallback(() => {
    if (isUltrastar && ultrastarData) {
      const audioReady = audioLoaded;
      const videoReady = ultrastarData.videoUrl ? videoLoaded : true; // No video = ready
      const backgroundReady = ultrastarData.backgroundImageUrl ? true : true; // Images load instantly
      
      if (audioReady && videoReady && backgroundReady && !canAutoPlay) {
        console.log('🎵 Audio and background media are ready for autoplay:', {
          audioReady,
          videoReady,
          backgroundReady,
          hasVideo: !!ultrastarData.videoUrl,
          hasBackgroundImage: !!ultrastarData.backgroundImageUrl,
          title: currentSong?.title
        });
        setCanAutoPlay(true);
      }
    }
  }, [isUltrastar, ultrastarData, audioLoaded, videoLoaded, canAutoPlay, currentSong?.title]);

  // Check media readiness whenever loading states change
  useEffect(() => {
    checkMediaReady();
  }, [checkMediaReady]);

  // Start autoplay when both media are ready
  useEffect(() => {
    if (canAutoPlay && audioRef.current && audioRef.current.paused) {
      console.log('🎵 Starting autoplay for Ultrastar song:', {
        songId: currentSong?.id,
        title: currentSong?.title,
        audioLoaded,
        videoLoaded,
        hasVideo: !!ultrastarData?.videoUrl
      });
      
      audioRef.current.play().catch(error => {
        console.error('🎵 Autoplay failed:', error);
      });
    }
  }, [canAutoPlay, currentSong?.id, currentSong?.title, audioLoaded, videoLoaded, ultrastarData?.videoUrl]);

  // Reset loading states when song changes
  useEffect(() => {
    if (currentSong?.id !== lastSongId) {
      setAudioLoaded(false);
      setVideoLoaded(false);
      setCanAutoPlay(false);
      setShowLyrics(false);
      setIsFadeOutMode(false); // Reset fade-out mode for new song
      setFadeOutLineIndex(null); // Reset fade-out line index for new song
      setFadeOutLineIndices(new Set()); // Reset fade-out line indices for new song
      stopProgress(); // Reset progress for new song
    }
  }, [currentSong?.id, lastSongId, stopProgress]);

  // Initialize cursor timer on component mount
  useEffect(() => {
    // Start the cursor timer when component mounts
    showCursor();
    
    // Cleanup timeout on unmount
    return () => {
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
    };
  }, [showCursor]);

  return (
    <ShowContainer 
      onClick={handleScreenClick}
      onMouseMove={handleMouseMove}
      $cursorVisible={cursorVisible}
    >
      {/* Fullscreen Button */}
        {isFullscreen ? '⤓' : <FullscreenButton onClick={(e) => {
        e.stopPropagation();
        toggleFullscreen();
      }}>⤢</FullscreenButton>}
      {/* Fullscreen Video */}
      {(currentSong?.youtube_url && !isUltrastar) || isUltrastar ? (
        <VideoWrapper>
          {(isServerVideo || isFileVideo || isYouTubeCache) ? (
            <VideoElement
              key={currentSong?.id} // Force re-render only when song changes
              src={currentSong.youtube_url}
              controls
              autoPlay
              onLoadStart={() => {
                const videoType = isFileVideo ? 'File' : isYouTubeCache ? 'YouTube Cache' : 'Server';
                console.log(`🎬 ${videoType} video started:`, { 
                  songId: currentSong?.id, 
                  title: currentSong?.title,
                  url: currentSong.youtube_url,
                  mode: currentSong?.mode
                });
              }}
              onEnded={async () => {
                const videoType = isFileVideo ? 'File' : isYouTubeCache ? 'YouTube Cache' : 'Server';
                console.log(`🎬 ${videoType} video ended:`, { 
                  songId: currentSong?.id, 
                  title: currentSong?.title,
                  mode: currentSong?.mode,
                  willShowQRCode: currentSong?.mode !== 'youtube'
                });
                
                // Check if this was a test song and restore original song
                try {
                  const { adminAPI } = await import('../services/api');
                  await adminAPI.restoreOriginalSong();
                  console.log('🎤 Test song ended - original song restored');
                } catch (error) {
                  console.error('Error restoring original song:', error);
                }
                
                // Automatically show QR code overlay when video ends (except for embedded YouTube videos)
                // YouTube cache videos should show the overlay since they are local videos
                if (currentSong?.mode !== 'youtube') {
                  showAPI.toggleQRCodeOverlay(true).catch(error => {
                    console.error('Error showing overlay:', error);
                  });
                }
              }}
            />
          ) : isUltrastar && ultrastarData?.audioUrl ? (
            <>
              {ultrastarData.videoUrl ? (
                <BackgroundVideo
                  ref={videoRef}
                  src={ultrastarData.videoUrl}
                  muted
                  loop
                  playsInline
                  onLoadedData={() => {
                    setVideoLoaded(true);
                  }}
                  onCanPlay={() => {
                    setVideoLoaded(true);
                  }}
                />
              ) : ultrastarData.backgroundImageUrl ? (
                <BackgroundImage
                  $imageUrl={ultrastarData.backgroundImageUrl}
                />
              ) : null}
              <AudioElement
                key={currentSong?.id}
                ref={audioRef}
                src={ultrastarData.audioUrl}
                autoPlay={canAutoPlay}
                onClick={(e) => e.stopPropagation()}
                style={{ display: 'none' }}
                onLoadStart={handleAudioLoadStart}
                onLoadedData={handleAudioLoadedData}
                onCanPlay={handleAudioCanPlay}
                onPlay={handleAudioPlay}
                onPause={handleAudioPause}
                onEnded={handleAudioEnded}
              />
              <div style={lyricsDisplayStyle} onClick={(e) => e.stopPropagation()}>
                <div ref={currentLyricRef} style={currentLyricStyle}></div>
                <div ref={nextLyricRef} style={previewLyricStyle}></div>
                <div ref={nextNextLyricRef} style={previewLyricStyle}></div>
              </div>
            </>
          ) : embedUrl ? (
            <VideoIframe
              key={currentSong?.id} // Force re-render only when song changes
              src={embedUrl}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onLoad={() => {
                console.log('🎬 YouTube video loaded:', { 
                  songId: currentSong?.id, 
                  title: currentSong?.title,
                  embedUrl,
                  mode: currentSong?.mode
                });
              }}
            />
          ) : (
            <NoVideoMessage>
              {currentSong ? '🎵 Kein Video verfügbar' : '🎤 Kein Song ausgewählt'}
            </NoVideoMessage>
          )}
        </VideoWrapper>
      ) : (
        <VideoWrapper>
          <NoVideoMessage>
            {currentSong ? '🎵 Kein YouTube-Link verfügbar' : '🎤 Kein Song ausgewählt'}
          </NoVideoMessage>
        </VideoWrapper>
      )}

      {/* Header Overlay */}
      <Header>
        <HeaderContent>
          <CurrentSongInfo>
            <SingerName>
              {currentSong ? `🎵 ${currentSong.user_name}` : 'Warte auf Song...'}
            </SingerName>
            <SongTitle>
              {currentSong ? (
                currentSong.artist ? `${currentSong.artist} - ${currentSong.title}` : currentSong.title
              ) : (
                'Kein Song in der Warteschlange'
              )}
            </SongTitle>
          </CurrentSongInfo>
          {timeRemaining !== null && (
            <TimerDisplay>
              ⏱️ {formatTime(timeRemaining)}
            </TimerDisplay>
          )}
        </HeaderContent>
      </Header>

      {/* Footer Overlay */}
      <Footer>
        <FooterContent>
          <NextSongsTitle>🎤 Nächste Songs:</NextSongsTitle>
          <NextSongsList>
            {nextSongs.length > 0 ? (
              nextSongs.map((song, index) => (
                <NextSongItem key={song.id}>
                  <NextSingerName>{song.user_name}</NextSingerName>
                  <NextSongTitle>
                    {song.artist ? `${song.artist} - ${song.title}` : song.title}
                  </NextSongTitle>
                </NextSongItem>
              ))
            ) : (
              <NextSongItem>
                <NextSingerName>Keine weiteren Songs</NextSingerName>
                <NextSongTitle>Warteschlange ist leer</NextSongTitle>
              </NextSongItem>
            )}
          </NextSongsList>
        </FooterContent>
      </Footer>

      {/* Progress Bar Overlay */}
      <ProgressOverlay $isVisible={progressVisible}>
        <ProgressBarContainer>
          <ProgressBarFill $progress={progressValue} />
        </ProgressBarContainer>
      </ProgressOverlay>

      {/* QR Code Overlay */}
      <QRCodeOverlay $isVisible={showQRCodeOverlay}>
        <QRCodeHeader>{overlayTitle}</QRCodeHeader>
        <QRCodeContent>
          <QRCodeLeftSide>
            <QRCodeTitle>🎤 Nächster Song</QRCodeTitle>
            
            {(() => {
              const nextSong = currentSong ? 
                nextSongs.find(song => song.position > currentSong.position) :
                nextSongs.find(song => song.position === 1);
              
              return nextSong ? (
                <QRCodeNextSongInfo>
                  <QRCodeNextSinger>
                    {nextSong.user_name}
                  </QRCodeNextSinger>
                  <QRCodeNextSongTitle>
                    {nextSong.artist ? `${nextSong.artist} - ${nextSong.title}` : nextSong.title}
                  </QRCodeNextSongTitle>
                </QRCodeNextSongInfo>
              ) : (
                <QRCodeNextSongInfo>
                  <QRCodeNextSinger>Keine Songs in der Warteschlange</QRCodeNextSinger>
                  <QRCodeNextSongTitle>Füge den ersten Song hinzu!</QRCodeNextSongTitle>
                </QRCodeNextSongInfo>
              );
            })()}
          </QRCodeLeftSide>
          
          <QRCodeRightSide>
            <QRCodeImageLarge 
              src={qrCodeUrl || ''}
              alt="QR Code für Song-Anfrage"
            />
            <QRCodeTextLarge>
              QR-Code scannen für neue Song-Anfragen
            </QRCodeTextLarge>
          </QRCodeRightSide>
        </QRCodeContent>
      </QRCodeOverlay>
    </ShowContainer>
  );
};

export default ShowView;
