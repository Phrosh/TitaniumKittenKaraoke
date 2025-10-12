import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { adminAPI } from '../../../services/api';
import toast from 'react-hot-toast';
import styled from 'styled-components';
import { SettingsSection, SettingsTitle, SettingsLabel, SettingsDescription, SettingsRow } from '../style';

const SettingsCheckbox = styled.input`
  margin-right: 10px;
  transform: scale(1.2);
`;

const SettingsButton = styled.button`
  background: #3498db;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover:not(:disabled) {
    background: #2980b9;
    transform: translateY(-1px);
  }

  &:disabled {
    background: #bdc3c7;
    cursor: not-allowed;
    transform: none;
  }
`;

const SettingsButtonGroup = styled.div`
  display: flex;
  gap: 10px;
`;

const SongList = styled.div`
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #ddd;
  border-radius: 6px;
  margin: 15px 0;
`;

const SongItem = styled.div`
  display: flex;
  align-items: center;
  padding: 10px 15px;
  border-bottom: 1px solid #eee;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: #f8f9fa;
  }

  &:last-child {
    border-bottom: none;
  }
`;

const SongName = styled.span`
  font-size: 1rem;
  color: #333;
  margin-left: 10px;
  width: 200px;
`;

const SongCheckbox = styled.input`
  transform: scale(1.2);
`;

const VolumeSlider = styled.input`
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: #ddd;
  outline: none;
  -webkit-appearance: none;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #3498db;
    cursor: pointer;
  }

  &::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #3498db;
    cursor: pointer;
    border: none;
  }
`;

const VolumeValue = styled.span`
  font-weight: 600;
  color: #333;
  min-width: 40px;
  text-align: right;
`;

const PlayButton = styled.button`
  background: #27ae60;
  color: white;
  border: none;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-left: 10px;
  min-width: 60px;

  &:hover {
    background: #229954;
    transform: translateY(-1px);
  }

  &:disabled {
    background: #bdc3c7;
    cursor: not-allowed;
    transform: none;
  }
`;

const AudioPlayer = styled.div`
  background: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 15px;
  margin: 15px 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const AudioPlayerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
`;

const AudioPlayerTitle = styled.span`
  font-weight: 600;
  color: #333;
  font-size: 1rem;
`;

const AudioPlayerControls = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const AudioPlayerButton = styled.button`
  background: #3498db;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #2980b9;
  }

  &:disabled {
    background: #bdc3c7;
    cursor: not-allowed;
  }
`;

const SeekSlider = styled.input`
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: #ddd;
  outline: none;
  -webkit-appearance: none;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #3498db;
    cursor: pointer;
  }

  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #3498db;
    cursor: pointer;
    border: none;
  }
`;

const TimeDisplay = styled.span`
  font-size: 0.9rem;
  color: #666;
  min-width: 80px;
  text-align: center;
`;

interface BackgroundMusicSong {
  filename: string;
  name: string;
  url: string;
}

interface BackgroundMusicSettings {
  enabled: boolean;
  volume: number;
  selectedSongs: string[];
}

const BackgroundMusicTab: React.FC = () => {
  const { t } = useTranslation();
  const [songs, setSongs] = useState<BackgroundMusicSong[]>([]);
  const [settings, setSettings] = useState<BackgroundMusicSettings>({
    enabled: true,
    volume: 0.3,
    selectedSongs: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Preview audio state
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [songsResponse, settingsResponse] = await Promise.all([
        adminAPI.getBackgroundMusicSongs(),
        adminAPI.getBackgroundMusicSettings()
      ]);
      
      setSongs(songsResponse.data.songs);
      setSettings(settingsResponse.data.settings);
    } catch (error) {
      console.error('Error loading background music data:', error);
      toast.error(t('backgroundMusic.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      await adminAPI.updateBackgroundMusicSettings(settings);
      toast.success(t('backgroundMusic.settingsSaved'));
    } catch (error) {
      console.error('Error saving background music settings:', error);
      toast.error(t('backgroundMusic.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = () => {
    setSettings(prev => ({ ...prev, enabled: !prev.enabled }));
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(event.target.value);
    setSettings(prev => ({ ...prev, volume }));
  };

  const handleSongToggle = (filename: string) => {
    setSettings(prev => {
      const newSelectedSongs = prev.selectedSongs.includes(filename)
        ? prev.selectedSongs.filter(song => song !== filename)
        : [...prev.selectedSongs, filename];
      
      return { ...prev, selectedSongs: newSelectedSongs };
    });
  };

  const handleSelectAll = () => {
    setSettings(prev => ({ ...prev, selectedSongs: songs.map(song => song.filename) }));
  };

  const handleSelectNone = () => {
    setSettings(prev => ({ ...prev, selectedSongs: [] }));
  };

  // Audio preview functions
  const playPreview = useCallback((song: BackgroundMusicSong) => {
    // Stop current preview if playing
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
    }

    // Create new audio element
    const audio = new Audio(song.url);
    audio.volume = settings.volume;
    audio.loop = false;
    
    // Set up event listeners
    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
    });
    
    audio.addEventListener('timeupdate', () => {
      if (!isDragging) {
        setCurrentTime(audio.currentTime);
      }
    });
    
    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentTime(0);
      setCurrentlyPlaying(null);
    });
    
    audio.addEventListener('play', () => {
      setIsPlaying(true);
    });
    
    audio.addEventListener('pause', () => {
      setIsPlaying(false);
    });

    // Play the audio
    audio.play().then(() => {
      setPreviewAudio(audio);
      setCurrentlyPlaying(song.filename);
      setIsPlaying(true);
    }).catch(error => {
      console.error('Error playing preview:', error);
    });
  }, [previewAudio, settings.volume, isDragging]);

  const stopPreview = useCallback(() => {
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
      setPreviewAudio(null);
      setCurrentlyPlaying(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [previewAudio]);

  const togglePlayPause = useCallback(() => {
    if (!previewAudio) return;
    
    if (isPlaying) {
      previewAudio.pause();
    } else {
      previewAudio.play().catch(error => {
        console.error('Error resuming preview:', error);
      });
    }
  }, [previewAudio, isPlaying]);

  const handleSeek = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(event.target.value);
    setCurrentTime(newTime);
    
    if (previewAudio) {
      previewAudio.currentTime = newTime;
    }
  }, [previewAudio]);

  const handleSeekStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleSeekEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Update audio volume when settings change
  useEffect(() => {
    if (previewAudio) {
      previewAudio.volume = settings.volume;
    }
  }, [previewAudio, settings.volume]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (previewAudio) {
        previewAudio.pause();
        previewAudio.currentTime = 0;
      }
    };
  }, [previewAudio]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isAllSelected = songs.length > 0 && settings.selectedSongs.length === songs.length;
  const isNoneSelected = settings.selectedSongs.length === 0;

  if (loading) {
    return (
      <SettingsSection>
        <SettingsTitle>{t('backgroundMusic.title')}</SettingsTitle>
        <div>{t('backgroundMusic.loading')}</div>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection>
      <SettingsTitle>{t('backgroundMusic.title')}</SettingsTitle>
      
      <SettingsSection>
        <SettingsDescription>
          {t('backgroundMusic.description')}
        </SettingsDescription>
        
        <SettingsRow>
          <SettingsLabel>
            <SettingsCheckbox
              type="checkbox"
              checked={settings.enabled}
              onChange={handleToggleEnabled}
            />
            {t('backgroundMusic.enabled')}
          </SettingsLabel>
        </SettingsRow>

        {settings.enabled && (
          <>
            <SettingsRow>
              <SettingsLabel>{t('backgroundMusic.volume')}</SettingsLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                <VolumeSlider
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.volume}
                  onChange={handleVolumeChange}
                />
                <VolumeValue>{Math.round(settings.volume * 100)}%</VolumeValue>
              </div>
            </SettingsRow>

            <SettingsRow>
              <SettingsLabel>{t('backgroundMusic.selectedSongs')}</SettingsLabel>
              <SettingsButtonGroup>
                <SettingsButton
                  type="button"
                  onClick={handleSelectAll}
                  disabled={isAllSelected}
                >
                  {t('backgroundMusic.selectAll')}
                </SettingsButton>
                <SettingsButton
                  type="button"
                  onClick={handleSelectNone}
                  disabled={isNoneSelected}
                >
                  {t('backgroundMusic.selectNone')}
                </SettingsButton>
              </SettingsButtonGroup>
            </SettingsRow>

            {/* Audio Player */}
            {currentlyPlaying && (
              <AudioPlayer>
                <AudioPlayerHeader>
                  <AudioPlayerTitle>
                    {t('backgroundMusic.nowPlaying')}: {songs.find(s => s.filename === currentlyPlaying)?.name}
                  </AudioPlayerTitle>
                  <AudioPlayerButton onClick={stopPreview}>
                    {t('backgroundMusic.stop')}
                  </AudioPlayerButton>
                </AudioPlayerHeader>
                
                <AudioPlayerControls>
                  <AudioPlayerButton onClick={togglePlayPause}>
                    {isPlaying ? '⏸️' : '▶️'}
                  </AudioPlayerButton>
                  
                  <TimeDisplay>{formatTime(currentTime)}</TimeDisplay>
                  
                  <SeekSlider
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    onMouseDown={handleSeekStart}
                    onMouseUp={handleSeekEnd}
                    onTouchStart={handleSeekStart}
                    onTouchEnd={handleSeekEnd}
                  />
                  
                  <TimeDisplay>{formatTime(duration)}</TimeDisplay>
                </AudioPlayerControls>
              </AudioPlayer>
            )}

            {/* <SongList> */}
              {songs.map(song => (
                <SongItem key={song.filename}>
                  <SongCheckbox
                    type="checkbox"
                    checked={settings.selectedSongs.includes(song.filename)}
                    onChange={() => handleSongToggle(song.filename)}
                  />
                  <SongName>{song.name}</SongName>
                  <PlayButton
                    onClick={() => playPreview(song)}
                    disabled={currentlyPlaying === song.filename && isPlaying}
                  >
                    {currentlyPlaying === song.filename && isPlaying ? '⏸️' : '▶️'}
                  </PlayButton>
                </SongItem>
              ))}
            {/* </SongList> */}

            {songs.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                {t('backgroundMusic.noSongsFound')}
              </div>
            )}
          </>
        )}

        <SettingsRow style={{ marginTop: '20px' }}>
          <SettingsButton
            type="button"
            onClick={handleSaveSettings}
            disabled={saving}
          >
            {saving ? t('backgroundMusic.saving') : t('backgroundMusic.save')}
          </SettingsButton>
        </SettingsRow>
      </SettingsSection>
    </SettingsSection>
  );
};

export default BackgroundMusicTab;
