import React, { useState, useEffect, useRef, useCallback } from 'react';
import { showAPI, songAPI } from '../../services/api';
import websocketService, { ShowUpdateData } from '../../services/websocket';
import { boilDown } from '../../utils/boilDown';
import { useTranslation } from 'react-i18next';
import { 
  CurrentSong, 
  ShowData, 
  Song, 
  UltrastarNote, 
  UltrastarLine,
  UltrastarSongData 
} from './types';
import { 
  UNSUNG_COLOR, 
  CURRENT_LINE_OPACITY,
   NEXT_LINE_OPACITY, 
   NEXT_NEXT_LINE_OPACITY, 
   LYRICS_FADE_DURATION,
   COUNTDOWN_SECONDS,
   UPDATE_THROTTLE_MS,
   HIGHLIGHT_COLOR,
   FADE_OUT_THRESHOLD_MS,
   FADE_IN_THRESHOLD_MS,
   FADE_IN_DURATION_SECONDS,
   FADE_IN_ATTACK_SECONDS
  } from './constants';
import { 
  ShowContainer, 
  VideoWrapper, 
  VideoIframe, 
  VideoElement, 
  BackgroundVideo,
  BackgroundImage, 
  AudioElement,
  ProgressOverlay, 
  ProgressBarContainer, 
  ProgressBarFill, 
  NoVideoMessage, 
} from './style';
import Overlay from './Overlay';
import Footer from './Footer';
import Header from './Header';
import ControlButtons from './ControlButtons';

let globalUltrastarData: UltrastarSongData | null = null;

const ShowView: React.FC = () => {
  const { t } = useTranslation();
  const [currentSong, setCurrentSong] = useState<CurrentSong | null>(null);
  const [nextSongs, setNextSongs] = useState<Song[]>([]);
  // const [loading, setLoading] = useState(true);
  // const [error, setError] = useState<string | null>(null);
  const [lastSongId, setLastSongId] = useState<number | null>(null);
  const lastSongIdRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  // const [showTransition, setShowTransition] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [videoStartTime, setVideoStartTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [showQRCodeOverlay, setShowQRCodeOverlay] = useState(false);
  const [overlayTitle, setOverlayTitle] = useState('Willkommen beim Karaoke');
  
  // YouTube embed state (only for cache miss fallback)
  const [iframeKey, setIframeKey] = useState(0);
  const [youtubeCurrentTime, setYoutubeCurrentTime] = useState(0);
  const [youtubeIsPaused, setYoutubeIsPaused] = useState(false);
  
  // Cursor visibility state
  const [cursorVisible, setCursorVisible] = useState(true);
  const cursorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Ultrastar-specific state
  const [ultrastarData, setUltrastarData] = useState<UltrastarSongData | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const currentLyricRef = useRef<HTMLDivElement | null>(null);
  const nextLyricRef = useRef<HTMLDivElement | null>(null);
  const nextNextLyricRef = useRef<HTMLDivElement | null>(null);
  const lastLoggedText = useRef<string>('');
  const lastUpdateTime = useRef<number>(0);

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
  const getLineText = useCallback((line: any) => {
    return line.notes.map((note: any) => note.text).join('');
  }, []);


  const setLyricContent = (ref: React.RefObject<HTMLDivElement>, line: any, color: string, opacity: number) => {
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
      if (currentLyricRef.current) currentLyricRef.current.textContent = '';
      if (nextLyricRef.current) nextLyricRef.current.textContent = '';
      if (nextNextLyricRef.current) nextNextLyricRef.current.textContent = '';
    });
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

  // Function to restart lyrics animation when audio resumes
  const restartLyricsAnimation = useCallback(() => {
    if (ultrastarData && audioRef.current && !audioRef.current.paused) {
      console.log('🎵 Restarting lyrics animation');
      // Clear existing animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Restart the animation loop
      animationFrameRef.current = requestAnimationFrame(() => {
        // This will restart the animation loop
        if (ultrastarData && audioRef.current && !audioRef.current.paused) {
          // Recalculate timing and restart the loop
          const beatDuration = (60 / ultrastarData.bpm) * 1000; // Convert to milliseconds
          const updateLyrics = () => {
            if (!audioRef.current || audioRef.current.paused) return;
            
            const now = Date.now();
            const timeSinceLastUpdate = now - lastUpdateTime.current;
            
            if (timeSinceLastUpdate < UPDATE_THROTTLE_MS) {
              animationFrameRef.current = requestAnimationFrame(updateLyrics);
              return;
            }
            
            lastUpdateTime.current = now;
            const currentTime = audioRef.current.currentTime * 1000;
            const songTime = currentTime - ultrastarData.gap;
            
            if (songTime < 0) {
              animationFrameRef.current = requestAnimationFrame(updateLyrics);
              return;
            }
            
            const currentBeat = songTime / beatDuration;
            const currentLineIndex = ultrastarData.lines.findIndex((line: UltrastarLine) => 
              currentBeat >= line.startBeat && currentBeat < line.endBeat
            );
            
            if (currentLineIndex >= 0) {
              const currentLine = ultrastarData.lines[currentLineIndex];
              const nextLine = ultrastarData.lines[currentLineIndex + 1];
              const nextNextLine = ultrastarData.lines[currentLineIndex + 2];
              updateLyricsDisplay(currentLine, nextLine, nextNextLine, false);
            }
            
            animationFrameRef.current = requestAnimationFrame(updateLyrics);
          };
          
          animationFrameRef.current = requestAnimationFrame(updateLyrics);
        }
      });
    }
  }, [ultrastarData]);

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
      
      // Note: We don't check for paused here to allow initial animation start
      // Pause handling is done in the event handlers instead
      
      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateTime.current;
      
      // Throttle updates to prevent race conditions
      if (timeSinceLastUpdate < UPDATE_THROTTLE_MS) {
        animationFrameRef.current = requestAnimationFrame(updateLyrics);
        return;
      }
      
      lastUpdateTime.current = now;
      
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
        
        // Update current line with highlighted syllable - use requestAnimationFrame for safe DOM updates
        const currentLyricElement = currentLyricRef.current;
        if (currentLyricElement) {
          // Use requestAnimationFrame to ensure DOM updates happen safely
          requestAnimationFrame(() => {
            // Double-check ref is still valid after requestAnimationFrame
            if (!currentLyricRef.current) return;
            
            if (currentSyllable && currentSyllable.text.trim()) {
              // Clear and rebuild the line with proper spacing
              currentLyricRef.current.innerHTML = '';
              
              currentLine.notes.forEach((note: UltrastarNote, index: number) => {
                const isSung = note.startBeat < currentSyllable.startBeat;
                const isCurrent = note.startBeat === currentSyllable.startBeat;
                
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
                    if (noteSpan.parentNode) {
                      noteSpan.style.transform = 'scale(1.1)';
                    }
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
            } else {
              // No active syllable, but show already sung syllables in highlight color
              currentLyricRef.current.innerHTML = '';
              
              currentLine.notes.forEach((note: UltrastarNote, index: number) => {
                const isSung = note.startBeat < currentBeat;
                
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
          });
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
          
          const currentLyricElement = currentLyricRef.current;
          if (currentLyricElement) {
            requestAnimationFrame(() => {
              if (currentLyricRef.current) {
                currentLyricRef.current.innerHTML = '';
                currentLyricRef.current.style.color = HIGHLIGHT_COLOR;
                currentLyricRef.current.style.fontWeight = 'bold';
                currentLyricRef.current.style.opacity = '1';
                currentLyricRef.current.textContent = getLineText(lastLine);
              }
            });
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
      // setCurrentNoteIndex(0);
      
      // Reset all states atomically to prevent race conditions
      setShowLyrics(false);
      setLyricsScale(0);
      setIsFadeOutMode(false);
      setFadeOutLineIndex(null);
      setFadeOutLineIndices(new Set());
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
      
      // Don't start timing immediately - wait for audio to be ready
      // Timing will be started in handleAudioCanPlay when audio is fully loaded
      
    } catch (error) {
      console.error('Error loading Ultrastar data:', error);
    }
  }, [stopProgress]);

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
        
        
        // Load Ultrastar data if it's an ultrastar song
        if (newSong && newSong.mode === 'ultrastar') {
          await loadUltrastarData(newSong);
        } else {
          // Clear ultrastar data for non-ultrastar songs - do this atomically
          stopUltrastarTiming();
          stopProgress();
          
          // Reset all states atomically to prevent race conditions
          setUltrastarData(null);
          setShowLyrics(false);
          setLyricsScale(0);
          setIsFadeOutMode(false);
          setFadeOutLineIndex(null);
          setFadeOutLineIndices(new Set());
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
      // setError(t('showView.errorLoadingCurrentSong'));
      setCurrentSong(null);
      setNextSongs([]);
      // setLoading(false);
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
            
            console.log('🔌 Cache hit - using file:', {
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
      
      // Load Ultrastar data if it's an ultrastar song
      if (newSong && newSong.mode === 'ultrastar') {
        loadUltrastarData(newSong).catch(error => {
          console.error('Error loading ultrastar data:', error);
        });
      } else {
        // Clear ultrastar data for non-ultrastar songs - do this atomically
        stopUltrastarTiming();
        stopProgress();
        
        // Reset all states atomically to prevent race conditions
        setUltrastarData(null);
        setShowLyrics(false);
        setLyricsScale(0);
        setIsFadeOutMode(false);
        setFadeOutLineIndex(null);
        setFadeOutLineIndices(new Set());
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
      console.log('🔌 WebSocket toggle-play-pause received, currentSong:', currentSong);
      
      if (currentSong?.mode === 'ultrastar' && audioRef.current) {
        console.log('🎤 Ultrastar toggle-play-pause via WebSocket');
        if (audioRef.current.paused) {
          audioRef.current.play().catch(error => {
            console.error('🎵 Error resuming playback:', error);
          });
          setIsPlaying(true);
          // Restart lyrics animation when audio resumes
          setTimeout(() => {
            restartLyricsAnimation();
          }, 100); // Small delay to ensure audio is playing
        } else {
          audioRef.current.pause();
          setIsPlaying(false);
          // Stop lyrics animation when audio is paused
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
        }
      } else if (currentSong?.mode === 'youtube') {
        console.log('📺 YouTube toggle-play-pause via WebSocket');
        // YouTube embed - toggle pause state
        setYoutubeIsPaused(!youtubeIsPaused);
      } else if (currentSong?.mode !== 'ultrastar' && videoRef.current) {
        console.log('🎬 Video toggle-play-pause via WebSocket');
        if (videoRef.current.paused) {
          videoRef.current.play().catch(error => {
            console.error('🎬 Error resuming video playback:', error);
          });
          setIsPlaying(true);
        } else {
          videoRef.current.pause();
          setIsPlaying(false);
        }
      }
    };
    
    const handleRestartSong = () => {
      console.log('🔌 WebSocket restart-song received, currentSong:', currentSong);
      console.log('🔌 Audio ref:', audioRef.current);
      console.log('🔌 Video ref:', videoRef.current);
      console.log('🔌 Ultrastar data:', ultrastarData);
      
      if (currentSong?.mode === 'ultrastar' && audioRef.current && ultrastarData) {
        console.log('🎤 Ultrastar restart-song via WebSocket');
        
        // Restart audio
        console.log('🎵 Audio currentTime before:', audioRef.current.currentTime);
        audioRef.current.currentTime = 0;
        console.log('🎵 Audio currentTime after:', audioRef.current.currentTime);
        audioRef.current.play().then(() => {
          console.log('🎵 Audio play() successful');
        }).catch(error => {
          console.error('🎵 Error restarting playback:', error);
        });
        
        // Also restart video if present
        if (videoRef.current) {
          console.log('🎬 Ultrastar video restart-song via WebSocket');
          console.log('🎬 Video currentTime before:', videoRef.current.currentTime);
          videoRef.current.currentTime = 0;
          console.log('🎬 Video currentTime after:', videoRef.current.currentTime);
          videoRef.current.play().then(() => {
            console.log('🎬 Video play() successful');
          }).catch(error => {
            console.error('🎬 Error restarting video playback:', error);
          });
        } else {
          console.log('🎬 No video ref found for Ultrastar song');
        }
        
        setIsPlaying(true);
        // Restart complete Ultrastar timing and lyrics
        setTimeout(() => {
          console.log('🎤 Restarting complete Ultrastar timing via WebSocket');
          startUltrastarTiming(ultrastarData, new Set());
        }, 100); // Small delay to ensure audio is playing
      } else if (currentSong?.mode === 'youtube') {
        console.log('📺 YouTube restart-song via WebSocket');
        // YouTube embed - restart by reloading iframe
        setYoutubeCurrentTime(0);
        setIframeKey(prev => prev + 1);
        setYoutubeIsPaused(false);
      } else if (currentSong?.mode !== 'ultrastar' && videoRef.current) {
        console.log('🎬 Video restart-song via WebSocket');
        console.log('🎬 Video currentTime before:', videoRef.current.currentTime);
        videoRef.current.currentTime = 0;
        console.log('🎬 Video currentTime after:', videoRef.current.currentTime);
        videoRef.current.play().then(() => {
          console.log('🎬 Video play() successful');
        }).catch(error => {
          console.error('🎬 Error restarting video playback:', error);
        });
        setIsPlaying(true);
        console.log('🎬 Video play() called, isPlaying set to true');
      } else if (currentSong?.mode === 'server_video' || currentSong?.mode === 'file' || currentSong?.mode === 'youtube_cache') {
        console.log('🎬 Server/File/YouTube-Cache video restart-song via WebSocket');
        if (videoRef.current) {
          console.log('🎬 Video currentTime before:', videoRef.current.currentTime);
          videoRef.current.currentTime = 0;
          console.log('🎬 Video currentTime after:', videoRef.current.currentTime);
          videoRef.current.play().catch(error => {
            console.error('🎬 Error restarting video playback:', error);
          });
          setIsPlaying(true);
          console.log('🎬 Video play() called, isPlaying set to true');
        } else {
          console.log('❌ Video ref is null for server/file/youtube-cache video');
        }
      } else {
        console.log('❌ No WebSocket restart logic executed - conditions not met');
        console.log('❌ Mode:', currentSong?.mode);
        console.log('❌ Has audioRef:', !!audioRef.current);
        console.log('❌ Has videoRef:', !!videoRef.current);
        console.log('❌ Has ultrastarData:', !!ultrastarData);
      }
    };
    
    // Add event listeners
    websocketService.on('toggle-play-pause', handleTogglePlayPause);
    websocketService.on('restart-song', handleRestartSong);

    return () => {
      websocketService.offShowUpdate(handleWebSocketUpdate);
      websocketService.off('toggle-play-pause', handleTogglePlayPause);
      websocketService.off('restart-song', handleRestartSong);
      websocketService.disconnect();
      stopUltrastarTiming(); // Cleanup ultrastar timing
    };
  }, [handleWebSocketUpdate, currentSong, ultrastarData, startUltrastarTiming, youtubeIsPaused]);

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
    
    console.log('🔍 Checking cache for:', {
      artist: artist,
      title: title,
      boiledArtist: boiledArtist,
      boiledTitle: boiledTitle,
      videoId: videoId,
      artistTitleUrl: artistTitleUrl,
      videoIdUrl: videoIdUrl
    });
    
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

  const isUltrastar = currentSong?.mode === 'ultrastar';

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
    
    // Start timing only when audio is ready to prevent race conditions
    if (ultrastarData && ultrastarData.audioUrl && ultrastarData.bpm > 0) {
      const fadeOutIndices = analyzeFadeOutLines(ultrastarData);
      startUltrastarTiming(ultrastarData, fadeOutIndices);
    }
  }, [currentSong?.id, currentSong?.title, ultrastarData, startUltrastarTiming]);

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
    setIsPlaying(true);
    
    // Sync video with audio
    if (videoRef.current && ultrastarData?.videoUrl) {
      videoRef.current.muted = true;
      videoRef.current.currentTime = ultrastarData.videogap;
      videoRef.current.play().catch(console.error);
    }
  }, [ultrastarData, ultrastarData?.gap, currentSong?.id, currentSong?.title, setShowLyrics]);

  const handleAudioPause = useCallback(() => {
    setPlaying(false);
    setIsPlaying(false);
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
      const { adminAPI } = await import('../../services/api');
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
    // Mark that user has interacted (allows autoplay for future songs)
    setHasUserInteracted(true);
    
    if (isUltrastar && audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play().catch(error => {
          console.error('🎵 Error resuming playback:', error);
        });
        setIsPlaying(true);
        // Restart lyrics animation when audio resumes
        setTimeout(() => {
          restartLyricsAnimation();
        }, 100); // Small delay to ensure audio is playing
      } else {
        audioRef.current.pause();
        setIsPlaying(false);
        // Stop lyrics animation when audio is paused
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      }
    } else if (currentSong?.mode === 'youtube') {
      // YouTube embed - toggle pause state
      setYoutubeIsPaused(!youtubeIsPaused);
    } else if (!isUltrastar && videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(error => {
          console.error('🎬 Error resuming video playback:', error);
        });
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [isUltrastar, currentSong?.id, currentSong?.title, currentSong?.mode, youtubeIsPaused, restartLyricsAnimation]);

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
    if (canAutoPlay && hasUserInteracted && audioRef.current && audioRef.current.paused) {
      // Add a small delay to ensure all DOM updates are complete
      const playTimeout = setTimeout(() => {
        if (audioRef.current && audioRef.current.paused) {
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
      }, 100); // 100ms delay to prevent race conditions
      
      return () => clearTimeout(playTimeout);
    }
  }, [canAutoPlay, hasUserInteracted, currentSong?.id, currentSong?.title, audioLoaded, videoLoaded, ultrastarData?.videoUrl]);

  // Reset loading states when song changes
  useEffect(() => {
    if (currentSong?.id !== lastSongId) {
      // Stop all timing and progress first
      stopUltrastarTiming();
      stopProgress();
      
      // Reset all states atomically to prevent race conditions
      setAudioLoaded(false);
      setVideoLoaded(false);
      setCanAutoPlay(false);
      setShowLyrics(false);
      setIsFadeOutMode(false);
      setFadeOutLineIndex(null);
      setFadeOutLineIndices(new Set());
      setIsPlaying(false);
    }
  }, [currentSong?.id, lastSongId, stopUltrastarTiming, stopProgress]);

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

  return (
    <ShowContainer 
      onClick={handleScreenClick}
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
      <ProgressOverlay $isVisible={progressVisible} $isUltrastar={isUltrastar}>
        <ProgressBarContainer $isUltrastar={isUltrastar}>
          <ProgressBarFill $progress={progressValue} />
        </ProgressBarContainer>
      </ProgressOverlay>

      {/* QR Code Overlay */}
      <Overlay
        show={showQRCodeOverlay}
        overlayTitle={overlayTitle}
        currentSong={currentSong}
        nextSongs={nextSongs}
        qrCodeUrl={qrCodeUrl}
      />
    </ShowContainer>
  );
};

export default ShowView;
