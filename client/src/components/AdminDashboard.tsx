import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { adminAPI, showAPI, songAPI } from '../services/api';
import { AdminDashboardData } from '../types';
import websocketService, { AdminUpdateData } from '../services/websocket';
import PlaylistTab from './admin/tabs/playlist/PlaylistTab';
import BanlistTab from './admin/tabs/BanlistTab';
import UsersTab from './admin/tabs/UsersTab';
import SettingsTab from './admin/tabs/SettingsTab';
import BackgroundMusicTab from './admin/tabs/BackgroundMusicTab';
import ApprovalModal from './admin/modals/ApprovalModal';
import SongsTab from './admin/tabs/songs/SongsTab';
import ApprovalNotificationBarComponent from './admin/ApprovalNotificationBar';
import getFirstLetter from '../utils/getFirstLetter';
import SongForm from './admin/SongForm';
import loadAllSongs from '../utils/loadAllSongs';
import { Container, LoadingMessage, Header, Title, LogoutButton, TabContainer, TabHeader, TabButton, TabContent, CurrentNextSongContainer, SongDisplayBox, SongDisplayLabel, SongDisplaySinger, SongDisplayTitle, SongTimeContainer, SongTimeRow, SongTimeLabel, SongProgressBar, SongProgressFill, SongTimeValueLeft, SongTimeValueRight } from './admin/style';


const AdminDashboard: React.FC = () => {
  const { t } = useTranslation();
  
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true); // Default to true - assume song is playing when dashboard loads
  const [songStartTimestamp, setSongStartTimestamp] = useState<string | null>(null);
  const [songDuration, setSongDuration] = useState<number | null>(null);
  const [currentSongId, setCurrentSongId] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  
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
  const [activeTab, setActiveTab] = useState<'playlist' | 'settings' | 'users' | 'banlist' | 'songs' | 'background-music'>('playlist');
  const [addSongUsdbResults, setAddSongUsdbResults] = useState<any[]>([]);
  const [addSongUsdbLoading, setAddSongUsdbLoading] = useState(false);
  const [manualSongList, setManualSongList] = useState<any[]>([]);
  const [addSongSearchTerm, setAddSongSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(async () => {
    if (!showApprovalModal) { return ; }
    const songs = await loadAllSongs();
    setManualSongList(songs);
  }, [showApprovalModal]);
  
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
      const [dashboardResponse, magicYouTubeResponse] = await Promise.all([
        adminAPI.getDashboard(),
        songAPI.getMagicYouTube()
      ]);
      
      const dashboardData = dashboardResponse.data;
      const magicYouTubeSongs = magicYouTubeResponse.data.magicYouTube || [];
      
      // Combine dashboard data with magic YouTube songs
      const combinedData = {
        ...dashboardData,
        magicYouTubeSongs
      };
      
      setDashboardData(combinedData);
      
      // Load pending approvals count
      await loadPendingApprovalsCount();
      
      
      // Check QR overlay status from show API
      try {
        const showResponse = await showAPI.getCurrentSong();
        const overlayStatus = showResponse.data.showQRCodeOverlay || false;
        setShowQRCodeOverlay(overlayStatus);
      } catch (showError) {
      }
      
      return combinedData; // Return combined data for use in other functions
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
    // Check if current song changed
    if (data.currentSong && data.currentSong.id !== currentSongId) {
      // Song changed, reset timer (will be set by song-start event)
      setSongStartTimestamp(null);
      setSongDuration(data.currentSong.duration_seconds ?? null);
      setCurrentSongId(data.currentSong.id);
      setElapsedTime(0);
    } else if (!data.currentSong && currentSongId !== null) {
      // Song was removed
      setSongStartTimestamp(null);
      setSongDuration(null);
      setCurrentSongId(null);
      setElapsedTime(0);
    } else if (data.currentSong && data.currentSong.id === currentSongId) {
      // Same song, but maybe duration is now available
      if (!songDuration && data.currentSong.duration_seconds) {
        setSongDuration(data.currentSong.duration_seconds);
        console.log('⏱️ Updated duration from admin-update:', data.currentSong.duration_seconds);
      }
    }
    
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
  }, [currentSongId, songDuration]);

  useEffect(() => {
    // Initial fetch
    fetchDashboardData();
    // USDB credentials und Cloudflared werden jetzt in der SettingsTab verwaltet
    
    // Define handleAdminToast before the .then() block so it's available in cleanup
    const handleAdminToast = (data: { 
      type: 'error' | 'success' | 'warning' | 'info'; 
      message?: string; 
      translationKey?: string;
      translationParams?: Record<string, any>;
      details?: string; 
      reasonTranslationKey?: string;
      reasonTranslationParams?: Record<string, any>;
      timestamp: string; 
    }) => {
      console.log('🍞 AdminDashboard: Received admin toast:', data);
      
      // Get translated message
      let message = data.message;
      if (data.translationKey) {
        message = t(data.translationKey, data.translationParams);
      }
      
      // Get translated details if available
      let details = data.details;
      if (data.reasonTranslationKey) {
        details = t(data.reasonTranslationKey, data.reasonTranslationParams);
      }
      
      // Show toast based on type
      switch (data.type) {
        case 'error':
          toast.error(message, {
            duration: 5000,
            position: 'top-right',
            description: details
          });
          break;
        case 'success':
          toast.success(message, {
            duration: 3000,
            position: 'top-right',
            description: details
          });
          break;
        case 'warning':
          toast(message, {
            icon: '⚠️',
            duration: 4000,
            position: 'top-right',
            description: details
          });
          break;
        case 'info':
          toast(message, {
            icon: 'ℹ️',
            duration: 3000,
            position: 'top-right',
            description: details
          });
          break;
        default:
          toast(message, {
            duration: 3000,
            position: 'top-right',
            description: details
          });
      }
    };
    
    // Define handleSongStart before the .then() block so it's available in cleanup
    const handleSongStart = (data: { songId: number; startTimestamp: string; durationSeconds: number | null; isRestart: boolean }) => {
      console.log('⏱️ Song start event received:', data);
      setSongStartTimestamp(data.startTimestamp);
      setCurrentSongId(data.songId);
      setElapsedTime(0);
      
      // Use duration from event if available
      if (data.durationSeconds && data.durationSeconds !== null) {
        setSongDuration(data.durationSeconds);
        console.log('⏱️ Using duration from song-start event:', data.durationSeconds);
      } else {
        // Duration not in event, will be set from admin-update event if available
        setSongDuration(null);
        console.log('⏱️ No duration in song-start event, waiting for admin-update');
      }
    };
    
    // Define handleTogglePlayPause before the .then() block so it's available in cleanup
    const handleTogglePlayPause = () => {
      console.log('⏯️ Frontend: Received toggle-play-pause event');
      setIsPlaying(prev => !prev);
    };
    
    // Connect to WebSocket
    console.log('🔌 Frontend: Attempting to connect to WebSocket...');
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
      console.log('🔌 Frontend: Registering event listeners...');
      websocketService.onAdminUpdate(handleAdminWebSocketUpdate);
      console.log('🔌 Frontend: Registered admin-update listener');
      
      // Listen for song start events
      websocketService.on('song-start', handleSongStart);
      console.log('🔌 Frontend: Registered song-start listener');
      
      // Listen for play/pause toggle events to update isPlaying state
      websocketService.on('toggle-play-pause', handleTogglePlayPause);
      console.log('🔌 Frontend: Registered toggle-play-pause listener');
      
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
      
      // Listen for admin toast notifications
      websocketService.on('admin-toast', handleAdminToast);
      
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
          
          toast(`🎵 ${t('adminDashboard.newSongApprovalRequest')}`, {
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
      console.log('🔌 Frontend: Cleaning up WebSocket event listeners');
      websocketService.offAdminUpdate(handleAdminWebSocketUpdate);
      websocketService.off('toggle-play-pause', handleTogglePlayPause);
      websocketService.off('song-start', handleSongStart);
      websocketService.offShowAction(() => {});
      websocketService.offPlaylistUpgrade(() => {});
      websocketService.offUSDBDownload(() => {});
      websocketService.off('admin-toast', handleAdminToast);
      websocketService.leaveAdminRoom();
      websocketService.disconnect();
    };
  }, [fetchDashboardData, handleAdminWebSocketUpdate]);

  // Interval for calculating elapsed time
  useEffect(() => {
    if (!songStartTimestamp || !isPlaying || !songDuration) {
      return;
    }

    const interval = setInterval(() => {
      const startTime = new Date(songStartTimestamp).getTime();
      const now = new Date().getTime();
      const elapsed = Math.floor((now - startTime) / 1000);
      
      // Don't exceed song duration
      const clampedElapsed = Math.min(elapsed, songDuration);
      setElapsedTime(clampedElapsed);
    }, 100); // Update every 100ms for smooth progress

    return () => clearInterval(interval);
  }, [songStartTimestamp, isPlaying, songDuration]);


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
        
          toast(`🎵 ${t('adminDashboard.songApprovalNotification', { count: pendingApprovals.length })}`, {
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

      toast.success(t('adminDashboard.songAddedSuccess'));
      
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
      toast.error(error.response?.data?.error || t('adminDashboard.songAddError'));
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
      
      toast(t('adminDashboard.songRejected'), { icon: '❌' });
      
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
      toast.error(t('adminDashboard.songRejectError'));
    }
  };

  const [showQRCodeOverlay, setShowQRCodeOverlay] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  };

  // WebSocket updates handle download status now, no need for periodic checks

  if (loading) {
    return (
      <Container>
        <LoadingMessage>{t('adminDashboard.loading')}</LoadingMessage>
      </Container>
    );
  }

  if (!dashboardData) {
    return (
      <Container>
        <LoadingMessage>{t('adminDashboard.loadError')}</LoadingMessage>
      </Container>
    );
  }

  return (
    <Container>
      {/* <Header>
        <Title>
          <img 
            src="/tkk-logo.png" 
            alt="TKK Logo" 
            style={{ 
              height: '60px', 
              marginRight: '15px',
              verticalAlign: 'middle'
            }} 
          />
          {t('adminDashboard.title')}
        </Title>
        <LogoutButton onClick={handleLogout}>{t('adminDashboard.logout')}</LogoutButton>
      </Header> */}

      {/* Approval Notification Bar */}
      <ApprovalNotificationBarComponent
        pendingApprovalsCount={pendingApprovalsCount}
        onNotificationClick={loadAndShowPendingApprovals}
      />

      {/* Current and Next Song Display */}
      <CurrentNextSongContainer>
        <SongDisplayBox $isCurrent={true}>
          <SongDisplayLabel>🎵 {t('adminDashboard.currentSong')}</SongDisplayLabel>
          {dashboardData.currentSong ? (
            <>
              <SongDisplaySinger>
                {dashboardData.currentSong.user_name || 'Unbekannt'}
              </SongDisplaySinger>
              <SongDisplayTitle>
                {dashboardData.currentSong.artist || ''} {dashboardData.currentSong.artist && dashboardData.currentSong.title ? ' - ' : ''} {dashboardData.currentSong.title || 'Kein Titel'}
              </SongDisplayTitle>
              
              {/* Time Display and Progress Bar */}
              {songDuration && songDuration > 0 && (
                <SongTimeContainer $isCurrent={true}>
                  <SongTimeRow>
                    <SongTimeValueLeft>
                      {(() => {
                        const remaining = Math.max(0, songDuration - elapsedTime);
                        const minutes = Math.floor(remaining / 60);
                        const seconds = remaining % 60;
                        return `-${minutes}:${seconds.toString().padStart(2, '0')}`;
                      })()}
                    </SongTimeValueLeft>
                    <SongProgressBar>
                      <SongProgressFill $progress={songDuration > 0 ? (elapsedTime / songDuration) * 100 : 0} />
                    </SongProgressBar>
                    <SongTimeValueRight>
                      {(() => {
                        const minutes = Math.floor(songDuration / 60);
                        const seconds = songDuration % 60;
                        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
                      })()}
                    </SongTimeValueRight>
                  </SongTimeRow>
                </SongTimeContainer>
              )}
            </>
          ) : (
            <>
              <SongDisplaySinger>-</SongDisplaySinger>
              <SongDisplayTitle>Kein Song aktiv</SongDisplayTitle>
            </>
          )}
        </SongDisplayBox>
        
        <SongDisplayBox $isCurrent={false}>
          <SongDisplayLabel>⏭️ {t('adminDashboard.nextSong')}</SongDisplayLabel>
          {(() => {
            const nextSong = dashboardData.currentSong 
              ? dashboardData.playlist.find(song => song.position > (dashboardData.currentSong?.position || 0))
              : dashboardData.playlist[0];
            
            return nextSong ? (
              <>
                <SongDisplaySinger>
                  {nextSong.user_name || 'Unbekannt'}
                </SongDisplaySinger>
                <SongDisplayTitle>
                  {nextSong.artist || ''} {nextSong.artist && nextSong.title ? ' - ' : ''} {nextSong.title || 'Kein Titel'}
                </SongDisplayTitle>
              </>
            ) : (
              <>
                <SongDisplaySinger>-</SongDisplaySinger>
                <SongDisplayTitle>Kein nächster Song</SongDisplayTitle>
              </>
            );
          })()}
        </SongDisplayBox>
      </CurrentNextSongContainer>

      <TabContainer>
        <TabHeader>
          <TabButton 
            $active={activeTab === 'playlist'} 
            onClick={() => setActiveTab('playlist')}
          >
            🎵 {t('adminDashboard.tabs.playlist')}
            {/* 🎵 Playlist ({filteredPlaylist.length} Songs) */}
          </TabButton>
          <TabButton 
            $active={activeTab === 'songs'} 
            onClick={() => {
              setActiveTab('songs');
            }}
          >
            📁 {t('adminDashboard.tabs.songs')}
          </TabButton>
          <TabButton 
            $active={activeTab === 'banlist'} 
            onClick={() => setActiveTab('banlist')}
          >
            🚫 {t('adminDashboard.tabs.banlist')}
          </TabButton>
          <TabButton 
            $active={activeTab === 'users'} 
            onClick={() => setActiveTab('users')}
          >
            👥 {t('adminDashboard.tabs.users')}
          </TabButton>
          <TabButton 
            $active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ {t('adminDashboard.tabs.settings')}
          </TabButton>
          <TabButton 
            $active={activeTab === 'background-music'} 
            onClick={() => setActiveTab('background-music')}
          >
            🎵 {t('adminDashboard.tabs.backgroundMusic')}
          </TabButton>
        </TabHeader>
        
        <TabContent>
          {activeTab === 'playlist' && (
            <PlaylistTab
              fetchDashboardData={fetchDashboardData}
              dashboardData={dashboardData}
              setDashboardData={setDashboardData}
              setActiveTab={setActiveTab}
              handleDeviceIdClick={handleDeviceIdClick}
              showQRCodeOverlay={showQRCodeOverlay}
              setShowQRCodeOverlay={setShowQRCodeOverlay}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
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
              fetchDashboardData={fetchDashboardData}
            />
          )}
          
          {activeTab === 'background-music' && (
            <BackgroundMusicTab />
          )}
          
        </TabContent>
      </TabContainer>



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