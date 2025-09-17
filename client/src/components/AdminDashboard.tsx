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













const LoadingMessage = styled.div`
  text-align: center;
  padding: 40px;
  color: #666;
`;

// Reusable Song Form Component
interface SongFormProps {
  singerName: string;
  artist: string;
  title: string;
  youtubeUrl: string;
  withBackgroundVocals: boolean;
  onSingerNameChange: (value: string) => void;
  onArtistChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onYoutubeUrlChange: (value: string) => void;
  onWithBackgroundVocalsChange: (checked: boolean) => void;
  showSongList?: boolean;
  songList?: any[];
  onSongSelect?: (song: any) => void;
  usdbResults?: any[];
  usdbLoading?: boolean;
  getFirstLetter?: (artist: string) => string;
}

const SongForm: React.FC<SongFormProps> = ({
  singerName,
  artist,
  title,
  youtubeUrl,
  withBackgroundVocals,
  onSingerNameChange,
  onArtistChange,
  onTitleChange,
  onYoutubeUrlChange,
  onWithBackgroundVocalsChange,
  showSongList = false,
  songList = [],
  onSongSelect,
  usdbResults = [],
  usdbLoading = false,
  getFirstLetter
}) => {
  return (
    <>
      {/* Singer Name */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontSize: '14px',
          fontWeight: '500',
          color: '#333'
        }}>
          Sänger-Name:
        </label>
        <input
          type="text"
          placeholder="Name des Teilnehmers"
          value={singerName}
          onChange={(e) => onSingerNameChange(e.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '14px'
          }}
        />
      </div>

      {/* Artist and Title */}
      <div style={{ 
        display: 'flex', 
        gap: '15px', 
        marginBottom: '20px',
        alignItems: 'center'
      }}>
        <div style={{ flex: 1 }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#333'
          }}>
            Interpret:
          </label>
          <input
            type="text"
            placeholder="Interpret"
            value={artist}
            onChange={(e) => onArtistChange(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#333'
          }}>
            Songtitel:
          </label>
          <input
            type="text"
            placeholder="Songtitel"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>
      </div>

      {/* YouTube Link */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        marginBottom: '20px',
        gap: '15px'
      }}>
        <div style={{ 
          flex: 1, 
          height: '1px', 
          backgroundColor: '#ddd' 
        }}></div>
        <span style={{ 
          color: '#666', 
          fontSize: '14px', 
          fontWeight: '500' 
        }}>
          oder
        </span>
        <div style={{ 
          flex: 1, 
          height: '1px', 
          backgroundColor: '#ddd' 
        }}></div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontSize: '14px',
          fontWeight: '500',
          color: '#333'
        }}>
          YouTube-Link:
        </label>
        <input
          type="text"
          placeholder="https://www.youtube.com/watch?v=..."
          value={youtubeUrl}
          onChange={(e) => onYoutubeUrlChange(e.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '14px'
          }}
        />
      </div>

      {/* Background Vocals Checkbox */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={withBackgroundVocals}
            onChange={(e) => onWithBackgroundVocalsChange(e.target.checked)}
            style={{ transform: 'scale(1.2)' }}
          />
          <span style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>
            Mit Hintergrundstimmen
          </span>
        </label>
      </div>

      {/* Song List */}
      {showSongList && (
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#333'
          }}>
            Songliste:
          </label>
          
          <div style={{ display: 'flex', padding: '8px 10px', background: '#f8f9fa', borderRadius: '8px', marginBottom: '10px', fontSize: '12px', fontWeight: '600', color: '#666' }}>
            <div style={{ flex: 1, paddingRight: '10px' }}>INTERPRET</div>
            <div style={{ flex: 1, paddingLeft: '10px', borderLeft: '1px solid #eee' }}>SONGTITEL</div>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '300px', border: '1px solid #ddd', borderRadius: '6px' }}>
            {/* USDB Results Section */}
            {usdbResults.length > 0 && (
              <div>
                <div style={{
                  position: 'sticky',
                  top: 0,
                  background: '#28a745',
                  color: 'white',
                  padding: '8px 15px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  zIndex: 10,
                  borderBottom: '2px solid #218838'
                }}>
                  USDB ({usdbResults.length})
                </div>
                {usdbResults.map((song, index) => (
                  <div
                    key={`usdb-${song.id}`}
                    onClick={() => onSongSelect?.(song)}
                    style={{
                      padding: '10px',
                      border: '1px solid #eee',
                      borderRadius: '8px',
                      marginBottom: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      backgroundColor: artist === song.artist && title === song.title ? '#e3f2fd' : 'white'
                    }}
                    onMouseEnter={(e) => {
                      if (!(artist === song.artist && title === song.title)) {
                        e.currentTarget.style.background = '#f8f9fa';
                        e.currentTarget.style.borderColor = '#667eea';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!(artist === song.artist && title === song.title)) {
                        e.currentTarget.style.background = 'white';
                        e.currentTarget.style.borderColor = '#eee';
                      }
                    }}
                  >
                    <div style={{ fontWeight: '600', color: '#333', flex: 1, paddingRight: '10px' }}>
                      {song.artist}
                    </div>
                    <div style={{ color: '#666', fontSize: '14px', flex: 1, paddingLeft: '10px', borderLeft: '1px solid #eee' }}>
                      {song.title}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Loading indicator for USDB search */}
            {usdbLoading && (
              <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                🔍 USDB-Suche läuft...
              </div>
            )}

            {/* Local Songs Section */}
            {songList.length > 0 && getFirstLetter && (() => {
              // Filter songs based on current artist and title values
              const artistTerm = (artist || '').toLowerCase().trim();
              const titleTerm = (title || '').toLowerCase().trim();
              
              const filteredSongs = songList.filter(song => {
                // If no search terms at all, show all songs
                if (!artistTerm && !titleTerm) return true;
                
                // Search in artist, title, or combined
                const songArtist = song.artist.toLowerCase();
                const songTitle = song.title.toLowerCase();
                const songCombined = `${songArtist} - ${songTitle}`;
                
                // Check if song matches any of the search criteria
                let matches = false;
                
                // If artist term exists, check if song artist contains it
                if (artistTerm) {
                  matches = matches || songArtist.includes(artistTerm) || songCombined.includes(artistTerm);
                }
                
                // If title term exists, check if song title contains it
                if (titleTerm) {
                  matches = matches || songTitle.includes(titleTerm) || songCombined.includes(titleTerm);
                }
                
                // Cross-search: artist term in title, title term in artist
                if (artistTerm && titleTerm) {
                  matches = matches || songArtist.includes(titleTerm) || songTitle.includes(artistTerm);
                }
                
                return matches;
              });
              
              // Group filtered songs by first letter of artist
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
                <>
                  {sortedGroups.length > 0 ? sortedGroups.map((letter) => (
                    <div key={letter}>
                      <div style={{
                        position: 'sticky',
                        top: 0,
                        background: '#adb5bd',
                        color: 'white',
                        padding: '8px 15px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        zIndex: 10,
                        borderBottom: '2px solid #9ca3af'
                      }}>
                        {letter}
                      </div>
                      {groupedSongs[letter].map((song, index) => (
                        <div
                          key={`${letter}-${index}`}
                          onClick={() => onSongSelect?.(song)}
                          style={{
                            padding: '10px',
                            border: '1px solid #eee',
                            borderRadius: '8px',
                            marginBottom: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            backgroundColor: artist === song.artist && title === song.title ? '#e3f2fd' : 'white'
                          }}
                          onMouseEnter={(e) => {
                            if (!(artist === song.artist && title === song.title)) {
                              e.currentTarget.style.background = '#f8f9fa';
                              e.currentTarget.style.borderColor = '#667eea';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!(artist === song.artist && title === song.title)) {
                              e.currentTarget.style.background = 'white';
                              e.currentTarget.style.borderColor = '#eee';
                            }
                          }}
                        >
                          <div style={{ fontWeight: '600', color: '#333', flex: 1, paddingRight: '10px' }}>
                            {song.artist}
                          </div>
                          <div style={{ color: '#666', fontSize: '14px', flex: 1, paddingLeft: '10px', borderLeft: '1px solid #eee' }}>
                            {song.title}
                          </div>
                        </div>
                      ))}
                    </div>
                  )) : (
                    <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                      Keine lokalen Songs gefunden
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </>
  );
};

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
  const [showQRCodeOverlay, setShowQRCodeOverlay] = useState(false);
  const [showPastSongs, setShowPastSongs] = useState(false);
  const [activeTab, setActiveTab] = useState<'playlist' | 'settings' | 'users' | 'banlist' | 'songs'>('playlist');
  const [isPlaying, setIsPlaying] = useState(false);
  const [manualSongData, setManualSongData] = useState({
    singerName: '',
    songInput: ''
  });
  const [showManualSongList, setShowManualSongList] = useState(false);
  const [manualSongList, setManualSongList] = useState<any[]>([]);
  const [manualSongSearchTerm, setManualSongSearchTerm] = useState('');
  
  // New Add Song Modal State
  const [showAddSongModal, setShowAddSongModal] = useState(false);
  const [addSongData, setAddSongData] = useState({
    singerName: '',
    artist: '',
    title: '',
    youtubeUrl: ''
  });
  const [addSongSearchTerm, setAddSongSearchTerm] = useState('');
  
  // USDB Search State for Add Song Modal
  const [addSongUsdbResults, setAddSongUsdbResults] = useState<any[]>([]);
  const [addSongUsdbLoading, setAddSongUsdbLoading] = useState(false);
  const [addSongUsdbTimeout, setAddSongUsdbTimeout] = useState<NodeJS.Timeout | null>(null);
  
  
  // Song Management
  const [songs, setSongs] = useState<any[]>([]);
  const [invisibleSongs, setInvisibleSongs] = useState<any[]>([]);
  const [processingSongs, setProcessingSongs] = useState<Set<string>>(new Set());
  const [songSearchTerm, setSongSearchTerm] = useState('');
  const [songTab, setSongTab] = useState<'all' | 'visible' | 'invisible'>('all');
  const [ultrastarAudioSettings, setUltrastarAudioSettings] = useState<Record<string, string>>({});
  
  // Rename modal state
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameSong, setRenameSong] = useState<any>(null);
  const [renameData, setRenameData] = useState({
    newArtist: '',
    newTitle: ''
  });
  
  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteSong, setDeleteSong] = useState<any>(null);
  
  // YouTube Download Dialog
  const [showYouTubeDialog, setShowYouTubeDialog] = useState(false);
  const [selectedSongForDownload, setSelectedSongForDownload] = useState<any>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [downloadingVideo, setDownloadingVideo] = useState(false);
  
  
  const navigate = useNavigate();

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
  
  
  const [showUsdbDialog, setShowUsdbDialog] = useState(false);
  const [usdbUrl, setUsdbUrl] = useState('');
  const [usdbDownloading, setUsdbDownloading] = useState(false);
  
  // Batch USDB Management
  const [usdbBatchUrls, setUsdbBatchUrls] = useState<string[]>(['']);
  const [usdbBatchDownloading, setUsdbBatchDownloading] = useState(false);
  const [usdbBatchProgress, setUsdbBatchProgress] = useState({ current: 0, total: 0 });
  const [usdbBatchResults, setUsdbBatchResults] = useState<Array<{url: string, status: 'pending' | 'downloading' | 'completed' | 'error', message?: string}>>([]);
  const [usdbBatchCurrentDownloading, setUsdbBatchCurrentDownloading] = useState<number | null>(null);

  // USDB Search Management
  const [usdbSearchInterpret, setUsdbSearchInterpret] = useState('');
  const [usdbSearchTitle, setUsdbSearchTitle] = useState('');
  const [usdbSearchResults, setUsdbSearchResults] = useState<Array<{id: number, artist: string, title: string, url: string}>>([]);
  const [usdbSearchLoading, setUsdbSearchLoading] = useState(false);

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
      // Use the same API function as the /new route
      const response = await songAPI.requestSong({
        name: manualSongData.singerName.trim(),
        songInput: manualSongData.songInput.trim(),
        deviceId: 'ADMIN' // Admin device ID
      });

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

  const handleOpenManualSongList = async () => {
    try {
      const [localResponse, ultrastarResponse, fileResponse] = await Promise.all([
        songAPI.getServerVideos(),
        songAPI.getUltrastarSongs(),
        songAPI.getFileSongs()
      ]);
      
      const serverVideos = localResponse.data.videos || [];
      const ultrastarSongs = ultrastarResponse.data.songs || [];
      const fileSongs = fileResponse.data.fileSongs || [];
      
      // Combine and deduplicate songs
      const allSongs = [...fileSongs];
      
      // Add server videos
      serverVideos.forEach(serverVideo => {
        const exists = allSongs.some(song => 
          song.artist.toLowerCase() === serverVideo.artist.toLowerCase() &&
          song.title.toLowerCase() === serverVideo.title.toLowerCase()
        );
        if (!exists) {
          allSongs.push(serverVideo);
        }
      });
      
      // Add ultrastar songs
      ultrastarSongs.forEach(ultrastarSong => {
        const exists = allSongs.some(song => 
          song.artist.toLowerCase() === ultrastarSong.artist.toLowerCase() &&
          song.title.toLowerCase() === ultrastarSong.title.toLowerCase()
        );
        if (!exists) {
          allSongs.push(ultrastarSong);
        }
      });
      
      // Sort alphabetically by artist, then by title
      allSongs.sort((a, b) => {
        const artistA = a.artist.toLowerCase();
        const artistB = b.artist.toLowerCase();
        if (artistA !== artistB) {
          return artistA.localeCompare(artistB);
        }
        return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
      });
      
      setManualSongList(allSongs);
      setShowManualSongList(true);
    } catch (error) {
      console.error('Error loading manual song list:', error);
      toast.error('Fehler beim Laden der Songliste');
    }
  };

  const handleCloseManualSongList = () => {
    setShowManualSongList(false);
    setManualSongSearchTerm('');
  };

  const handleSelectManualSong = (song: any) => {
    setManualSongData(prev => ({
      ...prev,
      songInput: `${song.artist} - ${song.title}`
    }));
    handleCloseManualSongList();
  };

  const filteredManualSongs = manualSongList.filter(song =>
    song.artist.toLowerCase().includes(manualSongSearchTerm.toLowerCase()) ||
    song.title.toLowerCase().includes(manualSongSearchTerm.toLowerCase()) ||
    `${song.artist} - ${song.title}`.toLowerCase().includes(manualSongSearchTerm.toLowerCase())
  );

  // Load all available songs (server videos, ultrastar, file songs)
  const loadAllSongs = async () => {
    try {
      const [localResponse, ultrastarResponse, fileResponse] = await Promise.all([
        songAPI.getServerVideos(),
        songAPI.getUltrastarSongs(),
        songAPI.getFileSongs()
      ]);
      
      const serverVideos = localResponse.data.videos || [];
      const ultrastarSongs = ultrastarResponse.data.songs || [];
      const fileSongs = fileResponse.data.fileSongs || [];
      
      // Combine all songs
      const allSongs = [
        ...serverVideos.map((video: any) => ({
          artist: video.artist,
          title: video.title,
          mode: 'server_video'
        })),
        ...ultrastarSongs.map((song: any) => ({
          artist: song.artist,
          title: song.title,
          mode: 'ultrastar'
        })),
        ...fileSongs.map((song: any) => ({
          artist: song.artist,
          title: song.title,
          mode: 'file'
        }))
      ];
      
      // Sort by artist, then by title
      allSongs.sort((a, b) => {
        const artistA = a.artist.toLowerCase();
        const artistB = b.artist.toLowerCase();
        if (artistA !== artistB) {
          return artistA.localeCompare(artistB);
        }
        return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
      });
      
      setManualSongList(allSongs);
      return allSongs;
    } catch (error) {
      console.error('Error loading all songs:', error);
      toast.error('Fehler beim Laden der Songliste');
      return [];
    }
  };

  // New Add Song Modal Handlers
  const handleOpenAddSongModal = async () => {
    await loadAllSongs();
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
    if (addSongUsdbTimeout) {
      clearTimeout(addSongUsdbTimeout);
      setAddSongUsdbTimeout(null);
    }
  };

  const handleSelectAddSong = (song: any) => {
    setAddSongData(prev => ({
      ...prev,
      artist: song.artist,
      title: song.title
    }));
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

  const filteredAddSongs = manualSongList.filter(song =>
    song.artist.toLowerCase().includes(addSongSearchTerm.toLowerCase()) ||
    song.title.toLowerCase().includes(addSongSearchTerm.toLowerCase()) ||
    `${song.artist} - ${song.title}`.toLowerCase().includes(addSongSearchTerm.toLowerCase())
  );



  // USDB Search with delay
  const performUSDBSearch = async (artist: string, title: string) => {
    if (!artist.trim() && !title.trim()) {
      setAddSongUsdbResults([]);
      return;
    }

    setAddSongUsdbLoading(true);
    try {
      const response = await adminAPI.searchUSDB(
        artist.trim() || undefined,
        title.trim() || undefined,
        20 // Limit to 20 results for modal
      );

      const songs = response.data.songs || [];
      setAddSongUsdbResults(songs);
    } catch (error) {
      console.error('Error searching USDB:', error);
      setAddSongUsdbResults([]);
    } finally {
      setAddSongUsdbLoading(false);
    }
  };

  // Debounced USDB search
  const triggerUSDBSearch = (artist: string, title: string) => {
    // Clear existing timeout
    if (addSongUsdbTimeout) {
      clearTimeout(addSongUsdbTimeout);
    }

    // Show loading state immediately
    if (artist.trim() || title.trim()) {
      setAddSongUsdbLoading(true);
      setAddSongUsdbResults([]);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      performUSDBSearch(artist, title);
    }, 2000); // 2 seconds delay

    setAddSongUsdbTimeout(timeout);
  };

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (addSongUsdbTimeout) {
        clearTimeout(addSongUsdbTimeout);
      }
    };
  }, [addSongUsdbTimeout]);

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

  // Song Management Functions
  const fetchSongs = useCallback(async () => {
    try {
      const [localResponse, ultrastarResponse, fileResponse, audioSettingsResponse, youtubeResponse] = await Promise.all([
        songAPI.getServerVideos(),
        songAPI.getUltrastarSongs(),
        songAPI.getFileSongs(),
        adminAPI.getUltrastarAudioSettings(),
        songAPI.getYouTubeSongs()
      ]);
      
      const serverVideos = localResponse.data.videos || [];
      const ultrastarSongs = ultrastarResponse.data.songs || [];
      const fileSongs = fileResponse.data.fileSongs || [];
      const youtubeSongs = youtubeResponse.data.youtubeSongs || [];
      const audioSettings = audioSettingsResponse.data.ultrastarAudioSettings || [];
      
      // Convert audio settings to a lookup object
      const audioSettingsMap: Record<string, string> = {};
      audioSettings.forEach((setting: any) => {
        const key = `${setting.artist}-${setting.title}`;
        audioSettingsMap[key] = setting.audio_preference;
      });
      setUltrastarAudioSettings(audioSettingsMap);
      
      // Combine and deduplicate songs, preserving all modes
      const allSongs = [...fileSongs];
      
      // Add server videos
      serverVideos.forEach(serverVideo => {
        const existingIndex = allSongs.findIndex(song => 
          song.artist.toLowerCase() === serverVideo.artist.toLowerCase() &&
          song.title.toLowerCase() === serverVideo.title.toLowerCase()
        );
        if (existingIndex !== -1) {
          // Song exists, add server_video mode
          if (!allSongs[existingIndex].modes) {
            allSongs[existingIndex].modes = [];
          }
          if (!allSongs[existingIndex].modes.includes('server_video')) {
            allSongs[existingIndex].modes.push('server_video');
          }
        } else {
          // Song doesn't exist, add as server_video only
          allSongs.push({ ...serverVideo, modes: ['server_video'] });
        }
      });
      
      // Add ultrastar songs
      ultrastarSongs.forEach(ultrastarSong => {
        const existingIndex = allSongs.findIndex(song => 
          song.artist.toLowerCase() === ultrastarSong.artist.toLowerCase() &&
          song.title.toLowerCase() === ultrastarSong.title.toLowerCase()
        );
        if (existingIndex !== -1) {
          // Song exists, add ultrastar mode and file status
          if (!allSongs[existingIndex].modes) {
            allSongs[existingIndex].modes = [];
          }
          if (!allSongs[existingIndex].modes.includes('ultrastar')) {
            allSongs[existingIndex].modes.push('ultrastar');
          }
          // Update file status from ultrastar song
          allSongs[existingIndex].hasVideo = ultrastarSong.hasVideo;
          allSongs[existingIndex].hasPreferredVideo = ultrastarSong.hasPreferredVideo;
          allSongs[existingIndex].hasHp2Hp5 = ultrastarSong.hasHp2Hp5;
          allSongs[existingIndex].hasAudio = ultrastarSong.hasAudio;
        } else {
          // Song doesn't exist, add as ultrastar only with file status
          allSongs.push({ 
            ...ultrastarSong, 
            modes: ['ultrastar'],
            hasVideo: ultrastarSong.hasVideo,
            hasPreferredVideo: ultrastarSong.hasPreferredVideo,
            hasHp2Hp5: ultrastarSong.hasHp2Hp5,
            hasAudio: ultrastarSong.hasAudio
          });
        }
      });
      
      // Add YouTube cache songs
      youtubeSongs.forEach(youtubeSong => {
        const existingIndex = allSongs.findIndex(song => 
          song.artist.toLowerCase() === youtubeSong.artist.toLowerCase() &&
          song.title.toLowerCase() === youtubeSong.title.toLowerCase()
        );
        if (existingIndex !== -1) {
          // Song exists, add youtube_cache mode
          if (!allSongs[existingIndex].modes) {
            allSongs[existingIndex].modes = [];
          }
          if (!allSongs[existingIndex].modes.includes('youtube_cache')) {
            allSongs[existingIndex].modes.push('youtube_cache');
          }
        } else {
          // Song doesn't exist, add as youtube_cache only
          allSongs.push({ 
            ...youtubeSong, 
            modes: ['youtube_cache'],
            hasVideo: youtubeSong.hasVideo
          });
        }
      });
      
      // Add modes array to songs that don't have modes yet
      allSongs.forEach(song => {
        if (!song.modes) {
          song.modes = ['file'];
        }
      });
      
      // Sort alphabetically by artist, then by title
      allSongs.sort((a, b) => {
        const artistA = a.artist.toLowerCase();
        const artistB = b.artist.toLowerCase();
        if (artistA !== artistB) {
          return artistA.localeCompare(artistB);
        }
        return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
      });
      
      setSongs(allSongs);
    } catch (error) {
      console.error('Error loading songs:', error);
      toast.error('Fehler beim Laden der Songliste');
    }
  }, []);

  const fetchInvisibleSongs = useCallback(async () => {
    try {
      const response = await adminAPI.getInvisibleSongs();
      setInvisibleSongs(response.data.invisibleSongs || []);
    } catch (error) {
      console.error('Error fetching invisible songs:', error);
    }
  }, []);

  // Load songs when songs tab is active
  useEffect(() => {
    if (activeTab === 'songs') {
      fetchSongs();
      fetchInvisibleSongs();
    }
  }, [activeTab, fetchSongs, fetchInvisibleSongs]);

  const handleToggleSongVisibility = async (song: any) => {
    // Check if song is currently in invisible_songs table
    const isInInvisibleTable = invisibleSongs.some(invisible => 
      invisible.artist.toLowerCase() === song.artist.toLowerCase() &&
      invisible.title.toLowerCase() === song.title.toLowerCase()
    );

    if (isInInvisibleTable) {
      // Song is in invisible_songs table - remove it to make it visible
      const invisibleSong = invisibleSongs.find(invisible => 
        invisible.artist.toLowerCase() === song.artist.toLowerCase() &&
        invisible.title.toLowerCase() === song.title.toLowerCase()
      );
      
      setActionLoading(true);
      try {
        await adminAPI.removeFromInvisibleSongs(invisibleSong.id);
        toast.success(`${song.artist} - ${song.title} wieder sichtbar gemacht`);
        await fetchInvisibleSongs();
      } catch (error: any) {
        console.error('Error removing from invisible songs:', error);
        toast.error(error.response?.data?.message || 'Fehler beim Sichtbarmachen des Songs');
      } finally {
        setActionLoading(false);
      }
    } else {
      // Song is not in invisible_songs table - add it to make it invisible
      setActionLoading(true);
      try {
        await adminAPI.addToInvisibleSongs(song.artist, song.title);
        toast.success(`${song.artist} - ${song.title} unsichtbar gemacht`);
        await fetchInvisibleSongs();
      } catch (error: any) {
        console.error('Error adding to invisible songs:', error);
        toast.error(error.response?.data?.message || 'Fehler beim Unsichtbarmachen des Songs');
      } finally {
        setActionLoading(false);
      }
    }
  };

  // Check if Ultrastar song has all required files for processing
  const hasAllRequiredFiles = (song: any) => {
    if (!song.modes?.includes('ultrastar')) return false;
    
    // Check if video files are present (mp4 or webm)
    const hasVideo = song.hasVideo || false;
    
    // Check if HP2/HP5 files are present
    const hasHp2Hp5 = song.hasHp2Hp5 || false;
    
    // Show processing button only if BOTH video AND HP2/HP5 files are present
    return hasVideo && hasHp2Hp5;
  };

  // Check if Ultrastar song has missing files (for warning display)
  const hasMissingFiles = (song: any) => {
    if (!song.modes?.includes('ultrastar')) return false;
    
    // If the properties are undefined, we can't determine if files are missing
    // So we assume they are complete (don't show button/warning)
    if (song.hasVideo === undefined || song.hasHp2Hp5 === undefined) {
      return false;
    }
    
    // Check if video files are present (mp4 or webm)
    const hasVideo = song.hasVideo === true;
    
    // Check if HP2/HP5 files are present
    const hasHp2Hp5 = song.hasHp2Hp5 === true;
    
    // Show warning if video OR HP2/HP5 files are missing
    return !hasVideo || !hasHp2Hp5;
  };

  const handleUltrastarAudioChange = async (song: any, audioPreference: string) => {
    setActionLoading(true);
    try {
      const songKey = `${song.artist}-${song.title}`;
      
      if (audioPreference === 'choice') {
        // Remove setting (default to choice)
        await adminAPI.removeUltrastarAudioSetting(song.artist, song.title);
        setUltrastarAudioSettings(prev => {
          const newSettings = { ...prev };
          delete newSettings[songKey];
          return newSettings;
        });
        toast.success(`${song.artist} - ${song.title}: Audio-Einstellung auf "Auswahl" gesetzt`);
      } else {
        // Set specific preference
        await adminAPI.setUltrastarAudioSetting(song.artist, song.title, audioPreference);
        setUltrastarAudioSettings(prev => ({
          ...prev,
          [songKey]: audioPreference
        }));
        const preferenceText = audioPreference === 'hp2' ? 'Ohne Background Vocals' : 'Mit Background Vocals';
        toast.success(`${song.artist} - ${song.title}: Audio-Einstellung auf "${preferenceText}" gesetzt`);
      }
    } catch (error: any) {
      console.error('Error updating ultrastar audio setting:', error);
      toast.error(error.response?.data?.message || 'Fehler beim Aktualisieren der Audio-Einstellung');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRenameSong = (song: any) => {
    setRenameSong(song);
    setRenameData({
      newArtist: song.artist,
      newTitle: song.title
    });
    setShowRenameModal(true);
  };

  const handleRenameConfirm = async () => {
    if (!renameSong || !renameData.newArtist.trim() || !renameData.newTitle.trim()) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await adminAPI.renameSong(
        renameSong.artist,
        renameSong.title,
        renameData.newArtist.trim(),
        renameData.newTitle.trim()
      );
      
      if (response.data.success) {
        // Refresh songs list
        await fetchSongs();
        setShowRenameModal(false);
        setRenameSong(null);
        setRenameData({ newArtist: '', newTitle: '' });
        toast.success(`Song erfolgreich umbenannt zu "${renameData.newArtist.trim()} - ${renameData.newTitle.trim()}"`);
      } else {
        console.error('Rename failed:', response.data.message);
        toast.error(response.data.message || 'Fehler beim Umbenennen des Songs');
      }
    } catch (error: any) {
      console.error('Error renaming song:', error);
      toast.error(error.response?.data?.message || 'Fehler beim Umbenennen des Songs');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRenameCancel = () => {
    setShowRenameModal(false);
    setRenameSong(null);
    setRenameData({ newArtist: '', newTitle: '' });
  };

  const handleDeleteSongFromLibrary = (song: any) => {
    setDeleteSong(song);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteSong) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await adminAPI.deleteSong(
        deleteSong.artist,
        deleteSong.title
      );
      
      if (response.data.success) {
        // Refresh songs list
        await fetchSongs();
        setShowDeleteModal(false);
        setDeleteSong(null);
        toast.success(`Song "${deleteSong.artist} - ${deleteSong.title}" erfolgreich gelöscht`);
      } else {
        console.error('Delete failed:', response.data.message);
        toast.error(response.data.message || 'Fehler beim Löschen des Songs');
      }
    } catch (error: any) {
      console.error('Error deleting song:', error);
      toast.error(error.response?.data?.message || 'Fehler beim Löschen des Songs');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setDeleteSong(null);
  };

  const handleStartProcessing = async (song: any) => {
    const songKey = `${song.artist}-${song.title}`;
    
    try {
      const folderName = song.folderName || `${song.artist} - ${song.title}`;
      
      // First check if video is needed
      const videoCheckResponse = await songAPI.checkNeedsVideo(folderName);
      
      if (videoCheckResponse.data.needsVideo) {
        // Show YouTube dialog
        setSelectedSongForDownload(song);
        setYoutubeUrl('');
        setShowYouTubeDialog(true);
        return;
      }
      
      // If video exists, proceed with normal processing
      await startNormalProcessing(song, songKey, folderName);
      
    } catch (error: any) {
      console.error('Error checking video needs:', error);
      toast.error(error.response?.data?.error || 'Fehler beim Prüfen der Video-Anforderungen');
    }
  };

  const handleTestSong = async (song: { artist: string; title: string; modes?: string[]; youtubeUrl?: string }) => {
    setActionLoading(true);
    
    try {
      // Determine the best mode and URL for the song
      let mode = 'youtube';
      let youtubeUrl = song.youtubeUrl;
      
      if (song.modes?.includes('ultrastar')) {
        mode = 'ultrastar';
        youtubeUrl = `/api/ultrastar/${encodeURIComponent(`${song.artist} - ${song.title}`)}`;
      } else if (song.modes?.includes('file')) {
        mode = 'file';
        youtubeUrl = song.youtubeUrl || `${song.artist} - ${song.title}`;
      } else if (song.modes?.includes('server_video')) {
        mode = 'server_video';
        youtubeUrl = song.youtubeUrl || `/api/videos/${encodeURIComponent(`${song.artist} - ${song.title}`)}`;
      }
      
      const response = await adminAPI.testSong({
        artist: song.artist,
        title: song.title,
        mode: mode,
        youtubeUrl: youtubeUrl
      });
      
      toast.success(`Test-Song "${song.artist} - ${song.title}" erfolgreich gestartet!`);
      console.log('Test song started:', response.data);
      
      // Optionally refresh the dashboard to show updated current song
      fetchDashboardData();
      
    } catch (error: any) {
      console.error('Error testing song:', error);
      toast.error(error.response?.data?.message || 'Fehler beim Starten des Test-Songs');
    } finally {
      setActionLoading(false);
    }
  };

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

  // Helper function to mark processing as completed (for future polling implementation)
  const markProcessingCompleted = (song: any) => {
    const songKey = `${song.artist}-${song.title}`;
    setProcessingSongs(prev => {
      const newSet = new Set(prev);
      newSet.delete(songKey);
      return newSet;
    });
    toast.success(`Verarbeitung für ${song.artist} - ${song.title} abgeschlossen`);
  };


  // USDB Management Handlers

  const handleOpenUsdbDialog = () => {
    // USDB-Zugangsdaten werden jetzt in der SettingsTab verwaltet
    setShowUsdbDialog(true);
  };

  const handleCloseUsdbDialog = async () => {
    setShowUsdbDialog(false);
    setUsdbUrl('');
    
    // Reset batch states
    setUsdbBatchUrls(['']);
    setUsdbBatchDownloading(false);
    setUsdbBatchProgress({ current: 0, total: 0 });
    setUsdbBatchResults([]);
    setUsdbBatchCurrentDownloading(null);
    
    // Reset search state
    setUsdbSearchInterpret('');
    setUsdbSearchTitle('');
    setUsdbSearchResults([]);
    setUsdbSearchLoading(false);
    
    // Rescan song list after closing USDB dialog
    try {
      // First rescan file system songs (includes USDB downloads)
      await adminAPI.rescanFileSongs();
      
      // Then fetch all songs to update the UI
      await fetchSongs();
      
      toast.success('Songliste wurde aktualisiert');
    } catch (error) {
      console.error('Error refreshing song list:', error);
      // Don't show error toast as this is a background operation
    }
  };

  // Batch USDB Functions
  const handleAddBatchUrlField = () => {
    setUsdbBatchUrls([...usdbBatchUrls, '']);
  };

  const handleRemoveBatchUrlField = (index: number) => {
    if (usdbBatchUrls.length > 1) {
      const removedUrl = usdbBatchUrls[index];
      const newUrls = usdbBatchUrls.filter((_, i) => i !== index);
      setUsdbBatchUrls(newUrls);
      
      // Update results array accordingly
      const newResults = usdbBatchResults.filter((_, i) => i !== index);
      setUsdbBatchResults(newResults);

      // If the removed URL was from search results, show a message
      if (removedUrl && removedUrl.includes('usdb.animux.de')) {
        toast('Song aus Download-Liste entfernt');
      }
    }
  };

  const [oldDownloadUrls, setOldDownloadUrls] = useState([]);

  useEffect(() => {
    if (oldDownloadUrls.length > 0) {
      const urls = usdbBatchUrls.filter((url: string) => !oldDownloadUrls.includes(url));
      setUsdbBatchUrls(urls);
      setOldDownloadUrls([]);
      setUsdbBatchCurrentDownloading(null);
      handleBatchDownloadFromUSDB(null, urls);
    }
  }, [oldDownloadUrls]);

  const handleBatchUrlChange = (index: number, value: string) => {
    const newUrls = [...usdbBatchUrls];
    newUrls[index] = value;
    setUsdbBatchUrls(newUrls);
    
    // Auto-add new field if current field has content and it's the last field
    if (value.trim() && index === usdbBatchUrls.length - 1) {
      setUsdbBatchUrls([...newUrls, '']);
    }
  };

  const handleBatchDownloadFromUSDB = async (event?: React.MouseEvent, urls?: string[]) => {
    // Filter out empty URLs
    console.log("urls", urls, usdbBatchUrls);
    const validUrls = (urls || usdbBatchUrls).filter(url => url.trim());
    
    if (validUrls.length === 0) {
      // toast.error('Bitte mindestens eine USDB-URL eingeben');
      return;
    }

    setUsdbBatchDownloading(true);
    setUsdbBatchProgress({ current: 0, total: validUrls.length });
    
    // Initialize results
    const initialResults = validUrls.map(url => ({
      url,
      status: 'pending' as const,
      message: ''
    }));
    setUsdbBatchResults(initialResults);

    try {
      for (let i = 0; i < validUrls.length; i++) {
        const url = validUrls[i];
        
        // Find the index in the original array
        const originalIndex = usdbBatchUrls.findIndex(u => u === url);
        setUsdbBatchCurrentDownloading(originalIndex);
        
        // Update current status to downloading
        setUsdbBatchResults(prev => prev.map((result, index) => 
          index === i ? { ...result, status: 'downloading' } : result
        ));
        
        try {
          const response = await adminAPI.downloadFromUSDB(url);
          
          // Mark as completed
          setUsdbBatchResults(prev => prev.map((result, index) => 
            index === i ? { 
              ...result, 
              status: 'completed', 
              message: response.data.message || 'Download erfolgreich'
            } : result
          ));
          
          // Update progress
          setUsdbBatchProgress({ current: i + 1, total: validUrls.length });
          
        } catch (error: any) {
          // Mark as error
          const errorMessage = error.response?.data?.message || 'Fehler beim Download';
          setUsdbBatchResults(prev => prev.map((result, index) => 
            index === i ? { 
              ...result, 
              status: 'error', 
              message: errorMessage
            } : result
          ));
          
          // Update progress even on error
          setUsdbBatchProgress({ current: i + 1, total: validUrls.length });
        }
      }
      
      // All downloads completed
      toast.success(`Batch-Download abgeschlossen: ${validUrls.length} Songs verarbeitet`);
      
      // Rescan song list
      try {
        await adminAPI.rescanFileSongs();
        await fetchSongs();
      } catch (rescanError) {
        console.error('Error rescanning after batch download:', rescanError);
      }
      
      // Close modal after successful completion
      // setShowUsdbDialog(false);
      // setUsdbBatchUrls(['']);
      setOldDownloadUrls(validUrls);
      setUsdbBatchProgress({ current: 0, total: 0 });
      setUsdbBatchResults([]);
      // setUsdbDownloadFinished(true);
    } catch (error) {
      console.error('Error in batch download:', error);
      toast.error('Fehler beim Batch-Download');
    } finally {
      setUsdbBatchDownloading(false);
      setUsdbBatchCurrentDownloading(null);
    }
  };

  // USDB Search Functions
  const handleSearchUSDB = async () => {
    if (!usdbSearchInterpret.trim() && !usdbSearchTitle.trim()) {
      toast.error('Bitte Interpret oder Titel eingeben');
      return;
    }

    setUsdbSearchLoading(true);
    try {
      const response = await adminAPI.searchUSDB(
        usdbSearchInterpret.trim() || undefined,
        usdbSearchTitle.trim() || undefined,
        50 // Limit to 50 results
      );

      const songs = response.data.songs || [];
      setUsdbSearchResults(songs);
      
      if (songs.length === 0) {
        toast('Keine Songs gefunden');
      } else {
        toast.success(`${songs.length} Songs gefunden`);
      }
    } catch (error: any) {
      console.error('Error searching USDB:', error);
      const message = error.response?.data?.message || 'Fehler bei der USDB-Suche';
      toast.error(message);
    } finally {
      setUsdbSearchLoading(false);
    }
  };

  const handleAddSearchResultToDownload = (song: {id: number, artist: string, title: string, url: string}) => {
    // Check if URL already exists in batch list
    const urlExists = usdbBatchUrls.some(url => url.trim() === song.url);
    
    if (urlExists) {
      toast('Dieser Song ist bereits in der Download-Liste');
      return;
    }

    // Add to batch URLs
    const newUrls = [...usdbBatchUrls];
    if (newUrls[newUrls.length - 1] === '') {
      // Replace empty last field
      newUrls[newUrls.length - 1] = song.url;
    } else {
      // Add new field
      newUrls.push(song.url);
    }
    
    // Always add an empty field at the end for new entries
    newUrls.push('');
    setUsdbBatchUrls(newUrls);

    // Remove from search results
    setUsdbSearchResults(prev => prev.filter(s => s.id !== song.id));
    
    toast.success(`${song.artist} - ${song.title} zur Download-Liste hinzugefügt`);
  };

  const handleRemoveSearchResult = (songId: number) => {
    setUsdbSearchResults(prev => prev.filter(s => s.id !== songId));
  };

  // Filter search results to remove songs already in download list
  React.useEffect(() => {
    if (usdbSearchResults.length > 0) {
      const filteredResults = usdbSearchResults.filter(song => 
        !usdbBatchUrls.some(url => url.trim() === song.url)
      );
      if (filteredResults.length !== usdbSearchResults.length) {
        setUsdbSearchResults(filteredResults);
      }
    }
  }, [usdbBatchUrls]);

  const handleDownloadFromUSDB = async () => {
    if (!usdbUrl.trim()) {
      toast.error('Bitte USDB-URL eingeben');
      return;
    }

    setUsdbDownloading(true);
    try {
      const response = await adminAPI.downloadFromUSDB(usdbUrl);
      
      if (response.data.message) {
        toast.success(response.data.message);
        
        // Automatically rescan song list after successful download
        try {
          await adminAPI.rescanFileSongs();
          await fetchSongs();
        } catch (rescanError) {
          console.error('Error rescanning after download:', rescanError);
          // Don't show error toast as download was successful
        }
      }
      
      setShowUsdbDialog(false);
      setUsdbUrl('');
      // Refresh dashboard data
      await fetchDashboardData();
    } catch (error: any) {
      console.error('Error downloading from USDB:', error);
      const message = error.response?.data?.message || 'Fehler beim Herunterladen von USDB';
      toast.error(message);
    } finally {
      setUsdbDownloading(false);
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

  // Helper function to get first letter for grouping (same as in SongRequest)
  const getFirstLetter = (artist: string) => {
    const firstChar = artist.charAt(0).toUpperCase();
    if (/[A-Z]/.test(firstChar)) {
      return firstChar;
    } else if (/[0-9]/.test(firstChar)) {
      return '#';
    } else {
      return '#';
    }
  };

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
            🎵 Playlist ({filteredPlaylist.length} Songs)
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
              filteredPlaylist={filteredPlaylist}
              currentSong={currentSong}
              showPastSongs={showPastSongs}
              showQRCodeOverlay={showQRCodeOverlay}
              actionLoading={actionLoading}
              isPlaying={isPlaying}
              draggedItem={draggedItem}
              dropTarget={dropTarget}
              youtubeLinks={youtubeLinks}
              onOpenAddSongModal={handleOpenAddSongModal}
              onToggleQRCodeOverlay={handleToggleQRCodeOverlay}
              onPreviousSong={handlePreviousSong}
              onTogglePlayPause={handleTogglePlayPause}
              onRestartSong={handleRestartSong}
              onNextSong={handleNextSong}
              onSetShowPastSongs={setShowPastSongs}
              onClearAllSongs={handleClearAllSongs}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onCopyToClipboard={handleCopyToClipboard}
              onYouTubeFieldChange={handleYouTubeFieldChange}
              onYouTubeFieldBlur={handleYouTubeFieldBlur}
              onPlaySong={handlePlaySong}
              onOpenModal={openModal}
              onRefreshClassification={handleRefreshClassification}
              onDeleteSong={handleDeleteSong}
              onDeviceIdClick={handleDeviceIdClick}
              isSongInYouTubeCache={isSongInYouTubeCache}
              getDownloadStatusText={getDownloadStatusText}
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
              songs={songs}
              invisibleSongs={invisibleSongs}
              songTab={songTab}
              songSearchTerm={songSearchTerm}
              actionLoading={actionLoading}
              processingSongs={processingSongs}
              ultrastarAudioSettings={ultrastarAudioSettings}
              onSongTabChange={setSongTab}
              onSongSearchTermChange={setSongSearchTerm}
              onToggleSongVisibility={handleToggleSongVisibility}
              onStartProcessing={handleStartProcessing}
              onTestSong={handleTestSong}
              onOpenUsdbDialog={handleOpenUsdbDialog}
              onRenameSong={handleRenameSong}
              onDeleteSongFromLibrary={handleDeleteSongFromLibrary}
              onUltrastarAudioChange={handleUltrastarAudioChange}
              hasMissingFiles={hasMissingFiles}
              getFirstLetter={getFirstLetter}
            />
          )}
          
        </TabContent>
      </TabContainer>

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

      {/* Manual Song List Modal */}
      <ManualSongListModal
        show={showManualSongList}
        manualSongList={filteredManualSongs}
        manualSongSearchTerm={manualSongSearchTerm}
        onClose={handleCloseManualSongList}
        onSearchTermChange={setManualSongSearchTerm}
        onSongSelect={handleSelectManualSong}
        getFirstLetter={getFirstLetter}
      />

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

      {/* USDB Batch Download Dialog */}
      {/* {here} */}
      <USDBDownloadModal
        show={showUsdbDialog}
        usdbBatchUrls={usdbBatchUrls}
        usdbBatchDownloading={usdbBatchDownloading}
        usdbBatchCurrentDownloading={usdbBatchCurrentDownloading}
        usdbBatchProgress={usdbBatchProgress}
        // onClose={handleCloseUsdbDialog}
        // onBatchUrlChange={handleBatchUrlChange}
        // onAddBatchUrlField={handleAddBatchUrlField}
        // onRemoveBatchUrlField={handleRemoveBatchUrlField}
        // onStartBatchDownload={handleStartBatchDownload}
        handleRemoveBatchUrlField={handleRemoveBatchUrlField}
        handleBatchUrlChange={handleBatchUrlChange}
        usdbBatchResults={usdbBatchResults}
        handleBatchDownloadFromUSDB={handleBatchDownloadFromUSDB}
        usdbSearchInterpret={usdbSearchInterpret}
        setUsdbSearchInterpret={setUsdbSearchInterpret}
        usdbSearchTitle={usdbSearchTitle}
        setUsdbSearchTitle={setUsdbSearchTitle}
        usdbSearchResults={usdbSearchResults}
        handleAddSearchResultToDownload={handleAddSearchResultToDownload}
        handleSearchUSDB={handleSearchUSDB}
        usdbSearchLoading={usdbSearchLoading}
        handleCloseUsdbDialog={handleCloseUsdbDialog}
      />

      {/* Rename Modal */}
      <RenameModal
        show={showRenameModal && !!renameSong}
        renameSong={renameSong}
        renameData={renameData}
        actionLoading={actionLoading}
        onClose={handleRenameCancel}
        onConfirm={handleRenameConfirm}
        onRenameDataChange={(field, value) => setRenameData(prev => ({ ...prev, [field]: value }))}
      />

      {/* Delete Modal */}
      <DeleteModal
        show={showDeleteModal && !!deleteSong}
        deleteSong={deleteSong}
        actionLoading={actionLoading}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
      />

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
              onArtistChange={(value) => {
                setAddSongData(prev => ({ ...prev, artist: value }));
                setAddSongSearchTerm(value);
                triggerUSDBSearch(value, addSongData.title);
              }}
              onTitleChange={(value) => {
                setAddSongData(prev => ({ ...prev, title: value }));
                setAddSongSearchTerm(value);
                triggerUSDBSearch(addSongData.artist, value);
              }}
              onYoutubeUrlChange={(value) => setAddSongData(prev => ({ ...prev, youtubeUrl: value }))}
              onWithBackgroundVocalsChange={() => {}} // Not used in Add Song Modal
              showSongList={true}
              songList={filteredAddSongs}
              onSongSelect={handleSelectAddSong}
              usdbResults={addSongUsdbResults}
              usdbLoading={addSongUsdbLoading}
              getFirstLetter={getFirstLetter}
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
          onArtistChange={(value) => {
            setApprovalData(prev => ({ ...prev, artist: value }));
            setAddSongSearchTerm(value);
            triggerUSDBSearch(value, approvalData.title || '');
          }}
          onTitleChange={(value) => {
            setApprovalData(prev => ({ ...prev, title: value }));
            setAddSongSearchTerm(value);
            triggerUSDBSearch(approvalData.artist || '', value);
          }}
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
          getFirstLetter={getFirstLetter}
        />
      </ApprovalModal>

    </Container>
  );
};

export default AdminDashboard;