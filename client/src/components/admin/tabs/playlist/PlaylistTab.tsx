import React from 'react';
import { AdminDashboardData, Song } from '../../../../types';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cleanYouTubeUrl } from '../../../../utils/youtubeUrlCleaner';
import { adminAPI, playlistAPI, showAPI, songAPI } from '../../../../services/api';
import toast from 'react-hot-toast';
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
  SongActions,
} from './style';
import Button from '../../../shared/Button';
import { isSongInYouTubeCache, DownloadStatus } from '../../../../utils/helper';
import EditSongModal from './EditSongModal';
import AddSongModal from './AddSongModal';
import DownloadStatusBadge from '../../../shared/DownloadStatusBadge';
import SmallModeBadge from '../../../shared/SmallModeBadge';


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
  const { t } = useTranslation();

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
      toast.success(show ? t('playlist.overlayEnabled') : t('playlist.overlayDisabled'));
    } catch (error) {
      console.error('Error toggling QR code overlay:', error);
      toast.error(t('playlist.overlayToggleError'));
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
    if (!window.confirm(t('playlist.confirmDeleteAll'))) {
      return;
    }

    setActionLoading(true);
    try {
      await adminAPI.clearAllSongs();
      await fetchDashboardData();
      toast.success(t('playlist.allSongsDeleted'));
    } catch (error) {
      console.error('Error clearing all songs:', error);
      toast.error(t('playlist.deleteAllSongsError'));
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

      toast.success(t('playlist.playlistReordered'));
    } catch (error) {
      console.error('Error reordering playlist:', error);
      toast.error(t('playlist.playlistReorderError'));
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
      toast.success(t('playlist.songCopied', { songTitle: textToCopy }));
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast.error(t('playlist.copyError'));
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
        toast.success(t('playlist.youtubeLinkUpdated'));

        // If it's a YouTube URL, show additional info
        if (cleanedUrl && (cleanedUrl.includes('youtube.com') || cleanedUrl.includes('youtu.be'))) {
          toast(t('playlist.youtubeDownloadStarted'), {
            icon: '⏳',
            duration: 3000,
          });
        }

        // Refresh data to get updated link
        fetchDashboardData();
      }
    } catch (error) {
      console.error('Error updating YouTube URL:', error);
      toast.error(t('playlist.youtubeLinkUpdateError'));
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
    if (!window.confirm(t('playlist.confirmDeleteSong'))) return;

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
        toast.success(t('playlist.songClassificationUpdated', { newMode: response.data.newMode }));
        await fetchDashboardData(); // Refresh the dashboard data
      } else {
        toast(t('playlist.noLocalFiles'), {
          icon: 'ℹ️',
          style: {
            background: '#3498db',
            color: '#fff',
          },
        });
      }
    } catch (error) {
      console.error('Error refreshing song classification:', error);
      toast.error(t('playlist.classificationUpdateError'));
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
      toast.success(t('playlist.songUpdated'));

      // If it's a YouTube URL, show additional info
      if (formData.youtubeUrl && (formData.youtubeUrl.includes('youtube.com') || formData.youtubeUrl.includes('youtu.be'))) {
        toast(t('playlist.youtubeDownloadStarted'), {
          icon: '⏳',
          duration: 3000,
        });
      }

      await fetchDashboardData();
      closeModal();
    } catch (error) {
      console.error('Error updating song:', error);
      toast.error(t('playlist.songUpdateError'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseAddSongModal = () => {
    setShowAddSongModal(false);
    setAddSongData({
      singerName: '',
      artist: '',
      title: '',
      youtubeUrl: ''
    });
  };

  const handleAddSongSubmit = async () => {
    if (!addSongData.singerName.trim()) {
      toast.error(t('playlist.enterSingerName'));
      return;
    }

    if (!addSongData.artist.trim() && !addSongData.youtubeUrl.trim()) {
      toast.error(t('playlist.enterArtistOrYoutube'));
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
      toast.success(t('playlist.songAdded'));

      handleCloseAddSongModal();

      // Refresh playlist
      await fetchDashboardData();
    } catch (error: any) {
      console.error('Error adding song:', error);
      toast.error(error.response?.data?.error || t('playlist.songAddError'));
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
              ➕ {t('playlist.addSong')}
            </Button>
          </div>
          <CenterButtons>
            <Button
              onClick={() => handleToggleQRCodeOverlay(!showQRCodeOverlay)}
              variant={showQRCodeOverlay ? 'success' : 'secondary'}
              size="small"
              style={{ marginRight: '10px' }}
            >
              📱 {showQRCodeOverlay ? t('playlist.overlayHide') : t('playlist.overlayShow')}
            </Button>

            {/* Control Buttons */}
            <ControlButtonGroup>
              <Button
                onClick={handlePreviousSong}
                disabled={actionLoading}
                title={t('playlist.previous')}
                size="small"
                style={{ marginRight: '8px' }}
              >
                ⏮️
              </Button>
              <Button
                onClick={handleTogglePlayPause}
                disabled={actionLoading}
                title={t('playlist.playPause')}
                size="small"
                style={{ marginRight: '8px' }}
              >
                {isPlaying ? '⏸️' : '▶️'}
              </Button>
              <Button
                onClick={handleRestartSong}
                disabled={actionLoading}
                title={t('playlist.restartSong')}
                size="small"
                style={{ marginRight: '8px' }}
              >
                🔄
              </Button>
            </ControlButtonGroup>

            <Button
              variant="success"
              onClick={handleNextSong}
              disabled={actionLoading}
            >
              ⏭️ {t('playlist.next')}
            </Button>
          </CenterButtons>
          <RightButtons>
            <Button
              onClick={() => setShowPastSongs(!showPastSongs)}
              size="small"
              style={{ marginRight: '8px' }}
            >
              📜 {showPastSongs ? t('playlist.hidePast') : t('playlist.showPast')}
            </Button>
            <Button
              onClick={handleClearAllSongs}
              disabled={actionLoading}
              type="danger"
              size="small"
              style={{ marginRight: '8px' }}
            >
              🗑️ {t('playlist.clearList')}
            </Button>
          </RightButtons>
        </ControlButtons>
      </PlaylistHeader>

      {filteredPlaylist.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          {t('playlist.noSongsInPlaylist')}
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
                        title={t('playlist.clickToBan')}
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
                              <SmallModeBadge mode={mode} modes={[mode]} />
                              {mode === 'ultrastar' && song.with_background_vocals && (
                                // <HP5Badge>🎤 BG Vocals</HP5Badge>
                                <SmallModeBadge mode="hp2" />
                              )}
                            </React.Fragment>
                          ))
                        ) : (
                          <>
                            <SmallModeBadge mode={song.mode || 'youtube'} modes={[song.mode || 'youtube']} />
                            {(song.mode || 'youtube') === 'ultrastar' && song.with_background_vocals && (
                              // <HP5Badge>🎤 BG Vocals</HP5Badge>
                              <SmallModeBadge mode="hp2" />
                            )}
                          </>
                        )}
                      </SongTitle>
                      {(song.mode || 'youtube') === 'youtube' && !isSongInYouTubeCache(song, dashboardData.youtubeSongs) && song.status !== 'downloading' && song.download_status !== 'downloading' && song.download_status !== 'downloaded' && song.download_status !== 'cached' && (
                        <YouTubeField
                          type="url"
                          placeholder={t('playlist.youtubeLinkPlaceholder')}
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
                          ✅ {t('playlist.youtubeCacheAvailable')}
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
                      title={t('playlist.refreshClassification')}
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
