import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { adminAPI, showAPI, songAPI } from '../services/api';
import { AdminDashboardData } from '../types';
import websocketService, { AdminUpdateData } from '../services/websocket';
import PlaylistTab from './admin/tabs/playlist/PlaylistTab';
import BanlistTab from './admin/tabs/BanlistTab';
import UsersTab from './admin/tabs/UsersTab';
import SettingsTab from './admin/tabs/SettingsTab';
import ApprovalModal from './admin/modals/ApprovalModal';
import SongsTab from './admin/tabs/songs/SongsTab';
import ApprovalNotificationBarComponent from './admin/ApprovalNotificationBar';
import getFirstLetter from '../utils/getFirstLetter';
import SongForm from './admin/SongForm';
import loadAllSongs from '../utils/loadAllSongs';
import { Container, LoadingMessage, Header, Title, LogoutButton, TabContainer, TabHeader, TabButton, TabContent } from './admin/style';


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
      const response = await adminAPI.getDashboard();
      setDashboardData(response.data);
      
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
            onClick={() => {
              setActiveTab('songs');
            }}
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
              showQRCodeOverlay={showQRCodeOverlay}
              setShowQRCodeOverlay={setShowQRCodeOverlay}
              setDashboardData={setDashboardData}
              fetchDashboardData={fetchDashboardData}
              isPlaying={isPlaying}
              actionLoading={actionLoading}
              setActionLoading={setActionLoading}
              dashboardData={dashboardData}
              handleDeviceIdClick={handleDeviceIdClick}
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