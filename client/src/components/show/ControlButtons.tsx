import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  ButtonsContainer,
} from './style';
import Button from '../shared/Button';
import websocketService from '../../services/websocket';

interface ControlButtonsProps {
  currentSong: any;
  isPlaying: boolean;
  setHasUserInteracted: (hasUserInteracted: boolean) => void;
  audioRef: React.RefObject<HTMLAudioElement>;
  videoRef: React.RefObject<HTMLVideoElement>;
  ultrastarData: any;
  startUltrastarTiming: (ultrastarData: any, fadeOutLineIndices: Set<number>[]) => void;
  setYoutubeCurrentTime: (youtubeCurrentTime: number) => void;
  setIframeKey: React.Dispatch<React.SetStateAction<number>>;
  setYoutubeIsPaused: (youtubeIsPaused: boolean) => void;
  setIsPlaying: (isPlaying: boolean) => void;
}

const buttonStyle = {
  background: 'rgba(0, 0, 0, 0.7)',
  color: 'white',
  border: '2px solid rgba(255, 255, 255, 0.3)',
  minWidth: '40px',
  height: '40px',
  padding: '0',
  fontVariantEmoji: 'text' as const
};

function getUltrastarPlaybackStartSeconds(data: { preGapSeconds?: number; postGapSeconds?: number }, mediaDurationSec: number): number {
  const pre =
    typeof data.preGapSeconds === 'number' && Number.isFinite(data.preGapSeconds)
      ? Math.max(0, data.preGapSeconds)
      : 0;
  const post =
    typeof data.postGapSeconds === 'number' && Number.isFinite(data.postGapSeconds)
      ? Math.max(0, data.postGapSeconds)
      : 0;
  if (pre <= 0) return 0;
  if (Number.isFinite(mediaDurationSec) && mediaDurationSec > 0) {
    return Math.min(pre, Math.max(0, mediaDurationSec - post - 0.05));
  }
  return pre;
}

function getUltrastarVideoTimeForAudioTime(
  data: { gap?: number; videogap?: number; preGapSeconds?: number },
  audioTimeSec: number
): number {
  const pre =
    typeof data.preGapSeconds === 'number' && Number.isFinite(data.preGapSeconds)
      ? Math.max(0, data.preGapSeconds)
      : 0;
  if (pre > 0) {
    return audioTimeSec;
  }
  const gapSec = (data.gap || 0) / 1000;
  const vg = data.videogap;
  if (vg === undefined || vg === null) {
    return audioTimeSec;
  }
  if (audioTimeSec < gapSec) {
    return vg;
  }
  return audioTimeSec - gapSec + vg;
}

function clampVideoTimeToDuration(videoEl: HTMLVideoElement, t: number): number {
  if (!Number.isFinite(t)) return 0;
  const d = videoEl.duration;
  if (Number.isFinite(d) && d > 0) {
    return Math.min(Math.max(0, t), Math.max(0, d - 0.04));
  }
  return Math.max(0, t);
}

const ControlButtons: React.FC<ControlButtonsProps> = ({
  currentSong,  
  isPlaying,
  setHasUserInteracted,
  audioRef,
  videoRef,
  ultrastarData,
  startUltrastarTiming,
  setYoutubeCurrentTime,
  setIframeKey,
  setYoutubeIsPaused,
  setIsPlaying,
}) => {
  const { t } = useTranslation();
  
  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  const handleRestartSong = useCallback(async () => {
    // Mark that user has interacted (allows autoplay for future songs)
    setHasUserInteracted(true);
    
    console.log('🔄 ShowView restart button clicked, currentSong:', currentSong);
    console.log('🔄 Audio ref:', audioRef.current);
    console.log('🔄 Video ref:', videoRef.current);
    console.log('🔄 Ultrastar data:', ultrastarData);
    
    // Handle local restart logic first
    if ((currentSong?.mode === 'ultrastar' || currentSong?.mode === 'magic-youtube') && audioRef.current && ultrastarData) {
      console.log('🎤 Ultrastar restart via ShowView button');
      
      const audioDur = audioRef.current.duration;
      const audioStart = getUltrastarPlaybackStartSeconds(ultrastarData, audioDur);
      console.log('🎵 Audio currentTime before:', audioRef.current.currentTime);
      audioRef.current.currentTime = audioStart;
      console.log('🎵 Audio currentTime after:', audioRef.current.currentTime);
      audioRef.current.play().then(() => {
        console.log('🎵 Audio play() successful');
      }).catch(error => {
        console.error('🎵 Error restarting playback:', error);
      });
      
      if (videoRef.current) {
        console.log('🎬 Ultrastar video restart via ShowView button');
        const vT = clampVideoTimeToDuration(
          videoRef.current,
          getUltrastarVideoTimeForAudioTime(ultrastarData, audioRef.current.currentTime)
        );
        videoRef.current.currentTime = vT;
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
        startUltrastarTiming(ultrastarData, [new Set<number>()]);
      }, 100); // Small delay to ensure audio is playing
    } else if (currentSong?.mode === 'youtube') {
      console.log('📺 YouTube restart via ShowView button');
      // YouTube embed - restart by reloading iframe
      setYoutubeCurrentTime(0);
      setIframeKey((prev: number) => prev + 1);
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

  if (isFullscreen) {
    return null;
  }

  return (
    <ButtonsContainer>
      <Button 
        onClick={(e) => {
          e.stopPropagation();
          handlePreviousSong();
        }}
        title={t('showView.previousSong')}
        size="small"
        style={buttonStyle}
      >
        ⏮️
      </Button>
      <Button 
        onClick={(e) => {
          e.stopPropagation();
          handleTogglePlayPause();
        }}
        title={t('showView.pausePlay')}
        size="small"
        style={{
          ...buttonStyle,
          ...(isPlaying ? {} : {
            background: 'rgba(0, 0, 0, 0.35)',
            color: '#bbbbbb',
            filter: 'grayscale(100%)',
            opacity: 0.6,
            border: '2px solid rgba(255, 255, 255, 0.15)'
          })
        }}
        disabled={!isPlaying}
      >
        ⏸️
      </Button>
      <Button 
        onClick={(e) => {
          e.stopPropagation();
          handleRestartSong();
        }}
        size="small"
        style={buttonStyle}
        title={t('showView.restartSong')}
      >
        🔄
      </Button>
      <Button 
        onClick={(e) => {
          e.stopPropagation();
          handleNextSong();
        }}
        size="small"
        style={buttonStyle}
        title={t('showView.nextSong')}
      >
        ⏭️
      </Button>
      <Button 
        onClick={(e) => {
          e.stopPropagation();
          toggleFullscreen();
        }} 
        size="small" 
        style={buttonStyle}
        title={t('showView.fullscreen')}
      >
        ⤢
      </Button>
    </ButtonsContainer>
  );
};

export default ControlButtons;


