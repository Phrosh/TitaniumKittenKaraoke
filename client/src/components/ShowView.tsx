import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { showAPI, songAPI } from '../services/api';

interface CurrentSong {
  id: number;
  user_name: string;
  artist: string;
  title: string;
  youtube_url: string;
  mode: 'youtube' | 'server_video' | 'file' | 'ultrastar';
  position: number;
  duration_seconds?: number;
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
  version: string;
  audioUrl?: string;
}

const ShowContainer = styled.div`
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
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
  top: 45%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80%;
  max-width: 600px;
  height: 60px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 10px;
  padding: 10px;
  z-index: 10;
`;

const LyricsDisplay = styled.div<{ $visible: boolean }>`
  position: absolute;
  top: 55%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80%;
  max-width: 600px;
  min-height: 80px;
  background: rgba(0, 0, 0, 0.9);
  border-radius: 10px;
  padding: 20px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: ${props => props.$visible ? 1 : 0};
  transition: opacity 1.5s ease-in-out;
`;

const CurrentLyric = styled.div`
  font-size: 2rem;
  font-weight: bold;
  color: #ffd700;
  text-align: center;
  margin-bottom: 10px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
  min-height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const PreviewLyric = styled.div`
  font-size: 1.2rem;
  color: #ccc;
  text-align: center;
  margin-bottom: 5px;
  opacity: 0.7;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  min-height: 1.5rem;
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
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
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
  color: #ffd700;
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
  const [showTransition, setShowTransition] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [videoStartTime, setVideoStartTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [showQRCodeOverlay, setShowQRCodeOverlay] = useState(false);
  const [overlayTitle, setOverlayTitle] = useState('Willkommen beim Karaoke');
  
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
  const [highlightColor, setHighlightColor] = useState('#87CEEB'); // Default helles Blau
  const [showLyrics, setShowLyrics] = useState(false);

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
  }, []);

  const startUltrastarTiming = useCallback((songData: UltrastarSongData) => {
    // Clear existing interval
    stopUltrastarTiming();
    
    if (!songData.audioUrl || songData.bpm <= 0) {
      console.warn('Cannot start Ultrastar timing: missing audio URL or invalid BPM');
      return;
    }
    
    console.log('🎵 Starting Ultrastar timing:', {
      bpm: songData.bpm,
      gap: songData.gap,
      notesCount: songData.notes.length
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
      const activeNotes = songData.notes.filter(note => {
        const noteStartTime = note.startBeat * beatDuration;
        const noteEndTime = (note.startBeat + note.duration) * beatDuration;
        return currentBeat >= note.startBeat && currentBeat < note.startBeat + note.duration;
      });
      
      
      // Find current line and update display
      const currentLineIndex = songData.lines.findIndex(line => 
        currentBeat >= line.startBeat && currentBeat < line.endBeat
      );
      
      // Check if lyrics should be shown (5 seconds before next line starts)
      const nextLineIndex = songData.lines.findIndex(line => 
        currentBeat < line.startBeat
      );
      
      let shouldShowLyrics = false;
      
      if (currentLineIndex >= 0) {
        // Currently in a line - always show
        shouldShowLyrics = true;
      } else if (nextLineIndex >= 0) {
        // Check if next line starts within 5 seconds
        const nextLine = songData.lines[nextLineIndex];
        const timeUntilNextLine = (nextLine.startBeat - currentBeat) * beatDuration;
        shouldShowLyrics = timeUntilNextLine <= 5000; // 5 seconds
      } else {
        // No more lines - check if current line ended less than 10 seconds ago
        const lastLine = songData.lines[songData.lines.length - 1];
        if (lastLine) {
          const timeSinceLastLine = (currentBeat - lastLine.endBeat) * beatDuration;
          shouldShowLyrics = timeSinceLastLine <= 10000; // 10 seconds
        }
      }
      
      
      // Update lyrics visibility
      setShowLyrics(shouldShowLyrics);
      
      if (currentLineIndex >= 0) {
        const currentLine = songData.lines[currentLineIndex];
        const nextLine = songData.lines[currentLineIndex + 1];
        const nextNextLine = songData.lines[currentLineIndex + 2];
        
        // Find current syllable within the line
        const currentSyllable = currentLine.notes.find(note => 
          currentBeat >= note.startBeat && currentBeat < note.startBeat + note.duration
        );
        
        // Update current line with highlighted syllable
        if (currentLyricRef.current) {
          if (currentSyllable && currentSyllable.text.trim()) {
            // Console log for current syllable (only if different from last logged)
            if (currentSyllable.text !== lastLoggedText.current) {
              console.log(`🎤 ${currentSyllable.text} (${currentSyllable.type})`);
              lastLoggedText.current = currentSyllable.text;
            }
            
            // Clear and rebuild the line with proper spacing
            if (currentLyricRef.current) {
              currentLyricRef.current.innerHTML = '';
              
              currentLine.notes.forEach((note, index) => {
                const isSung = note.startBeat < currentSyllable.startBeat;
                const isCurrent = note.startBeat === currentSyllable.startBeat;
                const isLast = index === currentLine.notes.length - 1;
                
                // Create note span
                const noteSpan = document.createElement('span');
                
                if (isSung) {
                  // Already sung - highlight color
                  noteSpan.style.color = highlightColor;
                  noteSpan.style.fontWeight = 'bold';
                  noteSpan.textContent = note.text;
                } else if (isCurrent) {
                  // Currently singing - animated from left to right
                  const progress = (currentBeat - note.startBeat) / note.duration;
                  const width = Math.min(100, Math.max(0, progress * 100));
                  
                  noteSpan.style.position = 'relative';
                  noteSpan.style.display = 'inline-block';
                  
                  const whiteSpan = document.createElement('span');
                  whiteSpan.style.color = 'white';
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
                  noteSpan.style.color = 'white';
                  noteSpan.textContent = note.text;
                }
                
                currentLyricRef.current.appendChild(noteSpan);
                
                // Add space after each note except the last one
                if (!isLast) {
                  const spaceSpan = document.createElement('span');
                  spaceSpan.innerHTML = '&nbsp;'; // Use non-breaking space
                  spaceSpan.style.color = 'white';
                  spaceSpan.style.fontSize = 'inherit';
                  spaceSpan.style.fontWeight = 'normal';
                  currentLyricRef.current.appendChild(spaceSpan);
                }
              });
            }
          } else {
            // No active syllable, but show already sung syllables in highlight color
            if (currentLyricRef.current) {
              currentLyricRef.current.innerHTML = '';
              
              currentLine.notes.forEach((note, index) => {
                const isSung = note.startBeat < currentBeat;
                const isLast = index === currentLine.notes.length - 1;
                
                // Create note span
                const noteSpan = document.createElement('span');
                
                if (isSung) {
                  // Already sung - highlight color
                  noteSpan.style.color = highlightColor;
                  noteSpan.style.fontWeight = 'bold';
                  noteSpan.textContent = note.text;
                } else {
                  // Not yet sung - white
                  noteSpan.style.color = 'white';
                  noteSpan.textContent = note.text;
                }
                
                currentLyricRef.current.appendChild(noteSpan);
                
                // Add space after each note except the last one
                if (!isLast) {
                  const spaceSpan = document.createElement('span');
                  spaceSpan.innerHTML = '&nbsp;';
                  spaceSpan.style.color = 'white';
                  spaceSpan.style.fontSize = 'inherit';
                  spaceSpan.style.fontWeight = 'normal';
                  currentLyricRef.current.appendChild(spaceSpan);
                }
              });
            }
          }
        }
        
        // Update next line
        if (nextLyricRef.current) {
          if (nextLine) {
            const nextLineText = nextLine.notes.map(note => note.text).join(' ');
            nextLyricRef.current.innerHTML = `<span style="color: white;">${nextLineText}</span>`;
          } else {
            nextLyricRef.current.textContent = '';
          }
        }
        
        // Update next next line
        if (nextNextLyricRef.current) {
          if (nextNextLine) {
            const nextNextLineText = nextNextLine.notes.map(note => note.text).join(' ');
            nextNextLyricRef.current.innerHTML = `<span style="color: white;">${nextNextLineText}</span>`;
          } else {
            nextNextLyricRef.current.textContent = '';
          }
        }
      } else if (shouldShowLyrics && nextLineIndex >= 0) {
        // Show preview of upcoming line (5 seconds before it starts)
        const nextLine = songData.lines[nextLineIndex];
        const nextNextLine = songData.lines[nextLineIndex + 1];
        const nextNextNextLine = songData.lines[nextLineIndex + 2];
        
        // Show next line as current (preview)
        if (currentLyricRef.current) {
          const lineText = nextLine.notes.map(note => note.text).join(' ');
          currentLyricRef.current.innerHTML = `<span style="color: white; opacity: 0.7;">${lineText}</span>`;
        }
        
        // Show next next line as next
        if (nextLyricRef.current) {
          if (nextNextLine) {
            const nextLineText = nextNextLine.notes.map(note => note.text).join(' ');
            nextLyricRef.current.innerHTML = `<span style="color: white; opacity: 0.5;">${nextLineText}</span>`;
          } else {
            nextLyricRef.current.textContent = '';
          }
        }
        
        // Show next next next line as next next
        if (nextNextLyricRef.current) {
          if (nextNextNextLine) {
            const nextNextLineText = nextNextNextLine.notes.map(note => note.text).join(' ');
            nextNextLyricRef.current.innerHTML = `<span style="color: white; opacity: 0.3;">${nextNextLineText}</span>`;
          } else {
            nextNextLyricRef.current.textContent = '';
          }
        }
      } else if (shouldShowLyrics && songData.lines.length > 0 && currentBeat < songData.lines[0].startBeat) {
        // Show preview of first line (before song starts, accounting for GAP)
        const firstLine = songData.lines[0];
        const secondLine = songData.lines[1];
        const thirdLine = songData.lines[2];
        
        // Show first line as current (preview)
        if (currentLyricRef.current) {
          const lineText = firstLine.notes.map(note => note.text).join(' ');
          currentLyricRef.current.innerHTML = `<span style="color: white; opacity: 0.7;">${lineText}</span>`;
        }
        
        // Show second line as next
        if (nextLyricRef.current) {
          if (secondLine) {
            const nextLineText = secondLine.notes.map(note => note.text).join(' ');
            nextLyricRef.current.innerHTML = `<span style="color: white; opacity: 0.5;">${nextLineText}</span>`;
          } else {
            nextLyricRef.current.textContent = '';
          }
        }
        
        // Show third line as next next
        if (nextNextLyricRef.current) {
          if (thirdLine) {
            const nextNextLineText = thirdLine.notes.map(note => note.text).join(' ');
            nextNextLyricRef.current.innerHTML = `<span style="color: white; opacity: 0.3;">${nextNextLineText}</span>`;
          } else {
            nextNextLyricRef.current.textContent = '';
          }
        }
      } else {
        // No active line and shouldn't show lyrics - clear all
        if (currentLyricRef.current) {
          currentLyricRef.current.textContent = '';
        }
        if (nextLyricRef.current) {
          nextLyricRef.current.textContent = '';
        }
        if (nextNextLyricRef.current) {
          nextNextLyricRef.current.textContent = '';
        }
        // Reset last logged text when no active notes
        lastLoggedText.current = '';
      }
      
      // Continue animation loop
      animationFrameRef.current = requestAnimationFrame(updateLyrics);
    };
    
    // Start the animation loop
    animationFrameRef.current = requestAnimationFrame(updateLyrics);
  }, [stopUltrastarTiming]);

  const loadHighlightColor = useCallback(async () => {
    try {
      const response = await songAPI.getHighlightColor();
      setHighlightColor(response.data.highlightColor);
    } catch (error) {
      console.error('Error loading highlight color:', error);
      // Keep default color
    }
  }, []);

  const loadUltrastarData = useCallback(async (song: CurrentSong) => {
    try {
      // Extract folder name from youtube_url (e.g., "/api/ultrastar/Artist - Title" -> "Artist - Title")
      const encodedFolderName = song.youtube_url.replace('/api/ultrastar/', '');
      const folderName = decodeURIComponent(encodedFolderName);
      console.log('🎵 Loading Ultrastar data for:', folderName);
      
      const response = await songAPI.getUltrastarSongData(folderName);
      const songData = response.data.songData;
      
      setUltrastarData(songData);
      setCurrentNoteIndex(0);
      
      console.log('🎵 Ultrastar data loaded:', {
        title: songData.title,
        artist: songData.artist,
        bpm: songData.bpm,
        gap: songData.gap,
        notesCount: songData.notes.length,
        audioUrl: songData.audioUrl
      });
      
      
      // Start timing if audio is available
      if (songData.audioUrl) {
        startUltrastarTiming(songData);
      }
    } catch (error) {
      console.error('Error loading Ultrastar data:', error);
    }
  }, [startUltrastarTiming]);

  // Show lyrics immediately when ultrastar data is loaded
  useEffect(() => {
    if (ultrastarData && ultrastarData.lines && ultrastarData.lines.length > 0) {
      const firstLine = ultrastarData.lines[0];
      const secondLine = ultrastarData.lines[1];
      const thirdLine = ultrastarData.lines[2];
      
      // Show first line as current (preview)
      if (currentLyricRef.current) {
        const lineText = firstLine.notes.map(note => note.text).join(' ');
        currentLyricRef.current.innerHTML = `<span style="color: white; opacity: 0.7;">${lineText}</span>`;
      }
      
      // Show second line as next
      if (nextLyricRef.current) {
        if (secondLine) {
          const nextLineText = secondLine.notes.map(note => note.text).join(' ');
          nextLyricRef.current.innerHTML = `<span style="color: white; opacity: 0.5;">${nextLineText}</span>`;
        } else {
          nextLyricRef.current.textContent = '';
        }
      }
      
      // Show third line as next next
      if (nextNextLyricRef.current) {
        if (thirdLine) {
          const nextNextLineText = thirdLine.notes.map(note => note.text).join(' ');
          nextNextLyricRef.current.innerHTML = `<span style="color: white; opacity: 0.3;">${nextNextLineText}</span>`;
        } else {
          nextNextLyricRef.current.textContent = '';
        }
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
          stopUltrastarTiming();
        }
        
        // Start timer for new song
        if (newSong && newSong.duration_seconds) {
          setVideoStartTime(Date.now());
          setTimeRemaining(newSong.duration_seconds);
          console.log('⏱️ Timer started:', { 
            duration: newSong.duration_seconds,
            startTime: Date.now() 
          });
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
    loadHighlightColor();
    
    // Refresh every 2 seconds to catch song changes
    const interval = setInterval(fetchCurrentSong, 2000);
    
    return () => {
      clearInterval(interval);
      stopUltrastarTiming(); // Cleanup ultrastar timing
    };
  }, [lastSongId, loadHighlightColor]);

  // Timer effect
  useEffect(() => {
    if (!videoStartTime || !timeRemaining) return;

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - videoStartTime) / 1000);
      const remaining = Math.max(0, timeRemaining - elapsed);
      
      setTimeRemaining(remaining);
      
      console.log('⏱️ Timer update:', { 
        elapsed, 
        remaining, 
        duration: currentSong?.duration_seconds 
      });
      
      // Video ended - show transition
      if (remaining <= 0) {
        console.log('🎬 Video ended - showing transition overlay');
        setShowTransition(true);
        setVideoStartTime(null);
        setTimeRemaining(null);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [videoStartTime, timeRemaining, currentSong?.duration_seconds]);


  // Show transition overlay when no current song
  useEffect(() => {
    console.log('🎬 Video transition check:', { 
      loading, 
      currentSong: currentSong?.id, 
      showTransition: !loading && !currentSong 
    });
    
    if (!loading && !currentSong) {
      console.log('🎤 Showing transition overlay - no current song');
      setShowTransition(true);
    } else {
      console.log('🎵 Hiding transition overlay - song is playing');
      setShowTransition(false);
    }
  }, [loading, currentSong]);

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
  const embedUrl = currentSong?.youtube_url && !isServerVideo && !isFileVideo && !isUltrastar ? getYouTubeEmbedUrl(currentSong.youtube_url) : null;

  return (
    <ShowContainer>
      {/* Fullscreen Video */}
      {(currentSong?.youtube_url && !isUltrastar) || isUltrastar ? (
        <VideoWrapper>
          {(isServerVideo || isFileVideo) ? (
            <VideoElement
              key={currentSong?.id} // Force re-render only when song changes
              src={currentSong.youtube_url}
              title={`${currentSong?.user_name} - ${currentSong?.title}`}
              controls
              autoPlay
              onLoadStart={() => {
                console.log(`🎬 ${isFileVideo ? 'File' : 'Server'} video started:`, { 
                  songId: currentSong?.id, 
                  title: currentSong?.title,
                  url: currentSong.youtube_url,
                  mode: currentSong?.mode
                });
              }}
              onEnded={() => {
                console.log(`🎬 ${isFileVideo ? 'File' : 'Server'} video ended:`, { 
                  songId: currentSong?.id, 
                  title: currentSong?.title,
                  mode: currentSong?.mode
                });
                
                // Automatically show QR code overlay when non-YouTube video ends
                if (currentSong?.mode !== 'youtube') {
                  showAPI.toggleQRCodeOverlay(true).catch(error => {
                    console.error('Error showing overlay:', error);
                  });
                }
              }}
            />
          ) : isUltrastar && ultrastarData?.audioUrl ? (
            <>
              <AudioElement
                key={currentSong?.id}
                ref={audioRef}
                src={ultrastarData.audioUrl}
                controls
                autoPlay
                onLoadStart={() => {
                  console.log('🎵 Ultrastar audio started:', { 
                    songId: currentSong?.id, 
                    title: currentSong?.title,
                    audioUrl: ultrastarData.audioUrl,
                    mode: currentSong?.mode,
                    bpm: ultrastarData.bpm,
                    gap: ultrastarData.gap
                  });
                  
                  // Set timeout to show lyrics 10 seconds before first line
                  if (ultrastarData.gap > 10000) {
                    const showTime = ultrastarData.gap - 10000;
                    setTimeout(() => {
                      console.log('🎵 10 Sekunden vor der ersten Zeile! Text wird jetzt eingeblendet!', {
                        gap: ultrastarData.gap,
                        showTime,
                        title: currentSong?.title
                      });
                      setShowLyrics(true);
                    }, showTime);
                  } else {
                    // Gap ist kleiner als 10 Sekunden - sofort einblenden ohne Fade
                    console.log('🎵 Gap < 10s - Text wird sofort eingeblendet!', {
                      gap: ultrastarData.gap,
                      title: currentSong?.title
                    });
                    setShowLyrics(true);
                  }
                }}
                onEnded={() => {
                  console.log('🎵 Ultrastar audio ended:', { 
                    songId: currentSong?.id, 
                    title: currentSong?.title 
                  });
                  stopUltrastarTiming();
                  // Automatically show QR overlay when audio ends
                  showAPI.toggleQRCodeOverlay(true).catch(error => {
                    console.error('Error showing overlay:', error);
                  });
                }}
              />
              <LyricsDisplay $visible={showLyrics}>
                <PreviewLyric ref={nextNextLyricRef}></PreviewLyric>
                <PreviewLyric ref={nextLyricRef}></PreviewLyric>
                <CurrentLyric ref={currentLyricRef}></CurrentLyric>
              </LyricsDisplay>
            </>
          ) : embedUrl ? (
            <VideoIframe
              key={currentSong?.id} // Force re-render only when song changes
              src={embedUrl}
              title={`${currentSong?.user_name} - ${currentSong?.title}`}
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

      {/* Transition Overlay */}
      {showTransition && console.log('🎤 Rendering transition overlay:', { 
        showTransition, 
        currentSong: currentSong?.id,
        nextSongsCount: nextSongs.length 
      })}
      <TransitionOverlay $isVisible={showTransition}>
        <TransitionContent>
          <TransitionTitle>🎤 Nächster Song</TransitionTitle>
          
          {nextSongs.length > 0 ? (
            <NextSongInfo>
              <NextSinger>🎵 {nextSongs[0].user_name}</NextSinger>
              <NextSong>
                {nextSongs[0].artist ? `${nextSongs[0].artist} - ${nextSongs[0].title}` : nextSongs[0].title}
              </NextSong>
            </NextSongInfo>
          ) : (
            <NextSongInfo>
              <NextSinger>🎵 Kein Song in der Warteschlange</NextSinger>
              <NextSong>Warte auf neue Songwünsche...</NextSong>
            </NextSongInfo>
          )}

          <QRCodeContainer>
            <QRCodeImage 
              src={qrCodeUrl} 
              alt="QR Code für Songwünsche"
              onError={(e) => {
                console.error('❌ QR Code failed to load');
                e.currentTarget.style.display = 'none';
              }}
              onLoad={() => {
                console.log('📱 QR Code loaded successfully');
              }}
            />
            <QRCodeText>
              📱 QR-Code scannen für Songwünsche<br/>
              Oder besuche: {window.location.origin}/new
            </QRCodeText>
          </QRCodeContainer>
        </TransitionContent>
      </TransitionOverlay>

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
