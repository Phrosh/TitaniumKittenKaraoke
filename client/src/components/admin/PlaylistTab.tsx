import React from 'react';
import styled from 'styled-components';
import { Song } from '../../types';

// Styled Components für PlaylistTab
const PlaylistContainer = styled.div`
  background: transparent;
  border-radius: 0;
  padding: 0;
  box-shadow: none;
`;

const PlaylistHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const ControlButtons = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;

const CenterButtons = styled.div`
  display: flex;
  gap: 15px;
  justify-content: center;
`;

const RightButtons = styled.div`
  display: flex;
  gap: 8px;
`;

const ControlButtonGroup = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const ControlButton = styled.button`
  background: #34495e;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1.2rem;
  transition: all 0.3s ease;
  min-width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover:not(:disabled) {
    background: #2c3e50;
    transform: translateY(-1px);
  }

  &:disabled {
    background: #bdc3c7;
    cursor: not-allowed;
    transform: none;
  }
`;

const SmallButton = styled.button<{ variant?: 'primary' | 'success' | 'danger' }>`
  background: ${props => 
    props.variant === 'success' ? '#27ae60' :
    props.variant === 'danger' ? '#e74c3c' :
    '#667eea'
  };
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    opacity: 0.9;
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
    transform: none;
  }
`;

const Button = styled.button<{ variant?: 'primary' | 'success' | 'danger' }>`
  background: ${props => 
    props.variant === 'success' ? '#27ae60' :
    props.variant === 'danger' ? '#e74c3c' :
    '#667eea'
  };
  color: white;
  border: none;
  padding: 15px 25px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 1rem;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    opacity: 0.9;
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
    transform: none;
  }
`;

const QRCodeToggleButton = styled.button<{ $active: boolean }>`
  background: ${props => props.$active ? '#8e44ad' : '#95a5a6'};
  color: white;
  border: none;
  padding: 15px 25px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background-color 0.2s;

  &:hover {
    background: ${props => props.$active ? '#7d3c98' : '#7f8c8d'};
  }
`;

const SongItem = styled.div<{ $isCurrent?: boolean; $hasNoYoutube?: boolean; $isPast?: boolean; $isDragging?: boolean; $isDropTarget?: boolean }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border-radius: 8px;
  margin: 10px 0;
  background: ${props => 
    props.$isCurrent ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.25) 0%, rgba(118, 75, 162, 0.25) 100%)' :
    props.$isPast ? '#f8f9fa' :
    props.$hasNoYoutube ? '#fff3cd' :
    'white'
  };
  border: ${props => 
    props.$isCurrent ? '2px solid #667eea' :
    props.$isDropTarget ? '2px dashed #667eea' :
    '1px solid #e9ecef'
  };
  box-shadow: ${props => 
    props.$isCurrent ? '0 4px 12px rgba(102, 126, 234, 0.3)' :
    props.$isDragging ? '0 8px 25px rgba(0, 0, 0, 0.15)' :
    '0 2px 8px rgba(0, 0, 0, 0.1)'
  };
  transition: all 0.3s ease;
  cursor: ${props => props.$isDragging ? 'grabbing' : 'grab'};
  opacity: ${props => props.$isDragging ? 0.7 : 1};
  transform: ${props => props.$isDragging ? 'rotate(2deg)' : 'none'};

  &:hover {
    transform: ${props => props.$isDragging ? 'rotate(2deg)' : 'translateY(-2px)'};
    box-shadow: ${props => 
      props.$isCurrent ? '0 6px 20px rgba(102, 126, 234, 0.4)' :
      '0 4px 15px rgba(0, 0, 0, 0.15)'
    };
  }
`;

const DragHandle = styled.div`
  cursor: grab;
  padding: 8px;
  color: rgba(0, 0, 0, 0.4);
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s ease;
  user-select: none;

  &:hover {
    background: rgba(0, 0, 0, 0.1);
    color: rgba(0, 0, 0, 0.6);
  }

  &:active {
    cursor: grabbing;
  }
`;

const PositionBadge = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 100%;
  color: #6c757d;
  font-size: 1.1rem;
  font-weight: 600;
  font-family: monospace;
`;

const SongContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SongName = styled.div<{ $isCurrent?: boolean }>`
  font-size: 1.1rem;
  font-weight: 600;
  color: ${props => props.$isCurrent ? '#5a6fd8' : '#333'};
  display: flex;
  align-items: center;
  gap: 8px;
`;

const DeviceId = styled.span<{ $isCurrent?: boolean }>`
  font-size: 0.85rem;
  color: ${props => props.$isCurrent ? '#5a6fd8' : '#666'};
  background: ${props => props.$isCurrent ? 'rgba(90, 111, 216, 0.1)' : '#f0f0f0'};
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.$isCurrent ? 'rgba(90, 111, 216, 0.2)' : '#e0e0e0'};
  }
`;

const SongTitleRow = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
`;

const ModeBadge = styled.div<{ $mode: 'youtube' | 'server_video' | 'file' | 'ultrastar' | 'youtube_cache' }>`
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: ${props => {
    switch (props.$mode) {
      case 'youtube': return '#ff4444';
      case 'server_video': return '#28a745';
      case 'file': return '#007bff';
      case 'ultrastar': return '#ffc107';
      case 'youtube_cache': return '#17a2b8';
      default: return '#6c757d';
    }
  }};
  color: white;
  min-width: 40px;
  text-align: center;
`;

const HP5Badge = styled.div`
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  margin-left: 8px;
  background: #ff6b35;
  color: white;
  min-width: 40px;
  text-align: center;
`;

const DownloadStatusBadge = styled.div<{ $status: 'downloading' | 'downloaded' | 'cached' | 'failed' | 'none' }>`
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  margin-left: 8px;
  min-width: 80px;
  text-align: center;
  background: ${props => {
    switch (props.$status) {
      case 'downloading': return '#ffc107';
      case 'downloaded': return '#28a745';
      case 'cached': return '#17a2b8';
      case 'failed': return '#dc3545';
      default: return '#6c757d';
    }
  }};
  color: white;
`;

const SongTitle = styled.div<{ $isCurrent?: boolean }>`
  flex: 1;
  font-size: 0.95rem;
  color: ${props => props.$isCurrent ? '#5a6fd8' : '#666'};
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
  user-select: text;
  display: flex;
  align-items: center;
  gap: 8px;

  &:hover {
    background: rgba(0, 0, 0, 0.05);
  }
`;

const YouTubeField = styled.input`
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.9rem;
  background: white;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
  }
`;

const SongActions = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const Badge = styled.div<{ type: 'current' | 'past' | 'future' }>`
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: ${props => {
    switch (props.type) {
      case 'current': return '#667eea';
      case 'past': return '#95a5a6';
      case 'future': return '#3498db';
      default: return '#6c757d';
    }
  }};
  color: white;
`;

const DropZone = styled.div<{ $isVisible: boolean }>`
  height: 4px;
  background: ${props => props.$isVisible ? '#667eea' : 'transparent'};
  border-radius: 2px;
  margin: 5px 0;
  transition: all 0.2s ease;
`;

interface PlaylistTabProps {
  filteredPlaylist: Song[];
  currentSong: Song | null;
  showPastSongs: boolean;
  showQRCodeOverlay: boolean;
  actionLoading: boolean;
  isPlaying: boolean;
  draggedItem: number | null;
  dropTarget: number | null;
  youtubeLinks: { [key: number]: string };
  onOpenAddSongModal: () => void;
  onToggleQRCodeOverlay: (show: boolean) => void;
  onPreviousSong: () => void;
  onTogglePlayPause: () => void;
  onRestartSong: () => void;
  onNextSong: () => void;
  onSetShowPastSongs: (show: boolean) => void;
  onClearAllSongs: () => void;
  onDragStart: (e: React.DragEvent, songId: number) => void;
  onDragOver: (e: React.DragEvent, songId: number) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetSongId: number) => void;
  onCopyToClipboard: (song: Song) => void;
  onYouTubeFieldChange: (songId: number, value: string) => void;
  onYouTubeFieldBlur: (songId: number, value: string) => void;
  onPlaySong: (songId: number) => void;
  onOpenModal: (song: Song, type: 'edit' | 'youtube') => void;
  onRefreshClassification: (songId: number) => void;
  onDeleteSong: (songId: number) => void;
  onDeviceIdClick: (deviceId: string) => void;
  isSongInYouTubeCache: (song: Song) => boolean;
  getDownloadStatusText: (status: string | undefined) => string;
}

const PlaylistTab: React.FC<PlaylistTabProps> = ({
  filteredPlaylist,
  currentSong,
  showPastSongs,
  showQRCodeOverlay,
  actionLoading,
  isPlaying,
  draggedItem,
  dropTarget,
  youtubeLinks,
  onOpenAddSongModal,
  onToggleQRCodeOverlay,
  onPreviousSong,
  onTogglePlayPause,
  onRestartSong,
  onNextSong,
  onSetShowPastSongs,
  onClearAllSongs,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onCopyToClipboard,
  onYouTubeFieldChange,
  onYouTubeFieldBlur,
  onPlaySong,
  onOpenModal,
  onRefreshClassification,
  onDeleteSong,
  onDeviceIdClick,
  isSongInYouTubeCache,
  getDownloadStatusText
}) => {
  return (
    <PlaylistContainer>
      <PlaylistHeader>
        <ControlButtons>
          <div>
            <Button 
              onClick={onOpenAddSongModal}
              style={{ background: '#28a745', marginRight: '15px' }}
            >
              ➕ Song Hinzufügen
            </Button>
          </div>
          <CenterButtons>
            <QRCodeToggleButton 
              $active={showQRCodeOverlay}
              onClick={() => onToggleQRCodeOverlay(!showQRCodeOverlay)}
            >
              📱 {showQRCodeOverlay ? 'Overlay ausblenden' : 'Overlay anzeigen'}
            </QRCodeToggleButton>
            
            {/* Control Buttons */}
            <ControlButtonGroup>
              <ControlButton 
                onClick={onPreviousSong}
                disabled={actionLoading}
                title="Zurück"
              >
                ⏮️
              </ControlButton>
              <ControlButton 
                onClick={onTogglePlayPause}
                disabled={actionLoading}
                title="Pause/Play"
              >
                {isPlaying ? '⏸️' : '▶️'}
              </ControlButton>
              <ControlButton 
                onClick={onRestartSong}
                disabled={actionLoading}
                title="Song neu starten"
              >
                🔄
              </ControlButton>
            </ControlButtonGroup>
            
            <Button 
              variant="success" 
              onClick={onNextSong}
              disabled={actionLoading}
            >
              ⏭️ Weiter
            </Button>
          </CenterButtons>
          <RightButtons>
            <SmallButton 
              onClick={() => onSetShowPastSongs(!showPastSongs)}
            >
              📜 {showPastSongs ? 'Vergangene ausblenden' : 'Vergangene anzeigen'}
            </SmallButton>
            <SmallButton 
              variant="danger" 
              onClick={onClearAllSongs}
              disabled={actionLoading}
            >
              🗑️ Liste Leeren
            </SmallButton>
          </RightButtons>
        </ControlButtons>
      </PlaylistHeader>

      {filteredPlaylist.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          Keine Songs in der Playlist
        </div>
      ) : (
        <div>
          {filteredPlaylist.map((song, index) => {
            const isCurrent = currentSong?.id === song.id;
            const isPast = currentSong && song.position < currentSong.position;
            const isDragging = draggedItem === song.id;
            const isDropTarget = dropTarget === song.id;
            const showDropZoneAbove = draggedItem && dropTarget === song.id && draggedItem !== song.id;
            
            return (
              <React.Fragment key={song.id}>
                {showDropZoneAbove && (
                  <DropZone $isVisible={true} />
                )}
                
                <SongItem 
                  $isCurrent={isCurrent}
                  $hasNoYoutube={song.mode === 'youtube' && !song.youtube_url}
                  $isPast={isPast}
                  $isDragging={isDragging}
                  $isDropTarget={isDropTarget}
                  draggable
                  onDragStart={(e) => onDragStart(e, song.id)}
                  onDragOver={(e) => onDragOver(e, song.id)}
                  onDragLeave={onDragLeave}
                  onDrop={(e) => onDrop(e, song.id)}
                >
                  <DragHandle>
                    ⋮⋮⋮
                  </DragHandle>
                  
                  <PositionBadge>
                    #{song.position}
                  </PositionBadge>
                  
                  <SongContent>
                    <SongName $isCurrent={song.id === currentSong?.id}>
                      {song.user_name}
                      <DeviceId 
                        $isCurrent={song.id === currentSong?.id}
                        onClick={() => onDeviceIdClick(song.device_id)}
                        title="Klicken um zur Banlist hinzuzufügen"
                      >
                        📱 {song.device_id}
                      </DeviceId>
                    </SongName>
                    <SongTitleRow>
                      <SongTitle 
                        $isCurrent={song.id === currentSong?.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onCopyToClipboard(song);
                        }}
                      >
                        {song.artist ? `${song.artist} - ${song.title}` : song.title}
                        {song.modes ? (
                          song.modes.map((mode, index) => (
                            <React.Fragment key={index}>
                              {mode === 'ultrastar' && song.with_background_vocals && (
                                <HP5Badge>🎤 BG Vocals</HP5Badge>
                              )}
                              <ModeBadge $mode={mode}>
                                {mode === 'server_video' ? '🟢 Server' : 
                                 mode === 'file' ? '🔵 Datei' : 
                                 mode === 'ultrastar' ? '⭐ Ultrastar' : 
                                 mode === 'youtube_cache' ? '🎬 YouTube Cache' : '🔴 YouTube'}
                              </ModeBadge>
                            </React.Fragment>
                          ))
                        ) : (
                          <>
                            {(song.mode || 'youtube') === 'ultrastar' && song.with_background_vocals && (
                              <HP5Badge>🎤 BG Vocals</HP5Badge>
                            )}
                            <ModeBadge $mode={song.mode || 'youtube'}>
                              {song.mode === 'server_video' ? '🟢 Server' : 
                               song.mode === 'file' ? '🔵 Datei' : 
                               song.mode === 'ultrastar' ? '⭐ Ultrastar' : 
                               song.mode === 'youtube_cache' ? '🎬 YouTube Cache' : '🔴 YouTube'}
                            </ModeBadge>
                          </>
                        )}
                      </SongTitle>
                      {(song.mode || 'youtube') === 'youtube' && !isSongInYouTubeCache(song) && song.status !== 'downloading' && song.download_status !== 'downloading' && song.download_status !== 'downloaded' && song.download_status !== 'cached' && (
                        <YouTubeField
                          type="url"
                          placeholder="YouTube-Link hier eingeben..."
                          value={youtubeLinks[song.id] !== undefined ? youtubeLinks[song.id] : (song.youtube_url || '')}
                          onChange={(e) => onYouTubeFieldChange(song.id, e.target.value)}
                          onBlur={(e) => onYouTubeFieldBlur(song.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              onYouTubeFieldBlur(song.id, e.currentTarget.value);
                            }
                          }}
                        />
                      )}
                      {(song.download_status && song.download_status !== 'none') || (song.status && song.status !== 'ready') && (
                        <DownloadStatusBadge $status={(song.status || song.download_status) as 'downloading' | 'downloaded' | 'cached' | 'failed' | 'none'}>
                          {getDownloadStatusText(song.status || song.download_status)}
                        </DownloadStatusBadge>
                      )}
                      {((song.mode || 'youtube') === 'youtube' && isSongInYouTubeCache(song)) || song.modes?.includes('youtube_cache') && (
                        <div style={{ 
                          padding: '8px 12px', 
                          backgroundColor: '#e8f5e8', 
                          border: '1px solid #4caf50', 
                          borderRadius: '6px', 
                          fontSize: '0.9rem',
                          color: '#2e7d32',
                          fontWeight: '500'
                        }}>
                          ✅ Im YouTube-Cache verfügbar
                        </div>
                      )}
                    </SongTitleRow>
                  </SongContent>
                  
                  <SongActions>
                    {currentSong?.id === song.id && (
                      <Badge type="current">
                        🎤 AKTUELL
                      </Badge>
                    )}
                    
                    <Button 
                      variant="success"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlaySong(song.id);
                      }}
                      disabled={actionLoading}
                    >
                      ▶️
                    </Button>
                    
                    <Button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenModal(song, 'edit');
                      }}
                      disabled={actionLoading}
                    >
                      ✏️
                    </Button>
                    
                    <Button 
                      variant="primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRefreshClassification(song.id);
                      }}
                      disabled={actionLoading}
                      title="Song-Klassifizierung aktualisieren (prüft auf lokale Dateien)"
                    >
                      🔄
                    </Button>
                    
                    <Button 
                      variant="danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSong(song.id);
                      }}
                      disabled={actionLoading}
                    >
                      🗑️
                    </Button>
                  </SongActions>
                </SongItem>
                
                {index === filteredPlaylist.length - 1 && draggedItem && !dropTarget && (
                  <DropZone $isVisible={true} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </PlaylistContainer>
  );
};

export default PlaylistTab;
