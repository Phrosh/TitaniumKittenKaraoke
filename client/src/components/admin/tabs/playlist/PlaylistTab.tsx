import React from 'react';
import styled from 'styled-components';
import { AdminDashboardData, Song } from '../../../../types';
import { useState, useCallback } from 'react';
import { cleanYouTubeUrl, extractVideoIdFromUrl } from '../../../../utils/youtubeUrlCleaner';
import { adminAPI, playlistAPI, showAPI, songAPI } from '../../../../services/api';
import toast from 'react-hot-toast';
import { boilDown, boilDownMatch } from '../../../../utils/boilDown';
// import EditSongModal from '../../modals/EditSongModal';
import SongForm from '../../SongForm';
import loadAllSongs from '../../../../utils/loadAllSongs';
import { 
  PlaylistContainer, 
  PlaylistHeader, 
  ControlButtons,
  CenterButtons,
  ControlButtonGroup,
  ControlButton,
  RightButtons,
  SmallButton,
  QRCodeToggleButton,
  // ShowPastSongsToggleButton,
  DropZone,
  SongItem,
  DragHandle,
  PositionBadge,
  SongContent,
  SongName,
  DeviceId,
  SongTitleRow,
  SongTitle,
  YouTubeField,
  HP5Badge,
  SongActions,
  Badge
} from './style';
import { Button } from '../../../shared';
import { isSongInYouTubeCache, DownloadStatus } from '../../../../utils/helper';
import ModeBadge from '../../../shared/ModeBadge';
import EditSongModal from './EditSongModal';
import AddSongModal from './AddSongModal';
import DownloadStatusBadge from '../../../shared/DownloadStatusBadge';


interface PlaylistTabProps {
 fetchDashboardData: () => void;
  dashboardData: AdminDashboardData;
  setDashboardData: (data: AdminDashboardData) => void;
  setActiveTab: (tab: string) => void;
  handleDeviceIdClick: (deviceId: string) => void;
}

const PlaylistTab: React.FC<PlaylistTabProps> = ({
  fetchDashboardData,
  dashboardData,
  setDashboardData,
  setActiveTab,
  handleDeviceIdClick,
}) => {
  const [showAddSongModal, setShowAddSongModal] = useState(false);
  const [showQRCodeOverlay, setShowQRCodeOverlay] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [youtubeLinks, setYoutubeLinks] = useState<Record<string, string>>({});
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'edit' | 'youtube'>('edit');
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    youtubeUrl: ''
  });

  const [showPastSongs, setShowPastSongs] = useState(false);
  const { playlist, currentSong, stats } = dashboardData;

  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [addSongData, setAddSongData] = useState({
    singerName: '',
    artist: '',
    title: '',
    youtubeUrl: ''
  });
  const [manualSongList, setManualSongList] = useState<any[]>([]);


// Filter playlist based on showPastSongs setting
const filteredPlaylist = showPastSongs 
? playlist 
: playlist.filter(song => !currentSong || song.position >= currentSong.position);

  // New Add Song Modal Handlers
  const handleOpenAddSongModal = async () => {
    const songs = await loadAllSongs();
    setManualSongList(songs);
    setShowAddSongModal(true);
  };
  
  const handleToggleQRCodeOverlay = async (show: boolean) => {
    try {
      await adminAPI.setQRCodeOverlay(show);
      setShowQRCodeOverlay(show);
      toast.success(show ? 'QR-Code Overlay aktiviert!' : 'QR-Code Overlay deaktiviert!');
    } catch (error) {
      console.error('Error toggling QR code overlay:', error);
      toast.error('Fehler beim Umschalten des QR-Code Overlays');
    }
  };

  const handleNextSong = async () => {
    setActionLoading(true);
    try {
      await playlistAPI.nextSong();
      await fetchDashboardData();
    } catch (error) {
      console.error('Error moving to next song:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePreviousSong = async () => {
    setActionLoading(true);
    try {
      await playlistAPI.previousSong();
      await fetchDashboardData();
    } catch (error) {
      console.error('Error moving to previous song:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTogglePlayPause = async () => {
    setActionLoading(true);
    try {
      const response = await playlistAPI.togglePlayPause();
      console.log('⏯️ Play/pause toggle response:', response.data);
      
      // Check if current song is Ultrastar
      if (response.data.currentSong && response.data.currentSong.mode === 'ultrastar') {
        console.log('🎤 Ultrastar song detected - ShowView will handle audio control');
      }
      
      await fetchDashboardData();
    } catch (error) {
      console.error('Error toggling play/pause:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestartSong = async () => {
    setActionLoading(true);
    try {
      await playlistAPI.restartSong();
      await fetchDashboardData();
    } catch (error) {
      console.error('Error restarting song:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearAllSongs = async () => {
    if (!window.confirm('Wirklich ALLE Songs aus der Playlist löschen? Diese Aktion kann nicht rückgängig gemacht werden!')) {
      return;
    }
    
    setActionLoading(true);
    try {
      await adminAPI.clearAllSongs();
      await fetchDashboardData();
      alert('Alle Songs wurden erfolgreich gelöscht!');
    } catch (error) {
      console.error('Error clearing all songs:', error);
      alert('Fehler beim Löschen der Songs');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, songId: number) => {
    setDraggedItem(songId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', songId.toString());
  };

  const handleDragOver = (e: React.DragEvent, songId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (songId !== draggedItem) {
      setDropTarget(songId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear drop target if we're leaving the entire song item
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropTarget(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetSongId: number) => {
    e.preventDefault();
    
    if (!draggedItem || !dashboardData || draggedItem === targetSongId) {
      setDraggedItem(null);
      return;
    }

    try {
      setActionLoading(true);
      
      const draggedIndex = dashboardData.playlist.findIndex(song => song.id === draggedItem);
      const targetIndex = dashboardData.playlist.findIndex(song => song.id === targetSongId);
      
      if (draggedIndex === -1 || targetIndex === -1) {
        setDraggedItem(null);
        return;
      }

      // Update local state immediately for better UX
      const newPlaylist = Array.from(dashboardData.playlist);
      const [reorderedItem] = newPlaylist.splice(draggedIndex, 1);
      newPlaylist.splice(targetIndex, 0, reorderedItem);
      
      setDashboardData(prev => prev ? {
        ...prev,
        playlist: newPlaylist
      } : null);

      // Update positions in backend
      await playlistAPI.reorderPlaylist(
        reorderedItem.id,
        targetIndex + 1
      );
      
      toast.success('Playlist-Reihenfolge aktualisiert!');
    } catch (error) {
      console.error('Error reordering playlist:', error);
      toast.error('Fehler beim Neuordnen der Playlist');
      // Revert local state on error
      fetchDashboardData();
    } finally {
      setActionLoading(false);
      setDraggedItem(null);
      setDropTarget(null);
    }
  };

  const handleCopyToClipboard = async (song: Song) => {
    const textToCopy = `${song.artist} - ${song.title} Karaoke`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      toast.success(`"${textToCopy}" in die Zwischenablage kopiert!`);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast.error('Fehler beim Kopieren in die Zwischenablage');
    }
  };

  const handleYouTubeFieldChange = (songId: number, value: string) => {
    // Clean the YouTube URL in real-time
    const cleanedUrl = cleanYouTubeUrl(value);
    
    setYoutubeLinks(prev => ({
      ...prev,
      [songId]: cleanedUrl
    }));
  };

  const handleYouTubeFieldBlur = async (songId: number, value: string) => {
    try {
      // Clean the YouTube URL
      const cleanedUrl = cleanYouTubeUrl(value);
      
      // Find the current song to check if the URL has actually changed
      const currentSong = dashboardData?.playlist.find(song => song.id === songId);
      const currentUrl = currentSong?.youtube_url || '';
      
      // Only update if the URL has actually changed
      if (cleanedUrl !== currentUrl) {
        await adminAPI.updateYouTubeUrl(songId, cleanedUrl);
        toast.success('YouTube-Link aktualisiert!');
        
        // If it's a YouTube URL, show additional info
        if (cleanedUrl && (cleanedUrl.includes('youtube.com') || cleanedUrl.includes('youtu.be'))) {
          toast('📥 YouTube-Download wird im Hintergrund gestartet...', {
            icon: '⏳',
            duration: 3000,
          });
        }
        
        // Refresh data to get updated link
        fetchDashboardData();
      }
    } catch (error) {
      console.error('Error updating YouTube URL:', error);
      toast.error('Fehler beim Aktualisieren des YouTube-Links');
    }
  };

  const handlePlaySong = async (songId: number) => {
    setActionLoading(true);
    try {
      await playlistAPI.setCurrentSong(songId);
      await fetchDashboardData();
    } catch (error) {
      console.error('Error setting current song:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSong = async (songId: number) => {
    if (!window.confirm('Song wirklich löschen?')) return;
    
    setActionLoading(true);
    try {
      await playlistAPI.deleteSong(songId);
      await fetchDashboardData();
    } catch (error) {
      console.error('Error deleting song:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefreshClassification = async (songId: number) => {
    setActionLoading(true);
    try {
      const response = await adminAPI.refreshSongClassification(songId);
      
      if (response.data.updated) {
        toast.success(`Song-Klassifizierung aktualisiert! Neuer Modus: ${response.data.newMode}`);
        await fetchDashboardData(); // Refresh the dashboard data
      } else {
        toast('Keine lokalen Dateien gefunden. Song bleibt als YouTube.', {
          icon: 'ℹ️',
          style: {
            background: '#3498db',
            color: '#fff',
          },
        });
      }
    } catch (error) {
      console.error('Error refreshing song classification:', error);
      toast.error('Fehler beim Aktualisieren der Song-Klassifizierung');
    } finally {
      setActionLoading(false);
    }
  };

  const openModal = (song: Song, type: 'edit' | 'youtube') => {
    setSelectedSong(song);
    setModalType(type);
    setFormData({
      title: song.title,
      artist: song.artist || '',
      youtubeUrl: song.youtube_url || ''
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedSong(null);
  };

  const handleSaveSong = async () => {
    if (!selectedSong) return;
    
    setActionLoading(true);
    try {
      if (modalType === 'youtube') {
        await adminAPI.updateYouTubeUrl(selectedSong.id, formData.youtubeUrl);
      } else {
        await adminAPI.updateSong(selectedSong.id, {
          title: formData.title,
          artist: formData.artist,
          youtubeUrl: formData.youtubeUrl
        });
      }
      
      // Show success message
      toast.success('Song erfolgreich aktualisiert!');
      
      // If it's a YouTube URL, show additional info
      if (formData.youtubeUrl && (formData.youtubeUrl.includes('youtube.com') || formData.youtubeUrl.includes('youtu.be'))) {
        toast('📥 YouTube-Download wird im Hintergrund gestartet...', {
          icon: '⏳',
          duration: 3000,
        });
      }
      
      await fetchDashboardData();
      closeModal();
    } catch (error) {
      console.error('Error updating song:', error);
      toast.error('Fehler beim Aktualisieren des Songs');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseAddSongModal = () => {
    setShowAddSongModal(false);
  };

  const handleAddSongSubmit = async () => {
    if (!addSongData.singerName.trim()) {
      toast.error('Bitte gib einen Sänger-Namen ein');
      return;
    }

    if (!addSongData.artist.trim() && !addSongData.youtubeUrl.trim()) {
      toast.error('Bitte gib einen Interpret/Songtitel oder YouTube-Link ein');
      return;
    }

    setActionLoading(true);
    try {
      let songInput = '';
      if (addSongData.youtubeUrl.trim()) {
        songInput = addSongData.youtubeUrl.trim();
      } else {
        songInput = `${addSongData.artist} - ${addSongData.title}`;
      }

      await songAPI.requestSong({
        name: addSongData.singerName,
        songInput: songInput,
        deviceId: 'ADM' // Admin device ID
      });
      toast.success('Song erfolgreich zur Playlist hinzugefügt!');
      handleCloseAddSongModal();
      
      // Refresh playlist
      await fetchDashboardData();
    } catch (error: any) {
      console.error('Error adding song:', error);
      toast.error(error.response?.data?.error || 'Fehler beim Hinzufügen des Songs');
    } finally {
      setActionLoading(false);
    }
  };





  return <>
     <PlaylistContainer>
        <PlaylistHeader>
          <ControlButtons>
            <div>
              <Button 
                onClick={handleOpenAddSongModal}
                style={{ background: '#28a745', marginRight: '15px' }}
              >
                ➕ Song Hinzufügen
              </Button>
            </div>
            <CenterButtons>
              <QRCodeToggleButton 
                $active={showQRCodeOverlay}
                onClick={() => handleToggleQRCodeOverlay(!showQRCodeOverlay)}
              >
                📱 {showQRCodeOverlay ? 'Overlay ausblenden' : 'Overlay anzeigen'}
              </QRCodeToggleButton>
              
              {/* Control Buttons */}
              <ControlButtonGroup>
                <ControlButton 
                  onClick={handlePreviousSong}
                  disabled={actionLoading}
                  title="Zurück"
                >
                  ⏮️
                </ControlButton>
                <ControlButton 
                  onClick={handleTogglePlayPause}
                  disabled={actionLoading}
                  title="Pause/Play"
                >
                  {isPlaying ? '⏸️' : '▶️'}
                </ControlButton>
                <ControlButton 
                  onClick={handleRestartSong}
                  disabled={actionLoading}
                  title="Song neu starten"
                >
                  🔄
                </ControlButton>
              </ControlButtonGroup>
              
              <Button 
                variant="success" 
                onClick={handleNextSong}
                disabled={actionLoading}
              >
                ⏭️ Weiter
              </Button>
            </CenterButtons>
            <RightButtons>
              <SmallButton 
                onClick={() => setShowPastSongs(!showPastSongs)}
              >
                📜 {showPastSongs ? 'Vergangene ausblenden' : 'Vergangene anzeigen'}
              </SmallButton>
              <SmallButton 
                variant="danger" 
                onClick={handleClearAllSongs}
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
                    onDragStart={(e) => handleDragStart(e, song.id)}
                    onDragOver={(e) => handleDragOver(e, song.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, song.id)}
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
                          onClick={() => handleDeviceIdClick(song.device_id)}
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
                            handleCopyToClipboard(song);
                          }}
                        >
                          {song.artist ? `${song.artist} - ${song.title}` : song.title}
                          {song.modes ? (
                            song.modes.map((mode, index) => (
                              <React.Fragment key={index}>
                                {mode === 'ultrastar' && song.with_background_vocals && (
                                  <HP5Badge>🎤 BG Vocals</HP5Badge>
                                )}
                                <ModeBadge mode={mode} />
                              </React.Fragment>
                            ))
                          ) : (
                            <>
                              {(song.mode || 'youtube') === 'ultrastar' && song.with_background_vocals && (
                                <HP5Badge>🎤 BG Vocals</HP5Badge>
                              )}
                                <ModeBadge mode={song.mode || 'youtube'} />
                            </>
                          )}
                        </SongTitle>
                        {(song.mode || 'youtube') === 'youtube' && !isSongInYouTubeCache(song, dashboardData.youtubeSongs) && song.status !== 'downloading' && song.download_status !== 'downloading' && song.download_status !== 'downloaded' && song.download_status !== 'cached' && (
                          <YouTubeField
                            type="url"
                            placeholder="YouTube-Link hier eingeben..."
                            value={youtubeLinks[song.id] !== undefined ? youtubeLinks[song.id] : (song.youtube_url || '')}
                            onChange={(e) => handleYouTubeFieldChange(song.id, e.target.value)}
                            onBlur={(e) => handleYouTubeFieldBlur(song.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleYouTubeFieldBlur(song.id, e.currentTarget.value);
                              }
                            }}
                          />
                        )}
                        {(song.download_status && song.download_status !== 'none') || (song.status && song.status !== 'none') && (
                          <DownloadStatusBadge status={(song.status || song.download_status) as DownloadStatus} />
                        )}
                        {((song.mode || 'youtube') === 'youtube' && isSongInYouTubeCache(song, dashboardData.youtubeSongs)) || song.modes?.includes('youtube_cache') && (
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
        {/* {currentSong?.id === song.id && (
          <Badge type="current">
            🎤 AKTUELL
          </Badge>
        )} */}
                      
                      <Button 
                        variant="success"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlaySong(song.id);
                        }}
                        disabled={actionLoading}
                      >
                        ▶️
                      </Button>
                      
                      <Button 
                        onClick={(e) => {
                          e.stopPropagation();
                          openModal(song, 'edit');
                        }}
                        disabled={actionLoading}
                      >
                        ✏️
                      </Button>
                      
                      <Button 
                        variant="primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRefreshClassification(song.id);
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
                          handleDeleteSong(song.id);
                        }}
                        disabled={actionLoading}
                      >
                        🗑️
                      </Button>
                    </SongActions>
                  </SongItem>
                  
                  {index === playlist.length - 1 && draggedItem && !dropTarget && (
                    <DropZone $isVisible={true} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </PlaylistContainer>
      {/* modals */}

      <EditSongModal
        show={showModal && formData}
        onClose={closeModal}
        onSave={handleSaveSong}
        modalType={modalType}
        formData={formData}
        setFormData={setFormData}
        actionLoading={actionLoading}
      />
      <AddSongModal
        show={showAddSongModal}
        onClose={handleCloseAddSongModal}
        onSave={handleAddSongSubmit}
        addSongData={addSongData}
        setAddSongData={setAddSongData}
        manualSongList={manualSongList}
      />


  </>
};

export default PlaylistTab;
