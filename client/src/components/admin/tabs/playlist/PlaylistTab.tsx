import React from 'react';
import { AdminDashboardData, Song } from '../../../../types';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { cleanYouTubeUrl } from '../../../../utils/youtubeUrlCleaner';
import { adminAPI, playlistAPI, showAPI, songAPI } from '../../../../services/api';
import websocketService from '../../../../services/websocket';
import toast from 'react-hot-toast';
import loadAllSongs from '../../../../utils/loadAllSongs';
import { boilDown } from '../../../../utils/boilDown';
import { DownloadStatus } from '../../../../utils/helper';
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
import { isSongInYouTubeCache } from '../../../../utils/helper';
import EditSongModal from './EditSongModal';
import AddSongModal from './AddSongModal';
import DownloadStatusBadge from '../../../shared/DownloadStatusBadge';
import SmallModeBadge from '../../../shared/SmallModeBadge';


interface PlaylistTabProps {
  fetchDashboardData: () => void;
  dashboardData: AdminDashboardData;
  setDashboardData: (data: AdminDashboardData | null) => void;
  setActiveTab: (tab: string) => void;
  handleDeviceIdClick: (deviceId: string) => void;
  showQRCodeOverlay: boolean;
  setShowQRCodeOverlay: (show: boolean) => void;
  isPlaying: boolean;
  setIsPlaying: (isPlaying: boolean) => void;
}

const PlaylistTab: React.FC<PlaylistTabProps> = ({
  fetchDashboardData,
  dashboardData,
  setDashboardData,
  setActiveTab,
  handleDeviceIdClick,
  showQRCodeOverlay,
  setShowQRCodeOverlay,
  isPlaying,
  setIsPlaying,
}) => {
  const { t } = useTranslation();

  const [showAddSongModal, setShowAddSongModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [youtubeLinks, setYoutubeLinks] = useState<Record<string, string>>({});
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'edit' | 'youtube'>('edit');
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    youtubeUrl: '',
    youtubeMode: 'karaoke' as 'karaoke' | 'magic'
  });

  const [showPastSongs, setShowPastSongs] = useState(false);
  const { playlist, currentSong, stats } = dashboardData;

  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [addSongData, setAddSongData] = useState({
    singerName: '',
    artist: '',
    title: '',
    youtubeUrl: '',
    youtubeMode: 'karaoke' as 'karaoke' | 'magic',
    withBackgroundVocals: false
  });
  const [manualSongList, setManualSongList] = useState<any[]>([]);

  // WebSocket listener for QR overlay updates
  useEffect(() => {
    const handleQROverlayToggle = (data: { show: boolean }) => {
      console.log('📱 PlaylistTab: Received QR overlay toggle:', data.show);
      setShowQRCodeOverlay(data.show);
    };

        const handleProcessingStatus = (data: { id?: number; artist?: string; title?: string; status: DownloadStatus }) => {
          try {
            console.log('🛰️ PlaylistTab: processing-status received via WS:', data, 'timestamp:', new Date().toISOString());
            
            // Add small delay to prevent race conditions
            setTimeout(() => {
        
        // Use functional update to get the latest state
        setDashboardData((prev: AdminDashboardData | null) => {
          if (!prev) return prev;
          
          // Create a deep copy to avoid mutation issues
          const updated = JSON.parse(JSON.stringify(prev));
          const normalize = (s?: string) => (s || '').toLowerCase();
          const b = (s?: string) => boilDown(s || '');

          // Status precedence: only apply if newStatus has >= priority than current
          const priority: Record<string, number> = {
            failed: 100,
            finished: 90,
            transcribing: 80,
            separating: 70,
            downloading: 60,
          } as any;
          const getPriority = (s?: string) => priority[(s || 'none') as string] ?? 0;

          const matches = (s: Song): boolean => {
            // Only match by ID if provided - this prevents updating multiple songs with same artist/title
            if (typeof data.id === 'number' && s.id === data.id) return true;
            return false;
          };

          // If no matches found by ID or artist/title, try to find the most recent song with similar name
          let foundMatch = false;
          let appliedCount = 0;
          updated.playlist = updated.playlist.map((s: Song) => {
            if (!matches(s)) return s;
            foundMatch = true;
                const currentStatusRaw = ((s as any).download_status || (s as any).status) as string | undefined;
                const currentStatus = currentStatusRaw === 'ready' ? 'finished' : currentStatusRaw;
                const incomingStatus = (data.status as string);
            
                const shouldApply = getPriority(incomingStatus) >= getPriority(currentStatus);
                if (!shouldApply) {
                  console.log('🛰️ PlaylistTab: skipping lower-priority status', { songId: s.id, currentStatus, incomingStatus, priority: { current: getPriority(currentStatus), incoming: getPriority(incomingStatus) } });
                  return s;
                }
            const next = { ...(s as any) };
            next.download_status = data.status;
            appliedCount++;
            return next as Song;
          });

          if (appliedCount === 0) {
            console.log('🛰️ PlaylistTab: No song found with ID:', data.id);
            // If song not found by ID, try to find by artist/title as fallback
            if (data.artist && data.title) {
              console.log('🛰️ PlaylistTab: Trying fallback matching by artist/title');
              const normalize = (s?: string) => (s || '').toLowerCase();
              const b = (s?: string) => boilDown(s || '');
              
              // Try to find the most recent song with matching artist/title
              const recentSong = updated.playlist
                .filter((s: Song) => {
                  // Try exact match first
                  if (normalize(s.artist) === normalize(data.artist) && normalize(s.title) === normalize(data.title)) return true;
                  // Try boiled down match
                  if (b(s.artist) === b(data.artist) && b(s.title) === b(data.title)) return true;
                  return false;
                })
                .sort((a: Song, b: Song) => (b.id || 0) - (a.id || 0))[0]; // Most recent by ID
              
              if (recentSong) {
                console.log('🛰️ PlaylistTab: Found fallback match:', { songId: recentSong.id, artist: recentSong.artist, title: recentSong.title });
                const currentStatusRaw = ((recentSong as any).download_status || (recentSong as any).status) as string | undefined;
                const currentStatus = currentStatusRaw === 'ready' ? 'finished' : currentStatusRaw;
                const incomingStatus = (data.status as string);
                
                const shouldApply = getPriority(incomingStatus) >= getPriority(currentStatus);
                if (shouldApply) {
                  const next = { ...(recentSong as any) };
                  next.download_status = data.status;
                  appliedCount++;
                  console.log('🛰️ PlaylistTab: applying status to fallback match:', { songId: recentSong.id, artist: recentSong.artist, title: recentSong.title, status: data.status, priority: { current: getPriority(currentStatus), incoming: getPriority(incomingStatus) } });
                  
                  // Update the playlist with the modified song
                  updated.playlist = updated.playlist.map((s: Song) => s.id === recentSong.id ? next as Song : s);
                } else {
                  console.log('🛰️ PlaylistTab: Skipping fallback match due to lower priority:', { songId: recentSong.id, currentStatus, incomingStatus, priority: { current: getPriority(currentStatus), incoming: getPriority(incomingStatus) } });
                }
              } else {
                console.log('🛰️ PlaylistTab: No fallback match found by artist/title');
              }
            }
            
            if (appliedCount === 0) {
              console.log('🛰️ PlaylistTab: No fallback match found either');
              return prev;
            }
          }
          console.log('🛰️ PlaylistTab: status applied to entries:', appliedCount);
          return updated;
        });
            }, 100); // 100ms delay
          } catch (e) {
            console.error('Error applying processing status:', e);
          }
        };

    // Listen for QR overlay toggle events
    websocketService.on('qr-overlay-toggle', handleQROverlayToggle);
    // Listen for processing status updates
    websocketService.on('processing-status', handleProcessingStatus);

    return () => {
      websocketService.off('qr-overlay-toggle', handleQROverlayToggle);
      websocketService.off('processing-status', handleProcessingStatus);
    };
  }, [setShowQRCodeOverlay, setDashboardData]);

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
      console.log('📱 PlaylistTab: Toggling QR overlay to:', show);
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
      setIsPlaying(true); // Song is playing after restart
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

      setDashboardData(dashboardData ? {
        ...dashboardData,
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
      youtubeUrl: song.youtube_url || '',
      youtubeMode: 'karaoke' as 'karaoke' | 'magic',
      singerName: song.user_name || '',
      withBackgroundVocals: song.with_background_vocals || false
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
        if (formData.youtubeMode === 'magic') {
          // Use magic-youtube processing
          await adminAPI.processMagicYouTube(selectedSong.id, formData.youtubeUrl);
          toast.success(t('playlist.magicYouTubeProcessingStarted'));
        } else {
          // Use regular YouTube processing
          await adminAPI.updateYouTubeUrl(selectedSong.id, formData.youtubeUrl);
          toast.success(t('playlist.songUpdated'));
        }
      } else {
        await adminAPI.updateSong(selectedSong.id, {
          title: formData.title,
          artist: formData.artist,
          youtubeUrl: formData.youtubeUrl,
          singerName: formData.singerName,
          withBackgroundVocals: formData.withBackgroundVocals
        });
        toast.success(t('playlist.songUpdated'));
      }

      // If it's a YouTube URL, show additional info
      if (formData.youtubeUrl && (formData.youtubeUrl.includes('youtube.com') || formData.youtubeUrl.includes('youtu.be'))) {
        if (formData.youtubeMode === 'magic') {
          toast(t('playlist.magicYouTubeProcessingSteps'), {
            icon: '✨',
            duration: 5000,
          });
        } else {
          toast(t('playlist.youtubeDownloadStarted'), {
            icon: '⏳',
            duration: 3000,
          });
        }
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
      youtubeUrl: '',
      youtubeMode: 'karaoke' as 'karaoke' | 'magic',
      withBackgroundVocals: false
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
        deviceId: 'ADM', // Admin device ID
        withBackgroundVocals: addSongData.withBackgroundVocals,
        youtubeMode: addSongData.youtubeMode
      });
      
      if (addSongData.youtubeUrl.trim() && addSongData.youtubeMode === 'magic') {
        toast.success(t('playlist.magicYouTubeProcessingStarted'));
        toast(t('playlist.magicYouTubeProcessingSteps'), {
          icon: '✨',
          duration: 5000,
        });
      } else {
        toast.success(t('playlist.songAdded'));
      }

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
              style={{ background: '#28a745', marginRight: '15px', fontVariantEmoji: 'text' as const }}
            >
              ➕ {t('playlist.addSong')}
            </Button>
          </div>
          <CenterButtons>
            <QRCodeToggleButton
              onClick={() => handleToggleQRCodeOverlay(!showQRCodeOverlay)}
              $active={showQRCodeOverlay}
              style={{ marginRight: '10px' }}
            >
              📱 {showQRCodeOverlay ? t('playlist.overlayHide') : t('playlist.overlayShow')}
            </QRCodeToggleButton>

            {/* Control Buttons */}
            <ControlButtonGroup>
              <Button
                onClick={handlePreviousSong}
                disabled={actionLoading}
                title={t('playlist.previous')}
                size="small"
                style={{ marginRight: '8px', fontVariantEmoji: 'text' as const }}
              >
                ⏮️
              </Button>
              <Button
                onClick={handleTogglePlayPause}
                disabled={actionLoading || !isPlaying}
                title={t('playlist.playPause')}
                size="small"
                style={{
                  marginRight: '8px',
                  fontVariantEmoji: 'text' as const,
                  ...(isPlaying ? {} : {
                    background: 'rgba(0, 0, 0, 0.35)',
                    color: '#bbbbbb',
                    filter: 'grayscale(100%)',
                    opacity: 0.6,
                    border: '2px solid rgba(255, 255, 255, 0.15)'
                  })
                }}
              >
                ⏸️
              </Button>
              <Button
                onClick={handleRestartSong}
                disabled={actionLoading}
                title={t('playlist.restartSong')}
                size="small"
                style={{ marginRight: '8px', fontVariantEmoji: 'text' as const }}
              >
                🔄
              </Button>
            </ControlButtonGroup>

            <Button
              variant="success"
              onClick={handleNextSong}
              disabled={actionLoading}
              style={{ fontVariantEmoji: 'text' as const }}
            >
              ⏭️ {t('playlist.next')}
            </Button>
          </CenterButtons>
          <RightButtons>
            <Button
              onClick={() => setShowPastSongs(!showPastSongs)}
              size="small"
              variant={showPastSongs ? 'secondary' : 'default'}
              style={{ marginRight: '8px', fontVariantEmoji: 'text' as const }}
            >
              📜 {showPastSongs ? t('playlist.hidePast') : t('playlist.showPast')}
            </Button>
            <Button
              onClick={handleClearAllSongs}
              disabled={actionLoading}
              type="danger"
              size="small"
              style={{ marginRight: '8px', fontVariantEmoji: 'text' as const }}
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
            const effectiveStatus = (song.download_status as string) === 'ready' ? 'finished' : song.download_status;
            const isBlocked = !!effectiveStatus && !['finished', 'failed'].includes(effectiveStatus as string);
            
            return (
              <React.Fragment key={song.id}>
                {showDropZoneAbove && (
                  <DropZone $isVisible={true} />
                )}

                <SongItem
                  $isCurrent={isCurrent}
                  $hasNoYoutube={song.mode === 'youtube' && !song.youtube_url}
                  $isBlocked={isBlocked}
                  $isPast={isPast || false}
                  $isDragging={isDragging}
                  $isDropTarget={isDropTarget || false}
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
                        onClick={() => handleDeviceIdClick(song.device_id || '')}
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
                        {(() => {
                          // Check if title contains [DUET] and clean it for display
                          const isDuett = song.title.includes('[DUET]');
                          const cleanTitle = isDuett ? song.title.replace(/\s*\[DUET\]\s*/gi, '').trim() : song.title;
                          const displayTitle = song.artist ? `${song.artist} - ${cleanTitle}` : cleanTitle;
                          
                          return (
                            <>
                              {displayTitle}
                              {song.modes ? (
                                song.modes.map((mode, index) => (
                                  <React.Fragment key={index}>
                                    {/* Show magic badge instead of ultrastar badge for magic songs */}
                                    {song.magic && mode === 'ultrastar' ? (
                                      <SmallModeBadge mode="magic-youtube" modes={['magic-youtube']} />
                                    ) : (
                                      <SmallModeBadge mode={mode} modes={[mode]} />
                                    )}
                                    {mode === 'ultrastar' && song.with_background_vocals && (
                                      // <HP5Badge>🎤 BG Vocals</HP5Badge>
                                      <SmallModeBadge mode="hp2" />
                                    )}
                                  </React.Fragment>
                                ))
                              ) : (
                                <>
                                  {/* Show magic badge instead of ultrastar badge for magic songs */}
                                  {song.magic && (song.mode || 'youtube') === 'ultrastar' ? (
                                    <SmallModeBadge mode="magic-youtube" modes={['magic-youtube']} />
                                  ) : (
                                    <SmallModeBadge mode={song.mode || 'youtube'} modes={[song.mode || 'youtube']} />
                                  )}
                                  {(song.mode || 'youtube') === 'ultrastar' && song.with_background_vocals && (
                                    // <HP5Badge>🎤 BG Vocals</HP5Badge>
                                    <SmallModeBadge mode="hp2" />
                                  )}
                                </>
                              )}
                              {isDuett && <SmallModeBadge mode="duett" />}
                            </>
                          );
                        })()}
                      </SongTitle>
                      {((song.mode === 'youtube' && !isSongInYouTubeCache(song, dashboardData.youtubeSongs) && ['failed', 'none'].includes(song.download_status || '')) || !song.youtube_url || song.youtube_url.length === 0) && (
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          zIndex: 10
                        }}>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              openModal(song, 'youtube');
                            }}
                            style={{ 
                              fontSize: '1.2rem', 
                              padding: '12px 24px',
                              backgroundColor: '#dc3545',
                              borderColor: '#dc3545',
                              color: 'white',
                              fontWeight: 'bold',
                              boxShadow: '0 4px 8px rgba(220, 53, 69, 0.3)',
                              borderRadius: '8px'
                            }}
                          >
                            📺 {t('playlist.addYouTubeLink')}
                          </Button>
                        </div>
                      )}
                      {effectiveStatus ? (
                        <DownloadStatusBadge status={effectiveStatus as DownloadStatus} />
                      ) : null}
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
                      disabled={actionLoading || isBlocked}
                      style={{
                        fontVariantEmoji: 'text' as const
                      }}
                    >
                      ▶️
                    </Button>

                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        openModal(song, 'edit');
                      }}
                      disabled={actionLoading || isBlocked}
                      style={{
                        fontVariantEmoji: 'text' as const
                      }}
                    >
                      ✏️
                    </Button>

                    <Button
                      variant="primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRefreshClassification(song.id);
                      }}
                      style={{
                        fontVariantEmoji: 'text' as const
                      }}
                      disabled={actionLoading || isBlocked}
                      title={t('playlist.refreshClassification')}
                    >
                      🔄
                    </Button>

                    <Button
                      variant="danger"
                      style={{
                        fontVariantEmoji: 'text' as const
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSong(song.id);
                      }}
                      disabled={actionLoading || isBlocked}
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
      show={showModal && !!formData}
      onClose={closeModal}
      onSave={handleSaveSong}
      modalType={modalType}
      formData={formData}
      setFormData={setFormData}
      currentSong={selectedSong}
      dashboardData={dashboardData}
    />
        <AddSongModal
          show={showAddSongModal}
          onClose={handleCloseAddSongModal}
          onSave={handleAddSongSubmit}
          addSongData={addSongData}
          setAddSongData={setAddSongData}
          manualSongList={manualSongList}
          dashboardData={dashboardData}
        />


  </>
};

export default PlaylistTab;
