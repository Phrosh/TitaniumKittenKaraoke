import React, { useState, useEffect, useRef, useCallback } from 'react';
import { showAPI, songAPI, adminAPI } from '../../services/api';
import websocketService, { ShowUpdateData } from '../../services/websocket';
import { boilDown } from '../../utils/boilDown';
import { useTranslation } from 'react-i18next';
import { 
  Singer,
  CurrentSong,
  Song,
  UltrastarNote,
  UltrastarLine,
 } from './types';
import { 
  PRIMARY_COLOR,
  HIGHLIGHT_COLOR,
  SECONDARY_COLOR,
  UNSUNG_COLOR,
  CURRENT_LINE_OPACITY,
  NEXT_LINE_OPACITY,
  NEXT_NEXT_LINE_OPACITY,
  LYRICS_FADE_DURATION,
  COUNTDOWN_SECONDS,
  FADE_IN_ATTACK_SECONDS,
  FADE_IN_DURATION_SECONDS,
  FADE_OUT_THRESHOLD_MS,
  FADE_IN_THRESHOLD_MS,
  START_BUTTON_MODE,
  CURRENT_START_MODE,
  BLACK_BACKGROUND
 } from './constants';
import { 
  ProgressOverlay, 
  ProgressBarContainer, 
  ProgressBarFill,
  ShowContainer,
  VideoWrapper,
  VideoElement,
  VideoIframe,
  AudioElement,
  BackgroundVideo,
  BackgroundImage,
  NoVideoMessage
} from './style';
import { UltrastarSongData } from './types';
import Footer from './Footer';
import Header from './Header';
import Overlay from './Overlay';
import StartOverlay from './StartOverlay';
import QRCodeCorner from './QRCodeCorner';
import ControlButtons from './ControlButtons';
import AdCorner from './AdCorner';

let globalUltrastarData: UltrastarSongData | null = null;

let p1Timeouts: NodeJS.Timeout[] = [];
let p2Timeouts: NodeJS.Timeout[] = [];

const ShowView: React.FC = () => {
  const { t } = useTranslation();
  const [currentSong, setCurrentSong] = useState<CurrentSong | null>(null);
  const [nextSongs, setNextSongs] = useState<Song[]>([]);
  const [lastSongId, setLastSongId] = useState<number | null>(null);
  const lastSongIdRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [videoStartTime, setVideoStartTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [showQRCodeOverlay, setShowQRCodeOverlay] = useState(false);
  const [overlayTitle, setOverlayTitle] = useState('Willkommen beim Karaoke');
  const [showStartOverlay, setShowStartOverlay] = useState(false);

  // YouTube embed state (only for cache miss fallback)
  const [iframeKey, setIframeKey] = useState(0);
  const [youtubeCurrentTime, setYoutubeCurrentTime] = useState(0);
  const [youtubeIsPaused, setYoutubeIsPaused] = useState(false);

  // Cursor visibility state
  const [cursorVisible, setCursorVisible] = useState(true);
  const cursorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Ultrastar-specific state
  const [ultrastarData, setUltrastarData] = useState<UltrastarSongData | null>(null);
  const [isApiLoadedSong, setIsApiLoadedSong] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastLoggedText = useRef<string>('');
  const lastUpdateTimeP1 = useRef<number>(0);
  const lastUpdateTimeP2 = useRef<number>(0);
  const UPDATE_THROTTLE_MS = 50; // Throttle updates to max 20fps to prevent race conditions

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [canAutoPlay, setCanAutoPlay] = useState(false);

  const [lyricsScaleP1, setLyricsScaleP1] = useState<number>(1);
  const [lyricsScaleP2, setLyricsScaleP2] = useState<number>(1);
  const [lyricsTransitionEnabledP1, setLyricsTransitionEnabledP1] = useState(false);
  const [lyricsTransitionEnabledP2, setLyricsTransitionEnabledP2] = useState(false);

  const [progressVisible1, setProgressVisible1] = useState(false);
  const [progressValue1, setProgressValue1] = useState(100);
  const progressIntervalRef1 = useRef<NodeJS.Timeout | null>(null);
  const [progressVisible2, setProgressVisible2] = useState(false);
  const [progressValue2, setProgressValue2] = useState(100);
  const progressIntervalRef2 = useRef<NodeJS.Timeout | null>(null);
  const [showLyrics1, setShowLyrics1] = useState(false);
  const [showLyrics2, setShowLyrics2] = useState(false);
  const currentLyricRef1 = useRef<HTMLDivElement | null>(null);
  const nextLyricRef1 = useRef<HTMLDivElement | null>(null);
  const nextNextLyricRef1 = useRef<HTMLDivElement | null>(null);
  const animationFrameRef1 = useRef<number | null>(null);
  const currentLyricRef2 = useRef<HTMLDivElement | null>(null);
  const nextLyricRef2 = useRef<HTMLDivElement | null>(null);
  const nextNextLyricRef2 = useRef<HTMLDivElement | null>(null);
  const animationFrameRef2 = useRef<number | null>(null);

  // Progress bar state
  const timingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Timer ref for song duration
  const songTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [isDuet, setIsDuet] = useState(false);

  // Background Music State
  const [backgroundMusicSettings, setBackgroundMusicSettings] = useState({
    enabled: true,
    volume: 0.3,
    selectedSongs: [] as string[]
  });
  const [backgroundMusicSongs, setBackgroundMusicSongs] = useState<Array<{filename: string, name: string, url: string}>>([]);
  const backgroundMusicRef = useRef<HTMLAudioElement | null>(null);
  const [isBackgroundMusicPlaying, setIsBackgroundMusicPlaying] = useState(false);

  const lyricsDisplayStyle = {
    position: 'absolute' as const,
    top: '55%',
    left: 0,
    right: 0,
    width: '100%',
    height: '25vh',
    background: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 0,
    padding: '4vh',
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: showLyrics1 ? 1 : 0,
    whiteSpace: 'pre' as const,
    boxShadow: `0px 0px 20px ${BLACK_BACKGROUND}`,
    transform: `translateY(-50%) scale(${lyricsScaleP1})`,
    transition: `${lyricsTransitionEnabledP1 ? `opacity ${LYRICS_FADE_DURATION} ease-in-out, height 1s ease-in-out, min-height 1s ease-in-out, padding 1s ease-in-out` : 'none'}`,
    overflow: 'hidden' as const
  };

  const lyricsDisplayStyle1 = !isDuet ? lyricsDisplayStyle : {
    ...lyricsDisplayStyle,
    top: '35%',
  }

  // console.log(showLyrics1, showLyrics2, lyricsScaleP1, lyricsScaleP2);

  const lyricsDisplayStyle2 = {
    ...lyricsDisplayStyle,
    opacity: showLyrics2 ? 1 : 0,
    transform: `translateY(-50%) scale(${lyricsScaleP2})`,
    transition: `${lyricsTransitionEnabledP2 ? `opacity ${LYRICS_FADE_DURATION} ease-in-out, height 1s ease-in-out, min-height 1s ease-in-out, padding 1s ease-in-out` : 'none'}`,
    top: '65%',
  }

  const currentLyricStyle = {
    fontSize: '7vh',
    lineHeight: '10vh',
    fontWeight: 'bold',
    color: UNSUNG_COLOR,
    textAlign: 'center' as const,
    marginBottom: '10px',
    textShadow: '4px 4px 8px rgba(0, 0, 0, 1)',
    minHeight: '8vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const previewLyricStyle = {
    fontSize: '4vh',
    lineHeight: '4vh',
    color: UNSUNG_COLOR,
    textAlign: 'center' as const,
    marginBottom: '5px',
    opacity: 0.7,
    textShadow: '4px 4px 8px rgba(0, 0, 0, 1)',
    minHeight: '5vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  // Helper functions for lyrics display
  const getLineText = useCallback((line: any) => {
    return line.notes.map((note: any) => note.text).join('');
  }, []);


  const setLyricContent = (ref: React.RefObject<HTMLDivElement>, line: any, color: string, opacity: number) => {
    if (!ref) return;
    const element = ref.current;
    if (element) {
      requestAnimationFrame(() => {
        // Double-check ref is still valid after requestAnimationFrame
        if (!ref.current) return;

        if (line) {
          const lineText = getLineText(line);
          ref.current.innerHTML = `<span style="color: ${color}; opacity: ${opacity};">${lineText}</span>`;
        } else {
          ref.current.textContent = '';
        }
      });
    }
  };

  const clearAllLyrics = () => {
    requestAnimationFrame(() => {
      const singers = getSingers(ultrastarData);
      for (const singer of singers) {
        if (singer.refs.currentLyricRef.current) singer.refs.currentLyricRef.current.textContent = '';
        if (singer.refs.nextLyricRef.current) singer.refs.nextLyricRef.current.textContent = '';
        if (singer.refs.nextNextLyricRef.current) singer.refs.nextNextLyricRef.current.textContent = '';
      }
    });
  };

  const updateLyricsDisplay = (refs: { currentLyricRef: React.RefObject<HTMLDivElement>, nextLyricRef: React.RefObject<HTMLDivElement>, nextNextLyricRef: React.RefObject<HTMLDivElement> }, currentLine: any, nextLine: any, nextNextLine: any, isActive: boolean = false) => {
    const isFirstSinger = currentLine.notes[0].singer === "P1";
    const color = isFirstSinger ? PRIMARY_COLOR : SECONDARY_COLOR;
    if (isActive) {
      // Active line - current line gets full opacity, others get reduced
      setLyricContent(refs.currentLyricRef, currentLine, color, CURRENT_LINE_OPACITY);
      setLyricContent(refs.nextLyricRef, nextLine, UNSUNG_COLOR, NEXT_LINE_OPACITY);
      setLyricContent(refs.nextNextLyricRef, nextNextLine, UNSUNG_COLOR, NEXT_NEXT_LINE_OPACITY);
    } else {
      // Preview mode - all lines get unsung color with different opacities
      setLyricContent(refs.currentLyricRef, currentLine, UNSUNG_COLOR, CURRENT_LINE_OPACITY);
      setLyricContent(refs.nextLyricRef, nextLine, UNSUNG_COLOR, NEXT_LINE_OPACITY);
      setLyricContent(refs.nextNextLyricRef, nextNextLine, UNSUNG_COLOR, NEXT_NEXT_LINE_OPACITY);
    }
  };

  // Progress bar functions
  const stopProgress = useCallback((singer: Singer) => {
    if (singer.progress.intervalRef.current) {
      clearInterval(singer.progress.intervalRef.current);
      singer.progress.intervalRef.current = null;
    }
    singer.progress.setVisible(false);
    singer.progress.setValue(0);
  }, []);

  const startProgress = useCallback((secondsUntilNextLine: number, singer: Singer) => {
    // Only start progress if there's enough time (at least 3 seconds)
    if (secondsUntilNextLine < COUNTDOWN_SECONDS) {
      return;
    }

    // Clear any existing progress
    stopProgress(singer);

    singer.progress.setValue(100); // Start at 100%
    singer.progress.setVisible(true);

    // Start progress animation: full → empty
    const startTime = Date.now();
    const totalDuration = COUNTDOWN_SECONDS * 1000; // 3 seconds total

    singer.progress.intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / totalDuration;

      // Full → empty (100% → 0%)
      const emptyProgress = (1 - progress) * 100;
      singer.progress.setValue(emptyProgress);

      if (progress >= 1) {
        stopProgress(singer);
      }
    }, 50); // Update every 50ms for smooth animation
  }, [stopProgress]);

  // Ultrastar functions
  const stopUltrastarTiming = useCallback(() => {
    if (timingIntervalRef.current) {
      clearInterval(timingIntervalRef.current);
      timingIntervalRef.current = null;
    }
    
    // Clear animation frames directly without using getSingers to avoid stale closures
    if (animationFrameRef1.current) {
      cancelAnimationFrame(animationFrameRef1.current);
      animationFrameRef1.current = null;
    }
    if (animationFrameRef2.current) {
      cancelAnimationFrame(animationFrameRef2.current);
      animationFrameRef2.current = null;
    }
    
    // Clear progress intervals directly
    if (progressIntervalRef1.current) {
      clearInterval(progressIntervalRef1.current);
      progressIntervalRef1.current = null;
    }
    if (progressIntervalRef2.current) {
      clearInterval(progressIntervalRef2.current);
      progressIntervalRef2.current = null;
    }
    
    // Reset progress states
    setProgressVisible1(false);
    setProgressValue1(0);
    setProgressVisible2(false);
    setProgressValue2(0);
  }, []);

  const getSingers = useCallback((ultrastarData: UltrastarSongData | null) => {
    if (!ultrastarData) return [];

    const singers: Singer[] = [{
      singer: "P1",
      timeouts: p1Timeouts,
      lines: [] as UltrastarLine[],
      notes: [] as UltrastarNote[],
      refs: {
        currentLyricRef: currentLyricRef1,
        nextLyricRef: nextLyricRef1,
        nextNextLyricRef: nextNextLyricRef1,
        animationFrameRef: animationFrameRef1
      },
      setShowLyrics: setShowLyrics1,
      setLyricsScale: setLyricsScaleP1,
      setLyricsTransitionEnabled: setLyricsTransitionEnabledP1,
      progress: {
        visible: false, // Don't use state values here
        value: 0,
        intervalRef: progressIntervalRef1,
        setValue: setProgressValue1,
        setVisible: setProgressVisible1
      }
    }];

    if (ultrastarData.isDuet) {
      singers[0].lines = ultrastarData.lines[0] as UltrastarLine[];
      singers.push({
        singer: "P2",
        setLyricsScale: setLyricsScaleP2,
        setLyricsTransitionEnabled: setLyricsTransitionEnabledP2,
        timeouts: p2Timeouts,
        lines: ultrastarData.lines[1] as UltrastarLine[],
        notes: ultrastarData.notes[1] as UltrastarNote[],
        refs: {
          currentLyricRef: currentLyricRef2,
          nextLyricRef: nextLyricRef2,
          nextNextLyricRef: nextNextLyricRef2,
          animationFrameRef: animationFrameRef2
        },
        setShowLyrics: setShowLyrics2,
        progress: {
          visible: false, // Don't use state values here
          value: 0,
          intervalRef: progressIntervalRef2,
          setValue: setProgressValue2,
          setVisible: setProgressVisible2
        }
      });
    } else {
      singers[0].lines = ultrastarData.lines as UltrastarLine[];
      singers[0].notes = ultrastarData.notes as UltrastarNote[];
    }
    return singers;
  }, [ultrastarData, currentLyricRef1, nextLyricRef1, nextNextLyricRef1, animationFrameRef1, currentLyricRef2, nextLyricRef2, nextNextLyricRef2, animationFrameRef2, setLyricsScaleP1, setLyricsScaleP2, setLyricsTransitionEnabledP1, setLyricsTransitionEnabledP2, progressIntervalRef1, progressIntervalRef2, setProgressValue1, setProgressValue2, setProgressVisible1, setProgressVisible2]);

  // Function to restart lyrics animation when audio resumes
  const restartLyricsAnimation = useCallback(() => {
    if (ultrastarData && audioRef.current && !audioRef.current.paused) {
      // Clear existing animation frame directly
      if (animationFrameRef1.current) {
        cancelAnimationFrame(animationFrameRef1.current);
        animationFrameRef1.current = null;
      }
      if (animationFrameRef2.current) {
        cancelAnimationFrame(animationFrameRef2.current);
        animationFrameRef2.current = null;
      }

      // Note: We'll restart timing in the event handlers instead
    }
  }, [ultrastarData]);

  const startUltrastarTiming = useCallback((songData: UltrastarSongData, fadeOutIndices: Set<number>[]) => {
    // Clear existing interval
    stopUltrastarTiming();

    if (!songData.audioUrl || songData.bpm <= 0) {
      console.warn('Cannot start Ultrastar timing: missing audio URL or invalid BPM');
      return;
    }

    // Calculate beat duration in milliseconds
    const beatDuration = (60000 / (songData.bpm)) / 4; // 60 seconds / BPM

    // Get singers for this specific song data
    const singers = getSingers(songData);

    // Use requestAnimationFrame for smooth 60fps updates
    for (const singer of singers) {
      const updateLyrics = (singer: Singer) => {
        const singerIndex = singer.singer === "P1" ? 0 : 1;
        if (!audioRef.current) return;

        // Note: We don't check for paused here to allow initial animation start
        // Pause handling is done in the event handlers instead

        const now = Date.now();
        const lastUpdateTime = singer.singer === "P1" ? lastUpdateTimeP1 : lastUpdateTimeP2;
        const timeSinceLastUpdate = now - lastUpdateTime.current;

        // Throttle updates to prevent race conditions
        if (timeSinceLastUpdate < UPDATE_THROTTLE_MS) {
          singer.refs.animationFrameRef.current = requestAnimationFrame(() => updateLyrics(singer));
          return;
        }
        lastUpdateTime.current = now;

        const currentTime = audioRef.current.currentTime * 1000; // Convert to milliseconds
        const songTime = currentTime - songData.gap; // Subtract gap

        if (songTime < 0) {
          // Before song starts, continue animation loop
          singer.refs.animationFrameRef.current = requestAnimationFrame(() => updateLyrics(singer));
          return;
        }
        // Find current note based on time
        const currentBeat = songTime / beatDuration;

        // Find current line and update display
        const currentLineIndex = singer.lines.findIndex((line: UltrastarLine) =>
          currentBeat >= line.startBeat && currentBeat < line.endBeat
        );

        // Check if lyrics should be shown (5 seconds before next line starts)
        const nextLineIndex = singer.lines.findIndex((line: UltrastarLine) =>
          currentBeat < line.startBeat
        );

        let shouldShowLyrics = false;

        if (currentLineIndex >= 0) {
          // Currently in a line - always show
          shouldShowLyrics = true;
        } else if (nextLineIndex >= 0) {
          // Check if next line starts within 10 seconds
          const nextLine = singer.lines[nextLineIndex];
          const timeUntilNextLine = (nextLine.startBeat - currentBeat) * beatDuration;

          // Show lyrics within 10 seconds of any line
          if (timeUntilNextLine <= 10000) {
            shouldShowLyrics = true;
          } else {
            shouldShowLyrics = false;
          }
        } else {
          // No more lines - check if current line ended less than 10 seconds ago
          const lastLine = singer.lines[singer.lines.length - 1];
          if (lastLine) {
            const timeSinceLastLine = (currentBeat - lastLine.endBeat) * beatDuration;
            shouldShowLyrics = timeSinceLastLine <= 10000; // 10 seconds
          }
        }
        // Update lyrics visibility
        singer.setShowLyrics(shouldShowLyrics);

        if (currentLineIndex >= 0) {
          // Stop progress when we're actively singing a line
          stopProgress(singer);

          const currentLine = singer.lines[currentLineIndex];
          const nextLine = singer.lines[currentLineIndex + 1];
          const nextNextLine = singer.lines[currentLineIndex + 2];

          // Find current syllable within the line
          const currentSyllable = currentLine.notes.find((note: UltrastarNote) =>
            currentBeat >= note.startBeat && currentBeat < note.startBeat + note.duration
          );

          // Update current line with highlighted syllable - use requestAnimationFrame for safe DOM updates
          const currentLyricElement = singer.refs.currentLyricRef.current;
          if (currentLyricElement) {
            // Use requestAnimationFrame to ensure DOM updates happen safely
            requestAnimationFrame(() => {
              // Double-check ref is still valid after requestAnimationFrame
              if (!singer.refs.currentLyricRef.current) return;
              const highlightColor = singer.singer === "P1" ? HIGHLIGHT_COLOR : SECONDARY_COLOR;

              if (currentSyllable && currentSyllable.text.trim()) {
                // Clear and rebuild the line with proper spacing
                singer.refs.currentLyricRef.current.innerHTML = '';
                currentLine.notes.forEach((note: UltrastarNote, index: number) => {
                  const isSung = note.startBeat < currentSyllable.startBeat;
                  const isCurrent = note.startBeat === currentSyllable.startBeat;

                  // Create note span
                  const noteSpan = document.createElement('span');


                  if (isSung) {
                    // Already sung - highlight color
                    noteSpan.style.color = highlightColor;
                    noteSpan.style.fontWeight = 'bold';
                    noteSpan.textContent = note.text;
                  } else if (isCurrent) {
                    // Currently singing - animated from left to right with scaling
                    const progress = (currentBeat - note.startBeat) / note.duration;
                    const width = Math.min(100, Math.max(0, progress * 100));

                    noteSpan.style.position = 'relative';
                    noteSpan.style.display = 'inline-block';
                    // noteSpan.style.transform = 'scale(1.0)';
                    noteSpan.style.transition = 'transform 0.5s ease-in-out';

                    // // Apply scaling after DOM is ready
                    // setTimeout(() => {
                    //   if (noteSpan.parentNode) {
                    //     noteSpan.style.transform = 'scale(1.1)';
                    //   }
                    // }, 0);

                    const whiteSpan = document.createElement('span');
                    whiteSpan.style.color = UNSUNG_COLOR;
                    whiteSpan.textContent = note.text;

                    const highlightSpan = document.createElement('span');
                    highlightSpan.style.position = 'absolute';
                    highlightSpan.style.top = '0';
                    highlightSpan.style.left = '0';
                    highlightSpan.style.width = `${width}%`;
                    highlightSpan.style.overflow = 'hidden';
                    highlightSpan.style.color = highlightColor;
                    highlightSpan.style.fontWeight = 'bold';
                    highlightSpan.textContent = note.text;

                    noteSpan.appendChild(whiteSpan);
                    noteSpan.appendChild(highlightSpan);
                  } else {
                    // Not yet sung - white
                    noteSpan.style.color = UNSUNG_COLOR;
                    noteSpan.textContent = note.text;
                  }

                  if (singer.refs.currentLyricRef.current) {
                    singer.refs.currentLyricRef.current.appendChild(noteSpan);
                  }
                });
              } else {
                // No active syllable, but show already sung syllables in highlight color
                singer.refs.currentLyricRef.current.innerHTML = '';

                currentLine.notes.forEach((note: UltrastarNote, index: number) => {
                  const isSung = note.startBeat < currentBeat;

                  // Create note span
                  const noteSpan = document.createElement('span');

                  if (isSung) {
                    // Already sung - highlight color
                    noteSpan.style.color = highlightColor;
                    noteSpan.style.fontWeight = 'bold';
                    noteSpan.textContent = note.text;
                  } else {
                    // Not yet sung - white
                    noteSpan.style.color = UNSUNG_COLOR;
                    noteSpan.textContent = note.text;
                  }

                  if (singer.refs.currentLyricRef.current) {
                    singer.refs.currentLyricRef.current.appendChild(noteSpan);
                  }
                });
              }
            });
          }

          // Update next lines using helper function (but keep current line with syllable logic)
          // Check if next line (Zeile 2) is a fade-out line - hide only next next line (Zeile 3)
          if (fadeOutIndices[singerIndex]?.has(currentLineIndex + 1)) {
            setLyricContent(singer.refs.nextLyricRef, nextLine, UNSUNG_COLOR, NEXT_LINE_OPACITY);
            setLyricContent(singer.refs.nextNextLyricRef, null, UNSUNG_COLOR, NEXT_NEXT_LINE_OPACITY);
          } else if (fadeOutIndices[singerIndex]?.has(currentLineIndex)) {
            // Current line (Zeile 1) is a fade-out line - hide next lines (Zeile 2 und 3)
            setLyricContent(singer.refs.nextLyricRef, null, UNSUNG_COLOR, NEXT_LINE_OPACITY);
            setLyricContent(singer.refs.nextNextLyricRef, null, UNSUNG_COLOR, NEXT_NEXT_LINE_OPACITY);
          } else {
            // No fade-out line - show all lines
            setLyricContent(singer.refs.nextLyricRef, nextLine, UNSUNG_COLOR, NEXT_LINE_OPACITY);
            setLyricContent(singer.refs.nextNextLyricRef, nextNextLine, UNSUNG_COLOR, NEXT_NEXT_LINE_OPACITY);
          }
        } else if (shouldShowLyrics && nextLineIndex >= 0) {
          // Show preview of upcoming line (FADE_IN_THRESHOLD_MS before it starts)
          const nextLine = singer.lines[nextLineIndex];
          const nextNextLine = singer.lines[nextLineIndex + 1];
          const nextNextNextLine = singer.lines[nextLineIndex + 2];

          // Calculate time until next line starts
          const timeUntilNextLine = (nextLine.startBeat - currentBeat) * beatDuration;
          const secondsUntilNextLine = timeUntilNextLine / 1000;

          // Start progress if we're showing lyrics and there's exactly 3 seconds left
          if (secondsUntilNextLine >= COUNTDOWN_SECONDS && secondsUntilNextLine <= COUNTDOWN_SECONDS + 0.5) {
            startProgress(secondsUntilNextLine, singer);
          }

          // Check if any of the preview lines is a fade-out line
          if (fadeOutIndices[singerIndex]?.has(nextLineIndex + 1)) {
            // Next line (Preview-Zeile 1) is a fade-out line - show next line, hide line after fade-out
            updateLyricsDisplay(singer.refs, nextLine, nextNextLine, null, false);
          } else if (fadeOutIndices[singerIndex]?.has(nextLineIndex)) {
            // Current preview line is a fade-out line - show only this line
            updateLyricsDisplay(singer.refs, nextLine, null, null, false);
          } else {
            // No fade-out line in preview - normal mode
            updateLyricsDisplay(singer.refs, nextLine, nextNextLine, nextNextNextLine, false);
          }
        } else if (shouldShowLyrics && singer.lines.length > 0 && currentBeat < singer.lines[0].startBeat) {
          // Show preview of first line (before song starts, accounting for GAP)
          const firstLine = singer.lines[0];
          const secondLine = singer.lines[1];
          const thirdLine = singer.lines[2];

          // Calculate time until first line starts
          const timeUntilFirstLine = (firstLine.startBeat - currentBeat) * beatDuration;
          const secondsUntilFirstLine = timeUntilFirstLine / 1000;

          // Start progress if we're showing lyrics and there's exactly 3 seconds left
          if (secondsUntilFirstLine >= COUNTDOWN_SECONDS && secondsUntilFirstLine <= COUNTDOWN_SECONDS + 0.5) {
            startProgress(secondsUntilFirstLine, singer);
          }

          // Check if any of the first lines is a fade-out line
          if (fadeOutIndices[singerIndex]?.has(1)) {
            // Second line is a fade-out line - show first and second line, hide third line
            updateLyricsDisplay(singer.refs, firstLine, secondLine, null, false);
          } else if (fadeOutIndices[singerIndex]?.has(0)) {
            // First line is a fade-out line - show only first line
            updateLyricsDisplay(singer.refs, firstLine, null, null, false);
          } else {
            // No fade-out line in first lines - normal mode
            updateLyricsDisplay(singer.refs, firstLine, secondLine, thirdLine, false);
          }
        } else if (shouldShowLyrics && singer.lines.length > 0 && currentBeat > singer.lines[singer.lines.length - 1].endBeat) {
          // All lines are sung - hide entire lyrics container
          const lastLine = singer.lines[singer.lines.length - 1];
          const timeSinceLastLine = (currentBeat - lastLine.endBeat) * beatDuration;

          if (timeSinceLastLine <= 3000) {
            // Show last line for 3 seconds with fade-out styling

            const highlightColor = singer.singer === "P1" ? HIGHLIGHT_COLOR : SECONDARY_COLOR;

            const currentLyricElement = singer.refs.currentLyricRef.current;
            if (currentLyricElement) {
              requestAnimationFrame(() => {
                if (singer.refs.currentLyricRef.current) {
                  singer.refs.currentLyricRef.current.innerHTML = '';
                  singer.refs.currentLyricRef.current.style.color = highlightColor;
                  singer.refs.currentLyricRef.current.style.fontWeight = 'bold';
                  singer.refs.currentLyricRef.current.style.opacity = '1';
                  singer.refs.currentLyricRef.current.textContent = getLineText(lastLine);
                }
              });
            }
            // Hide next lines
            setLyricContent(singer.refs.nextLyricRef, null, UNSUNG_COLOR, NEXT_LINE_OPACITY);
            setLyricContent(singer.refs.nextNextLyricRef, null, UNSUNG_COLOR, NEXT_NEXT_LINE_OPACITY);
          } else {
            // After 3 seconds - hide entire lyrics container
            singer.setShowLyrics(false);
          }
        } else {
          // No active line and shouldn't show lyrics - clear all
          clearAllLyrics();
          // Reset last logged text when no active notes
          lastLoggedText.current = '';
        }

        // Continue animation loop
        singer.refs.animationFrameRef.current = requestAnimationFrame(() => updateLyrics(singer));
      };
      // Start the animation loop
      singer.refs.animationFrameRef.current = requestAnimationFrame(() => updateLyrics(singer));
    }
  }, [stopUltrastarTiming]);

  const analyzeFadeOutLines = useCallback((songData: UltrastarSongData): Set<number>[] => {
    let fadeOutIndices = [];
    
    // Handle both single singer and duet cases
    if (songData.isDuet) {
      // Duet case - analyze both singers
      for (let singerIndex = 0; singerIndex < 2; singerIndex++) {
        const lines = songData.lines[singerIndex] as UltrastarLine[];
        const beatDuration = (60000 / songData.bpm) / 4;
        const fadeOutLines: Array<{ index: number, text: string, timeUntilNext: number }> = [];
        
        for (let i = 0; i < lines.length - 1; i++) {
          const currentLine = lines[i];
          const nextLine = lines[i + 1];
          
          if (currentLine && nextLine && 'startBeat' in currentLine && 'endBeat' in currentLine && 'startBeat' in nextLine && 'endBeat' in nextLine) {
            const pauseBetweenLines = (nextLine.startBeat - currentLine.endBeat) * beatDuration;
            
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
          const thisFadeOutIndices = new Set<number>();
          fadeOutLines.forEach((fadeOutLine) => {
            thisFadeOutIndices.add(fadeOutLine.index);
          });
          fadeOutIndices.push(thisFadeOutIndices);
        } else {
          fadeOutIndices.push(new Set<number>());
        }
      }
    } else {
      // Single singer case
      const lines = songData.lines as UltrastarLine[];
      const beatDuration = (60000 / songData.bpm) / 4;
      const fadeOutLines: Array<{ index: number, text: string, timeUntilNext: number }> = [];
      
      for (let i = 0; i < lines.length - 1; i++) {
        const currentLine = lines[i];
        const nextLine = lines[i + 1];
        
        if (currentLine && nextLine && 'startBeat' in currentLine && 'endBeat' in currentLine && 'startBeat' in nextLine && 'endBeat' in nextLine) {
          const pauseBetweenLines = (nextLine.startBeat - currentLine.endBeat) * beatDuration;
          
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
        const thisFadeOutIndices = new Set<number>();
        fadeOutLines.forEach((fadeOutLine) => {
          thisFadeOutIndices.add(fadeOutLine.index);
        });
        fadeOutIndices.push(thisFadeOutIndices);
      } else {
        fadeOutIndices.push(new Set<number>());
      }
    }
    
    return fadeOutIndices;
  }, [getLineText]);

  const loadUltrastarData = useCallback(async (song: CurrentSong) => {
    try {
      // Extract folder name from youtube_url
      let folderName: string;
      if (song.youtube_url.includes('/api/ultrastar/')) {
        // UltraStar songs: "/api/ultrastar/Artist - Title" -> "Artist - Title"
        folderName = decodeURIComponent(song.youtube_url.replace('/api/ultrastar/', ''));
      } else if (song.youtube_url.includes('/api/magic-youtube/')) {
        // Magic-YouTube songs: "/api/magic-youtube/Artist - Title" -> "Artist - Title"
        folderName = decodeURIComponent(song.youtube_url.replace('/api/magic-youtube/', ''));
      } else {
        throw new Error(`Unsupported YouTube URL format: ${song.youtube_url}`);
      }

      // Pass withBackgroundVocals preference as query parameter
      const withBackgroundVocals = song.with_background_vocals ? 'true' : 'false';
      const response = await songAPI.getUltrastarSongData(folderName, withBackgroundVocals);
      const songData = response.data.songData;

      setUltrastarData(songData);

      // Reset all states atomically to prevent race conditions
      setShowLyrics1(false);
      setShowLyrics2(false);
      setLyricsScaleP1(0);
      setLyricsScaleP2(0);
      setProgressVisible1(false);
      setProgressValue1(0);
      setProgressVisible2(false);
      setProgressValue2(0);
      setIsDuet(songData.isDuet);

      // Analyze and log all fade-out lines
      // const fadeOutIndices = analyzeFadeOutLines(songData);

      // Don't start timing immediately - wait for audio to be ready
      // Timing will be started in handleAudioCanPlay when audio is fully loaded

    } catch (error) {
      console.error('Error loading Ultrastar data:', error);
    }
  }, [stopProgress]);

  // Show lyrics immediately when ultrastar data is loaded
  useEffect(() => {
    if (!ultrastarData) return;
    
    // Handle both single singer and duet cases
    if (ultrastarData.isDuet) {
      // Duet case - show lyrics for both singers
      const lines1 = ultrastarData.lines[0] as UltrastarLine[];
      const lines2 = ultrastarData.lines[1] as UltrastarLine[];
      
      if (lines1.length > 0) {
        const firstLine = lines1[0];
        const secondLine = lines1[1];
        const thirdLine = lines1[2];
        updateLyricsDisplay({ currentLyricRef: currentLyricRef1, nextLyricRef: nextLyricRef1, nextNextLyricRef: nextNextLyricRef1 }, firstLine, secondLine, thirdLine, false);
      }
      
      if (lines2.length > 0) {
        const firstLine = lines2[0];
        const secondLine = lines2[1];
        const thirdLine = lines2[2];
        updateLyricsDisplay({ currentLyricRef: currentLyricRef2, nextLyricRef: nextLyricRef2, nextNextLyricRef: nextNextLyricRef2 }, firstLine, secondLine, thirdLine, false);
      }
    } else {
      // Single singer case
      const lines = ultrastarData.lines as UltrastarLine[];
      if (lines.length > 0) {
        const firstLine = lines[0];
        const secondLine = lines[1];
        const thirdLine = lines[2];
        updateLyricsDisplay({ currentLyricRef: currentLyricRef1, nextLyricRef: nextLyricRef1, nextNextLyricRef: nextNextLyricRef1 }, firstLine, secondLine, thirdLine, false);
      }
    }
  }, [ultrastarData]);


  const fetchCurrentSong = async () => {
    try {
      const response = await showAPI.getCurrentSong();
      const newSong = response.data.currentSong;
      const nextSongs = response.data.nextSongs || [];
      const overlayStatus = response.data.showQRCodeOverlay || false;
      const qrCodeDataUrl = response.data.qrCodeDataUrl;
      const title = response.data.overlayTitle;

      // Handle all video URLs - convert YouTube URLs to cache URLs or use existing cache URLs
      let normalizedSong = newSong;
      if (newSong && newSong.youtube_url) {
        // Extract video ID from any YouTube URL
        let videoId: string | null = null;
        const videoIdMatch = newSong.youtube_url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
        if (videoIdMatch) {
          videoId = videoIdMatch[1];
        }

        if (videoId && (newSong.youtube_url.includes('youtube.com') || newSong.youtube_url.includes('localhost:5000/api/youtube-videos'))) {
          // Use central cache function to find the correct file
          const cacheUrl = await findCacheFile(newSong.artist, newSong.title, videoId);

          if (cacheUrl) {
            // Cache hit - use the found file
            normalizedSong = {
              ...newSong,
              youtube_url: cacheUrl,
              mode: 'server_video' // Force to server_video mode
            };

            console.log('🌐 Cache hit - using file:', {
              original: newSong.youtube_url,
              cacheUrl: cacheUrl,
              artist: newSong.artist,
              title: newSong.title,
              videoId: videoId,
              originalMode: newSong.mode,
              newMode: 'server_video'
            });
          } else {
            // Cache miss - use YouTube embed as fallback
            normalizedSong = {
              ...newSong,
              mode: 'youtube' // Force to youtube mode for embed
            };

            console.log('🌐 Cache miss - using YouTube embed:', {
              original: newSong.youtube_url,
              artist: newSong.artist,
              title: newSong.title,
              videoId: videoId,
              originalMode: newSong.mode,
              newMode: 'youtube'
            });
          }
        }
      }

      console.log('🌐 API fetchCurrentSong:', {
        newSong: normalizedSong ? {
          id: normalizedSong.id,
          title: normalizedSong.title,
          mode: normalizedSong.mode,
          youtube_url: normalizedSong.youtube_url
        } : null,
        lastSongId: lastSongIdRef.current,
        songChanged: !normalizedSong || normalizedSong.id !== lastSongIdRef.current
      });

      // Update overlay status from API
      setShowQRCodeOverlay(overlayStatus);

      // Send QR overlay change to admin dashboard
      websocketService.emit('show-action', {
        action: 'qr-overlay-changed',
        timestamp: new Date().toISOString(),
        showQRCodeOverlay: overlayStatus,
        overlayTitle: overlayTitle,
        currentSong: currentSong ? {
          id: currentSong.id,
          artist: currentSong.artist,
          title: currentSong.title,
          mode: currentSong.mode
        } : null
      });

      // Update QR code if provided
      if (qrCodeDataUrl) {
        setQrCodeUrl(qrCodeDataUrl);
      }

      // Update overlay title
      setOverlayTitle(title);

      // Nur State aktualisieren wenn sich der Song geändert hat
      if (!normalizedSong || normalizedSong.id !== lastSongIdRef.current) {
        console.log('🌐 Setting new song from API:', normalizedSong);
        
        // Stop background music when new song is loaded
        stopBackgroundMusic();
        
        setCurrentSong(normalizedSong);
        setLastSongId(normalizedSong?.id || null);
        lastSongIdRef.current = normalizedSong?.id || null;
        // setError(null);

        // Automatically hide overlay when song changes
        if (showQRCodeOverlay) {
          showAPI.toggleQRCodeOverlay(false).catch(error => {
            console.error('Error hiding overlay:', error);
          });
        }


        // Show start overlay if user hasn't interacted yet (for any song type)
        if (!hasUserInteracted) {
          console.log('🌐 API: User hasn\'t interacted yet, showing start overlay');
          setShowStartOverlay(true);
        }

        // Load Ultrastar-style data for ultrastar and magic-youtube songs
        if (newSong && (newSong.mode === 'ultrastar' || newSong.mode === 'magic-youtube')) {
          console.log('🌐 API: Loading Ultrastar data for new song');
          setIsApiLoadedSong(true); // Mark as API-loaded song
          await loadUltrastarData(newSong);
        } else {
          // Clear ultrastar data for non-ultrastar songs - do this atomically
          stopUltrastarTiming();
          // stopProgress();
          setProgressVisible1(false);

          // Reset all states atomically to prevent race conditions
          setUltrastarData(null);
          setShowLyrics1(false);
          setShowLyrics2(false);
          setLyricsScaleP1(0);
          setLyricsScaleP2(0);
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
      // setLoading(false);
    } catch (error: any) {
      console.error('❌ Error fetching current song:', error);
      setCurrentSong(null);
      setNextSongs([]);
    }
  };

  const handleWebSocketUpdate = useCallback(async (data: ShowUpdateData) => {
    const { currentSong: newSong, nextSongs, showQRCodeOverlay, qrCodeDataUrl, overlayTitle } = data;

    // Handle all video URLs - convert YouTube URLs to cache URLs or use existing cache URLs
    let normalizedSong = newSong;
    if (newSong && newSong.youtube_url) {
      // Extract video ID from any YouTube URL
      let videoId: string | null = null;
      const videoIdMatch = newSong.youtube_url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
      if (videoIdMatch) {
        videoId = videoIdMatch[1];
      }

      if (videoId && (newSong.youtube_url.includes('youtube.com') || newSong.youtube_url.includes('localhost:5000/api/youtube-videos'))) {
        // Use central cache function to find the correct file
        const cacheUrl = await findCacheFile(newSong.artist, newSong.title, videoId);

        if (cacheUrl) {
          // Cache hit - use the found file
          normalizedSong = {
            ...newSong,
            youtube_url: cacheUrl,
            mode: 'server_video' // Force to server_video mode
          };
        } else {
          // Cache miss - use YouTube embed as fallback
          normalizedSong = {
            ...newSong,
            mode: 'youtube' // Force to youtube mode for embed
          };

          console.log('🔌 Cache miss - using YouTube embed:', {
            original: newSong.youtube_url,
            artist: newSong.artist,
            title: newSong.title,
            videoId: videoId,
            originalMode: newSong.mode,
            newMode: 'youtube'
          });
        }
      }
    }

    console.log('🔌 WebSocket Update received:', {
      newSong: normalizedSong ? {
        id: normalizedSong.id,
        title: normalizedSong.title,
        mode: normalizedSong.mode,
        youtube_url: normalizedSong.youtube_url
      } : null,
      lastSongId: lastSongIdRef.current,
      songChanged: !normalizedSong || normalizedSong.id !== lastSongIdRef.current
    });

    // Update QR overlay state
    setShowQRCodeOverlay(showQRCodeOverlay);
    if (qrCodeDataUrl) {
      setQrCodeUrl(qrCodeDataUrl);
    }

    // Update overlay title
    setOverlayTitle(overlayTitle);

    // Nur State aktualisieren wenn sich der Song geändert hat
    if (!normalizedSong || normalizedSong.id !== lastSongIdRef.current) {
      console.log('🔌 Setting new song from WebSocket:', normalizedSong);
      
      // Stop background music when new song is loaded
      stopBackgroundMusic();
      
      setCurrentSong(normalizedSong);
      setLastSongId(normalizedSong?.id || null);
      lastSongIdRef.current = normalizedSong?.id || null;
      // setError(null);
      
      for (const timeouts of [p1Timeouts, p2Timeouts]) {
        for (const timeout of timeouts) {
          clearTimeout(timeout);
        }
      }
      
      setSongChanged(true);

      // Automatically hide overlay when song changes
      if (showQRCodeOverlay) {
        showAPI.toggleQRCodeOverlay(false).catch(error => {
          console.error('Error hiding overlay:', error);
        });
      }

      // Hide start overlay when song comes via WebSocket (user has interacted)
      if (showStartOverlay) {
        console.log('🔌 WebSocket: Hiding start overlay, song loaded via WebSocket');
        setShowStartOverlay(false);
      }

      // Load Ultrastar-style data for ultrastar and magic-youtube songs
      if (newSong && (newSong.mode === 'ultrastar' || (newSong as any).mode === 'magic-youtube')) {
        setIsApiLoadedSong(false); // Mark as WebSocket-loaded song
        await loadUltrastarData(newSong);
      } else {
        // Clear ultrastar data for non-ultrastar songs - do this atomically
        stopUltrastarTiming();
        setProgressVisible1(false);
        setProgressValue1(0);
        setProgressVisible2(false);
        setProgressValue2(0);

        // Reset all states atomically to prevent race conditions
        setUltrastarData(null);
        setShowLyrics1(false);
        setShowLyrics2(false);
        setLyricsScaleP1(0);
        setLyricsScaleP2(0);
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
  }, [showAPI, stopUltrastarTiming, stopProgress]);

  useEffect(() => {
    // Initial fetch
    fetchCurrentSong();

    // Connect to WebSocket
    websocketService.connect().then(() => {
      console.log('🔌 Connected to WebSocket for real-time updates');
    }).catch((error) => {
      console.error('🔌 Failed to connect to WebSocket, falling back to polling:', error);

      // Fallback to polling if WebSocket fails
      const interval = setInterval(fetchCurrentSong, 2000);

      return () => {
        clearInterval(interval);
        stopUltrastarTiming();
      };
    });

    // Set up WebSocket event listeners
    websocketService.onShowUpdate(handleWebSocketUpdate);

    // Listen for control events
    const handleTogglePlayPause = () => {
      if (isUltrastar && audioRef.current) {
        if (audioRef.current.paused) {
          audioRef.current.play().catch(error => {
            console.error('🎵 Error resuming playback:', error);
          });
          setIsPlaying(true);
          // Hide QR overlay when playback starts via control event
          showAPI.toggleQRCodeOverlay(false).catch(error => {
            console.error('Error hiding overlay on play:', error);
          });
          // Restart lyrics animation when audio resumes
          setTimeout(() => {
            restartLyricsAnimation();
          }, 100); // Small delay to ensure audio is playing
        } else {
          audioRef.current.pause();
          setIsPlaying(false);
          // Stop lyrics animation when audio is paused
          for (const singer of getSingers(ultrastarData)) {
            if (singer.refs.animationFrameRef.current) {
              cancelAnimationFrame(singer.refs.animationFrameRef.current);
              singer.refs.animationFrameRef.current = null;
            }
          }
        }
      } else if (currentSong?.mode === 'youtube') {
        // YouTube embed - toggle pause state
        setYoutubeIsPaused(!youtubeIsPaused);
        // If we are effectively starting playback (was paused), hide overlay
        if (youtubeIsPaused) {
          showAPI.toggleQRCodeOverlay(false).catch(error => {
            console.error('Error hiding overlay on play:', error);
          });
        }
      } else if (!isUltrastar && videoRef.current) {
        console.log('🎬 Video toggle-play-pause via WebSocket');
        if (videoRef.current.paused) {
          videoRef.current.play().catch(error => {
            console.error('🎬 Error resuming video playback:', error);
          });
          setIsPlaying(true);
          // Hide QR overlay when playback starts via control event
          showAPI.toggleQRCodeOverlay(false).catch(error => {
            console.error('Error hiding overlay on play:', error);
          });
        } else {
          videoRef.current.pause();
          setIsPlaying(false);
        }
      }
    };

    const handleRestartSong = () => {

      // Hide QR overlay when song restarts via control event
      showAPI.toggleQRCodeOverlay(false).catch(error => {
        console.error('Error hiding overlay on restart:', error);
      });

      // Stop background music when song restarts
      stopBackgroundMusic();

      if (isUltrastar && audioRef.current && ultrastarData) {

        // Stop and reset all timing/UI first to ensure clean restart
        stopUltrastarTiming();
        // Clear animation frames
        if (animationFrameRef1.current) {
          cancelAnimationFrame(animationFrameRef1.current);
          animationFrameRef1.current = null;
        }
        if (animationFrameRef2.current) {
          cancelAnimationFrame(animationFrameRef2.current);
          animationFrameRef2.current = null;
        }
        // Reset lyric containers and visibility
        setShowLyrics1(false);
        setShowLyrics2(false);
        setLyricsScaleP1(0);
        setLyricsScaleP2(0);
        setLyricsTransitionEnabledP1(false);
        setLyricsTransitionEnabledP2(false);
        clearAllLyrics();
        // Reset progress bars and internal intervals
        setProgressVisible1(false);
        setProgressValue1(0);
        setProgressVisible2(false);
        setProgressValue2(0);
        if (progressIntervalRef1.current) { clearInterval(progressIntervalRef1.current); progressIntervalRef1.current = null; }
        if (progressIntervalRef2.current) { clearInterval(progressIntervalRef2.current); progressIntervalRef2.current = null; }
        // Reset throttling refs for timing
        lastUpdateTimeP1.current = 0;
        lastUpdateTimeP2.current = 0;
        lastLoggedText.current = '';

        // Restart audio
        audioRef.current.currentTime = 0;
        audioRef.current.play().then(() => {
          console.log('🎵 Audio play() successful');
        }).catch(error => {
          console.error('🎵 Error restarting playback:', error);
        });

        // Also restart video if present
        if (videoRef.current) {
          videoRef.current.currentTime = ultrastarData.videogap || 0;
          videoRef.current.play().then(() => {
            console.log('🎬 Video play() successful');
          }).catch(error => {
            console.error('🎬 Error restarting video playback:', error);
          });
        } else {
          console.log('🎬 No video ref found for Ultrastar song');
        }
        
        for (const timeouts of [p1Timeouts, p2Timeouts]) {
          for (const timeout of timeouts) {
            clearTimeout(timeout);
          }
        }

        setIsPlaying(true);
        setPlaying(true);
        setSongChanged(true);
        
        // Reset timer for restart
        if (currentSong && currentSong.duration_seconds) {
          // Clear existing timer first
          if (songTimerRef.current) {
            clearInterval(songTimerRef.current);
            songTimerRef.current = null;
          }
          setVideoStartTime(Date.now());
          setTimeRemaining(currentSong.duration_seconds);
        }
        
        // Show preview lyrics immediately after reset
        setTimeout(() => {
          if (ultrastarData.isDuet) {
            // Duet case - show lyrics for both singers
            const lines1 = ultrastarData.lines[0] as UltrastarLine[];
            const lines2 = ultrastarData.lines[1] as UltrastarLine[];
            
            if (lines1.length > 0) {
              const firstLine = lines1[0];
              const secondLine = lines1[1];
              const thirdLine = lines1[2];
              updateLyricsDisplay({ currentLyricRef: currentLyricRef1, nextLyricRef: nextLyricRef1, nextNextLyricRef: nextNextLyricRef1 }, firstLine, secondLine, thirdLine, false);
            }
            
            if (lines2.length > 0) {
              const firstLine = lines2[0];
              const secondLine = lines2[1];
              const thirdLine = lines2[2];
              updateLyricsDisplay({ currentLyricRef: currentLyricRef2, nextLyricRef: nextLyricRef2, nextNextLyricRef: nextNextLyricRef2 }, firstLine, secondLine, thirdLine, false);
            }
          } else {
            // Single singer case
            const lines = ultrastarData.lines as UltrastarLine[];
            if (lines.length > 0) {
              const firstLine = lines[0];
              const secondLine = lines[1];
              const thirdLine = lines[2];
              updateLyricsDisplay({ currentLyricRef: currentLyricRef1, nextLyricRef: nextLyricRef1, nextNextLyricRef: nextNextLyricRef1 }, firstLine, secondLine, thirdLine, false);
            }
          }
        }, 50); // Small delay to ensure DOM is ready
        
        // Restart Ultrastar timing with fresh fade-out analysis
        setTimeout(() => {
          const fadeOutIndices = analyzeFadeOutLines(ultrastarData);
          startUltrastarTiming(ultrastarData, fadeOutIndices);
        }, 100); // Small delay to ensure audio is playing
      } else if (currentSong?.mode === 'youtube') {
        // YouTube embed - restart by reloading iframe
        setYoutubeCurrentTime(0);
        setIframeKey(prev => prev + 1);
        setYoutubeIsPaused(false);
      } else if (currentSong?.mode !== 'ultrastar' && videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().then(() => {
          console.log('🎬 Video play() successful');
        }).catch(error => {
          console.error('🎬 Error restarting video playback:', error);
        });
        setIsPlaying(true);
        
        // Reset timer for restart
        if (currentSong && currentSong.duration_seconds) {
          // Clear existing timer first
          if (songTimerRef.current) {
            clearInterval(songTimerRef.current);
            songTimerRef.current = null;
          }
          setVideoStartTime(Date.now());
          setTimeRemaining(currentSong.duration_seconds);
        }
      } else if (currentSong?.mode === 'server_video' || currentSong?.mode === 'file' || currentSong?.mode === 'youtube_cache') {
        if (videoRef.current) {
          console.log('🎬 Video currentTime before:', videoRef.current.currentTime);
          videoRef.current.currentTime = 0;
          console.log('🎬 Video currentTime after:', videoRef.current.currentTime);
          videoRef.current.play().catch(error => {
            console.error('🎬 Error restarting video playback:', error);
          });
          setIsPlaying(true);
          console.log('🎬 Video play() called, isPlaying set to true');
          
          // Reset timer for restart
          if (currentSong && currentSong.duration_seconds) {
            // Clear existing timer first
            if (songTimerRef.current) {
              clearInterval(songTimerRef.current);
              songTimerRef.current = null;
            }
            setVideoStartTime(Date.now());
            setTimeRemaining(currentSong.duration_seconds);
          }
        } else {
          console.log('❌ Video ref is null for server/file/youtube-cache video');
        }
      }
    };

    // Add event listeners
    websocketService.on('toggle-play-pause', handleTogglePlayPause);
    websocketService.on('restart-song', handleRestartSong);
    
    // Listen for background music settings updates
    const handleBackgroundMusicSettingsUpdate = (data: {
      enabled: boolean;
      volume: number;
      selectedSongs: string[];
    }) => {
      console.log('🎵 Background music settings updated:', data);
      setBackgroundMusicSettings(data);
      
      // Update current background music volume if playing
      if (backgroundMusicRef.current && isBackgroundMusicPlaying) {
        backgroundMusicRef.current.volume = data.volume;
      }
      
      // Stop background music if disabled
      if (!data.enabled && isBackgroundMusicPlaying) {
        stopBackgroundMusic();
      }
    };
    
    websocketService.on('background-music-settings-updated', handleBackgroundMusicSettingsUpdate);

    return () => {
      websocketService.offShowUpdate(handleWebSocketUpdate);
      websocketService.off('toggle-play-pause', handleTogglePlayPause);
      websocketService.off('restart-song', handleRestartSong);
      websocketService.off('background-music-settings-updated', handleBackgroundMusicSettingsUpdate);
      websocketService.disconnect();
      stopUltrastarTiming(); // Cleanup ultrastar timing
    };
  }, [handleWebSocketUpdate, currentSong, ultrastarData, startUltrastarTiming, youtubeIsPaused]);

  // Timer effect
  useEffect(() => {
    if (!videoStartTime || !timeRemaining) return;

    // Clear any existing timer
    if (songTimerRef.current) {
      clearInterval(songTimerRef.current);
      songTimerRef.current = null;
    }

    songTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - videoStartTime) / 1000);
      const remaining = Math.max(0, timeRemaining - elapsed);

      setTimeRemaining(remaining);

      // Video ended - show transition
      if (remaining <= 0) {
        setVideoStartTime(null);
        setTimeRemaining(null);
        if (songTimerRef.current) {
          clearInterval(songTimerRef.current);
          songTimerRef.current = null;
        }
      }
    }, 1000);

    return () => {
      if (songTimerRef.current) {
        clearInterval(songTimerRef.current);
        songTimerRef.current = null;
      }
    };
  }, [videoStartTime, timeRemaining, currentSong?.duration_seconds]);


  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Function to get YouTube embed URL
  const getYouTubeEmbedUrl = (url: string): string => {
    const videoIdMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    if (videoIdMatch) {
      const videoId = videoIdMatch[1];
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1&start=${youtubeCurrentTime}`;
    }
    return url;
  };

  // Central cache function: finds the correct cache file path or returns null for cache miss
  const findCacheFile = async (artist: string, title: string, videoId: string): Promise<string | null> => {
    // Use boil down normalization for better matching
    const boiledArtist = boilDown(artist);
    const boiledTitle = boilDown(title);

    // Try both cache structures:
    // #1: "youtube/[artist] - [title]/[videoId].mp4"
    const artistTitlePath = `${artist} - ${title}`;
    const artistTitleUrl = `http://localhost:5000/api/youtube-videos/${encodeURIComponent(artistTitlePath)}/${videoId}.mp4`;

    // #2: "youtube/[videoId]/[videoId].mp4" (fallback)
    const videoIdUrl = `http://localhost:5000/api/youtube-videos/${videoId}/${videoId}.mp4`;

    try {
      // Try artist-title structure first
      const response1 = await fetch(artistTitleUrl, { method: 'HEAD' });
      if (response1.ok) {
        console.log('🎬 Cache hit: Artist-Title structure', artistTitleUrl);
        return artistTitleUrl;
      }
    } catch (error) {
      console.log('🎬 Cache miss: Artist-Title structure', artistTitleUrl);
    }

    try {
      // Try YouTube-ID structure as fallback
      const response2 = await fetch(videoIdUrl, { method: 'HEAD' });
      if (response2.ok) {
        console.log('🎬 Cache hit: YouTube-ID structure', videoIdUrl);
        return videoIdUrl;
      }
    } catch (error) {
      console.log('🎬 Cache miss: YouTube-ID structure', videoIdUrl);
    }

    // No cache found
    console.log('🎬 Cache miss: No file found for', { artist: artist, title: title, boiledArtist: boiledArtist, boiledTitle: boiledTitle, videoId });
    return null;
  };

  const isUltrastar = currentSong?.mode === 'ultrastar' || currentSong?.mode === 'magic-youtube';

  // Background Music Functions
  const loadBackgroundMusicSettings = useCallback(async () => {
    try {
      const [songsResponse, settingsResponse] = await Promise.all([
        adminAPI.getBackgroundMusicSongs(),
        adminAPI.getBackgroundMusicSettings()
      ]);
      
      setBackgroundMusicSongs(songsResponse.data.songs);
      setBackgroundMusicSettings(settingsResponse.data.settings);
    } catch (error) {
      console.error('Error loading background music settings:', error);
    }
  }, []);

  const getRandomBackgroundSong = useCallback(() => {
    if (!backgroundMusicSettings.enabled || backgroundMusicSongs.length === 0) {
      return null;
    }

    let availableSongs = backgroundMusicSongs;
    
    // If specific songs are selected, use only those
    if (backgroundMusicSettings.selectedSongs.length > 0) {
      availableSongs = backgroundMusicSongs.filter(song => 
        backgroundMusicSettings.selectedSongs.includes(song.filename)
      );
    }

    if (availableSongs.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * availableSongs.length);
    return availableSongs[randomIndex];
  }, [backgroundMusicSettings, backgroundMusicSongs]);

  const playBackgroundMusic = useCallback(() => {
    if (!backgroundMusicSettings.enabled || isBackgroundMusicPlaying) {
      return;
    }

    const randomSong = getRandomBackgroundSong();
    if (!randomSong || !backgroundMusicRef.current) {
      return;
    }

    backgroundMusicRef.current.src = randomSong.url;
    backgroundMusicRef.current.volume = backgroundMusicSettings.volume;
    backgroundMusicRef.current.loop = true;
    
    backgroundMusicRef.current.play().then(() => {
      setIsBackgroundMusicPlaying(true);
      console.log('🎵 Background music started:', randomSong.name);
    }).catch(error => {
      console.error('Error playing background music:', error);
    });
  }, [backgroundMusicSettings, isBackgroundMusicPlaying, getRandomBackgroundSong]);

  const stopBackgroundMusic = useCallback(() => {
    if (!backgroundMusicRef.current || !isBackgroundMusicPlaying) {
      return;
    }

    // Fade out background music
    const fadeOut = () => {
      if (!backgroundMusicRef.current) return;
      
      const currentVolume = backgroundMusicRef.current.volume;
      const fadeStep = currentVolume / 20; // 20 steps for smooth fade
      
      if (currentVolume > 0) {
        backgroundMusicRef.current.volume = Math.max(0, currentVolume - fadeStep);
        setTimeout(fadeOut, 50);
      } else {
        backgroundMusicRef.current.pause();
        backgroundMusicRef.current.currentTime = 0;
        backgroundMusicRef.current.volume = backgroundMusicSettings.volume; // Reset volume
        setIsBackgroundMusicPlaying(false);
        console.log('🎵 Background music stopped');
      }
    };
    
    fadeOut();
  }, [isBackgroundMusicPlaying, backgroundMusicSettings.volume]);

  useEffect(() => {
    globalUltrastarData = ultrastarData;
  }, [ultrastarData]);

  // Load background music settings on component mount
  useEffect(() => {
    loadBackgroundMusicSettings();
  }, [loadBackgroundMusicSettings]);

  const handleAudioLoadedData = useCallback(() => {
    setAudioLoaded(true);
  }, [ultrastarData, currentSong?.id, currentSong?.title]);

  const handleAudioCanPlay = useCallback(() => {
    setAudioLoaded(true);

    // Start timing only when audio is ready to prevent race conditions
    // But don't start timing immediately - wait for audio to actually start playing
    if (ultrastarData && ultrastarData.audioUrl && ultrastarData.bpm > 0) {
      if (isApiLoadedSong) {
        const fadeOutIndices = analyzeFadeOutLines(ultrastarData);
        startUltrastarTiming(ultrastarData, fadeOutIndices);
      }
    }
  }, [currentSong?.id, currentSong?.title, ultrastarData, startUltrastarTiming, isApiLoadedSong, analyzeFadeOutLines]);

  const [songChanged, setSongChanged] = useState(true);

  useEffect(() => {
    setSongChanged(true);
  }, [ultrastarData?.gap]);

  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!songChanged || !playing || typeof ultrastarData?.gap === 'undefined') return;

    const singers = getSingers(ultrastarData);
    const beatDuration = (60000 / ultrastarData.bpm) / 4;
    const fadeInDuration = 1000 * FADE_IN_DURATION_SECONDS;

    for (const singer of singers) {
      for (const timeout of singer.timeouts) {
        clearTimeout(timeout);
      }
      singer.timeouts = [];
      const lines = singer.lines as UltrastarLine[];
      const firstLine = lines[0];
      const firstLineStartTime = ultrastarData.gap + (firstLine.startBeat * beatDuration);
      const showTime = Math.max(0, firstLineStartTime - 1000 * FADE_IN_ATTACK_SECONDS);
      const timeUntilFirstLine = firstLineStartTime;
      const secondsUntilFirstLine = timeUntilFirstLine / 1000;
      if (showTime <= fadeInDuration) {
        singer.setLyricsTransitionEnabled(false);
        singer.setLyricsScale(1);
        singer.setShowLyrics(true);
      } else {
        singer.setLyricsTransitionEnabled(true);
        singer.timeouts = [];
        singer.timeouts.push(setTimeout(() => {
          singer.setLyricsScale(1);
          singer.setShowLyrics(true);
          singer.timeouts.push(setTimeout(() => {
            startProgress(secondsUntilFirstLine, singer);
          }, (FADE_IN_ATTACK_SECONDS - COUNTDOWN_SECONDS) * 1000));
        }, showTime));
      }
    }
    setSongChanged(false);
  }, [ultrastarData?.gap, songChanged, playing]);

  const handleAudioPlay = useCallback(async () => {
    setShowLyrics1(false);
    setShowLyrics2(false);
    setPlaying(true);
    setIsPlaying(true);

    // Stop background music when song starts
    stopBackgroundMusic();

    // Start Ultrastar timing now that audio is actually playing
    if (ultrastarData && ultrastarData.audioUrl && ultrastarData.bpm > 0) {
      const fadeOutIndices = analyzeFadeOutLines(ultrastarData);
      startUltrastarTiming(ultrastarData, fadeOutIndices);
    }

    // Sync video with audio
    if (videoRef.current && ultrastarData?.videoUrl) {
      videoRef.current.muted = true;
      videoRef.current.currentTime = ultrastarData.videogap;
      videoRef.current.play().catch(console.error);
    }
  }, [ultrastarData, ultrastarData?.gap, currentSong?.id, currentSong?.title, setShowLyrics1, setShowLyrics2, startUltrastarTiming, analyzeFadeOutLines, stopBackgroundMusic]);

  const handleAudioPause = useCallback(() => {
    setPlaying(false);
    setIsPlaying(false);

    // Pause video when audio is paused
    if (videoRef.current && ultrastarData?.videoUrl) {
      videoRef.current.pause();
    }
  }, [ultrastarData, currentSong?.id, currentSong?.title]);

  const handleAudioEnded = useCallback(async () => {
    // Stop video when audio ends
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }

    stopUltrastarTiming();

    // Check if this was a test song and restore original song
    try {
      const { adminAPI } = await import('../../services/api');
      await adminAPI.restoreOriginalSong();
      console.log('🎤 Test song ended - original song restored');
    } catch (error) {
      console.error('Error restoring original song:', error);
    }

    // Start background music when song ends
    setTimeout(() => {
      playBackgroundMusic();
    }, 1000); // Small delay to ensure smooth transition

    // Automatically show QR overlay when audio ends
    showAPI.toggleQRCodeOverlay(true).catch(error => {
      console.error('Error showing overlay:', error);
    });
  }, [currentSong?.id, currentSong?.title, stopUltrastarTiming, playBackgroundMusic]);

  // Handle click on screen to toggle play/pause
  // const handleScreenClick = useCallback(() => {
  //   // Mark that user has interacted (allows autoplay for future songs)
  //   setHasUserInteracted(true);

  //   if (isUltrastar && audioRef.current) {
  //     if (audioRef.current.paused) {
  //       audioRef.current.play().catch(error => {
  //         console.error('🎵 Error resuming playback:', error);
  //       });
  //       setIsPlaying(true);
  //       // Restart lyrics animation when audio resumes
  //       setTimeout(() => {
  //         restartLyricsAnimation();
  //       }, 100); // Small delay to ensure audio is playing
  //     } else {
  //       audioRef.current.pause();
  //       setIsPlaying(false);
  //       // Stop lyrics animation when audio is paused
  //       for (const singer of getSingers(ultrastarData)) {
  //         if (singer.refs.animationFrameRef.current) {
  //           cancelAnimationFrame(singer.refs.animationFrameRef.current);
  //           singer.refs.animationFrameRef.current = null;
  //         }
  //       }
  //     }
  //   } else if (currentSong?.mode === 'youtube') {
  //     // YouTube embed - toggle pause state
  //     setYoutubeIsPaused(!youtubeIsPaused);
  //   } else if (!isUltrastar && videoRef.current) {
  //     if (videoRef.current.paused) {
  //       videoRef.current.play().catch(error => {
  //         console.error('🎬 Error resuming video playback:', error);
  //       });
  //       setIsPlaying(true);
  //     } else {
  //       videoRef.current.pause();
  //       setIsPlaying(false);
  //     }
  //   }
  // }, [isUltrastar, currentSong?.id, currentSong?.title, currentSong?.mode, youtubeIsPaused, restartLyricsAnimation]);

  const handleStartButtonClick = useCallback(async () => {
    // Mark that user has interacted (allows autoplay for future songs)
    setHasUserInteracted(true);

    // Hide the start overlay
    setShowStartOverlay(false);

    // Send restart action to admin dashboard
    websocketService.emit('show-action', {
      action: 'restart-song',
      timestamp: new Date().toISOString(),
      currentSong: currentSong ? {
        id: currentSong.id,
        artist: currentSong.artist,
        title: currentSong.title,
        mode: currentSong.mode
      } : null
    });

    try {
      const { playlistAPI } = await import('../../services/api');
      await playlistAPI.restartSong();

      // Check if we're in pause mode
      if (CURRENT_START_MODE === START_BUTTON_MODE.PAUSE) {
        console.log('🎤 Pause mode: Song restarted, now pausing and showing QR overlay');
        
        // Wait a moment for the song to load, then pause
        setTimeout(async () => {
          try {
            // Pause the song
            await playlistAPI.togglePlayPause();
            
            // Show QR code overlay
            console.log('🎤 Pause mode: Calling showAPI.toggleQRCodeOverlay(true)');
            await showAPI.toggleQRCodeOverlay(true);
            
            console.log('🎤 Pause mode: Song paused and QR overlay shown');
          } catch (error) {
            console.error('Error in pause mode:', error);
          }
        }, 1000); // Wait 1 second for song to load
      }
    } catch (error) {
      console.error('Error restarting song:', error);
    }
  }, [currentSong]);

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

  // Reset YouTube embed state when song changes
  useEffect(() => {
    if (currentSong?.mode === 'youtube') {
      setYoutubeCurrentTime(0);
      setYoutubeIsPaused(false);
      setIframeKey(prev => prev + 1);
      console.log('🔄 Reset YouTube embed state for new song');
    }
  }, [currentSong?.id]);

  // Check if both audio and video/background are ready for autoplay
  const checkMediaReady = useCallback(() => {
    if (isUltrastar && ultrastarData) {
      const audioReady = audioLoaded;
      const videoReady = ultrastarData.videoUrl ? videoLoaded : true; // No video = ready
      const backgroundReady = ultrastarData.backgroundImageUrl ? true : true; // Images load instantly

      if (audioReady && videoReady && backgroundReady && !canAutoPlay) {
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
    if (canAutoPlay && hasUserInteracted && audioRef.current && audioRef.current.paused) {
      // Add a small delay to ensure all DOM updates are complete
      const playTimeout = setTimeout(() => {
        if (audioRef.current && audioRef.current.paused) {
          audioRef.current.play().catch(error => {
            console.error('🎵 Autoplay failed:', error);
          });
        }
      }, 100); // 100ms delay to prevent race conditions

      return () => clearTimeout(playTimeout);
    }
  }, [canAutoPlay, hasUserInteracted, currentSong?.id, currentSong?.title, audioLoaded, videoLoaded, ultrastarData?.videoUrl]);

  // Reset loading states when song changes
  useEffect(() => {
    if (currentSong?.id !== lastSongId) {
      // Stop all timing and progress first
      stopUltrastarTiming();
      
      // Clear all animation frames
      if (animationFrameRef1.current) {
        cancelAnimationFrame(animationFrameRef1.current);
        animationFrameRef1.current = null;
      }
      if (animationFrameRef2.current) {
        cancelAnimationFrame(animationFrameRef2.current);
        animationFrameRef2.current = null;
      }
      
      // Clear all progress intervals
      if (progressIntervalRef1.current) {
        clearInterval(progressIntervalRef1.current);
        progressIntervalRef1.current = null;
      }
      if (progressIntervalRef2.current) {
        clearInterval(progressIntervalRef2.current);
        progressIntervalRef2.current = null;
      }

      // Reset all states atomically to prevent race conditions
      setProgressVisible1(false);
      setProgressValue1(0);
      setProgressVisible2(false);
      setProgressValue2(0);
      setAudioLoaded(false);
      setVideoLoaded(false);
      setCanAutoPlay(false);
      setShowLyrics1(false);
      setShowLyrics2(false);
      setLyricsScaleP1(0);
      setLyricsScaleP2(0);
      setLyricsTransitionEnabledP1(false);
      setLyricsTransitionEnabledP2(false);
      setIsPlaying(false);
      setIsApiLoadedSong(false); // Reset API-loaded flag
      
      // Clear lyrics content
      if (currentLyricRef1.current) currentLyricRef1.current.textContent = '';
      if (nextLyricRef1.current) nextLyricRef1.current.textContent = '';
      if (nextNextLyricRef1.current) nextNextLyricRef1.current.textContent = '';
      if (currentLyricRef2.current) currentLyricRef2.current.textContent = '';
      if (nextLyricRef2.current) nextLyricRef2.current.textContent = '';
      if (nextNextLyricRef2.current) nextNextLyricRef2.current.textContent = '';
    }
  }, [currentSong?.id, lastSongId, stopUltrastarTiming]);

  // Keep lastSongIdRef in sync with lastSongId state
  useEffect(() => {
    lastSongIdRef.current = lastSongId;
  }, [lastSongId]);

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

  // Handle window resize for responsive font sizes and ref cleanup
  useEffect(() => {
    const handleResize = () => {
      // Force re-render to update font sizes
      setCurrentSong(prev => prev ? { ...prev } : null);
      
      // Restart ultrastar timing if currently playing to refresh refs
      if (ultrastarData && audioRef.current && !audioRef.current.paused && isPlaying) {
        console.log('🔄 Resize detected - restarting ultrastar timing to refresh refs');
        
        // Stop current timing
        stopUltrastarTiming();
        
        // Restart timing with fresh refs after a short delay
        setTimeout(() => {
          if (ultrastarData && audioRef.current && !audioRef.current.paused) {
            const fadeOutIndices = analyzeFadeOutLines(ultrastarData);
            startUltrastarTiming(ultrastarData, fadeOutIndices);
          }
        }, 100);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [ultrastarData, isPlaying, stopUltrastarTiming, startUltrastarTiming, analyzeFadeOutLines]);

  return (
    <ShowContainer
      // onClick={handleScreenClick}
      onMouseMove={handleMouseMove}
      $cursorVisible={cursorVisible}
    >
      {/* Control Buttons - only show when not in fullscreen */}
      <ControlButtons 
        currentSong={currentSong}
        isPlaying={isPlaying}
        setHasUserInteracted={setHasUserInteracted}
        audioRef={audioRef}
        videoRef={videoRef}
        ultrastarData={ultrastarData}
        startUltrastarTiming={startUltrastarTiming}
        setYoutubeCurrentTime={setYoutubeCurrentTime}
        setIframeKey={setIframeKey}
        setYoutubeIsPaused={setYoutubeIsPaused}
        setIsPlaying={setIsPlaying}
      />
      {/* Fullscreen Video */}
      {(currentSong?.youtube_url && !isUltrastar) || isUltrastar ? (
        <VideoWrapper>
          {!isUltrastar ? (
            currentSong?.mode === 'youtube' ? (
              <VideoIframe
                key={iframeKey}
                src={getYouTubeEmbedUrl(currentSong.youtube_url)}
                title={`${currentSong.artist} - ${currentSong.title}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <VideoElement
                key={currentSong?.id} // Force re-render only when song changes
                ref={videoRef}
                src={currentSong.youtube_url}
                controls
                autoPlay={hasUserInteracted}
                onLoadStart={() => {
                  console.log(`🎬 Video started:`, {
                    songId: currentSong?.id,
                    title: currentSong?.title,
                    url: currentSong?.youtube_url,
                    mode: currentSong?.mode,
                    isUltrastar,
                    currentSongObject: currentSong
                  });
                  // Set playing state to true when video starts loading (autoplay) - only if user has interacted
                  if (hasUserInteracted) {
                    setIsPlaying(true);
                  }
                }}
                onPlay={() => {
                  setIsPlaying(true);
                  console.log('🎬 Video started playing');
                  // Stop background music when video starts
                  stopBackgroundMusic();
                }}
                onPause={() => {
                  setIsPlaying(false);
                  console.log('🎬 Video paused');
                }}
                onEnded={async () => {
                  console.log(`🎬 Video ended:`, {
                    songId: currentSong?.id,
                    title: currentSong?.title,
                    mode: currentSong?.mode
                  });

                  setIsPlaying(false);

                  // Check if this was a test song and restore original song
                  try {
                    const { adminAPI } = await import('../../services/api');
                    await adminAPI.restoreOriginalSong();
                    console.log('🎤 Test song ended - original song restored');
                  } catch (error) {
                    console.error('Error restoring original song:', error);
                  }

                  // Start background music when video ends
                  setTimeout(() => {
                    playBackgroundMusic();
                  }, 1000); // Small delay to ensure smooth transition

                  // Automatically show QR code overlay when video ends
                  showAPI.toggleQRCodeOverlay(true).catch(error => {
                    console.error('Error showing overlay:', error);
                  });
                }}
              />
            )
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
                autoPlay={canAutoPlay && hasUserInteracted}
                onClick={(e) => e.stopPropagation()}
                style={{ display: 'none' }}
                onLoadedData={handleAudioLoadedData}
                onCanPlay={handleAudioCanPlay}
                onPlay={handleAudioPlay}
                onPause={handleAudioPause}
                onEnded={handleAudioEnded}
              />
              <div style={lyricsDisplayStyle1} onClick={(e) => e.stopPropagation()}>
                <div ref={currentLyricRef1} style={currentLyricStyle}></div>
                <div ref={nextLyricRef1} style={previewLyricStyle}></div>
                <div ref={nextNextLyricRef1} style={previewLyricStyle}></div>

              </div>

              {isDuet && <div style={lyricsDisplayStyle2} onClick={(e) => e.stopPropagation()}>
                <div ref={currentLyricRef2} style={currentLyricStyle}></div>
                <div ref={nextLyricRef2} style={previewLyricStyle}></div>
                <div ref={nextNextLyricRef2} style={previewLyricStyle}></div>
              </div>}
            </>
          ) : (
            <NoVideoMessage>
              {currentSong ? `🎵 ${t('showView.noVideoAvailable')}` : `🎤 ${t('showView.noSongSelected')}`}
            </NoVideoMessage>
          )}
        </VideoWrapper>
      ) : (
        <VideoWrapper>
          <NoVideoMessage>
            {currentSong ? `🎵 ${t('showView.noYoutubeLinkAvailable')}` : `🎤 ${t('showView.noSongSelected')}`}
          </NoVideoMessage>
        </VideoWrapper>
      )}

      {/* Header Overlay */}
      <Header
        currentSong={currentSong}
        timeRemaining={timeRemaining}
      />

      {/* Footer Overlay */}
      <Footer
        nextSongs={nextSongs}
      />

      {/* Progress Bar Overlay */}
      <ProgressOverlay $isVisible={progressVisible1} $isUltrastar={isUltrastar} $isSecond={false} $isDuet={isDuet}>
        <ProgressBarContainer $isUltrastar={isUltrastar} $isSecond={false}>
          <ProgressBarFill $progress={progressValue1} $isSecond={false} />
        </ProgressBarContainer>
      </ProgressOverlay>
      {isDuet && (
        <ProgressOverlay $isVisible={progressVisible2} $isUltrastar={isUltrastar} $isSecond={true} $isDuet={isDuet}>
          <ProgressBarContainer $isUltrastar={isUltrastar} $isSecond={true}>
            <ProgressBarFill $progress={progressValue2} $isSecond={true} />
          </ProgressBarContainer>
        </ProgressOverlay>
      )}

      {/* Controlled QR Code Overlay */}
      <Overlay
        show={showQRCodeOverlay}
        overlayTitle={overlayTitle}
        currentSong={currentSong}
        nextSongs={nextSongs}
        qrCodeUrl={qrCodeUrl}
      />

      {/* Start Overlay */}
      <StartOverlay
        show={showStartOverlay}
        onStartClick={handleStartButtonClick}
      />

      {/* Permanent QR Code Corner */}
      <QRCodeCorner qrCodeUrl={qrCodeUrl} />
      <AdCorner />
      
      {/* Background Music Audio Element */}
      <AudioElement
        ref={backgroundMusicRef}
        style={{ display: 'none' }}
        preload="auto"
      />
    </ShowContainer>
  );
};

export default ShowView;
