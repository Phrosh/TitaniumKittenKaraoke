import React from 'react';
import styled from 'styled-components';
import { AdminDashboardData, Song } from '../../../types';
import { useState, useCallback } from 'react';
import { cleanYouTubeUrl, extractVideoIdFromUrl } from '../../../utils/youtubeUrlCleaner';
import { adminAPI, playlistAPI, showAPI, songAPI } from '../../../services/api';
import toast from 'react-hot-toast';
import { boilDown, boilDownMatch } from '../../../utils/boilDown';
import EditSongModal from '../modals/EditSongModal';
import SongForm from '../SongForm';
import loadAllSongs from '../../../utils/loadAllSongs';

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
  // filteredPlaylist: Song[];
  // currentSong: Song | null;
  // showPastSongs: boolean;
  // showQRCodeOverlay: boolean;
  // actionLoading: boolean;
  // isPlaying: boolean;
  // draggedItem: number | null;
  // dropTarget: number | null;
  // youtubeLinks: { [key: number]: string };
  // onOpenAddSongModal: () => void;
  // onToggleQRCodeOverlay: (show: boolean) => void;
  // onPreviousSong: () => void;
  // onTogglePlayPause: () => void;
  // onRestartSong: () => void;
  // onNextSong: () => void;
  // onSetShowPastSongs: (show: boolean) => void;
  // onClearAllSongs: () => void;
  // onDragStart: (e: React.DragEvent, songId: number) => void;
  // onDragOver: (e: React.DragEvent, songId: number) => void;
  // onDragLeave: (e: React.DragEvent) => void;
  // onDrop: (e: React.DragEvent, targetSongId: number) => void;
  // onCopyToClipboard: (song: Song) => void;
  // onYouTubeFieldChange: (songId: number, value: string) => void;
  // onYouTubeFieldBlur: (songId: number, value: string) => void;
  // onPlaySong: (songId: number) => void;
  // onOpenModal: (song: Song, type: 'edit' | 'youtube') => void;
  // onRefreshClassification: (songId: number) => void;
  // onDeleteSong: (songId: number) => void;
  // onDeviceIdClick: (deviceId: string) => void;
  // isSongInYouTubeCache: (song: Song) => boolean;
  // getDownloadStatusText: (status: string | undefined) => string;
  setActiveTab: (tab: 'playlist' | 'settings' | 'users' | 'banlist' | 'songs') => void;
  dashboardData: AdminDashboardData;
  setDashboardData: (data: AdminDashboardData) => void;
  fetchDashboardData: () => void;
  handleDeviceIdClick: (deviceId: string) => void;
  setShowQRCodeOverlay: (show: boolean) => void;
  actionLoading: boolean;
  setActionLoading: (loading: boolean) => void;
  isPlaying: boolean;
  showQRCodeOverlay: boolean;
  // setAddSongSearchTerm: (searchTerm: string) => void;
  // triggerUSDBSearch: (artist: string, title: string) => void;
}

const PlaylistTab: React.FC<PlaylistTabProps> = ({
  // filteredPlaylist,
  // currentSong,
  // showPastSongs,
  // showQRCodeOverlay,
  // actionLoading,
  // isPlaying,
  // draggedItem,
  // dropTarget,
  // youtubeLinks,
  // onOpenAddSongModal,
  // onToggleQRCodeOverlay,
  // onPreviousSong,
  // onTogglePlayPause,
  // onRestartSong,
  // onNextSong,
  // onSetShowPastSongs,
  // onClearAllSongs,
  // onDragStart,
  // onDragOver,
  // onDragLeave,
  // onDrop,
  // onCopyToClipboard,
  // onYouTubeFieldChange,
  // onYouTubeFieldBlur,
  // onPlaySong,
  // onOpenModal,
  // onRefreshClassification,
  // onDeleteSong,
  // onDeviceIdClick,
  // isSongInYouTubeCache,
  // getDownloadStatusText
  setShowQRCodeOverlay,
  showQRCodeOverlay,
  setActiveTab,
  dashboardData,
  setDashboardData,
  fetchDashboardData,
  handleDeviceIdClick,
  actionLoading,
  setActionLoading,
  isPlaying,
  // setAddSongSearchTerm,
  // triggerUSDBSearch
}) => {

  const { playlist, currentSong, stats } = dashboardData;
  const [showPastSongs, setShowPastSongs] = useState(false);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'edit' | 'youtube'>('edit');
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    youtubeUrl: ''
  });
  const [youtubeLinks, setYoutubeLinks] = useState<{[key: number]: string}>({});
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  // const [showManualSongList, setShowManualSongList] = useState(false);
  const [manualSongList, setManualSongList] = useState<any[]>([]);
  const [showAddSongModal, setShowAddSongModal] = useState(false);
  const [addSongUsdbResults, setAddSongUsdbResults] = useState<any[]>([]);
  const [addSongUsdbLoading, setAddSongUsdbLoading] = useState(false);
  const [addSongData, setAddSongData] = useState({
    singerName: '',
    artist: '',
    title: '',
    youtubeUrl: ''
  });
  const [addSongSearchTerm, setAddSongSearchTerm] = useState('');
  
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

  const handleCloseAddSongModal = () => {
    setShowAddSongModal(false);
    setAddSongData({
      singerName: '',
      artist: '',
      title: '',
      youtubeUrl: ''
    });
    setAddSongSearchTerm('');
    setAddSongUsdbResults([]);
    setAddSongUsdbLoading(false);
    // Clear any pending timeout
    // if (addSongUsdbTimeout) {
    //   clearTimeout(addSongUsdbTimeout);
    //   setAddSongUsdbTimeout(null);
    // }
  };

  const getDownloadStatusText = (status: string | undefined) => {
    switch (status) {
      case 'downloading': return '🔄 USDB Download läuft...';
      case 'downloaded': return '✅ Heruntergeladen';
      case 'cached': return '💾 Im Cache';
      case 'failed': return '❌ USDB Download fehlgeschlagen';
      case 'ready': return '';
      default: return '';
    }
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
  
  const handleDragOver = (e: React.DragEvent, songId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (songId !== draggedItem) {
      setDropTarget(songId);
    }
  };
  

  const handleDragStart = (e: React.DragEvent, songId: number) => {
    setDraggedItem(songId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', songId.toString());
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
        deviceId: 'ADMIN' // Admin device ID
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

  // Check if a song exists in YouTube cache
  const isSongInYouTubeCache = useCallback((song: Song) => {
    if (!dashboardData?.youtubeSongs || !song.artist || !song.title) {
      return false;
    }
    
    // First try exact match
    let found = dashboardData.youtubeSongs.some(youtubeSong => 
      youtubeSong.artist.toLowerCase() === song.artist?.toLowerCase() &&
      youtubeSong.title.toLowerCase() === song.title.toLowerCase()
    );
    
    // If not found, try with boil down normalization
    if (!found) {
      const boiledArtist = boilDown(song.artist);
      const boiledTitle = boilDown(song.title);
      
      found = dashboardData.youtubeSongs.some(youtubeSong => {
        const boiledYoutubeArtist = boilDown(youtubeSong.artist);
        const boiledYoutubeTitle = boilDown(youtubeSong.title);
        
        // Try individual artist/title matches
        if (boilDownMatch(youtubeSong.artist, song.artist) || 
            boilDownMatch(youtubeSong.title, song.title)) {
          return true;
        }
        
        // Try combined match
        const boiledCombined = boilDown(`${song.artist} - ${song.title}`);
        const boiledYoutubeCombined = boilDown(`${youtubeSong.artist} - ${youtubeSong.title}`);
        return boiledCombined === boiledYoutubeCombined;
      });
    }
    
    // If still not found, try with sanitized names (fallback)
    if (!found) {
      const sanitizeFilename = (filename: string) => {
        if (!filename) return '';
        return filename.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
                     .replace(/^[.\s]+|[.\s]+$/g, '')
                     .replace(/_+/g, '_')
                     .replace(/^_+|_+$/g, '') || 'unnamed';
      };
      
      const sanitizedArtist = sanitizeFilename(song.artist);
      const sanitizedTitle = sanitizeFilename(song.title);
      
      found = dashboardData.youtubeSongs.some(youtubeSong => 
        youtubeSong.folderName === `${sanitizedArtist} - ${sanitizedTitle}`
      );
    }
    
    // If still not found and we have a YouTube URL, try to find by video ID
    if (!found && song.youtube_url) {
      const videoId = extractVideoIdFromUrl(song.youtube_url);
      if (videoId) {
        // First try to find in the scanned songs
        found = dashboardData.youtubeSongs.some(youtubeSong => {
          // Check if any video file in the folder has this video ID as filename
          if (youtubeSong.videoFiles && Array.isArray(youtubeSong.videoFiles)) {
            return youtubeSong.videoFiles.some((videoFile: string) => 
              videoFile.startsWith(videoId)
            );
          }
          // Fallback: check the main videoFile
          return youtubeSong.videoFile && youtubeSong.videoFile.startsWith(videoId);
        });
        
        // If still not found, the backend will handle recursive search
        // This is just for frontend display - the actual cache hit detection
        // happens on the backend when the song is processed
      }
    }
    
    return found;
  }, [dashboardData?.youtubeSongs]);

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

  const filteredAddSongs = manualSongList.filter(song =>
    song.artist.toLowerCase().includes(addSongSearchTerm.toLowerCase()) ||
    song.title.toLowerCase().includes(addSongSearchTerm.toLowerCase()) ||
    `${song.artist} - ${song.title}`.toLowerCase().includes(addSongSearchTerm.toLowerCase())
  );

  const handleSelectAddSong = (song: any) => {
    setAddSongData(prev => ({
      ...prev,
      artist: song.artist,
      title: song.title
    }));
  };

  return (
    <><PlaylistContainer>
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
                          onChange={(e) => handleYouTubeFieldChange(song.id, e.target.value)}
                          onBlur={(e) => handleYouTubeFieldBlur(song.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleYouTubeFieldBlur(song.id, e.currentTarget.value);
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
                
                {index === filteredPlaylist.length - 1 && draggedItem && !dropTarget && (
                  <DropZone $isVisible={true} />
                )}
              </React.Fragment>
            );
          })}
        </div>
        
      
      
      )}
    </PlaylistContainer>
      {showModal && selectedSong && (
        <EditSongModal
          show={showModal && !!selectedSong}
          modalType={modalType}
          formData={formData}
          actionLoading={actionLoading}
          onClose={closeModal}
          onSave={handleSaveSong}
          onFormDataChange={(field, value) => setFormData(prev => ({ ...prev, [field]: value }))}
        />
      )}
      {/* Add Song Modal */}
      {showAddSongModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '20px',
            maxWidth: '800px',
            width: '90%',
            maxHeight: '95vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              borderBottom: '1px solid #eee',
              paddingBottom: '15px'
            }}>
              <h3 style={{ margin: 0, color: '#333' }}>➕ Song hinzufügen</h3>
              <button
                onClick={handleCloseAddSongModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ×
              </button>
            </div>

            {/* Song Form */}
            <SongForm
              singerName={addSongData.singerName}
              artist={addSongData.artist}
              title={addSongData.title}
              youtubeUrl={addSongData.youtubeUrl}
              withBackgroundVocals={false}
              onSingerNameChange={(value) => setAddSongData(prev => ({ ...prev, singerName: value }))}
              songData={addSongData}
              setSongData={setAddSongData}
              setSongSearchTerm={setAddSongSearchTerm}
              // triggerUSDBSearch={triggerUSDBSearch}
              // onArtistChange={(value) => {
              //   setAddSongData(prev => ({ ...prev, artist: value }));
              //   setAddSongSearchTerm(value);
              //   triggerUSDBSearch(value, addSongData.title);
              // }}
              // onTitleChange={(value) => {
              //   setAddSongData(prev => ({ ...prev, title: value }));
              //   setAddSongSearchTerm(value);
              //   triggerUSDBSearch(addSongData.artist, value);
              // }}
              onYoutubeUrlChange={(value) => setAddSongData(prev => ({ ...prev, youtubeUrl: value }))}
              onWithBackgroundVocalsChange={() => {}} // Not used in Add Song Modal
              showSongList={true}
              songList={filteredAddSongs}
              onSongSelect={handleSelectAddSong}
              usdbResults={addSongUsdbResults}
              usdbLoading={addSongUsdbLoading}
              setUsdbResults={setAddSongUsdbResults}
              setUsdbLoading={setAddSongUsdbLoading}
            />


            {/* Buttons */}
            <div style={{ 
              display: 'flex', 
              gap: '12px',
              justifyContent: 'flex-end',
              marginTop: '20px',
              paddingTop: '20px',
              borderTop: '1px solid #e1e5e9'
            }}>
              <button
                onClick={handleCloseAddSongModal}
                disabled={actionLoading}
                style={{
                  padding: '12px 24px',
                  border: '2px solid #e1e5e9',
                  borderRadius: '8px',
                  backgroundColor: actionLoading ? '#f8f9fa' : 'white',
                  color: actionLoading ? '#ccc' : '#666',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={handleAddSongSubmit}
                disabled={actionLoading || !addSongData.singerName.trim() || (!addSongData.artist.trim() && !addSongData.youtubeUrl.trim())}
                  style={{
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: actionLoading || !addSongData.singerName.trim() || (!addSongData.artist.trim() && !addSongData.youtubeUrl.trim()) ? '#ccc' : '#28a745',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: actionLoading || !addSongData.singerName.trim() || (!addSongData.artist.trim() && !addSongData.youtubeUrl.trim()) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {actionLoading ? 'Hinzufügen...' : 'Hinzufügen'}
              </button>
              </div>
            </div>
        </div>
      )}
      </>
  );
};

export default PlaylistTab;
