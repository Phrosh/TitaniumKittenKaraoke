import React from 'react';
import styled from 'styled-components';

// Styled Components für SongsTab
const SettingsSection = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
`;

const SettingsTitle = styled.h3`
  color: #333;
  margin: 0 0 20px 0;
  font-size: 1.3rem;
  font-weight: 600;
`;

const SettingsCard = styled.div`
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid #e9ecef;
`;

const SettingsLabel = styled.label`
  display: block;
  font-weight: 600;
  margin-bottom: 10px;
  color: #333;
  font-size: 1rem;
`;

const SettingsInput = styled.input`
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: #3498db;
    box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
  }
`;

const SettingsDescription = styled.div`
  font-size: 0.9rem;
  color: #666;
  margin-top: 10px;
  line-height: 1.4;
`;

const TabButton = styled.button<{ $active: boolean; $color?: string }>`
  padding: 10px 20px;
  border: 2px solid;
  border-color: ${props => props.$active ? (props.$color || '#667eea') : '#e1e5e9'};
  background: ${props => props.$active ? (props.$color || '#667eea') : 'white'};
  color: ${props => props.$active ? 'white' : '#333'};
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.3s ease;
`;

const UsdbButton = styled.button`
  background: #6f42c1;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  justify-content: center;

  &:hover:not(:disabled) {
    background: #5a2d91;
    transform: translateY(-1px);
  }

  &:disabled {
    background: #6c757d;
    cursor: not-allowed;
    transform: none;
  }
`;

const SongItem = styled.div<{ $isInvisible: boolean }>`
  display: flex;
  align-items: center;
  padding: 12px;
  border: 1px solid #eee;
  border-radius: 6px;
  margin-bottom: 8px;
  background: ${props => props.$isInvisible ? '#f8f9fa' : '#fff'};
  opacity: ${props => props.$isInvisible ? 0.7 : 1};
  gap: 12px;
`;

const SongInfo = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 20px;
`;

const SongTitle = styled.div`
  flex: 1;
`;

const SongName = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
`;

const SongText = styled.div`
  font-weight: 600;
  font-size: 16px;
  color: #333;
  cursor: pointer;
  user-select: none;
`;

const ModeTags = styled.div`
  display: flex;
  gap: 4px;
`;

const ModeTag = styled.span<{ $color: string; $background: string }>`
  font-size: 12px;
  color: ${props => props.$color};
  background: ${props => props.$background};
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
`;

const ActionButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ActionButton = styled.button<{ $variant: 'success' | 'info' | 'warning' | 'danger' }>`
  font-size: 12px;
  padding: 6px 12px;
  background: ${props => 
    props.$variant === 'success' ? '#28a745' :
    props.$variant === 'info' ? '#17a2b8' :
    props.$variant === 'warning' ? '#ffc107' :
    '#dc3545'
  };
  color: ${props => props.$variant === 'warning' ? '#000' : 'white'};
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  opacity: 1;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: ${props => 
      props.$variant === 'success' ? '#218838' :
      props.$variant === 'info' ? '#138496' :
      props.$variant === 'warning' ? '#e0a800' :
      '#c82333'
    };
    transform: scale(1.05);
  }

  &:disabled {
    background: #6c757d;
    cursor: not-allowed;
    transform: none;
    opacity: 0.6;
  }
`;

const GroupHeader = styled.div`
  position: sticky;
  top: 0;
  background: #adb5bd;
  color: white;
  padding: 8px 15px;
  font-size: 16px;
  font-weight: bold;
  z-index: 10;
  border-bottom: 2px solid #9ca3af;
`;

const SongsList = styled.div`
  margin-top: 10px;
  max-height: 500px;
  overflow-y: auto;
`;

interface SongsTabProps {
  songs: any[];
  invisibleSongs: any[];
  songTab: 'all' | 'visible' | 'invisible';
  songSearchTerm: string;
  actionLoading: boolean;
  processingSongs: Set<string>;
  ultrastarAudioSettings: Record<string, string>;
  onSongTabChange: (tab: 'all' | 'visible' | 'invisible') => void;
  onSongSearchTermChange: (term: string) => void;
  onToggleSongVisibility: (song: any) => void;
  onStartProcessing: (song: any) => void;
  onTestSong: (song: any) => void;
  onOpenUsdbDialog: () => void;
  onRenameSong: (song: any) => void;
  onDeleteSongFromLibrary: (song: any) => void;
  onUltrastarAudioChange: (song: any, value: string) => void;
  hasMissingFiles: (song: any) => boolean;
  getFirstLetter: (text: string) => string;
}

const SongsTab: React.FC<SongsTabProps> = ({
  songs,
  invisibleSongs,
  songTab,
  songSearchTerm,
  actionLoading,
  processingSongs,
  ultrastarAudioSettings,
  onSongTabChange,
  onSongSearchTermChange,
  onToggleSongVisibility,
  onStartProcessing,
  onTestSong,
  onOpenUsdbDialog,
  onRenameSong,
  onDeleteSongFromLibrary,
  onUltrastarAudioChange,
  hasMissingFiles,
  getFirstLetter
}) => {
  const getVisibleSongsCount = () => {
    return songs.filter(song => !invisibleSongs.some(invisible => 
      invisible.artist.toLowerCase() === song.artist.toLowerCase() &&
      invisible.title.toLowerCase() === song.title.toLowerCase()
    )).length;
  };

  const getInvisibleSongsCount = () => {
    return songs.filter(song => invisibleSongs.some(invisible => 
      invisible.artist.toLowerCase() === song.artist.toLowerCase() &&
      invisible.title.toLowerCase() === song.title.toLowerCase()
    )).length;
  };

  const getFilteredSongs = () => {
    let filteredSongs = songs;
    
    // Apply tab filter
    if (songTab === 'visible') {
      filteredSongs = songs.filter(song => !invisibleSongs.some(invisible => 
        invisible.artist.toLowerCase() === song.artist.toLowerCase() &&
        invisible.title.toLowerCase() === song.title.toLowerCase()
      ));
    } else if (songTab === 'invisible') {
      filteredSongs = songs.filter(song => invisibleSongs.some(invisible => 
        invisible.artist.toLowerCase() === song.artist.toLowerCase() &&
        invisible.title.toLowerCase() === song.title.toLowerCase()
      ));
    }
    
    // Apply search filter
    filteredSongs = filteredSongs.filter(song => 
      !songSearchTerm || 
      song.title.toLowerCase().includes(songSearchTerm.toLowerCase()) ||
      song.artist?.toLowerCase().includes(songSearchTerm.toLowerCase())
    );
    
    return filteredSongs;
  };

  const getGroupedSongs = () => {
    const filteredSongs = getFilteredSongs();
    
    // Group songs by first letter of artist
    const groupedSongs = filteredSongs.reduce((groups, song) => {
      const letter = getFirstLetter(song.artist);
      if (!groups[letter]) {
        groups[letter] = [];
      }
      groups[letter].push(song);
      return groups;
    }, {} as Record<string, typeof filteredSongs>);
    
    return Object.keys(groupedSongs).sort();
  };

  const getCurrentTabCount = () => {
    switch (songTab) {
      case 'visible':
        return getVisibleSongsCount();
      case 'invisible':
        return getInvisibleSongsCount();
      default:
        return songs.length;
    }
  };

  const getCurrentTabLabel = () => {
    switch (songTab) {
      case 'visible':
        return `Eingeblendete Songs (${getVisibleSongsCount()}):`;
      case 'invisible':
        return `Ausgeblendete Songs (${getInvisibleSongsCount()}):`;
      default:
        return `Alle Songs (${songs.length}):`;
    }
  };

  return (
    <SettingsSection>
      <SettingsTitle>🎵 Songverwaltung</SettingsTitle>
      
      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        {/* Left column: Song management buttons and search */}
        <div style={{ flex: '1', minWidth: '0' }}>
          {/* Song Tabs */}
          <SettingsCard>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <TabButton
                $active={songTab === 'all'}
                onClick={() => onSongTabChange('all')}
              >
                Alle Songs ({songs.length})
              </TabButton>
              <TabButton
                $active={songTab === 'visible'}
                $color="#28a745"
                onClick={() => onSongTabChange('visible')}
              >
                Eingeblendete ({getVisibleSongsCount()})
              </TabButton>
              <TabButton
                $active={songTab === 'invisible'}
                $color="#dc3545"
                onClick={() => onSongTabChange('invisible')}
              >
                Ausgeblendete ({getInvisibleSongsCount()})
              </TabButton>
            </div>
            
            {/* Search songs */}
            <SettingsLabel>Songs durchsuchen:</SettingsLabel>
            <SettingsInput
              type="text"
              placeholder="Nach Song oder Interpret suchen..."
              value={songSearchTerm}
              onChange={(e) => onSongSearchTermChange(e.target.value)}
              style={{ marginBottom: '15px', width: '100%', maxWidth: '600px' }}
            />
            <SettingsDescription>
              Verwaltung aller verfügbaren Songs. Du kannst Songs unsichtbar machen, damit sie nicht in der öffentlichen Songliste (/new) erscheinen.
            </SettingsDescription>
          </SettingsCard>
        </div>
        
        {/* Right column: USDB Download */}
        <div style={{ flex: '0 0 350px', minWidth: '350px' }}>
          <SettingsCard>
            <SettingsLabel>USDB Song herunterladen:</SettingsLabel>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
              <UsdbButton
                type="button"
                onClick={onOpenUsdbDialog}
              >
                🌐 USDB Song laden
              </UsdbButton>
            </div>
            <SettingsDescription>
              Lade Songs direkt von der UltraStar Database (
              <a 
                href="https://usdb.animux.de" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: '#007bff', textDecoration: 'underline' }}
              >
                usdb.animux.de
              </a>
              ) herunter. 
              Stelle sicher, dass du zuerst deine USDB-Zugangsdaten in den Einstellungen eingetragen hast.
            </SettingsDescription>
          </SettingsCard>
        </div>
      </div>
      
      {/* Songs list */}
      <SettingsCard>
        <SettingsLabel>{getCurrentTabLabel()}</SettingsLabel>
        {songs.length === 0 ? (
          <div style={{ color: '#666', fontStyle: 'italic' }}>
            Keine Songs vorhanden
          </div>
        ) : (() => {
          const filteredSongs = getFilteredSongs();
          const groupedSongs = filteredSongs.reduce((groups, song) => {
            const letter = getFirstLetter(song.artist);
            if (!groups[letter]) {
              groups[letter] = [];
            }
            groups[letter].push(song);
            return groups;
          }, {} as Record<string, typeof filteredSongs>);
          
          const sortedGroups = Object.keys(groupedSongs).sort();
          
          return (
            <SongsList>
              {sortedGroups.map((letter) => (
                <div key={letter}>
                  <GroupHeader>{letter}</GroupHeader>
                  {groupedSongs[letter].map((song: any) => {
                    const isInvisible = invisibleSongs.some(invisible => 
                      invisible.artist.toLowerCase() === song.artist.toLowerCase() &&
                      invisible.title.toLowerCase() === song.title.toLowerCase()
                    );
                    
                    return (
                      <SongItem key={`${song.artist}-${song.title}`} $isInvisible={isInvisible}>
                        <input
                          type="checkbox"
                          checked={!isInvisible}
                          onChange={() => onToggleSongVisibility(song)}
                          disabled={actionLoading}
                          style={{
                            cursor: actionLoading ? 'not-allowed' : 'pointer',
                            flexShrink: 0
                          }}
                        />
                        <SongInfo>
                          {/* Left side: Song info */}
                          <SongTitle>
                            <SongName>
                              <SongText
                                onClick={() => onToggleSongVisibility(song)}
                                title="Klicken zum Umschalten der Sichtbarkeit"
                              >
                                {song.artist} - {song.title}
                              </SongText>
                              <ModeTags>
                                {song.modes?.includes('server_video') && (
                                  <ModeTag $color="#28a745" $background="#d4edda">
                                    🟢 Server
                                  </ModeTag>
                                )}
                                {song.modes?.includes('file') && (
                                  <ModeTag $color="#007bff" $background="#cce7ff">
                                    🔵 Datei
                                  </ModeTag>
                                )}
                                {song.modes?.includes('ultrastar') && (
                                  <ModeTag $color="#8e44ad" $background="#e8d5f2">
                                    ⭐ Ultrastar
                                  </ModeTag>
                                )}
                                {song.mode === 'youtube' && (
                                  <ModeTag $color="#dc3545" $background="#f8d7da">
                                    🔴 YouTube
                                  </ModeTag>
                                )}
                                {song.modes?.includes('youtube_cache') && (
                                  <ModeTag $color="#dc3545" $background="#f8d7da">
                                    🎬 YouTube Cache
                                  </ModeTag>
                                )}
                                {hasMissingFiles(song) && (
                                  <ModeTag 
                                    $color="#ff6b35" 
                                    $background="#ffe6e0"
                                    title="Dieses Ultrastar-Video benötigt nach dem ersten Songwunsch länger für die Verarbeitung, da wichtige Dateien fehlen (Video-Datei oder HP2/HP5-Audio-Dateien)."
                                    style={{ cursor: 'help' }}
                                  >
                                    ⚠️ Verarbeitung
                                  </ModeTag>
                                )}
                              </ModeTags>
                            </SongName>
                          </SongTitle>
                          
                          {/* Action buttons */}
                          <ActionButtons>
                            {hasMissingFiles(song) && (
                              <ActionButton
                                $variant="success"
                                onClick={() => onStartProcessing(song)}
                                disabled={actionLoading || processingSongs.has(`${song.artist}-${song.title}`)}
                              >
                                {processingSongs.has(`${song.artist}-${song.title}`) ? '⏳ Verarbeitung läuft...' : '🔧 Verarbeitung starten'}
                              </ActionButton>
                            )}
                            
                            <ActionButton
                              $variant="warning"
                              onClick={() => onRenameSong(song)}
                              disabled={actionLoading}
                            >
                              ✏️ Umbenennen
                            </ActionButton>
                            
                            <ActionButton
                              $variant="danger"
                              onClick={() => onDeleteSongFromLibrary(song)}
                              disabled={actionLoading}
                            >
                              🗑️ Löschen
                            </ActionButton>
                            
                            <ActionButton
                              $variant="info"
                              onClick={() => onTestSong(song)}
                              disabled={actionLoading}
                            >
                              🎵 Testen
                            </ActionButton>
                          </ActionButtons>
                        </SongInfo>
                        
                        {/* Audio settings for Ultrastar songs */}
                        {song.modes?.includes('ultrastar') && (
                          <div style={{ flex: 1, padding: '8px', background: '#f8f9fa', borderRadius: '4px', marginTop: '8px' }}>
                            <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#495057' }}>
                              Audio-Einstellung:
                            </div>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
                                <input
                                  type="radio"
                                  name={`audio-${song.artist}-${song.title}`}
                                  value="hp2"
                                  checked={ultrastarAudioSettings[`${song.artist}-${song.title}`] === 'hp2'}
                                  onChange={(e) => onUltrastarAudioChange(song, e.target.value)}
                                  disabled={actionLoading}
                                />
                                Ohne Background Gesang
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
                                <input
                                  type="radio"
                                  name={`audio-${song.artist}-${song.title}`}
                                  value="hp5"
                                  checked={ultrastarAudioSettings[`${song.artist}-${song.title}`] === 'hp5'}
                                  onChange={(e) => onUltrastarAudioChange(song, e.target.value)}
                                  disabled={actionLoading}
                                />
                                Mit Background Gesang
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
                                <input
                                  type="radio"
                                  name={`audio-${song.artist}-${song.title}`}
                                  value="choice"
                                  checked={!ultrastarAudioSettings[`${song.artist}-${song.title}`] || ultrastarAudioSettings[`${song.artist}-${song.title}`] === 'choice'}
                                  onChange={(e) => onUltrastarAudioChange(song, e.target.value)}
                                  disabled={actionLoading}
                                />
                                Auswahl
                              </label>
                            </div>
                          </div>
                        )}
                      </SongItem>
                    );
                  })}
                </div>
              ))}
            </SongsList>
          );
        })()}
      </SettingsCard>
    </SettingsSection>
  );
};

export default SongsTab;
