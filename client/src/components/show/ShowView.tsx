import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { showAPI, songAPI } from '../../services/api';
import websocketService, { ShowUpdateData } from '../../services/websocket';
import { boilDown } from '../../utils/boilDown';
import { useTranslation } from 'react-i18next';
import Button from '../../components/shared/Button';
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
  SECONDARY_COLOR
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
  BackgroundImage
} from './style';
import { UltrastarSongData } from './types';
import Footer from './Footer';
import Header from './Header';
import Overlay from './Overlay';
import ControlButtons from './ControlButtons';

let globalUltrastarData: UltrastarSongData | null = null;

// const ShowContainer = styled.div<{ $cursorVisible: boolean }>`
//   position: relative;
//   width: 100vw;
//   height: 100vh;
//   overflow: hidden;
//   cursor: ${props => props.$cursorVisible ? 'default' : 'none'};
//   user-select: none;
//   -webkit-user-select: none;
//   -moz-user-select: none;
//   -ms-user-select: none;
// `;

// const VideoWrapper = styled.div`
//   position: absolute;
//   top: 0;
//   left: 0;
//   width: 100%;
//   height: 100%;
// `;


// const VideoElement = styled.video`
//   width: 100%;
//   height: 100%;
//   object-fit: contain;
//   background: black;
// `;

// const VideoIframe = styled.iframe`
//   width: 100%;
//   height: 100%;
//   border: none;
// `;

// const AudioElement = styled.audio`
//   position: absolute;
//   top: 50px;
//   left: 50%;
//   transform: translateX(-50%);
//   width: 80%;
//   max-width: 600px;
//   height: 60px;
//   background: rgba(0, 0, 0, 0.8);
//   border-radius: 10px;
//   padding: 10px;
//   z-index: 33;
// `;

// const BackgroundVideo = styled.video`
//   position: absolute;
//   top: 0;
//   left: 0;
//   width: 100%;
//   height: 100%;
//   object-fit: cover;
//   z-index: 1;
// `;

// const BackgroundImage = styled.div<{ $imageUrl: string }>`
//   position: absolute;
//   top: 0;
//   left: 0;
//   width: 100%;
//   height: 100%;
//   background-image: url(${props => props.$imageUrl});
//   background-size: cover;
//   background-position: center;
//   background-repeat: no-repeat;
//   filter: blur(8px);
//   transform: scale(1.1);
//   z-index: 1;
// `;

// createLyricsDisplay removed - now using inline styles

// createCurrentLyric removed - now using inline styles

// const PreviewLyric = styled.div`
//   font-size: 3rem;
//   color: #ffffff;
//   text-align: center;
//   margin-bottom: 5px;
//   text-shadow: 4px 4px 8px rgba(0, 0, 0, 1);
//   min-height: 3.5rem;
//   display: flex;
//   align-items: center;
//   justify-content: center;
// `;

// const HighlightedSyllable = styled.span`
//   background: linear-gradient(45deg, #ff6b6b, #ffd700);
//   -webkit-background-clip: text;
//   -webkit-text-fill-color: transparent;
//   background-clip: text;
//   font-weight: 900;
//   text-shadow: 4px 4px px rgba(0, 0, 0, 1);
// `;

// const CurrentSyllable = styled.span`
//   color: #ffffff;
//   font-weight: bold;
//   transform: scale(1.1);
//   transition: transform 0.2s ease-in-out;
//   display: inline-block;
// `;


// const Header = styled.div`
//   position: absolute;
//   top: 0;
//   left: 0;
//   right: 0;
//   background: rgba(0, 0, 0, 0.8);
//   backdrop-filter: blur(10px);
//   padding: 20px 40px;
//   z-index: 10;
// `;

// const HeaderContent = styled.div`
//   display: flex;
//   justify-content: space-between;
//   align-items: center;
//   max-width: 1200px;
//   margin: 0 auto;
// `;

// const CurrentSongInfo = styled.div`
//   display: flex;
//   flex-direction: column;
//   gap: 5px;
// `;

// const SingerName = styled.div`
//   font-size: 1.8rem;
//   font-weight: 700;
//   color: #fff;
//   text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
//   white-space: nowrap;
//   overflow: hidden;
//   text-overflow: ellipsis;
// `;

// const SongTitle = styled.div`
//   font-size: 1.2rem;
//   color: #ffd700;
//   font-weight: 500;
//   text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
//   white-space: nowrap;
//   overflow: hidden;
//   text-overflow: ellipsis;
// `;

// const TimerDisplay = styled.div`
//   font-size: 1rem;
//   color: #fff;
//   font-weight: 600;
//   text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
//   background: rgba(0, 0, 0, 0.3);
//   padding: 5px 10px;
//   border-radius: 15px;
//   margin-left: 20px;
// `;

// const Footer = styled.div`
//   position: absolute;
//   bottom: 0;
//   left: 0;
//   right: 0;
//   background: rgba(0, 0, 0, 0.8);
//   backdrop-filter: blur(10px);
//   padding: 20px 40px;
//   z-index: 10;
// `;

// const FooterContent = styled.div`
//   max-width: 1200px;
//   margin: 0 auto;
// `;

// const NextSongsTitle = styled.div`
//   font-size: 1rem;
//   color: #ccc;
//   margin-bottom: 10px;
//   font-weight: 600;
// `;

// const NextSongsList = styled.div`
//   display: flex;
//   gap: 20px;
//   width: 100%;
// `;

// const NextSongItem = styled.div`
//   display: flex;
//   flex-direction: column;
//   gap: 3px;
//   flex: 1;
//   min-width: 0;
// `;

// const NextSingerName = styled.div`
//   font-size: 0.9rem;
//   color: #fff;
//   font-weight: 600;
//   white-space: nowrap;
//   overflow: hidden;
//   text-overflow: ellipsis;
// `;

// const NextSongTitle = styled.div`
//   font-size: 0.8rem;
//   color: #ffd700;
//   white-space: nowrap;
//   overflow: hidden;
//   text-overflow: ellipsis;
// `;

// const TransitionOverlay = styled.div<{ $isVisible: boolean }>`
//   position: absolute;
//   top: 0;
//   left: 0;
//   right: 0;
//   bottom: 0;
//   background: rgba(0, 0, 0, 0.95);
//   backdrop-filter: blur(10px);
//   display: flex;
//   flex-direction: column;
//   align-items: center;
//   justify-content: center;
//   z-index: 100;
//   opacity: ${props => props.$isVisible ? 1 : 0};
//   visibility: ${props => props.$isVisible ? 'visible' : 'hidden'};
//   transition: all 0.5s ease;
// `;

// const TransitionContent = styled.div`
//   text-align: center;
//   max-width: 800px;
//   padding: 40px;
// `;

// const TransitionTitle = styled.h1`
//   font-size: 3rem;
//   font-weight: 700;
//   color: #fff;
//   margin-bottom: 30px;
//   text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
// `;

// const NextSongInfo = styled.div`
//   background: rgba(255, 255, 255, 0.1);
//   border-radius: 20px;
//   padding: 30px;
//   margin-bottom: 40px;
//   backdrop-filter: blur(10px);
// `;

// const NextSinger = styled.div`
//   font-size: 2.5rem;
//   font-weight: 700;
//   color: #ffffff;
//   margin-bottom: 15px;
//   text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
// `;

// const NextSong = styled.div`
//   font-size: 1.8rem;
//   color: #fff;
//   font-weight: 500;
//   text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
// `;

// const QRCodeContainer = styled.div`
//   display: flex;
//   flex-direction: column;
//   align-items: center;
//   gap: 20px;
// `;

// const QRCodeImage = styled.img`
//   width: 200px;
//   height: 200px;
//   border-radius: 15px;
//   box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
// `;

// const QRCodeText = styled.div`
//   font-size: 1.2rem;
//   color: #fff;
//   text-align: center;
//   max-width: 400px;
//   line-height: 1.5;
// `;

// QR Code Overlay Components
// const QRCodeOverlay = styled.div<{ $isVisible: boolean }>`
//   position: absolute;
//   top: 0;
//   left: 0;
//   right: 0;
//   bottom: 0;
//   background: rgba(0, 0, 0, 0.95);
//   display: flex;
//   flex-direction: column;
//   justify-content: center;
//   align-items: center;
//   z-index: 200;
//   padding: 40px;
//   opacity: ${props => props.$isVisible ? 1 : 0};
//   visibility: ${props => props.$isVisible ? 'visible' : 'hidden'};
//   transition: opacity 0.5s ease-in-out, visibility 0.5s ease-in-out;
// `;

// const QRCodeHeader = styled.h1`
//   position: absolute;
//   top: 40px;
//   left: 50%;
//   transform: translateX(-50%);
//   color: #fff;
//   font-size: 3rem;
//   margin: 0;
//   font-weight: bold;
//   text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
//   text-align: center;
//   z-index: 201;
// `;

// const QRCodeContent = styled.div`
//   display: flex;
//   flex-direction: row;
//   align-items: center;
//   gap: 60px;
//   max-width: 1200px;
//   width: 100%;
// `;

// const QRCodeLeftSide = styled.div`
//   flex: 2;
//   display: flex;
//   flex-direction: column;
//   align-items: center;
//   text-align: center;
// `;

// const QRCodeTitle = styled.h1`
//   color: #fff;
//   font-size: 4rem;
//   margin: 0 0 40px 0;
//   font-weight: bold;
//   text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
// `;

// const QRCodeNextSongInfo = styled.div`
//   display: flex;
//   flex-direction: column;
//   gap: 20px;
//   align-items: center;
// `;

// const QRCodeNextSinger = styled.h2`
//   font-size: 3rem;
//   margin: 0;
//   font-weight: 600;
//   color: #fff;
//   text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
// `;

// const QRCodeNextSongTitle = styled.h3`
//   font-size: 2.5rem;
//   margin: 0;
//   font-weight: normal;
//   color: #ffd700;
//   text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
// `;

// const QRCodeRightSide = styled.div`
//   flex: 1;
//   display: flex;
//   flex-direction: column;
//   align-items: center;
//   gap: 20px;
// `;

// const QRCodeImageLarge = styled.img`
//   width: 300px;
//   height: 300px;
//   border-radius: 15px;
//   border: 20px solid white;
//   box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
// `;

// const QRCodeTextLarge = styled.p`
//   color: #fff;
//   font-size: 1.4rem;
//   margin: 0;
//   text-align: center;
//   text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
//   max-width: 300px;
// `;

// const QRCodeCloseButton = styled.button`
//   background: #e74c3c;
//   color: white;
//   border: none;
//   padding: 15px 30px;
//   border-radius: 10px;
//   cursor: pointer;
//   font-size: 1.2rem;
//   font-weight: 600;
//   margin-top: 30px;

//   &:hover {
//     background: #c0392b;
//   }
// `;

// Start Overlay Components
const StartOverlay = styled.div<{ $isVisible: boolean }>`
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
  z-index: 300;
  padding: 40px;
  opacity: ${props => props.$isVisible ? 1 : 0};
  visibility: ${props => props.$isVisible ? 'visible' : 'hidden'};
  transition: opacity 0.5s ease-in-out, visibility 0.5s ease-in-out;
`;

const StartButton = styled.button`
  background: linear-gradient(45deg, #ff6b6b, #ffd700);
  color: white;
  border: none;
  padding: 30px 60px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 3rem;
  font-weight: 700;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  transition: all 0.3s ease-in-out;
  min-width: 300px;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 15px 40px rgba(0, 0, 0, 0.7);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const StartTitle = styled.h1`
  color: #fff;
  font-size: 4rem;
  margin: 0 0 40px 0;
  font-weight: bold;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
  text-align: center;
`;


const ButtonsContainer = styled.div`
  position: absolute;
  top: 20px;
  right: 80px;
  display: flex;
  gap: 8px;
  z-index: 20;
`;


// const ProgressOverlay = styled.div<{ $isVisible: boolean; $isUltrastar: boolean }>`
//   position: absolute;
//   top: calc(50vh - 200px);
//   left: 50%;
//   transform: translateX(-50%);
//   z-index: 50;
//   opacity: ${props => props.$isVisible ? 1 : 0};
//   visibility: ${props => props.$isVisible ? 'visible' : 'hidden'};
//   transition: opacity 0.3s ease-in-out, visibility 0.3s ease-in-out;
// `;

// const ProgressBarContainer = styled.div<{ $isUltrastar: boolean }>`
//   width: 50vw;
//   height: 40px;
//   background: rgba(0, 0, 0, 0.8);
//   border-radius: 4px;
//   border: 5px solid ${HIGHLIGHT_COLOR};
//   overflow: hidden;
//   box-shadow: 0 0 20px rgba(0, 0, 0, 1);
//   transform: ${props => props.$isUltrastar ? 'scale(1)' : 'scale(0)'};
//   transition: transform 0.3s ease-in-out;
// `;

// const ProgressBarFill = styled.div<{ $progress: number }>`
//   width: ${props => props.$progress}%;
//   height: 100%;
//   background: ${HIGHLIGHT_COLOR};
//   border-radius: 0px;
//   transition: width 0.1s ease-out;
//   box-shadow: 0 0 10px rgba(78, 145, 201, 0.5);
// `;

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

// const LoadingMessage = styled.div`
//   display: flex;
//   align-items: center;
//   justify-content: center;
//   height: 200px;
//   font-size: 1.2rem;
//   color: #666;
//   background: #f8f9fa;
//   border-radius: 15px;
// `;

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
  const [showStartOverlay, setShowStartOverlay] = useState(false);

  // YouTube embed state (only for cache miss fallback)
  const [iframeKey, setIframeKey] = useState(0);
  const [youtubeCurrentTime, setYoutubeCurrentTime] = useState(0);
  const [youtubeIsPaused, setYoutubeIsPaused] = useState(false);

  // Cursor visibility state
  const [cursorVisible, setCursorVisible] = useState(true);
  const cursorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Ultrastar-specific state
  const [ultrastarData, setUltrastarData] = useState<UltrastarSongData | null>(null);
  // const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  // const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
  const [isApiLoadedSong, setIsApiLoadedSong] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastLoggedText = useRef<string>('');
  const lastUpdateTime = useRef<number>(0);
  const UPDATE_THROTTLE_MS = 50; // Throttle updates to max 20fps to prevent race conditions

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
  // const [showLyrics, setShowLyrics] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [canAutoPlay, setCanAutoPlay] = useState(false);
  // const [isFadeOutMode, setIsFadeOutMode] = useState(false);
  // const [fadeOutLineIndex, setFadeOutLineIndex] = useState<number | null>(null);
  // const [fadeOutLineIndices, setFadeOutLineIndices] = useState<Set<number>>(new Set());
  const [lyricsScale, setLyricsScale] = useState<number>(1);
  const [lyricsTransitionEnabled, setLyricsTransitionEnabled] = useState(false);

  const [progressVisible1, setProgressVisible1] = useState(false);
  const [progressValue1, setProgressValue1] = useState(0);
  const progressIntervalRef1 = useRef<NodeJS.Timeout | null>(null);
  const [progressVisible2, setProgressVisible2] = useState(false);
  const [progressValue2, setProgressValue2] = useState(0);
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
  // const [progressVisible, setProgressVisible] = useState(false);
  // const [progressValue, setProgressValue] = useState(0);
  // const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // const animationFrameRef = useRef<number | null>(null);
  // const currentLyricRef = useRef<HTMLDivElement | null>(null);
  // const nextLyricRef = useRef<HTMLDivElement | null>(null);
  // const nextNextLyricRef = useRef<HTMLDivElement | null>(null);

  const [isDuet, setIsDuet] = useState(false);

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
    opacity: showLyrics1 ? 1 : 0,
    transition: `${lyricsTransitionEnabled ? `opacity ${LYRICS_FADE_DURATION} ease-in-out, height 1s ease-in-out, min-height 1s ease-in-out, padding 1s ease-in-out` : 'none'}`,
    whiteSpace: 'pre' as const,
    overflow: 'hidden' as const
  };

  const lyricsDisplayStyle1 = !isDuet ? lyricsDisplayStyle : {
    ...lyricsDisplayStyle,
    top: '35%',
  }

  const lyricsDisplayStyle2 = {
    ...lyricsDisplayStyle,
    opacity: showLyrics2 ? 1 : 0,
    top: '65%',
  }


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
  const stopProgress = useCallback(() => {
    const singers = getSingers(ultrastarData);
    for (const singer of singers) {
      if (singer.progress.intervalRef.current) {
        clearInterval(singer.progress.intervalRef.current);
        singer.progress.intervalRef.current = null;
      }
      singer.progress.visible = false;
      singer.progress.setValue(0);
    }
  }, []);

  const startProgress = useCallback((secondsUntilNextLine: number, singer: Singer) => {
    // Only start progress if there's enough time (at least 3 seconds)
    if (secondsUntilNextLine < COUNTDOWN_SECONDS) {
      return;
    }

    console.log('🎵 Starting progress bar:', { secondsUntilNextLine });

    // Clear any existing progress
    stopProgress();

    singer.progress.setValue(100); // Start at 100%
    singer.progress.visible = true;

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
    const singers = getSingers(ultrastarData);
    for (const singer of singers) {
      if (singer.refs.animationFrameRef.current) {
        cancelAnimationFrame(singer.refs.animationFrameRef.current);
        singer.refs.animationFrameRef.current = null;
      }
    }
    // Also stop progress when stopping ultrastar timing
    stopProgress();
  }, [stopProgress]);


  const getSingers = useCallback((ultrastarData: UltrastarSongData | null) => {
    if (!ultrastarData) return [];

    const singers: Singer[] = [{
      singer: "P1",
      lines: [] as UltrastarLine[],
      notes: [] as UltrastarNote[],
      refs: {
        currentLyricRef: currentLyricRef1,
        nextLyricRef: nextLyricRef1,
        nextNextLyricRef: nextNextLyricRef1,
        animationFrameRef: animationFrameRef1
      },
      setShowLyrics: setShowLyrics1,
      progress: {
        visible: progressVisible1,
        value: progressValue1,
        intervalRef: progressIntervalRef1,
        setValue: setProgressValue1
      }
    }];

    if (ultrastarData.isDuet) {
      singers[0].lines = ultrastarData.lines[0] as UltrastarLine[];
      singers.push({
        singer: "P2",
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
          visible: progressVisible2,
          value: progressValue2,
          intervalRef: progressIntervalRef2,
          setValue: setProgressValue2
        }
      });
    } else {
      singers[0].lines = ultrastarData.lines as UltrastarLine[];
      singers[0].notes = ultrastarData.notes as UltrastarNote[];
    }
    return singers;
  }, [ultrastarData, currentLyricRef1, nextLyricRef1, nextNextLyricRef1, animationFrameRef1, currentLyricRef2, nextLyricRef2, nextNextLyricRef2, animationFrameRef2]);

  // Function to restart lyrics animation when audio resumes
  const restartLyricsAnimation = useCallback(() => {
    if (ultrastarData && audioRef.current && !audioRef.current.paused) {
      console.log('🎵 Restarting lyrics animation');
      // Clear existing animation frame
      const singers = getSingers(ultrastarData);
      for (const singer of singers) {
        if (singer.refs.animationFrameRef.current) {
          cancelAnimationFrame(singer.refs.animationFrameRef.current);
          singer.refs.animationFrameRef.current = null;
        }

        singer.refs.animationFrameRef.current = requestAnimationFrame(() => {
          // This will restart the animation loop
          if (ultrastarData && audioRef.current && !audioRef.current.paused) {
            // Recalculate timing and restart the loop
            const beatDuration = (60 / ultrastarData.bpm) * 1000; // Convert to milliseconds

            const updateLyrics = (singer: Singer) => {
              if (!audioRef.current || audioRef.current.paused) return;

              const now = Date.now();
              const timeSinceLastUpdate = now - lastUpdateTime.current;

              if (timeSinceLastUpdate < UPDATE_THROTTLE_MS) {
                singer.refs.animationFrameRef.current = requestAnimationFrame(() => updateLyrics(singer));
                return;
              }

              lastUpdateTime.current = now;
              const currentTime = audioRef.current.currentTime * 1000;
              const songTime = currentTime - ultrastarData.gap;

              if (songTime < 0) {
                singer.refs.animationFrameRef.current = requestAnimationFrame(() => updateLyrics(singer));
                return;
              }

              const currentBeat = songTime / beatDuration;

              const currentLineIndex = singer.lines.findIndex((line: UltrastarLine) =>
                currentBeat >= line.startBeat && currentBeat < line.endBeat
              );

              if (currentLineIndex >= 0) {
                const currentLine = singer.lines[currentLineIndex];
                const nextLine = singer.lines[currentLineIndex + 1];
                const nextNextLine = singer.lines[currentLineIndex + 2];
                updateLyricsDisplay(singer.refs, currentLine, nextLine, nextNextLine, false);
              }

              singer.refs.animationFrameRef.current = requestAnimationFrame(() => updateLyrics(singer));
            };

            singer.refs.animationFrameRef.current = requestAnimationFrame(() => updateLyrics(singer));
          }
        });

      }
    }
  }, [ultrastarData, getSingers]);

  const startUltrastarTiming = useCallback((songData: UltrastarSongData, fadeOutIndices: Set<number>) => {
    // Clear existing interval
    stopUltrastarTiming();

    const singers = getSingers(songData);

    console.log("lines and refs", singers);

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
    for (const singer of singers) {
      const updateLyrics = (singer: Singer) => {
        if (!audioRef.current) return;

        // Note: We don't check for paused here to allow initial animation start
        // Pause handling is done in the event handlers instead

        const now = Date.now();
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

        // Find notes that should be active now
        // const activeNotes = singer.notes.filter((note: UltrastarNote) => {
        //   const noteStartTime = note.startBeat * beatDuration;
        //   const noteEndTime = (note.startBeat + note.duration) * beatDuration;
        //   return currentBeat >= note.startBeat && currentBeat < note.startBeat + note.duration;
        // });

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
          // console.log('🎵 Currently in line - showing lyrics');
        } else if (nextLineIndex >= 0) {
          // Check if next line starts within 10 seconds
          const nextLine = singer.lines[nextLineIndex];
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
          const lastLine = singer.lines[singer.lines.length - 1];
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
        singer.setShowLyrics(shouldShowLyrics);

        if (currentLineIndex >= 0) {
          // Stop progress when we're actively singing a line
          stopProgress();

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
                    noteSpan.style.transform = 'scale(1.0)';
                    noteSpan.style.transition = 'transform 0.5s ease-in-out';

                    // Apply scaling after DOM is ready
                    setTimeout(() => {
                      if (noteSpan.parentNode) {
                        noteSpan.style.transform = 'scale(1.1)';
                      }
                    }, 0);

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
          if (fadeOutIndices.has(currentLineIndex + 1)) {
            console.log('🎵 Zeile 2 ist Fade-out-Zeile - verstecke nur Zeile 3');
            setLyricContent(singer.refs.nextLyricRef, nextLine, UNSUNG_COLOR, NEXT_LINE_OPACITY);
            setLyricContent(singer.refs.nextNextLyricRef, null, UNSUNG_COLOR, NEXT_NEXT_LINE_OPACITY);
          } else if (fadeOutIndices.has(currentLineIndex)) {
            // Current line (Zeile 1) is a fade-out line - hide next lines (Zeile 2 und 3)
            console.log('🎵 Zeile 1 ist Fade-out-Zeile - verstecke Zeile 2 und 3');
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
          if (fadeOutIndices.has(nextLineIndex + 1)) {
            // Next line (Preview-Zeile 1) is a fade-out line - show next line, hide line after fade-out
            // setIsFadeOutMode(true);
            // setFadeOutLineIndex(nextLineIndex + 1);
            updateLyricsDisplay(singer.refs, nextLine, nextNextLine, null, false);
          } else if (fadeOutIndices.has(nextLineIndex)) {
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
          if (fadeOutIndices.has(1)) {
            // Second line is a fade-out line - show first and second line, hide third line
            console.log('🎵 Zweite Zeile ist Fade-out-Zeile (Index 1) - zeige erste und zweite Zeile, verstecke dritte');
            // setIsFadeOutMode(true);
            // setFadeOutLineIndex(1);
            updateLyricsDisplay(singer.refs, firstLine, secondLine, null, false);
          } else if (fadeOutIndices.has(0)) {
            // First line is a fade-out line - show only first line
            console.log('🎵 Erste Zeile ist Fade-out-Zeile (Index 0) - zeige nur erste Zeile');
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
            console.log('🎵 Alle Zeilen gesungen - zeige letzte Zeile für 3 Sekunden');

            const currentLyricElement = singer.refs.currentLyricRef.current;
            if (currentLyricElement) {
              requestAnimationFrame(() => {
                if (singer.refs.currentLyricRef.current) {
                  singer.refs.currentLyricRef.current.innerHTML = '';
                  singer.refs.currentLyricRef.current.style.color = HIGHLIGHT_COLOR;
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
            console.log('🎵 Alle Zeilen gesungen - verstecke gesamten Lyrics-Container');
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
  }, [stopUltrastarTiming/*, getSingers, nextLyricRef1, nextNextLyricRef1, currentLyricRef1, nextLyricRef2, nextNextLyricRef2, currentLyricRef2*/]);

  const analyzeFadeOutLines = useCallback((songData: UltrastarSongData): Set<number> => {
    if (!songData.lines || songData.lines.length === 0) {
      return new Set();
    }

    const beatDuration = (60000 / songData.bpm) / 4; // Beat duration in milliseconds (quarter notes)
    const fadeOutLines: Array<{ index: number, text: string, timeUntilNext: number }> = [];


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
      // setFadeOutLineIndices(fadeOutIndices);
      return fadeOutIndices;
    } else {
      console.log(`🎵 Keine Fade-out-Zeilen gefunden (alle Zeilen haben <${FADE_OUT_THRESHOLD_MS / 1000}s Pause)`);
      // setFadeOutLineIndices(new Set());
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
      setShowLyrics1(false);
      setShowLyrics2(false);
      setLyricsScale(0);
      // setIsFadeOutMode(false);
      // setFadeOutLineIndex(null);
      // setFadeOutLineIndices(new Set());
      stopProgress();
      setIsDuet(songData.isDuet);

      // console.log('🎵 Ultrastar data loaded:', {
      //   title: songData.title,
      //   artist: songData.artist,
      //   bpm: songData.bpm,
      //   gap: songData.gap,
      //   notesCount: songData.notes.length,
      //   audioUrl: songData.audioUrl,
      //   linesCount: songData.lines.length,
      //   firstLineStartBeat: songData.lines[0]?.startBeat,
      //   firstLineEndBeat: songData.lines[0]?.endBeat,
      //   firstLineText: songData.lines[0] ? songData.lines[0].notes.map((n: UltrastarNote) => n.text).join('') : 'N/A',
      //   loadSource: 'API' // This will help identify if loaded via API or WebSocket
      // });

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
    if (!ultrastarData) return;
    const singers = getSingers(ultrastarData);
    for (const singer of singers) {
      if (singer.lines.length > 0) {
        const firstLine = singer.lines[0];
        const secondLine = singer.lines[1];
        const thirdLine = singer.lines[2];
        updateLyricsDisplay(singer.refs, firstLine, secondLine, thirdLine, false);
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


        // Show start overlay if user hasn't interacted yet (for any song type)
        if (!hasUserInteracted) {
          console.log('🌐 API: User hasn\'t interacted yet, showing start overlay');
          setShowStartOverlay(true);
        }

        // Load Ultrastar data if it's an ultrastar song
        if (newSong && newSong.mode === 'ultrastar') {
          console.log('🌐 API: Loading Ultrastar data for new song');
          setIsApiLoadedSong(true); // Mark as API-loaded song
          await loadUltrastarData(newSong);
        } else {
          // Clear ultrastar data for non-ultrastar songs - do this atomically
          stopUltrastarTiming();
          stopProgress();

          // Reset all states atomically to prevent race conditions
          setUltrastarData(null);
          setShowLyrics1(false);
          setShowLyrics2(false);
          setLyricsScale(0);
          // setIsFadeOutMode(false);
          // setFadeOutLineIndex(null);
          // setFadeOutLineIndices(new Set());
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

      // Hide start overlay when song comes via WebSocket (user has interacted)
      if (showStartOverlay) {
        console.log('🔌 WebSocket: Hiding start overlay, song loaded via WebSocket');
        setShowStartOverlay(false);
      }

      // Load Ultrastar data if it's an ultrastar song
      if (newSong && newSong.mode === 'ultrastar') {
        setIsApiLoadedSong(false); // Mark as WebSocket-loaded song
        await loadUltrastarData(newSong);
      } else {
        // Clear ultrastar data for non-ultrastar songs - do this atomically
        stopUltrastarTiming();
        stopProgress();

        // Reset all states atomically to prevent race conditions
        setUltrastarData(null);
        setShowLyrics1(false);
        setShowLyrics2(false);
        setLyricsScale(0);
        // setIsFadeOutMode(false);
        // setFadeOutLineIndex(null);
        // setFadeOutLineIndices(new Set());
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
          for (const singer of getSingers(ultrastarData)) {
            if (singer.refs.animationFrameRef.current) {
              cancelAnimationFrame(singer.refs.animationFrameRef.current);
              singer.refs.animationFrameRef.current = null;
            }
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
      title: currentSong?.title,
      audioCurrentTime: audioRef.current?.currentTime,
      audioDuration: audioRef.current?.duration,
      ultrastarDataLoaded: !!ultrastarData,
      bpm: ultrastarData?.bpm,
      gap: ultrastarData?.gap
    });
    setAudioLoaded(true);

    // Start timing only when audio is ready to prevent race conditions
    // But don't start timing immediately - wait for audio to actually start playing
    if (ultrastarData && ultrastarData.audioUrl && ultrastarData.bpm > 0) {
      if (isApiLoadedSong) {
        console.log('🎵 handleAudioCanPlay: API-loaded song, starting timing immediately');
        const fadeOutIndices = analyzeFadeOutLines(ultrastarData);
        startUltrastarTiming(ultrastarData, fadeOutIndices);
      } else {
        console.log('🎵 handleAudioCanPlay: WebSocket-loaded song, waiting for play event to start timing');
        // Timing will be started in handleAudioPlay when audio actually starts
      }
    }
  }, [currentSong?.id, currentSong?.title, ultrastarData, startUltrastarTiming, isApiLoadedSong, analyzeFadeOutLines]);

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
    const singers = getSingers(ultrastarData);
    if (ultrastarData && singers[0]?.lines && singers[0]?.lines.length > 0) {
      const firstLine = [];
      const beatDuration = (60000 / ultrastarData.bpm) / 4; // Beat duration in milliseconds
      const firstLineStartTime = [];
      const fadeInDuration = 1000 * FADE_IN_DURATION_SECONDS; // 4 seconds
      const showTime = [];
      const timeUntilFirstLine = [];
      const secondsUntilFirstLine: number[] = [];
      for (let i = 0; i < singers.length; i++) {
        firstLine[i] = singers[i].lines[0];
        firstLineStartTime[i] = ultrastarData.gap + (firstLine[i].startBeat * beatDuration);
        showTime[i] = Math.max(0, firstLineStartTime[i] - 1000 * FADE_IN_ATTACK_SECONDS); // 10 seconds before first line

        // Calculate time until first line starts (for progress bar)
        timeUntilFirstLine[i] = firstLineStartTime[i];
        secondsUntilFirstLine[i] = timeUntilFirstLine[i] / 1000;
      }
      
      const minShowTime = Math.min(...showTime);

      if (minShowTime<= fadeInDuration) {
        // Show immediately if not enough time for fade-in
        console.log('🎵 Not enough time for fade-in - showing lyrics immediately');
        setLyricsTransitionEnabled(false);
        console.log('lyrics scale from useEffect');
        setLyricsScale(1);
        setShowLyrics1(true);
        setShowLyrics2(true);
        console.log('🎵 Showing lyrics immediately');
      } else {
        setLyricsTransitionEnabled(true);
        setTimeout(() => {
          console.log('lyrics scale from timeout');
          setLyricsScale(1);
          setShowLyrics1(true);
          setShowLyrics2(true);

          // Start progress bar for first lyrics if there's enough time
          for (let i = 0; i < singers.length; i++) {
            setTimeout(() => {
              console.log('🎵 Starting progress bar for first lyrics:', { secondsUntilFirstLine: secondsUntilFirstLine[i] });
              startProgress(secondsUntilFirstLine[i], singers[i]);
            }, (FADE_IN_ATTACK_SECONDS - COUNTDOWN_SECONDS) * 1000);
          }
        }, minShowTime);
      }
    }
    setSongChanged(false);
  }, [ultrastarData?.gap, songChanged, playing, setLyricsScale, setShowLyrics1, setShowLyrics2, setLyricsTransitionEnabled, startProgress]);


  // console.log('🎵 lyricsTransitionEnabled', lyricsTransitionEnabled);
  // console.log('🎵 lyricsScale', lyricsScale);
  // console.log('🎵 showLyrics', showLyrics);

  const handleAudioPlay = useCallback(async () => {
    console.log('🎵 handleAudioPlay called - Ultrastar audio started playing:', {
      songId: currentSong?.id,
      title: currentSong?.title,
      gap: globalUltrastarData?.gap,
      audioCurrentTime: audioRef.current?.currentTime
    });

    // Reset lyrics container height to 0 at video start
    // console.log('lyrics scale from handleAudioPlay');
    // setLyricsScale(0);
    setShowLyrics1(false);
    setShowLyrics2(false);
    setPlaying(true);
    setIsPlaying(true);

    // Start Ultrastar timing now that audio is actually playing
    if (ultrastarData && ultrastarData.audioUrl && ultrastarData.bpm > 0) {
      console.log('🎵 handleAudioPlay: Starting Ultrastar timing now that audio is playing');
      const fadeOutIndices = analyzeFadeOutLines(ultrastarData);
      startUltrastarTiming(ultrastarData, fadeOutIndices);
    }

    // Sync video with audio
    if (videoRef.current && ultrastarData?.videoUrl) {
      videoRef.current.muted = true;
      videoRef.current.currentTime = ultrastarData.videogap;
      videoRef.current.play().catch(console.error);
    }
  }, [ultrastarData, ultrastarData?.gap, currentSong?.id, currentSong?.title, setShowLyrics1, setShowLyrics2, startUltrastarTiming, analyzeFadeOutLines]);

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

  // Control button handlers
  const handlePreviousSong = useCallback(async () => {
    console.log('⏮️ ShowView previous song button clicked');

    // Send action to admin dashboard
    websocketService.emit('show-action', {
      action: 'previous-song',
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
      await playlistAPI.previousSong();
    } catch (error) {
      console.error('Error moving to previous song:', error);
    }
  }, [currentSong]);

  const handleTogglePlayPause = useCallback(async () => {
    // Mark that user has interacted (allows autoplay for future songs)
    setHasUserInteracted(true);

    console.log('⏯️ ShowView play/pause button clicked');

    // Send action to admin dashboard
    websocketService.emit('show-action', {
      action: 'toggle-play-pause',
      timestamp: new Date().toISOString(),
      currentSong: currentSong ? {
        id: currentSong.id,
        artist: currentSong.artist,
        title: currentSong.title,
        mode: currentSong.mode
      } : null,
      isPlaying: !isPlaying
    });

    try {
      const { playlistAPI } = await import('../../services/api');
      await playlistAPI.togglePlayPause();
    } catch (error) {
      console.error('Error toggling play/pause:', error);
    }
  }, [currentSong, isPlaying]);

  const handleRestartSong = useCallback(async () => {
    // Mark that user has interacted (allows autoplay for future songs)
    setHasUserInteracted(true);

    console.log('🔄 ShowView restart button clicked, currentSong:', currentSong);
    console.log('🔄 Audio ref:', audioRef.current);
    console.log('🔄 Video ref:', videoRef.current);
    console.log('🔄 Ultrastar data:', ultrastarData);

    // Handle local restart logic first
    if (currentSong?.mode === 'ultrastar' && audioRef.current && ultrastarData) {
      console.log('🎤 Ultrastar restart via ShowView button');

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
        console.log('🎬 Ultrastar video restart via ShowView button');
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
        console.log('🎤 Restarting complete Ultrastar timing');
        startUltrastarTiming(ultrastarData, new Set());
      }, 100); // Small delay to ensure audio is playing
    } else if (currentSong?.mode === 'youtube') {
      console.log('📺 YouTube restart via ShowView button');
      // YouTube embed - restart by reloading iframe
      setYoutubeCurrentTime(0);
      setIframeKey(prev => prev + 1);
      setYoutubeIsPaused(false);
    } else if (currentSong?.mode !== 'ultrastar' && videoRef.current) {
      console.log('🎬 Video restart via ShowView button');
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
      console.log('🎬 Server/File/YouTube-Cache video restart via ShowView button');
      if (videoRef.current) {
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
      } else {
        console.log('❌ Video ref is null for server/file/youtube-cache video');
      }
    } else {
      console.log('❌ No restart logic executed - conditions not met');
      console.log('❌ Mode:', currentSong?.mode);
      console.log('❌ Has audioRef:', !!audioRef.current);
      console.log('❌ Has videoRef:', !!videoRef.current);
      console.log('❌ Has ultrastarData:', !!ultrastarData);
    }

    // Send action to admin dashboard
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
    } catch (error) {
      console.error('Error restarting song:', error);
    }
  }, [currentSong, ultrastarData, startUltrastarTiming]);

  const handleNextSong = useCallback(async () => {
    // Mark that user has interacted (allows autoplay for future songs)
    setHasUserInteracted(true);

    console.log('⏭️ ShowView next song button clicked');

    // Send action to admin dashboard
    websocketService.emit('show-action', {
      action: 'next-song',
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
      await playlistAPI.nextSong();
    } catch (error) {
      console.error('Error moving to next song:', error);
    }
  }, [currentSong]);

  const handleStartButtonClick = useCallback(async () => {
    console.log('🎬 Start button clicked - restarting current song');

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
      console.log('🎬 Song restart API call sent');
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
      setShowLyrics1(false);
      setShowLyrics2(false);
      // setIsFadeOutMode(false);
      // setFadeOutLineIndex(null);
      // setFadeOutLineIndices(new Set());
      setIsPlaying(false);
      setIsApiLoadedSong(false); // Reset API-loaded flag
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
      <ProgressOverlay $isVisible={progressVisible1} $isUltrastar={isUltrastar} $isSecond={false}>
        <ProgressBarContainer $isUltrastar={isUltrastar}>
          <ProgressBarFill $progress={progressValue1} />
        </ProgressBarContainer>
      </ProgressOverlay>
      {isDuet && (
        <ProgressOverlay $isVisible={progressVisible2} $isUltrastar={isUltrastar} $isSecond={true}>
          <ProgressBarContainer $isUltrastar={isUltrastar}>
            <ProgressBarFill $progress={progressValue2} />
          </ProgressBarContainer>
        </ProgressOverlay>
      )}

      {/* QR Code Overlay */}
      <Overlay
        show={showQRCodeOverlay}
        overlayTitle={overlayTitle}
        currentSong={currentSong}
        nextSongs={nextSongs}
        qrCodeUrl={qrCodeUrl}
      />

      {/* Start Overlay */}
      <StartOverlay $isVisible={showStartOverlay}>
        <StartTitle>🎤 Karaoke</StartTitle>
        <StartButton onClick={handleStartButtonClick}>
          START
        </StartButton>
      </StartOverlay>
    </ShowContainer>
  );
};

export default ShowView;
