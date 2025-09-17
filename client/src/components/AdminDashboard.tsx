import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { adminAPI, playlistAPI, showAPI, songAPI } from '../services/api';
import { AdminDashboardData, Song, AdminUser, YouTubeSong } from '../types';
import websocketService, { AdminUpdateData } from '../services/websocket';
import { cleanYouTubeUrl, extractVideoIdFromUrl } from '../utils/youtubeUrlCleaner';
import { boilDown, boilDownMatch } from '../utils/boilDown';
import PlaylistTab from './admin/tabs/PlaylistTab';
import BanlistTab from './admin/tabs/BanlistTab';
import UsersTab from './admin/tabs/UsersTab';
import SettingsTab from './admin/tabs/SettingsTab';
import RenameModal from './admin/modals/RenameModal';
import DeleteModal from './admin/modals/DeleteModal';
import ApprovalModal from './admin/modals/ApprovalModal';
import EditSongModal from './admin/modals/EditSongModal';
import ManualSongListModal from './admin/modals/ManualSongListModal';
import YouTubeDownloadModal from './admin/modals/YouTubeDownloadModal';
import SongsTab from './admin/tabs/SongsTab';
import ApprovalNotificationBarComponent from './admin/ApprovalNotificationBar';
import { Button, SmallButton } from './shared';
import USDBDownloadModal from './admin/modals/usdb/UsdbDownloadModal';
import getFirstLetter from '../utils/getFirstLetter';
import SongForm from './admin/SongForm';
import loadAllSongs from '../utils/loadAllSongs';


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

// const QRCodeToggleButton = styled.button<{ $active: boolean }>`
//   background: ${props => props.$active ? '#8e44ad' : '#95a5a6'};
//   color: white;
//   border: none;
//   padding: 15px 25px;
//   border-radius: 8px;
//   cursor: pointer;
//   font-weight: 600;
//   font-size: 1.1rem;
//   display: flex;
//   align-items: center;
//   gap: 8px;
//   transition: background-color 0.2s;

//   &:hover {
//     background: ${props => props.$active ? '#7d3c98' : '#7f8c8d'};
//   }
// `;

// const ShowPastSongsToggleButton = styled.button<{ $active: boolean }>`
//   background: ${props => props.$active ? '#3498db' : '#95a5a6'};
//   color: white;
//   border: none;
//   padding: 15px 25px;
//   border-radius: 8px;
//   cursor: pointer;
//   font-weight: 600;
//   font-size: 1.1rem;
//   display: flex;
//   align-items: center;
//   gap: 8px;
//   transition: background-color 0.2s;

//   &:hover {
//     background: ${props => props.$active ? '#2980b9' : '#7f8c8d'};
//   }
// `;


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

const LoadingMessage = styled.div`
  text-align: center;
  padding: 40px;
  color: #666;
`;

const AdminDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  
  // Song Approval System State
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [currentApprovalIndex, setCurrentApprovalIndex] = useState(0);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [approvalData, setApprovalData] = useState({
    singerName: '',
    artist: '',
    title: '',
    youtubeUrl: '',
    songInput: '',
    deviceId: '',
    withBackgroundVocals: false
  });
  const [activeTab, setActiveTab] = useState<'playlist' | 'settings' | 'users' | 'banlist' | 'songs'>('playlist');
  const [manualSongData, setManualSongData] = useState({
    singerName: '',
    songInput: ''
  });
  const [manualSongSearchTerm, setManualSongSearchTerm] = useState('');
  
  // YouTube Download Dialog
  const [showYouTubeDialog, setShowYouTubeDialog] = useState(false);
  const [selectedSongForDownload, setSelectedSongForDownload] = useState<any>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [downloadingVideo, setDownloadingVideo] = useState(false);
  const [addSongUsdbResults, setAddSongUsdbResults] = useState<any[]>([]);
  const [addSongUsdbLoading, setAddSongUsdbLoading] = useState(false);
  const [manualSongList, setManualSongList] = useState<any[]>([]);
  const [addSongSearchTerm, setAddSongSearchTerm] = useState('');
  const [processingSongs, setProcessingSongs] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  
  const handleDeviceIdClick = (deviceId: string) => {
    setActiveTab('banlist');
    // Focus the input field after a short delay to ensure the tab is rendered
    setTimeout(() => {
      const input = document.querySelector('input[placeholder="ABC (3 Zeichen)"]') as HTMLInputElement;
      if (input) {
        input.value = deviceId;
        input.focus();
      }
    }, 100);
  };

  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await adminAPI.getDashboard();
      setDashboardData(response.data);
      
      // Settings werden jetzt in der SettingsTab verwaltet
      
      // Load pending approvals count
      await loadPendingApprovalsCount();
      
      
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

  const handleAdminWebSocketUpdate = useCallback((data: AdminUpdateData) => {
    // Update dashboard data with WebSocket data
    setDashboardData(prevData => ({
      ...prevData,
      playlist: data.playlist,
      currentSong: data.currentSong,
      maxDelay: data.maxDelay,
      total: data.total,
      settings: data.settings
    }));
    
    // Settings werden jetzt in der SettingsTab verwaltet
    if (data.settings && data.settings.show_qr_overlay) {
      setShowQRCodeOverlay(data.settings.show_qr_overlay === 'true');
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchDashboardData();
    // USDB credentials und Cloudflared werden jetzt in der SettingsTab verwaltet
    
    // Connect to WebSocket
    websocketService.connect().then(() => {
      console.log('🔌 Frontend: Connected to WebSocket for admin updates');
      websocketService.joinAdminRoom();
      console.log('🔌 Frontend: Joined admin room');
      
      // Test WebSocket connection
      console.log('🔌 Frontend: WebSocket connection status:', {
        connected: websocketService.getConnectionStatus(),
        socketId: websocketService.getSocketId(),
        timestamp: new Date().toISOString()
      });
      
      // Set up WebSocket event listeners AFTER connection is established
      websocketService.onAdminUpdate(handleAdminWebSocketUpdate);
      
      // Listen for play/pause toggle events to update isPlaying state
      websocketService.on('toggle-play-pause', () => {
        setIsPlaying(prev => !prev);
      });
      
      // Listen for show actions from ShowView
      const handleShowAction = (data: { action: string; timestamp: string; [key: string]: any }) => {
        console.log('📡 Show action received:', data);
        
        switch (data.action) {
          case 'toggle-play-pause':
            console.log(`⏯️ ShowView ${data.isPlaying ? 'paused' : 'played'} song: ${data.currentSong?.artist} - ${data.currentSong?.title}`);
            setIsPlaying(data.isPlaying);
            break;
          case 'restart-song':
            console.log(`🔄 ShowView restarted song: ${data.currentSong?.artist} - ${data.currentSong?.title}`);
            break;
          case 'next-song':
            console.log(`⏭️ ShowView moved to next song: ${data.currentSong?.artist} - ${data.currentSong?.title}`);
            break;
          case 'previous-song':
            console.log(`⏮️ ShowView moved to previous song: ${data.currentSong?.artist} - ${data.currentSong?.title}`);
            break;
          case 'qr-overlay-changed':
            console.log(`📱 ShowView QR overlay ${data.showQRCodeOverlay ? 'shown' : 'hidden'}: ${data.overlayTitle}`);
            break;
          default:
            console.log(`📡 Unknown show action: ${data.action}`);
        }
        
        // Refresh dashboard data to stay in sync
        fetchDashboardData();
      };
      
      websocketService.onShowAction(handleShowAction);
      
      // Listen for playlist upgrade notifications
      websocketService.onPlaylistUpgrade((data) => {
        console.log('🎉 Frontend: Received playlist upgrade notification:', data);
        toast.success(data.message, {
          duration: 5000,
          icon: '🎉'
        });
        // Refresh dashboard data to show updated playlist
        fetchDashboardData();
      });
      
      // Listen for USDB download notifications
      websocketService.onUSDBDownload((data) => {
        console.log('📥 Frontend: Received USDB download notification:', data);
        toast.success(data.message, {
          duration: 4000,
          icon: '📥'
        });
        // Refresh dashboard data to show updated playlist
        fetchDashboardData();
      });
      
      // Listen for song approval requests
      websocketService.on('song-approval-request', async (data) => {
        console.log('🎵 Frontend: Received song approval request:', data);
        
        // Load current auto-approve setting from server
        try {
          const settingsResponse = await adminAPI.getSettings();
          const currentAutoApprove = settingsResponse.data.settings.auto_approve_songs === 'true';
          console.log('🎵 Frontend: Current auto-approve setting:', currentAutoApprove);
          
          // Check if auto-approve is disabled (inverted logic)
          if (!currentAutoApprove) {
            console.log('🎵 Frontend: Auto-approve disabled, loading all pending approvals');
            // Load all pending approvals and show them in the modal
            await loadAndShowPendingApprovals();
          } else {
            console.log('🎵 Frontend: Auto-approve enabled, ignoring approval request');
          }
        } catch (error) {
          console.error('🎵 Frontend: Error loading settings:', error);
          // Fallback: show modal anyway if we can't load settings
          const approvalData = {
            singerName: data.data.singer_name,
            artist: data.data.artist,
            title: data.data.title,
            youtubeUrl: data.data.youtube_url,
            songInput: data.data.song_input,
            deviceId: data.data.device_id,
            withBackgroundVocals: data.data.with_background_vocals
          };
          
          handleShowApprovalModal([approvalData]);
          
          toast('🎵 Neuer Songwunsch zur Bestätigung eingegangen!', {
            duration: 5000,
            icon: '🎵'
          });
        }
      });
      
      // Test WebSocket event listeners registration
      console.log('🔌 Frontend: Event listeners registered AFTER connection:', {
        adminUpdate: true,
        playlistUpgrade: true,
        usdbDownload: true,
        socketId: websocketService.getSocketId(),
        connected: websocketService.getConnectionStatus(),
        timestamp: new Date().toISOString()
      });
      
      // Test WebSocket connection by sending a test event
      console.log('🧪 Testing WebSocket connection by sending test event...');
      websocketService.emit('test-event', { message: 'Test from AdminDashboard', timestamp: new Date().toISOString() });
      
    }).catch((error) => {
      console.error('🔌 Frontend: Failed to connect to WebSocket, falling back to polling:', error);
      
      // Fallback to polling if WebSocket fails
      const interval = setInterval(fetchDashboardData, 10000);
      
      return () => {
        clearInterval(interval);
      };
    });

    // Event listeners are now set up AFTER WebSocket connection is established

    return () => {
      websocketService.offAdminUpdate(handleAdminWebSocketUpdate);
      websocketService.off('toggle-play-pause');
      websocketService.offShowAction(() => {});
      websocketService.offPlaylistUpgrade(() => {});
      websocketService.offUSDBDownload(() => {});
      websocketService.leaveAdminRoom();
      websocketService.disconnect();
    };
  }, [fetchDashboardData, handleAdminWebSocketUpdate]);


  // Song Approval System Handlers
  const handleShowApprovalModal = (approvals: any[]) => {
    setPendingApprovals(approvals);
    setCurrentApprovalIndex(0);
    if (approvals.length > 0) {
      const approval = approvals[0];
      setApprovalData({
        singerName: approval.singerName || approval.singer_name || '',
        artist: approval.artist || '',
        title: approval.title || '',
        youtubeUrl: approval.youtubeUrl || approval.youtube_url || '',
        songInput: approval.songInput || approval.song_input || '',
        deviceId: approval.deviceId || approval.device_id || '',
        withBackgroundVocals: approval.withBackgroundVocals || approval.with_background_vocals || false
      });
      setShowApprovalModal(true);
    }
  };

  const loadPendingApprovalsCount = async () => {
    try {
      const response = await adminAPI.getSongApprovals();
      const pendingApprovals = response.data.approvals || [];
      setPendingApprovalsCount(pendingApprovals.length);
    } catch (error) {
      console.error('Error loading pending approvals count:', error);
      setPendingApprovalsCount(0);
    }
  };

  const loadAndShowPendingApprovals = async () => {
    try {
      // Load all songs first
      await loadAllSongs();
      
      const response = await adminAPI.getSongApprovals();
      const pendingApprovals = response.data.approvals || [];
      
      if (pendingApprovals.length > 0) {
        // Convert to the format expected by the modal
        const formattedApprovals = pendingApprovals.map(approval => ({
          singerName: approval.singer_name || '',
          artist: approval.artist || '',
          title: approval.title || '',
          youtubeUrl: approval.youtube_url || '',
          songInput: approval.song_input || '',
          deviceId: approval.device_id || '',
          withBackgroundVocals: approval.with_background_vocals || false,
          id: approval.id // Keep the approval ID for backend operations
        }));
        
        handleShowApprovalModal(formattedApprovals);
        
        toast(`🎵 ${pendingApprovals.length} Songwunsch/Songwünsche zur Bestätigung eingegangen!`, {
          duration: 5000,
          icon: '🎵'
        });
      }
    } catch (error) {
      console.error('Error loading pending approvals:', error);
    }
  };

  const handleCloseApprovalModal = () => {
    setShowApprovalModal(false);
    setPendingApprovals([]);
    setCurrentApprovalIndex(0);
    // Update pending approvals count after closing modal
    loadPendingApprovalsCount();
    setApprovalData({
      singerName: '',
      artist: '',
      title: '',
      youtubeUrl: '',
      songInput: '',
      deviceId: '',
      withBackgroundVocals: false
    });
  };

  const handleApproveSong = async () => {
    setActionLoading(true);
    try {
      const currentApproval = pendingApprovals[currentApprovalIndex];
      
      // Use the approval API if we have an approval ID
      if (currentApproval.id) {
        await adminAPI.approveSong(currentApproval.id, {
          singerName: approvalData.singerName,
          artist: approvalData.artist,
          title: approvalData.title,
          youtubeUrl: approvalData.youtubeUrl,
          withBackgroundVocals: approvalData.withBackgroundVocals
        });
      } else {
        // Fallback to direct song request API
        let songInput = '';
        
        if (approvalData.youtubeUrl.trim()) {
          songInput = approvalData.youtubeUrl.trim();
        } else {
          songInput = `${approvalData.artist} - ${approvalData.title}`;
        }

        await songAPI.requestSong({
          name: approvalData.singerName,
          songInput: songInput,
          deviceId: approvalData.deviceId,
          withBackgroundVocals: approvalData.withBackgroundVocals
        });
      }

      toast.success('Song erfolgreich zur Playlist hinzugefügt!');
      
      // Move to next approval or close modal
      if (currentApprovalIndex < pendingApprovals.length - 1) {
        const nextIndex = currentApprovalIndex + 1;
        setCurrentApprovalIndex(nextIndex);
        const nextApproval = pendingApprovals[nextIndex];
        setApprovalData({
          singerName: nextApproval.singerName || nextApproval.singer_name || '',
          artist: nextApproval.artist || '',
          title: nextApproval.title || '',
          youtubeUrl: nextApproval.youtubeUrl || nextApproval.youtube_url || '',
          songInput: nextApproval.songInput || nextApproval.song_input || '',
          deviceId: nextApproval.deviceId || nextApproval.device_id || '',
          withBackgroundVocals: nextApproval.withBackgroundVocals || nextApproval.with_background_vocals || false
        });
        // Update count after approving
        await loadPendingApprovalsCount();
      } else {
        handleCloseApprovalModal();
        await fetchDashboardData();
      }
    } catch (error: any) {
      console.error('Error approving song:', error);
      toast.error(error.response?.data?.error || 'Fehler beim Hinzufügen des Songs');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSong = async () => {
    try {
      const currentApproval = pendingApprovals[currentApprovalIndex];
      
      // Use the approval API if we have an approval ID
      if (currentApproval.id) {
        await adminAPI.rejectSong(currentApproval.id);
      }
      
      toast('Song abgelehnt', { icon: '❌' });
      
      // Move to next approval or close modal
      if (currentApprovalIndex < pendingApprovals.length - 1) {
        const nextIndex = currentApprovalIndex + 1;
        setCurrentApprovalIndex(nextIndex);
        const nextApproval = pendingApprovals[nextIndex];
        setApprovalData({
          singerName: nextApproval.singerName || nextApproval.singer_name || '',
          artist: nextApproval.artist || '',
          title: nextApproval.title || '',
          youtubeUrl: nextApproval.youtubeUrl || nextApproval.youtube_url || '',
          songInput: nextApproval.songInput || nextApproval.song_input || '',
          deviceId: nextApproval.deviceId || nextApproval.device_id || '',
          withBackgroundVocals: nextApproval.withBackgroundVocals || nextApproval.with_background_vocals || false
        });
        // Update count after rejecting
        await loadPendingApprovalsCount();
      } else {
        handleCloseApprovalModal();
      }
    } catch (error: any) {
      console.error('Error rejecting song:', error);
      toast.error('Fehler beim Ablehnen des Songs');
    }
  };

  const [showQRCodeOverlay, setShowQRCodeOverlay] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  };

  // const handleManualSongSubmit = async () => {
  //   if (!manualSongData.singerName.trim() || !manualSongData.songInput.trim()) {
  //     toast.error('Bitte fülle alle Felder aus');
  //     return;
  //   }

  //   setActionLoading(true);
  //   try {
  //     // Use the same API function as the /new route
  //     const response = await songAPI.requestSong({
  //       name: manualSongData.singerName.trim(),
  //       songInput: manualSongData.songInput.trim(),
  //       deviceId: 'ADMIN' // Admin device ID
  //     });

  //     toast.success('Song erfolgreich hinzugefügt!');
  //     setManualSongData({ singerName: '', songInput: '' });
  //     await fetchDashboardData();
  //   } catch (error) {
  //     console.error('Error adding manual song:', error);
  //     toast.error('Fehler beim Hinzufügen des Songs');
  //   } finally {
  //     setActionLoading(false);
  //   }
  // };

  // const handleOpenManualSongList = async () => {
  //   try {
  //     const [localResponse, ultrastarResponse, fileResponse] = await Promise.all([
  //       songAPI.getServerVideos(),
  //       songAPI.getUltrastarSongs(),
  //       songAPI.getFileSongs()
  //     ]);
      
  //     const serverVideos = localResponse.data.videos || [];
  //     const ultrastarSongs = ultrastarResponse.data.songs || [];
  //     const fileSongs = fileResponse.data.fileSongs || [];
      
  //     // Combine and deduplicate songs
  //     const allSongs = [...fileSongs];
      
  //     // Add server videos
  //     serverVideos.forEach(serverVideo => {
  //       const exists = allSongs.some(song => 
  //         song.artist.toLowerCase() === serverVideo.artist.toLowerCase() &&
  //         song.title.toLowerCase() === serverVideo.title.toLowerCase()
  //       );
  //       if (!exists) {
  //         allSongs.push(serverVideo);
  //       }
  //     });
      
  //     // Add ultrastar songs
  //     ultrastarSongs.forEach(ultrastarSong => {
  //       const exists = allSongs.some(song => 
  //         song.artist.toLowerCase() === ultrastarSong.artist.toLowerCase() &&
  //         song.title.toLowerCase() === ultrastarSong.title.toLowerCase()
  //       );
  //       if (!exists) {
  //         allSongs.push(ultrastarSong);
  //       }
  //     });
      
  //     // Sort alphabetically by artist, then by title
  //     allSongs.sort((a, b) => {
  //       const artistA = a.artist.toLowerCase();
  //       const artistB = b.artist.toLowerCase();
  //       if (artistA !== artistB) {
  //         return artistA.localeCompare(artistB);
  //       }
  //       return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
  //     });
      
  //     setManualSongList(allSongs);
  //     setShowManualSongList(true);
  //   } catch (error) {
  //     console.error('Error loading manual song list:', error);
  //     toast.error('Fehler beim Laden der Songliste');
  //   }
  // };

  // const handleCloseManualSongList = () => {
  //   setShowManualSongList(false);
  //   setManualSongSearchTerm('');
  // };

  // const handleSelectManualSong = (song: any) => {
  //   setManualSongData(prev => ({
  //     ...prev,
  //     songInput: `${song.artist} - ${song.title}`
  //   }));
  //   handleCloseManualSongList();
  // };

  // const filteredManualSongs = manualSongList.filter(song =>
  //   song.artist.toLowerCase().includes(manualSongSearchTerm.toLowerCase()) ||
  //   song.title.toLowerCase().includes(manualSongSearchTerm.toLowerCase()) ||
  //   `${song.artist} - ${song.title}`.toLowerCase().includes(manualSongSearchTerm.toLowerCase())
  // );

  // Periodic check for failed USDB downloads
  React.useEffect(() => {
    const checkFailedDownloads = async () => {
      try {
        // Get all songs with downloading status
        const downloadingSongs = dashboardData?.playlist.filter(song => 
          song.status === 'downloading' || song.download_status === 'downloading'
        ) || [];

        if (downloadingSongs.length > 0) {
          console.log(`🔍 Checking ${downloadingSongs.length} downloading songs for failed downloads...`);
          
          // Check each downloading song
          for (const song of downloadingSongs) {
            try {
              // Check if folder exists by making a request to the backend
              const response = await fetch(`/api/admin/check-download-status/${song.id}`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
              });
              
              if (response.ok) {
                const result = await response.json();
                if (result.status === 'failed') {
                  console.log(`❌ Download failed for song ${song.id}: ${song.artist} - ${song.title}`);
                  // Refresh dashboard data to update UI
                  await fetchDashboardData();
                }
              }
            } catch (error) {
              console.error(`Error checking download status for song ${song.id}:`, error);
            }
          }
        }
      } catch (error) {
        console.error('Error in periodic download check:', error);
      }
    };

    // Run check every 5 seconds
    const interval = setInterval(checkFailedDownloads, 5000);
    
    // Run initial check after 10 seconds (to allow downloads to start)
    const initialTimeout = setTimeout(checkFailedDownloads, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, [dashboardData]);

  // // Check if Ultrastar song has all required files for processing
  // const hasAllRequiredFiles = (song: any) => {
  //   if (!song.modes?.includes('ultrastar')) return false;
    
  //   // Check if video files are present (mp4 or webm)
  //   const hasVideo = song.hasVideo || false;
    
  //   // Check if HP2/HP5 files are present
  //   const hasHp2Hp5 = song.hasHp2Hp5 || false;
    
  //   // Show processing button only if BOTH video AND HP2/HP5 files are present
  //   return hasVideo && hasHp2Hp5;
  // };

  // // Check if Ultrastar song has missing files (for warning display)
  // const hasMissingFiles = (song: any) => {
  //   if (!song.modes?.includes('ultrastar')) return false;
    
  //   // If the properties are undefined, we can't determine if files are missing
  //   // So we assume they are complete (don't show button/warning)
  //   if (song.hasVideo === undefined || song.hasHp2Hp5 === undefined) {
  //     return false;
  //   }
    
  //   // Check if video files are present (mp4 or webm)
  //   const hasVideo = song.hasVideo === true;
    
  //   // Check if HP2/HP5 files are present
  //   const hasHp2Hp5 = song.hasHp2Hp5 === true;
    
  //   // Show warning if video OR HP2/HP5 files are missing
  //   return !hasVideo || !hasHp2Hp5;
  // };

  // const handleUltrastarAudioChange = async (song: any, audioPreference: string) => {
  //   setActionLoading(true);
  //   try {
  //     const songKey = `${song.artist}-${song.title}`;
      
  //     if (audioPreference === 'choice') {
  //       // Remove setting (default to choice)
  //       await adminAPI.removeUltrastarAudioSetting(song.artist, song.title);
  //       setUltrastarAudioSettings(prev => {
  //         const newSettings = { ...prev };
  //         delete newSettings[songKey];
  //         return newSettings;
  //       });
  //       toast.success(`${song.artist} - ${song.title}: Audio-Einstellung auf "Auswahl" gesetzt`);
  //     } else {
  //       // Set specific preference
  //       await adminAPI.setUltrastarAudioSetting(song.artist, song.title, audioPreference);
  //       setUltrastarAudioSettings(prev => ({
  //         ...prev,
  //         [songKey]: audioPreference
  //       }));
  //       const preferenceText = audioPreference === 'hp2' ? 'Ohne Background Vocals' : 'Mit Background Vocals';
  //       toast.success(`${song.artist} - ${song.title}: Audio-Einstellung auf "${preferenceText}" gesetzt`);
  //     }
  //   } catch (error: any) {
  //     console.error('Error updating ultrastar audio setting:', error);
  //     toast.error(error.response?.data?.message || 'Fehler beim Aktualisieren der Audio-Einstellung');
  //   } finally {
  //     setActionLoading(false);
  //   }
  // };

  

  // const handleStartProcessing = async (song: any) => {
  //   const songKey = `${song.artist}-${song.title}`;
    
  //   try {
  //     const folderName = song.folderName || `${song.artist} - ${song.title}`;
      
  //     // First check if video is needed
  //     const videoCheckResponse = await songAPI.checkNeedsVideo(folderName);
      
  //     if (videoCheckResponse.data.needsVideo) {
  //       // Show YouTube dialog
  //       setSelectedSongForDownload(song);
  //       setYoutubeUrl('');
  //       setShowYouTubeDialog(true);
  //       return;
  //     }
      
  //     // If video exists, proceed with normal processing
  //     await startNormalProcessing(song, songKey, folderName);
      
  //   } catch (error: any) {
  //     console.error('Error checking video needs:', error);
  //     toast.error(error.response?.data?.error || 'Fehler beim Prüfen der Video-Anforderungen');
  //   }
  // };

  // const handleTestSong = async (song: { artist: string; title: string; modes?: string[]; youtubeUrl?: string }) => {
  //   setActionLoading(true);
    
  //   try {
  //     // Determine the best mode and URL for the song
  //     let mode = 'youtube';
  //     let youtubeUrl = song.youtubeUrl;
      
  //     if (song.modes?.includes('ultrastar')) {
  //       mode = 'ultrastar';
  //       youtubeUrl = `/api/ultrastar/${encodeURIComponent(`${song.artist} - ${song.title}`)}`;
  //     } else if (song.modes?.includes('file')) {
  //       mode = 'file';
  //       youtubeUrl = song.youtubeUrl || `${song.artist} - ${song.title}`;
  //     } else if (song.modes?.includes('server_video')) {
  //       mode = 'server_video';
  //       youtubeUrl = song.youtubeUrl || `/api/videos/${encodeURIComponent(`${song.artist} - ${song.title}`)}`;
  //     }
      
  //     const response = await adminAPI.testSong({
  //       artist: song.artist,
  //       title: song.title,
  //       mode: mode,
  //       youtubeUrl: youtubeUrl
  //     });
      
  //     toast.success(`Test-Song "${song.artist} - ${song.title}" erfolgreich gestartet!`);
  //     console.log('Test song started:', response.data);
      
  //     // Optionally refresh the dashboard to show updated current song
  //     fetchDashboardData();
      
  //   } catch (error: any) {
  //     console.error('Error testing song:', error);
  //     toast.error(error.response?.data?.message || 'Fehler beim Starten des Test-Songs');
  //   } finally {
  //     setActionLoading(false);
  //   }
  // };

  const startNormalProcessing = async (song: any, songKey: string, folderName: string) => {
    // Mark song as processing
    setProcessingSongs(prev => new Set(prev).add(songKey));
    
    try {
      const response = await songAPI.processUltrastarSong(folderName);
      
      if (response.data.status === 'no_processing_needed') {
        toast('Keine Verarbeitung erforderlich - alle Dateien sind bereits vorhanden', { icon: 'ℹ️' });
        // Remove from processing state since no processing was needed
        setProcessingSongs(prev => {
          const newSet = new Set(prev);
          newSet.delete(songKey);
          return newSet;
        });
      } else {
        toast.success(`Verarbeitung für ${song.artist} - ${song.title} gestartet`);
        console.log('Processing started:', response.data);
        // Keep in processing state - will be removed later when job completes
      }
    } catch (error: any) {
      console.error('Error starting processing:', error);
      toast.error(error.response?.data?.error || 'Fehler beim Starten der Verarbeitung');
      // Remove from processing state on error
      setProcessingSongs(prev => {
        const newSet = new Set(prev);
        newSet.delete(songKey);
        return newSet;
      });
    }
  };

  const handleYouTubeDownload = async () => {
    if (!youtubeUrl.trim()) {
      toast.error('Bitte gib eine YouTube-URL ein');
      return;
    }
    
    if (!selectedSongForDownload) {
      toast.error('Kein Song für Download ausgewählt');
      return;
    }
    
    setDownloadingVideo(true);
    
    try {
      const folderName = selectedSongForDownload.folderName || `${selectedSongForDownload.artist} - ${selectedSongForDownload.title}`;
      
      toast('YouTube-Video wird heruntergeladen...', { icon: '📥' });
      
      const response = await songAPI.downloadYouTubeVideo(folderName, youtubeUrl);
      
      if (response.data.status === 'success') {
        toast.success(`Video erfolgreich heruntergeladen: ${response.data.downloadedFile}`);
        
        // Close dialog
        setShowYouTubeDialog(false);
        setSelectedSongForDownload(null);
        setYoutubeUrl('');
        
        // Start normal processing after download
        const songKey = `${selectedSongForDownload.artist}-${selectedSongForDownload.title}`;
        await startNormalProcessing(selectedSongForDownload, songKey, folderName);
        
      } else {
        toast.error('Download fehlgeschlagen');
      }
      
    } catch (error: any) {
      console.error('Error downloading YouTube video:', error);
      toast.error(error.response?.data?.error || 'Fehler beim Herunterladen des YouTube-Videos');
    } finally {
      setDownloadingVideo(false);
    }
  };

  const handleCloseYouTubeDialog = () => {
    setShowYouTubeDialog(false);
    setSelectedSongForDownload(null);
    setYoutubeUrl('');
    setDownloadingVideo(false);
  };

  const handleProcessWithoutVideo = async () => {
    if (!selectedSongForDownload) {
      toast.error('Kein Song für Verarbeitung ausgewählt');
      return;
    }
    
    const songKey = `${selectedSongForDownload.artist}-${selectedSongForDownload.title}`;
    const folderName = selectedSongForDownload.folderName || `${selectedSongForDownload.artist} - ${selectedSongForDownload.title}`;
    
    // Close dialog first
    handleCloseYouTubeDialog();
    
    // Start processing without video
    await startNormalProcessing(selectedSongForDownload, songKey, folderName);
  };

  // // Helper function to mark processing as completed (for future polling implementation)
  // const markProcessingCompleted = (song: any) => {
  //   const songKey = `${song.artist}-${song.title}`;
  //   setProcessingSongs(prev => {
  //     const newSet = new Set(prev);
  //     newSet.delete(songKey);
  //     return newSet;
  //   });
  //   toast.success(`Verarbeitung für ${song.artist} - ${song.title} abgeschlossen`);
  // };


  // USDB Management Handlers

  // // Batch USDB Functions
  // const handleAddBatchUrlField = () => {
  //   setUsdbBatchUrls([...usdbBatchUrls, '']);
  // };

  // USDB Search Functions
  


  // const handleDownloadFromUSDB = async () => {
  //   if (!usdbUrl.trim()) {
  //     toast.error('Bitte USDB-URL eingeben');
  //     return;
  //   }

  //   setUsdbDownloading(true);
  //   try {
  //     const response = await adminAPI.downloadFromUSDB(usdbUrl);
      
  //     if (response.data.message) {
  //       toast.success(response.data.message);
        
  //       // Automatically rescan song list after successful download
  //       try {
  //         await adminAPI.rescanFileSongs();
  //         await fetchSongs();
  //       } catch (rescanError) {
  //         console.error('Error rescanning after download:', rescanError);
  //         // Don't show error toast as download was successful
  //       }
  //     }
      
  //     setShowUsdbDialog(false);
  //     setUsdbUrl('');
  //     // Refresh dashboard data
  //     await fetchDashboardData();
  //   } catch (error: any) {
  //     console.error('Error downloading from USDB:', error);
  //     const message = error.response?.data?.message || 'Fehler beim Herunterladen von USDB';
  //     toast.error(message);
  //   } finally {
  //     setUsdbDownloading(false);
  //   }
  // };

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

  return (
    <Container>
      <Header>
        <Title>🎤 Admin Dashboard</Title>
        <LogoutButton onClick={handleLogout}>Abmelden</LogoutButton>
      </Header>

      {/* Approval Notification Bar */}
      <ApprovalNotificationBarComponent
        pendingApprovalsCount={pendingApprovalsCount}
        onNotificationClick={loadAndShowPendingApprovals}
      />

      <TabContainer>
        <TabHeader>
          <TabButton 
            $active={activeTab === 'playlist'} 
            onClick={() => setActiveTab('playlist')}
          >
            🎵 Playlist
            {/* 🎵 Playlist ({filteredPlaylist.length} Songs) */}
          </TabButton>
          <TabButton 
            $active={activeTab === 'songs'} 
            onClick={() => setActiveTab('songs')}
          >
            📁 Songverwaltung
          </TabButton>
          <TabButton 
            $active={activeTab === 'banlist'} 
            onClick={() => setActiveTab('banlist')}
          >
            🚫 Banlist
          </TabButton>
          <TabButton 
            $active={activeTab === 'users'} 
            onClick={() => setActiveTab('users')}
          >
            👥 Nutzerverwaltung
          </TabButton>
          <TabButton 
            $active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ Einstellungen
          </TabButton>
        </TabHeader>
        
        <TabContent>
          {activeTab === 'playlist' && (
            <PlaylistTab
              // filteredPlaylist={filteredPlaylist}
              // currentSong={currentSong}
              // showPastSongs={showPastSongs}
              // showQRCodeOverlay={showQRCodeOverlay}
              // actionLoading={actionLoadingdropTarget}
              // isPlaying={isPlaying}
              // draggedItem={draggedItem}
              // dropTarget={dropTarget}
              // youtubeLinks={youtubeLinks}
              // onOpenAddSongModal={handleOpenAddSongModal}
              // onToggleQRCodeOverlay={handleToggleQRCodeOverlay}
              // onPreviousSong={handlePreviousSong}
              // onTogglePlayPause={handleTogglePlayPause}
              // onRestartSong={handleRestartSong}
              // onNextSong={handleNextSong}
              // onSetShowPastSongs={setShowPastSongs}
              // onClearAllSongs={handleClearAllSongs}
              // onDragStart={handleDragStart}
              // onDragOver={handleDragOver}
              // onDragLeave={handleDragLeave}
              // onDrop={handleDrop}
              showQRCodeOverlay={showQRCodeOverlay}
              setShowQRCodeOverlay={setShowQRCodeOverlay}
              setDashboardData={setDashboardData}
              // onCopyToClipboard={handleCopyToClipboard}
              // onYouTubeFieldChange={handleYouTubeFieldChange}
              // onYouTubeFieldBlur={handleYouTubeFieldBlur}
              // onPlaySong={handlePlaySong}
              // onOpenModal={openModal}
              // onRefreshClassification={handleRefreshClassification}
              // onDeleteSong={handleDeleteSong}
              fetchDashboardData={fetchDashboardData}
              isPlaying={isPlaying}
              actionLoading={actionLoading}
              setActionLoading={setActionLoading}
              dashboardData={dashboardData}
              // onDeviceIdClick={handleDeviceIdClick}
              setActiveTab={setActiveTab}
              handleDeviceIdClick={handleDeviceIdClick}
              // isSongInYouTubeCache={isSongInYouTubeCache}
              // getDownloadStatusText={getDownloadStatusText}
            />
          )}
          
          {activeTab === 'settings' && (
            <SettingsTab
              t={(key: string) => key}
            />
          )}
          
          {activeTab === 'users' && (
            <UsersTab />
          )}
          
          {activeTab === 'banlist' && (
            <BanlistTab
              onDeviceIdClick={handleDeviceIdClick}
            />
          )}
          
          {activeTab === 'songs' && (
            <SongsTab
              // onOpenUsdbDialog={handleOpenUsdbDialog}
              // onRenameSong={handleRenameSong}
              // onDeleteSongFromLibrary={handleDeleteSongFromLibrary}
              processingSongs={processingSongs}
              setProcessingSongs={setProcessingSongs}
            />
          )}
          
        </TabContent>
      </TabContainer>

      {/* Manual Song List Modal */}
      {/* <ManualSongListModal
        show={showManualSongList}
        manualSongList={filteredManualSongs}
        manualSongSearchTerm={manualSongSearchTerm}
        onClose={handleCloseManualSongList}
        onSearchTermChange={setManualSongSearchTerm}
        onSongSelect={handleSelectManualSong}
        getFirstLetter={getFirstLetter}
      /> */}

      {/* YouTube Download Dialog */}
      <YouTubeDownloadModal
        show={showYouTubeDialog}
        selectedSongForDownload={selectedSongForDownload}
        youtubeUrl={youtubeUrl}
        downloadingVideo={downloadingVideo}
        onClose={handleCloseYouTubeDialog}
        onUrlChange={setYoutubeUrl}
        onProcessWithoutVideo={handleProcessWithoutVideo}
        onDownload={handleYouTubeDownload}
      />



      {/* Song Approval Modal */}
      <ApprovalModal
        show={showApprovalModal}
        pendingApprovals={pendingApprovals}
        currentApprovalIndex={currentApprovalIndex}
        approvalData={approvalData}
        actionLoading={actionLoading}
        onClose={handleCloseApprovalModal}
        onReject={handleRejectSong}
        onApprove={handleApproveSong}
      >
        <SongForm
          singerName={approvalData.singerName}
          artist={approvalData.artist}
          title={approvalData.title}
          youtubeUrl={approvalData.youtubeUrl}
          withBackgroundVocals={approvalData.withBackgroundVocals}
          onSingerNameChange={(value) => setApprovalData(prev => ({ ...prev, singerName: value }))}
          songData={approvalData}
          setSongData={setApprovalData}
          setSongSearchTerm={setAddSongSearchTerm}
          // triggerUSDBSearch={triggerUSDBSearch}
          // onArtistChange={(value) => {
          //   setApprovalData(prev => ({ ...prev, artist: value }));
          //   setAddSongSearchTerm(value);
          //   triggerUSDBSearch(value, approvalData.title || '');
          // }}
          // onTitleChange={(value) => {
          //   setApprovalData(prev => ({ ...prev, title: value }));
          //   setAddSongSearchTerm(value);
          //   triggerUSDBSearch(approvalData.artist || '', value);
          // }}
          onYoutubeUrlChange={(value) => setApprovalData(prev => ({ ...prev, youtubeUrl: value }))}
          onWithBackgroundVocalsChange={(checked) => setApprovalData(prev => ({ ...prev, withBackgroundVocals: checked }))}
          showSongList={true}
          songList={manualSongList}
          onSongSelect={(song) => {
            setApprovalData(prev => ({
              ...prev,
              artist: song.artist,
              title: song.title,
              youtubeUrl: song.youtube_url || ''
            }));
          }}
          usdbResults={addSongUsdbResults}
          usdbLoading={addSongUsdbLoading}
          setUsdbResults={setAddSongUsdbResults}
          setUsdbLoading={setAddSongUsdbLoading}
          getFirstLetter={getFirstLetter}
        />
      </ApprovalModal>

    </Container>
  );
};

export default AdminDashboard;