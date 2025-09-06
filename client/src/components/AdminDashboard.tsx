import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { adminAPI, playlistAPI, showAPI } from '../services/api';
import { AdminDashboardData, Song, AdminUser } from '../types';

const Container = styled.div`
  min-height: 100vh;
  padding: 20px;
`;

const TabContainer = styled.div`
  background: white;
  border-radius: 12px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
`;

const TabHeader = styled.div`
  display: flex;
  border-bottom: 1px solid #e9ecef;
`;

const TabButton = styled.button<{ $active: boolean }>`
  background: ${props => props.$active ? '#e3f2fd' : 'transparent'};
  color: ${props => props.$active ? '#1976d2' : '#666'};
  border: none;
  padding: 15px 25px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  border-radius: ${props => props.$active ? '12px 12px 0 0' : '0'};
  
  &:hover {
    background: ${props => props.$active ? '#bbdefb' : '#f8f9fa'};
    color: ${props => props.$active ? '#1565c0' : '#333'};
  }
  
  &:first-child {
    border-radius: 12px 0 0 0;
  }
  
  &:last-child {
    border-radius: 0 12px 0 0;
  }
`;

const TabContent = styled.div`
  padding: 20px;
`;

const ManualSongSection = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
`;

const ManualSongTitle = styled.h3`
  color: #333;
  margin: 0 0 15px 0;
  font-size: 1.2rem;
`;

const ManualSongForm = styled.div`
  display: flex;
  gap: 15px;
  align-items: end;
`;


const ManualSongInput = styled.input`
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  min-width: 400px;
  
  &:focus {
    outline: none;
    border-color: #667eea;
  }
`;

const ManualSongButton = styled.button`
  background: #27ae60;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  height: fit-content;
  
  &:hover:not(:disabled) {
    background: #229954;
    transform: translateY(-1px);
  }
  
  &:disabled {
    background: #ccc;
    cursor: not-allowed;
    transform: none;
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  background: rgba(255, 255, 255, 0.1);
  padding: 20px;
  border-radius: 12px;
  backdrop-filter: blur(10px);
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

const ShowPastSongsToggleButton = styled.button<{ $active: boolean }>`
  background: ${props => props.$active ? '#3498db' : '#95a5a6'};
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
    background: ${props => props.$active ? '#2980b9' : '#7f8c8d'};
  }
`;


const Title = styled.h1`
  color: white;
  font-size: 2.5rem;
  margin: 0;
`;

const LogoutButton = styled.button`
  background: #e74c3c;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;

  &:hover {
    background: #c0392b;
  }
`;


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

const PlaylistTitle = styled.h2`
  color: #333;
  margin: 0;
`;

const ControlButtons = styled.div`
  display: flex;
  gap: 10px;
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
  font-size: 1.1rem;
  transition: all 0.3s ease;

  &:hover {
    background: ${props => 
      props.variant === 'success' ? '#229954' :
      props.variant === 'danger' ? '#c0392b' :
      '#5a6fd8'
    };
    transform: translateY(-2px);
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
    transform: none;
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
    '#f8f9fa'
  };
  border: ${props => 
    props.$isCurrent ? '3px solid #5a6fd8' :
    props.$hasNoYoutube ? '2px solid #dc3545' :
    props.$isPast ? '1px solid #e9ecef' :
    props.$isDropTarget ? '2px dashed #3498db' :
    '1px solid #dee2e6'
  };
  opacity: ${props => props.$isPast ? 0.6 : props.$isDragging ? 0.5 : 1};
  transition: all 0.3s ease;
  transform: ${props => props.$isDragging ? 'scale(1.02)' : 'none'};
  gap: 15px;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  box-shadow: ${props => 
    props.$isDragging ? '0 8px 25px rgba(0,0,0,0.15)' : 
    props.$isCurrent ? '0 4px 15px rgba(102, 126, 234, 0.3)' :
    'none'
  };
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
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  touch-action: none;

  &:hover {
    color: rgba(0, 0, 0, 0.7);
    background: rgba(0, 0, 0, 0.1);
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
`;

const SongTitleRow = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
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
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  
  &:hover {
    background: ${props => props.$isCurrent ? 'rgba(90, 111, 216, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
    color: ${props => props.$isCurrent ? '#4a5bb8' : '#333'};
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
    border-color: #3498db;
    box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
  }

  &:hover {
    border-color: #bbb;
  }

  &::placeholder {
    color: #999;
    font-style: italic;
  }
`;

const SongInfo = styled.div`
  flex: 1;
`;

const SongDetails = styled.div`
  font-size: 0.9rem;
  color: #666;
`;

const SongActions = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
`;

const Badge = styled.span<{ type: 'current' | 'no-youtube' }>`
  background: ${props => props.type === 'current' ? '#e74c3c' : '#f39c12'};
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: bold;
`;

const Modal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  border-radius: 12px;
  padding: 30px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
`;

const ModalTitle = styled.h3`
  margin-bottom: 20px;
  color: #333;
`;

const FormGroup = styled.div`
  margin-bottom: 20px;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #333;
`;

const Input = styled.input`
  width: 100%;
  padding: 10px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: #667eea;
  }
`;


const ModalButtons = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
`;

const LoadingMessage = styled.div`
  text-align: center;
  padding: 40px;
  color: #666;
`;

const SettingsSection = styled.div`
  margin-bottom: 30px;
  background: rgba(255, 255, 255, 0.1);
  padding: 20px;
  border-radius: 12px;
  backdrop-filter: blur(10px);
`;

const SettingsTitle = styled.h2`
  color: #333;
  margin: 0 0 20px 0;
  font-size: 1.5rem;
`;

const SettingsCard = styled.div`
  background: rgba(255, 255, 255, 0.05);
  padding: 20px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

const SettingsLabel = styled.label`
  display: block;
  color: #333;
  margin-bottom: 8px;
  font-weight: 600;
`;

const SettingsInput = styled.input`
  width: 100px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  color: #333;
  margin-right: 10px;
  
  &:focus {
    outline: none;
    border-color: #667eea;
  }
`;

const SettingsButton = styled.button`
  background: #3498db;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  margin-right: 15px;

  &:hover:not(:disabled) {
    background: #2980b9;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const SettingsDescription = styled.p`
  color: #666;
  font-size: 0.9rem;
  margin: 10px 0 0 0;
  line-height: 1.4;
`;

const DropZone = styled.div<{ $isVisible?: boolean }>`
  height: 4px;
  background: #3498db;
  border-radius: 2px;
  margin: 5px 0;
  opacity: ${props => props.$isVisible ? 1 : 0};
  transition: opacity 0.2s ease;
  box-shadow: 0 0 10px rgba(52, 152, 219, 0.5);
`;

const AdminDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'edit' | 'youtube'>('edit');
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    youtubeUrl: ''
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [regressionValue, setRegressionValue] = useState(0.1);
  const [customUrl, setCustomUrl] = useState('');
  const [overlayTitle, setOverlayTitle] = useState('Willkommen beim Karaoke');
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [showQRCodeOverlay, setShowQRCodeOverlay] = useState(false);
  const [showPastSongs, setShowPastSongs] = useState(false);
  const [activeTab, setActiveTab] = useState<'playlist' | 'settings' | 'users'>('playlist');
  const [manualSongData, setManualSongData] = useState({
    singerName: '',
    songInput: ''
  });
  const navigate = useNavigate();

  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await adminAPI.getDashboard();
      setDashboardData(response.data);
      
      // Fetch settings including regression value and custom URL
      const settingsResponse = await adminAPI.getSettings();
      if (settingsResponse.data.settings.regression_value) {
        setRegressionValue(parseFloat(settingsResponse.data.settings.regression_value));
      }
      if (settingsResponse.data.settings.custom_url) {
        setCustomUrl(settingsResponse.data.settings.custom_url);
      }
      if (settingsResponse.data.settings.overlay_title) {
        setOverlayTitle(settingsResponse.data.settings.overlay_title);
      }
      
      // Check QR overlay status from show API
      try {
        const showResponse = await showAPI.getCurrentSong();
        const overlayStatus = showResponse.data.showQRCodeOverlay || false;
        setShowQRCodeOverlay(overlayStatus);
      } catch (showError) {
      }
      
      return response.data; // Return data for use in other functions
    } catch (error: any) {
      if (error.response?.status === 401) {
        navigate('/admin/login');
      }
      console.error('Error fetching dashboard data:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchDashboardData();
    // Refresh every 10 seconds
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // Load admin users when users tab is active
  useEffect(() => {
    if (activeTab === 'users') {
      fetchAdminUsers();
    }
  }, [activeTab]);

  const handleUpdateRegressionValue = async () => {
    setSettingsLoading(true);
    try {
      await adminAPI.updateRegressionValue(regressionValue);
      toast.success('Regression-Wert erfolgreich aktualisiert!');
    } catch (error) {
      console.error('Error updating regression value:', error);
      toast.error('Fehler beim Aktualisieren des Regression-Werts');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleUpdateCustomUrl = async () => {
    setSettingsLoading(true);
    try {
      await adminAPI.updateCustomUrl(customUrl);
      toast.success('Eigene URL erfolgreich aktualisiert!');
    } catch (error) {
      console.error('Error updating custom URL:', error);
      toast.error('Fehler beim Aktualisieren der eigenen URL');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleUpdateOverlayTitle = async () => {
    setSettingsLoading(true);
    try {
      await adminAPI.updateOverlayTitle(overlayTitle);
      toast.success('Overlay-Überschrift erfolgreich aktualisiert!');
    } catch (error) {
      console.error('Error updating overlay title:', error);
      toast.error('Fehler beim Aktualisieren der Overlay-Überschrift');
    } finally {
      setSettingsLoading(false);
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

  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [youtubeLinks, setYoutubeLinks] = useState<{[key: number]: string}>({});
  
  // Admin User Management
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [newUserData, setNewUserData] = useState({ username: '', password: '' });
  const [userManagementLoading, setUserManagementLoading] = useState(false);

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

  const handleYouTubeFieldClick = async (song: Song) => {
    const currentLink = youtubeLinks[song.id] || song.youtube_url;
    if (currentLink) {
      try {
        await navigator.clipboard.writeText(currentLink);
        toast.success('YouTube-Link in die Zwischenablage kopiert!');
      } catch (error) {
        console.error('Error copying YouTube link:', error);
        toast.error('Fehler beim Kopieren des YouTube-Links');
      }
    }
  };

  const handleYouTubeFieldChange = (songId: number, value: string) => {
    setYoutubeLinks(prev => ({
      ...prev,
      [songId]: value
    }));
  };

  const handleYouTubeFieldBlur = async (songId: number, value: string) => {
    try {
      await adminAPI.updateYouTubeUrl(songId, value);
      toast.success('YouTube-Link aktualisiert!');
      // Refresh data to get updated link
      fetchDashboardData();
    } catch (error) {
      console.error('Error updating YouTube URL:', error);
      toast.error('Fehler beim Aktualisieren des YouTube-Links');
    }
  };


  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
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
      await fetchDashboardData();
      closeModal();
    } catch (error) {
      console.error('Error updating song:', error);
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

  const handleManualSongSubmit = async () => {
    if (!manualSongData.singerName.trim() || !manualSongData.songInput.trim()) {
      toast.error('Bitte fülle alle Felder aus');
      return;
    }

    setActionLoading(true);
    try {
      // Use the same API endpoint as the /new route
      const response = await fetch('/api/songs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: manualSongData.singerName.trim(),
          song: manualSongData.songInput.trim(),
          device_id: 'ADM' // Admin device ID
        }),
      });

      if (!response.ok) {
        throw new Error('Fehler beim Hinzufügen des Songs');
      }

      toast.success('Song erfolgreich hinzugefügt!');
      setManualSongData({ singerName: '', songInput: '' });
      await fetchDashboardData();
    } catch (error) {
      console.error('Error adding manual song:', error);
      toast.error('Fehler beim Hinzufügen des Songs');
    } finally {
      setActionLoading(false);
    }
  };

  // Admin User Management Functions
  const fetchAdminUsers = async () => {
    try {
      const response = await adminAPI.getAdminUsers();
      console.log('Admin users response:', response.data);
      setAdminUsers(response.data.adminUsers || []);
    } catch (error) {
      console.error('Error fetching admin users:', error);
      toast.error('Fehler beim Laden der Admin-Benutzer');
    }
  };

  const handleCreateAdminUser = async () => {
    if (!newUserData.username.trim() || !newUserData.password.trim()) {
      toast.error('Bitte fülle alle Felder aus');
      return;
    }

    if (newUserData.password.length < 6) {
      toast.error('Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }

    setUserManagementLoading(true);
    try {
      await adminAPI.createAdminUser(newUserData);
      toast.success('Admin-Benutzer erfolgreich erstellt!');
      setNewUserData({ username: '', password: '' });
      await fetchAdminUsers();
    } catch (error: any) {
      console.error('Error creating admin user:', error);
      const message = error.response?.data?.message || 'Fehler beim Erstellen des Admin-Benutzers';
      toast.error(message);
    } finally {
      setUserManagementLoading(false);
    }
  };

  const handleDeleteAdminUser = async (userId: number, username: string) => {
    if (!window.confirm(`Möchtest du den Admin-Benutzer "${username}" wirklich löschen?`)) {
      return;
    }

    setUserManagementLoading(true);
    try {
      await adminAPI.deleteAdminUser(userId);
      toast.success(`Admin-Benutzer "${username}" erfolgreich gelöscht!`);
      await fetchAdminUsers();
    } catch (error: any) {
      console.error('Error deleting admin user:', error);
      const message = error.response?.data?.message || 'Fehler beim Löschen des Admin-Benutzers';
      toast.error(message);
    } finally {
      setUserManagementLoading(false);
    }
  };

  if (loading) {
    return (
      <Container>
        <LoadingMessage>Lade Dashboard...</LoadingMessage>
      </Container>
    );
  }

  if (!dashboardData) {
    return (
      <Container>
        <LoadingMessage>Fehler beim Laden der Daten</LoadingMessage>
      </Container>
    );
  }

  const { playlist, currentSong, stats } = dashboardData;
  
  // Filter playlist based on showPastSongs setting
  const filteredPlaylist = showPastSongs 
    ? playlist 
    : playlist.filter(song => !currentSong || song.position >= currentSong.position);

  return (
    <Container>
      <Header>
        <Title>🎤 Admin Dashboard</Title>
        <LogoutButton onClick={handleLogout}>Abmelden</LogoutButton>
      </Header>


      <ManualSongSection>
        <ManualSongTitle>➕ Song manuell hinzufügen</ManualSongTitle>
        <ManualSongForm>
          <ManualSongInput
            type="text"
            placeholder="Sänger-Name"
            value={manualSongData.singerName}
            onChange={(e) => setManualSongData(prev => ({ ...prev, singerName: e.target.value }))}
          />
          <ManualSongInput
            type="text"
            placeholder="Song (Interpret - Titel oder YouTube-Link)"
            value={manualSongData.songInput}
            onChange={(e) => setManualSongData(prev => ({ ...prev, songInput: e.target.value }))}
          />
          <ManualSongButton 
            onClick={handleManualSongSubmit}
            disabled={actionLoading}
          >
            {actionLoading ? 'Hinzufügen...' : '➕ Hinzufügen'}
          </ManualSongButton>
        </ManualSongForm>
      </ManualSongSection>

      <TabContainer>
        <TabHeader>
          <TabButton 
            $active={activeTab === 'playlist'} 
            onClick={() => setActiveTab('playlist')}
          >
            🎵 Playlist ({filteredPlaylist.length} Songs)
          </TabButton>
          <TabButton 
            $active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ Einstellungen
          </TabButton>
          <TabButton 
            $active={activeTab === 'users'} 
            onClick={() => setActiveTab('users')}
          >
            👥 Nutzerverwaltung
          </TabButton>
        </TabHeader>
        
        <TabContent>
          {activeTab === 'playlist' && (
            <PlaylistContainer>
        <PlaylistHeader>
          <div></div>
          <ControlButtons>
            <Button 
              variant="success" 
              onClick={handleNextSong}
              disabled={actionLoading}
            >
              ⏭️ Weiter
            </Button>
            <QRCodeToggleButton 
              $active={showQRCodeOverlay}
              onClick={() => handleToggleQRCodeOverlay(!showQRCodeOverlay)}
            >
              📱 {showQRCodeOverlay ? 'QR-Code ausblenden' : 'QR-Code anzeigen'}
            </QRCodeToggleButton>
            <ShowPastSongsToggleButton 
              $active={showPastSongs}
              onClick={() => setShowPastSongs(!showPastSongs)}
            >
              📜 {showPastSongs ? 'Vergangene ausblenden' : 'Vergangene anzeigen'}
            </ShowPastSongsToggleButton>
            <Button 
              variant="danger" 
              onClick={handleClearAllSongs}
              disabled={actionLoading}
            >
              🗑️ Liste Leeren
            </Button>
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
                    $hasNoYoutube={!song.youtube_url}
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
                        <DeviceId $isCurrent={song.id === currentSong?.id}>📱 {song.device_id}</DeviceId>
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
                      </SongTitle>
                        <YouTubeField
                          type="url"
                          placeholder="YouTube-Link hier eingeben..."
                          value={youtubeLinks[song.id] !== undefined ? youtubeLinks[song.id] : (song.youtube_url || '')}
                          onChange={(e) => handleYouTubeFieldChange(song.id, e.target.value)}
                          onBlur={(e) => handleYouTubeFieldBlur(song.id, e.target.value)}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleYouTubeFieldClick(song);
                          }}
                        />
                      </SongTitleRow>
                    </SongContent>
                    
                    <SongActions>
                      {currentSong?.id === song.id && (
                        <Badge type="current">🎤 AKTUELL</Badge>
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
          )}
          
          {activeTab === 'settings' && (
            <SettingsSection>
              <SettingsTitle>⚙️ Einstellungen</SettingsTitle>
              <SettingsCard>
                <SettingsLabel>Regression-Wert:</SettingsLabel>
                <SettingsInput
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={regressionValue}
                  onChange={(e) => setRegressionValue(parseFloat(e.target.value))}
                />
                <SettingsButton 
                  onClick={handleUpdateRegressionValue}
                  disabled={settingsLoading}
                >
                  {settingsLoading ? 'Speichert...' : 'Speichern'}
                </SettingsButton>
                <SettingsDescription>
                  Der Regression-Wert bestimmt, um wie viel die Priorität eines Songs reduziert wird, 
                  wenn er nach unten rutscht (Standard: 0.1). Bei 10 Regressionen wird die Priorität um 1.0 reduziert.
                </SettingsDescription>
              </SettingsCard>
              
              <SettingsCard>
                <SettingsLabel>Eigene URL:</SettingsLabel>
                <SettingsInput
                  type="url"
                  placeholder="https://meine-domain.com"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  style={{ minWidth: '300px' }}
                />
                <SettingsButton 
                  onClick={handleUpdateCustomUrl}
                  disabled={settingsLoading}
                >
                  {settingsLoading ? 'Speichert...' : 'Speichern'}
                </SettingsButton>
                <SettingsDescription>
                  Wenn gesetzt, wird der QR-Code mit dieser URL + "/new" generiert. 
                  Wenn leer, wird automatisch die aktuelle Domain verwendet.
                </SettingsDescription>
              </SettingsCard>
              
              <SettingsCard>
                <SettingsLabel>Overlay-Überschrift:</SettingsLabel>
                <SettingsInput
                  type="text"
                  placeholder="Willkommen beim Karaoke"
                  value={overlayTitle}
                  onChange={(e) => setOverlayTitle(e.target.value)}
                  style={{ minWidth: '300px' }}
                />
                <SettingsButton 
                  onClick={handleUpdateOverlayTitle}
                  disabled={settingsLoading}
                >
                  {settingsLoading ? 'Speichert...' : 'Speichern'}
                </SettingsButton>
                <SettingsDescription>
                  Diese Überschrift wird im QR-Code Overlay im /show Endpoint angezeigt.
                </SettingsDescription>
              </SettingsCard>
            </SettingsSection>
          )}
          
          {activeTab === 'users' && (
            <SettingsSection>
              <SettingsTitle>👥 Nutzerverwaltung</SettingsTitle>
              
              {/* Create new admin user */}
              <SettingsCard>
                <SettingsLabel>Neuen Admin-Benutzer erstellen:</SettingsLabel>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                  <SettingsInput
                    type="text"
                    placeholder="Benutzername"
                    value={newUserData.username}
                    onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
                    style={{ minWidth: '200px' }}
                  />
                  <SettingsInput
                    type="password"
                    placeholder="Passwort (min. 6 Zeichen)"
                    value={newUserData.password}
                    onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                    style={{ minWidth: '200px' }}
                  />
                  <SettingsButton 
                    onClick={handleCreateAdminUser}
                    disabled={userManagementLoading}
                  >
                    {userManagementLoading ? 'Erstellt...' : 'Erstellen'}
                  </SettingsButton>
                </div>
                <SettingsDescription>
                  Erstelle neue Admin-Benutzer, die Zugriff auf das Admin-Dashboard haben.
                </SettingsDescription>
              </SettingsCard>
              
              {/* List existing admin users */}
              <SettingsCard>
                <SettingsLabel>Bestehende Admin-Benutzer:</SettingsLabel>
                {!adminUsers || adminUsers.length === 0 ? (
                  <div style={{ color: '#666', fontStyle: 'italic' }}>
                    Keine Admin-Benutzer vorhanden
                  </div>
                ) : (
                  <div style={{ marginTop: '10px' }}>
                    {adminUsers.map((user) => (
                      <div 
                        key={user.id} 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          padding: '10px',
                          border: '1px solid #ddd',
                          borderRadius: '5px',
                          marginBottom: '5px',
                          backgroundColor: '#f9f9f9'
                        }}
                      >
                        <div>
                          <strong>{user.username}</strong>
                          <div style={{ fontSize: '0.9em', color: '#666' }}>
                            Erstellt: {new Date(user.created_at).toLocaleDateString('de-DE')}
                          </div>
                        </div>
                        <Button 
                          variant="danger"
                          onClick={() => handleDeleteAdminUser(user.id, user.username)}
                          disabled={userManagementLoading}
                          style={{ padding: '5px 10px', fontSize: '0.9em' }}
                        >
                          🗑️ Löschen
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <SettingsDescription>
                  Verwaltung aller Admin-Benutzer. Du kannst deinen eigenen Account nicht löschen.
                </SettingsDescription>
              </SettingsCard>
            </SettingsSection>
          )}
        </TabContent>
      </TabContainer>

      {showModal && selectedSong && (
        <Modal onClick={closeModal}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalTitle>
              {modalType === 'youtube' ? 'YouTube Link hinzufügen' : 'Song bearbeiten'}
            </ModalTitle>
            
            <FormGroup>
              <Label>Titel:</Label>
              <Input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                disabled={modalType === 'youtube'}
              />
            </FormGroup>
            
            <FormGroup>
              <Label>Interpret:</Label>
              <Input
                type="text"
                value={formData.artist}
                onChange={(e) => setFormData(prev => ({ ...prev, artist: e.target.value }))}
                disabled={modalType === 'youtube'}
              />
            </FormGroup>
            
            <FormGroup>
              <Label>YouTube URL:</Label>
              <Input
                type="url"
                value={formData.youtubeUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, youtubeUrl: e.target.value }))}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </FormGroup>
            
            <ModalButtons>
              <Button onClick={closeModal}>Abbrechen</Button>
              <Button 
                variant="success" 
                onClick={handleSaveSong}
                disabled={actionLoading}
              >
                {actionLoading ? 'Speichert...' : 'Speichern'}
              </Button>
            </ModalButtons>
          </ModalContent>
        </Modal>
      )}

    </Container>
  );
};

export default AdminDashboard;