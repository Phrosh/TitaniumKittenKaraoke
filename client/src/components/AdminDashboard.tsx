import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { adminAPI, playlistAPI, showAPI, songAPI } from '../services/api';
import { AdminDashboardData, Song, AdminUser, YouTubeSong } from '../types';
import websocketService, { AdminUpdateData } from '../services/websocket';
import { cleanYouTubeUrl, extractVideoIdFromUrl } from '../utils/youtubeUrlCleaner';
import { boilDown, boilDownMatch } from '../utils/boilDown';

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
    transform: scale(1.05);
  }

  &:disabled {
    background: #7f8c8d;
    cursor: not-allowed;
    transform: none;
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
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
  transition: all 0.3s ease;

  &:hover {
    background: ${props => 
      props.variant === 'success' ? '#229954' :
      props.variant === 'danger' ? '#c0392b' :
      '#5a6fd8'
    };
    transform: translateY(-1px);
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
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.$isCurrent ? 'rgba(90, 111, 216, 0.2)' : '#e0e0e0'};
    transform: scale(1.05);
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
      case 'file': return '#667eea';
      case 'ultrastar': return '#8e44ad';
      case 'youtube_cache': return '#dc3545';
      default: return '#ff4444';
    }
  }};
  color: white;
  min-width: 60px;
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
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
  const [youtubeEnabled, setYoutubeEnabled] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(false);
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
  
  // Banlist Management
  const [banlist, setBanlist] = useState<any[]>([]);
  const [newBanDeviceId, setNewBanDeviceId] = useState('');
  const [newBanReason, setNewBanReason] = useState('');
  
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
      if (settingsResponse.data.settings.youtube_enabled !== undefined) {
        setYoutubeEnabled(settingsResponse.data.settings.youtube_enabled === 'true');
      }
      
      // Load file songs folder setting
      try {
        const fileSongsResponse = await adminAPI.getFileSongsFolder();
        setFileSongsFolder(fileSongsResponse.data.folderPath || '');
        setFileSongs(fileSongsResponse.data.fileSongs || []);
        setLocalServerPort(fileSongsResponse.data.port || 4000);
      } catch (error) {
        console.error('Error loading file songs folder:', error);
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
    
    // Update local state from settings
    if (data.settings) {
      if (data.settings.regression_value) {
        setRegressionValue(parseFloat(data.settings.regression_value));
      }
      if (data.settings.custom_url) {
        setCustomUrl(data.settings.custom_url);
      }
      if (data.settings.overlay_title) {
        setOverlayTitle(data.settings.overlay_title);
      }
      if (data.settings.youtube_enabled) {
        setYoutubeEnabled(data.settings.youtube_enabled === 'true');
      }
      if (data.settings.show_qr_overlay) {
        setShowQRCodeOverlay(data.settings.show_qr_overlay === 'true');
      }
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchDashboardData();
    fetchUSDBCredentials();
    
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

  // Load admin users when users tab is active
  useEffect(() => {
    if (activeTab === 'users') {
      fetchAdminUsers();
    }
  }, [activeTab]);


  // Load banlist when banlist tab is active
  useEffect(() => {
    if (activeTab === 'banlist') {
      fetchBanlist();
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

  const handleUpdateYouTubeEnabled = async () => {
    setSettingsLoading(true);
    try {
      await adminAPI.updateYouTubeEnabled(youtubeEnabled);
      toast.success('YouTube-Einstellung erfolgreich aktualisiert!');
    } catch (error) {
      console.error('Error updating YouTube setting:', error);
      toast.error('Fehler beim Aktualisieren der YouTube-Einstellung');
    } finally {
      setSettingsLoading(false);
    }
  };


  const handleUpdateFileSongsFolder = async () => {
    setSettingsLoading(true);
    try {
      const response = await adminAPI.setFileSongsFolder(fileSongsFolder, localServerPort);
      setFileSongs(response.data.fileSongs);
      toast.success('Song-Ordner erfolgreich aktualisiert!');
    } catch (error) {
      console.error('Error updating file songs folder:', error);
      toast.error('Fehler beim Aktualisieren des Song-Ordners');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleRescanFileSongs = async () => {
    setSettingsLoading(true);
    try {
      const response = await adminAPI.rescanFileSongs();
      setFileSongs(response.data.fileSongs);
      toast.success('Songs erfolgreich neu gescannt!');
    } catch (error) {
      console.error('Error rescanning file songs:', error);
      toast.error('Fehler beim Neu-Scannen der Songs');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleRemoveFileSongs = async () => {
    setSettingsLoading(true);
    try {
      const response = await adminAPI.removeFileSongs();
      setFileSongs(response.data.fileSongs);
      toast.success('Alle Songs erfolgreich aus der Liste entfernt!');
    } catch (error) {
      console.error('Error removing file songs:', error);
      toast.error('Fehler beim Entfernen der Songs');
    } finally {
      setSettingsLoading(false);
    }
  };

  const generateLocalServerCommand = () => {
    if (!fileSongsFolder) return '';
    
    const folderPath = fileSongsFolder.replace(/\\/g, '/');
    
    switch (localServerTab) {
      case 'node':
        return `node -e "const http=require('http'),fs=require('fs'),path=require('path');const port=${localServerPort},dir='${folderPath}';const server=http.createServer((req,res)=>{res.setHeader('Access-Control-Allow-Origin','*');const filePath=path.join(dir,req.url.slice(1));fs.stat(filePath,(err,stats)=>{if(err||!stats.isFile()){res.writeHead(404);res.end('Not found');return;}res.setHeader('Content-Type','video/mp4');fs.createReadStream(filePath).pipe(res);});});server.listen(port,()=>console.log('🌐 Server: http://localhost:'+port+'/'));"`;
      case 'npx':
        return `npx serve "${folderPath}" -p ${localServerPort} -s`;
      case 'python':
        return `python -m http.server ${localServerPort} --directory "${folderPath}"`;
      default:
        return '';
    }
  };

  const handleCopyServerCommand = async () => {
    const command = generateLocalServerCommand();
    if (!command) {
      toast.error('Bitte zuerst einen Song-Ordner angeben');
      return;
    }
    
    try {
      await navigator.clipboard.writeText(command);
      toast.success('Befehl in die Zwischenablage kopiert!');
    } catch (error) {
      console.error('Error copying command:', error);
      toast.error('Fehler beim Kopieren des Befehls');
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
  
  // File Songs Management
  const [fileSongsFolder, setFileSongsFolder] = useState('');
  const [fileSongs, setFileSongs] = useState<any[]>([]);
  const [localServerPort, setLocalServerPort] = useState(4000);
  const [localServerTab, setLocalServerTab] = useState<'node' | 'npx' | 'python'>('python');
  
  // USDB Management
  const [usdbCredentials, setUsdbCredentials] = useState<{username: string, password: string} | null>(null);
  const [usdbUsername, setUsdbUsername] = useState('');
  const [usdbPassword, setUsdbPassword] = useState('');
  const [usdbLoading, setUsdbLoading] = useState(false);
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
        deviceId: 'ADM' // Admin device ID
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

  // New Add Song Modal Handlers
  const handleOpenAddSongModal = async () => {
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
      setShowAddSongModal(true);
    } catch (error) {
      console.error('Error loading add song modal:', error);
      toast.error('Fehler beim Laden der Songliste');
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
        songInput: songInput
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

  // Banlist Management Functions
  const fetchBanlist = async () => {
    try {
      const response = await adminAPI.getBanlist();
      setBanlist(response.data.bannedDevices || []);
    } catch (error) {
      console.error('Error fetching banlist:', error);
    }
  };

  const handleAddToBanlist = async () => {
    if (!newBanDeviceId.trim() || newBanDeviceId.length !== 3) {
      toast.error('Device ID muss genau 3 Zeichen lang sein');
      return;
    }

    setActionLoading(true);
    try {
      await adminAPI.addToBanlist(newBanDeviceId.toUpperCase(), newBanReason.trim() || undefined);
      toast.success(`Device ID ${newBanDeviceId.toUpperCase()} zur Banlist hinzugefügt`);
      setNewBanDeviceId('');
      setNewBanReason('');
      await fetchBanlist();
    } catch (error: any) {
      console.error('Error adding to banlist:', error);
      toast.error(error.response?.data?.message || 'Fehler beim Hinzufügen zur Banlist');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveFromBanlist = async (deviceId: string) => {
    if (!window.confirm(`Device ID ${deviceId} wirklich von der Banlist entfernen?`)) {
      return;
    }

    setActionLoading(true);
    try {
      await adminAPI.removeFromBanlist(deviceId);
      toast.success(`Device ID ${deviceId} von der Banlist entfernt`);
      await fetchBanlist();
    } catch (error: any) {
      console.error('Error removing from banlist:', error);
      toast.error(error.response?.data?.message || 'Fehler beim Entfernen von der Banlist');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeviceIdClick = (deviceId: string) => {
    setActiveTab('banlist');
    setNewBanDeviceId(deviceId);
    // Focus the input field after a short delay to ensure the tab is rendered
    setTimeout(() => {
      const input = document.querySelector('input[placeholder="ABC (3 Zeichen)"]') as HTMLInputElement;
      if (input) {
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
      const response = await adminAPI.renameYouTubeCacheSong(
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

  // USDB Management Handlers
  const fetchUSDBCredentials = async () => {
    try {
      const response = await adminAPI.getUSDBCredentials();
      setUsdbCredentials(response.data.credentials);
    } catch (error) {
      console.error('Error fetching USDB credentials:', error);
    }
  };

  const handleSaveUSDBCredentials = async () => {
    if (!usdbUsername.trim() || !usdbPassword.trim()) {
      toast.error('Bitte Username und Passwort eingeben');
      return;
    }

    setUsdbLoading(true);
    try {
      await adminAPI.saveUSDBCredentials(usdbUsername, usdbPassword);
      toast.success('USDB-Zugangsdaten erfolgreich gespeichert!');
      setUsdbUsername('');
      setUsdbPassword('');
      await fetchUSDBCredentials();
    } catch (error: any) {
      console.error('Error saving USDB credentials:', error);
      const message = error.response?.data?.message || 'Fehler beim Speichern der USDB-Zugangsdaten';
      toast.error(message);
    } finally {
      setUsdbLoading(false);
    }
  };

  const handleDeleteUSDBCredentials = async () => {
    if (!window.confirm('USDB-Zugangsdaten wirklich löschen?')) {
      return;
    }

    setUsdbLoading(true);
    try {
      await adminAPI.deleteUSDBCredentials();
      toast.success('USDB-Zugangsdaten erfolgreich gelöscht!');
      setUsdbCredentials(null);
    } catch (error: any) {
      console.error('Error deleting USDB credentials:', error);
      const message = error.response?.data?.message || 'Fehler beim Löschen der USDB-Zugangsdaten';
      toast.error(message);
    } finally {
      setUsdbLoading(false);
    }
  };

  const handleOpenUsdbDialog = () => {
    if (!usdbCredentials) {
      toast.error('Bitte zuerst USDB-Zugangsdaten in den Einstellungen eingeben');
      return;
    }
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

  const handleBatchUrlChange = (index: number, value: string) => {
    const newUrls = [...usdbBatchUrls];
    newUrls[index] = value;
    setUsdbBatchUrls(newUrls);
    
    // Auto-add new field if current field has content and it's the last field
    if (value.trim() && index === usdbBatchUrls.length - 1) {
      setUsdbBatchUrls([...newUrls, '']);
    }
  };

  const handleBatchDownloadFromUSDB = async () => {
    // Filter out empty URLs
    const validUrls = usdbBatchUrls.filter(url => url.trim());
    
    if (validUrls.length === 0) {
      toast.error('Bitte mindestens eine USDB-URL eingeben');
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
      setShowUsdbDialog(false);
      setUsdbBatchUrls(['']);
      setUsdbBatchProgress({ current: 0, total: 0 });
      setUsdbBatchResults([]);
      
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

              <SettingsCard>
                <SettingsLabel>Erlaube YouTube-Links in Songwünschen:</SettingsLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={youtubeEnabled}
                      onChange={(e) => setYoutubeEnabled(e.target.checked)}
                      style={{ transform: 'scale(1.2)' }}
                    />
                    <span style={{ fontSize: '16px', fontWeight: '500', color: '#333' }}>
                      {youtubeEnabled ? 'Aktiviert' : 'Deaktiviert'}
                    </span>
                  </label>
                  <SettingsButton 
                    onClick={handleUpdateYouTubeEnabled}
                    disabled={settingsLoading}
                    style={{ marginLeft: '10px' }}
                  >
                    {settingsLoading ? 'Speichert...' : 'Speichern'}
                  </SettingsButton>
                </div>
                <SettingsDescription>
                  Wenn deaktiviert, können Benutzer nur Songs aus der lokalen Songliste auswählen. 
                  YouTube-Links werden nicht akzeptiert.
                </SettingsDescription>
              </SettingsCard>
              
              <SettingsCard>
                <SettingsLabel>USDB-Zugangsdaten:</SettingsLabel>
                {usdbCredentials ? (
                  <div style={{ marginBottom: '15px' }}>
                    <div style={{ 
                      padding: '10px', 
                      background: '#d4edda', 
                      border: '1px solid #c3e6cb', 
                      borderRadius: '4px',
                      marginBottom: '10px'
                    }}>
                      <div style={{ fontWeight: '600', color: '#155724', marginBottom: '5px' }}>
                        ✅ USDB-Zugangsdaten gespeichert
                      </div>
                      <div style={{ color: '#155724', fontSize: '14px' }}>
                        Username: {usdbCredentials.username}
                      </div>
                    </div>
                    <SettingsButton 
                      onClick={handleDeleteUSDBCredentials}
                      disabled={usdbLoading}
                      style={{ backgroundColor: '#dc3545' }}
                    >
                      {usdbLoading ? 'Löscht...' : 'Zugangsdaten löschen'}
                    </SettingsButton>
                  </div>
                ) : (
                  <div style={{ marginBottom: '15px' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                      <SettingsInput
                        type="text"
                        placeholder="USDB Username"
                        value={usdbUsername}
                        onChange={(e) => setUsdbUsername(e.target.value)}
                        style={{ minWidth: '200px' }}
                      />
                      <SettingsInput
                        type="password"
                        placeholder="USDB Passwort"
                        value={usdbPassword}
                        onChange={(e) => setUsdbPassword(e.target.value)}
                        style={{ minWidth: '200px' }}
                      />
                      <SettingsButton 
                        onClick={handleSaveUSDBCredentials}
                        disabled={usdbLoading}
                      >
                        {usdbLoading ? 'Speichert...' : 'Speichern'}
                      </SettingsButton>
                    </div>
                  </div>
                )}
                <SettingsDescription>
                  Zugangsdaten für die UltraStar Database (usdb.animux.de). 
                  Diese werden benötigt, um Songs von USDB herunterzuladen.
                </SettingsDescription>
              </SettingsCard>
              
              <SettingsCard>
                <SettingsLabel>Lokaler Song-Ordner:</SettingsLabel>
                <SettingsInput
                  type="text"
                  placeholder="C:/songs"
                  value={fileSongsFolder}
                  onChange={(e) => setFileSongsFolder(e.target.value)}
                  style={{ minWidth: '300px' }}
                />
                <SettingsButton 
                  onClick={handleUpdateFileSongsFolder}
                  disabled={settingsLoading}
                >
                  {settingsLoading ? 'Speichert...' : 'Speichern'}
                </SettingsButton>
                <SettingsButton 
                  onClick={handleRescanFileSongs}
                  disabled={settingsLoading}
                  style={{ marginLeft: '10px', backgroundColor: '#17a2b8' }}
                >
                  {settingsLoading ? 'Scannt...' : 'Neu scannen'}
                </SettingsButton>
                <SettingsButton 
                  onClick={handleRemoveFileSongs}
                  disabled={settingsLoading}
                  style={{ marginLeft: '10px', backgroundColor: '#dc3545' }}
                >
                  {settingsLoading ? 'Entfernt...' : 'Songs aus der Liste entfernen'}
                </SettingsButton>
                <SettingsDescription>
                  Ordner mit lokalen Karaoke-Videos im Format "Interpret - Songtitel.erweiterung". 
                  Diese Songs haben höchste Priorität bei der Erkennung.
                </SettingsDescription>
                
                {/* Local Server Section */}
                {fileSongsFolder && (
                  <div style={{ marginTop: '20px', padding: '15px', background: '#e8f4fd', borderRadius: '8px', border: '1px solid #bee5eb' }}>
                    <div style={{ fontWeight: '600', marginBottom: '10px', color: '#0c5460' }}>
                      🌐 Lokaler Webserver für Videos
                    </div>
                    <div style={{ fontSize: '14px', color: '#0c5460', marginBottom: '15px' }}>
                      Starte einen lokalen Webserver, damit Videos über HTTP abgespielt werden können:
                    </div>
                    
                    {/* Port Selection */}
                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#333' }}>
                        Port:
                      </label>
                      <input
                        type="number"
                        value={localServerPort}
                        onChange={(e) => setLocalServerPort(parseInt(e.target.value) || 4000)}
                        min="1000"
                        max="65535"
                        style={{
                          width: '80px',
                          padding: '5px',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                    
                    {/* Server Type Tabs */}
                    <div style={{ marginBottom: '15px' }}>
                      <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                        {[
                          { key: 'python', label: 'Python', desc: 'Built-in' },
                          { key: 'npx', label: 'NPX', desc: 'serve' },
                          { key: 'node', label: 'Node.js', desc: 'Native' }
                        ].map(({ key, label, desc }) => (
                          <button
                            key={key}
                            onClick={() => setLocalServerTab(key as any)}
                            style={{
                              padding: '8px 12px',
                              border: '1px solid #ccc',
                              borderRadius: '4px',
                              background: localServerTab === key ? '#007bff' : 'white',
                              color: localServerTab === key ? 'white' : '#333',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '500'
                            }}
                          >
                            {label}
                            <div style={{ fontSize: '10px', opacity: 0.8 }}>{desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Command Display */}
                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#333' }}>
                        Befehl zum Kopieren:
                      </label>
                      <div style={{
                        padding: '10px',
                        background: '#f8f9fa',
                        border: '1px solid #dee2e6',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontSize: '13px',
                        wordBreak: 'break-all',
                        color: '#495057'
                      }}>
                        {generateLocalServerCommand() || 'Bitte Ordner angeben'}
                      </div>
                    </div>
                    
                    {/* Copy Button */}
                    <button
                      onClick={handleCopyServerCommand}
                      disabled={!fileSongsFolder}
                      style={{
                        padding: '8px 16px',
                        background: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: fileSongsFolder ? 'pointer' : 'not-allowed',
                        opacity: fileSongsFolder ? 1 : 0.6,
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      📋 Befehl kopieren
                    </button>
                    
                    <div style={{ marginTop: '10px', fontSize: '12px', color: '#6c757d' }}>
                      <strong>Anleitung:</strong><br/>
                      1. Befehl kopieren und in CMD/PowerShell ausführen<br/>
                      2. Server läuft auf http://localhost:{localServerPort}/<br/>
                      3. Videos werden automatisch über HTTP abgespielt
                    </div>
                  </div>
                )}
                
                {fileSongs.length > 0 && (
                  <div style={{ marginTop: '15px', padding: '10px', background: '#f8f9fa', borderRadius: '8px' }}>
                    <div style={{ fontWeight: '600', marginBottom: '8px', color: '#333' }}>
                      Gefundene Songs ({fileSongs.length}):
                    </div>
                    <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '14px' }}>
                      {fileSongs.slice(0, 10).map((song, index) => (
                        <div key={index} style={{ marginBottom: '4px', color: '#666' }}>
                          {song.artist} - {song.title}
                        </div>
                      ))}
                      {fileSongs.length > 10 && (
                        <div style={{ color: '#999', fontStyle: 'italic' }}>
                          ... und {fileSongs.length - 10} weitere
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
          
          {activeTab === 'banlist' && (
            <SettingsSection>
              <SettingsTitle>🚫 Banlist-Verwaltung</SettingsTitle>
              
              {/* Add device to banlist */}
              <SettingsCard>
                <SettingsLabel>Device ID zur Banlist hinzufügen:</SettingsLabel>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                  <SettingsInput
                    type="text"
                    placeholder="ABC (3 Zeichen)"
                    value={newBanDeviceId}
                    onChange={(e) => setNewBanDeviceId(e.target.value.toUpperCase())}
                    style={{ minWidth: '120px', textTransform: 'uppercase' }}
                    maxLength={3}
                  />
                  <SettingsInput
                    type="text"
                    placeholder="Grund (optional)"
                    value={newBanReason}
                    onChange={(e) => setNewBanReason(e.target.value)}
                    style={{ minWidth: '200px' }}
                  />
                  <SettingsButton 
                    onClick={handleAddToBanlist}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Hinzufügen...' : 'Hinzufügen'}
                  </SettingsButton>
                </div>
                <SettingsDescription>
                  Device IDs auf der Banlist können keine Songs hinzufügen. Sie erhalten trotzdem eine Erfolgsmeldung.
                </SettingsDescription>
              </SettingsCard>
              
              {/* List banned devices */}
              <SettingsCard>
                <SettingsLabel>Gesperrte Device IDs ({banlist.length}):</SettingsLabel>
                {banlist.length === 0 ? (
                  <div style={{ color: '#666', fontStyle: 'italic' }}>
                    Keine Device IDs gesperrt
                  </div>
                ) : (
                  <div style={{ marginTop: '10px' }}>
                    {banlist.map((ban) => (
                      <div 
                        key={ban.id} 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          padding: '10px',
                          border: '1px solid #eee',
                          borderRadius: '6px',
                          marginBottom: '8px',
                          background: '#fff'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '16px', color: '#333' }}>
                            🚫 {ban.device_id}
                          </div>
                          <div style={{ fontSize: '14px', color: '#666', marginTop: '2px' }}>
                            {ban.reason ? `Grund: ${ban.reason}` : 'Kein Grund angegeben'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                            Gesperrt am: {new Date(ban.created_at).toLocaleString('de-DE')}
                            {ban.banned_by && ` • von ${ban.banned_by}`}
                          </div>
                        </div>
                        <Button 
                          variant="danger"
                          onClick={() => handleRemoveFromBanlist(ban.device_id)}
                          disabled={actionLoading}
                          style={{ padding: '5px 10px', fontSize: '0.9em' }}
                        >
                          🗑️ Entfernen
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <SettingsDescription>
                  Verwaltung der gesperrten Device IDs. Gesperrte Geräte können keine Songs hinzufügen.
                </SettingsDescription>
              </SettingsCard>
            </SettingsSection>
          )}
          
          {activeTab === 'songs' && (
            <SettingsSection>
              <SettingsTitle>🎵 Songverwaltung</SettingsTitle>
              
              {/* Two-column layout */}
              <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                {/* Left column: Song management buttons and search */}
                <div style={{ flex: '1', minWidth: '0' }}>
                  {/* Song Tabs */}
                  <SettingsCard>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                      <button
                        onClick={() => setSongTab('all')}
                        style={{
                          padding: '10px 20px',
                          border: '2px solid',
                          borderColor: songTab === 'all' ? '#667eea' : '#e1e5e9',
                          background: songTab === 'all' ? '#667eea' : 'white',
                          color: songTab === 'all' ? 'white' : '#333',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '14px',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        Alle Songs ({songs.length})
                      </button>
                      <button
                        onClick={() => setSongTab('visible')}
                        style={{
                          padding: '10px 20px',
                          border: '2px solid',
                          borderColor: songTab === 'visible' ? '#28a745' : '#e1e5e9',
                          background: songTab === 'visible' ? '#28a745' : 'white',
                          color: songTab === 'visible' ? 'white' : '#333',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '14px',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        Eingeblendete ({songs.filter(song => !invisibleSongs.some(invisible => 
                          invisible.artist.toLowerCase() === song.artist.toLowerCase() &&
                          invisible.title.toLowerCase() === song.title.toLowerCase()
                        )).length})
                      </button>
                      <button
                        onClick={() => setSongTab('invisible')}
                        style={{
                          padding: '10px 20px',
                          border: '2px solid',
                          borderColor: songTab === 'invisible' ? '#dc3545' : '#e1e5e9',
                          background: songTab === 'invisible' ? '#dc3545' : 'white',
                          color: songTab === 'invisible' ? 'white' : '#333',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '14px',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        Ausgeblendete ({songs.filter(song => invisibleSongs.some(invisible => 
                          invisible.artist.toLowerCase() === song.artist.toLowerCase() &&
                          invisible.title.toLowerCase() === song.title.toLowerCase()
                        )).length})
                      </button>
                    </div>
                    
                    {/* Search songs */}
                    <SettingsLabel>Songs durchsuchen:</SettingsLabel>
                    <SettingsInput
                      type="text"
                      placeholder="Nach Song oder Interpret suchen..."
                      value={songSearchTerm}
                      onChange={(e) => setSongSearchTerm(e.target.value)}
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
                      <button
                        type="button"
                        onClick={handleOpenUsdbDialog}
                        style={{
                          background: '#6f42c1',
                          color: 'white',
                          border: 'none',
                          padding: '12px 20px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '600',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          width: '100%',
                          justifyContent: 'center'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#5a2d91';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#6f42c1';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        🌐 USDB Song laden
                      </button>
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
                <SettingsLabel>
                  {songTab === 'all' && `Alle Songs (${songs.length}):`}
                  {songTab === 'visible' && `Eingeblendete Songs (${songs.filter(song => !invisibleSongs.some(invisible => 
                    invisible.artist.toLowerCase() === song.artist.toLowerCase() &&
                    invisible.title.toLowerCase() === song.title.toLowerCase()
                  )).length}):`}
                  {songTab === 'invisible' && `Ausgeblendete Songs (${songs.filter(song => invisibleSongs.some(invisible => 
                    invisible.artist.toLowerCase() === song.artist.toLowerCase() &&
                    invisible.title.toLowerCase() === song.title.toLowerCase()
                  )).length}):`}
                </SettingsLabel>
                {songs.length === 0 ? (
                  <div style={{ color: '#666', fontStyle: 'italic' }}>
                    Keine Songs vorhanden
                  </div>
                ) : (() => {
                  // Filter songs based on tab and search term
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
                  
                  // Group songs by first letter of artist
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
                    <div style={{ marginTop: '10px', maxHeight: '500px', overflowY: 'auto' }}>
                      {sortedGroups.map((letter) => (
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
                          {groupedSongs[letter].map((song) => {
                        const isInvisible = invisibleSongs.some(invisible => 
                          invisible.artist.toLowerCase() === song.artist.toLowerCase() &&
                          invisible.title.toLowerCase() === song.title.toLowerCase()
                        );
                        
                        return (
                          <div 
                            key={`${song.artist}-${song.title}`} 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center',
                              padding: '12px',
                              border: '1px solid #eee',
                              borderRadius: '6px',
                              marginBottom: '8px',
                              background: isInvisible ? '#f8f9fa' : '#fff',
                              opacity: isInvisible ? 0.7 : 1,
                              gap: '12px'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={!isInvisible}
                              onChange={() => handleToggleSongVisibility(song)}
                              disabled={actionLoading}
                              style={{
                                cursor: actionLoading ? 'not-allowed' : 'pointer',
                                flexShrink: 0
                              }}
                            />
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '20px' }}>
                              {/* Left side: Song info */}
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                  <div 
                                    style={{ 
                                      fontWeight: '600', 
                                      fontSize: '16px', 
                                      color: '#333',
                                      cursor: 'pointer',
                                      userSelect: 'none'
                                    }}
                                    onClick={() => handleToggleSongVisibility(song)}
                                    title="Klicken zum Umschalten der Sichtbarkeit"
                                  >
                                    {song.artist} - {song.title}
                                  </div>
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    {song.modes?.includes('server_video') && (
                                      <span style={{ 
                                        fontSize: '12px', 
                                        color: '#28a745',
                                        background: '#d4edda',
                                        padding: '2px 6px', 
                                        borderRadius: '4px',
                                        fontWeight: '500'
                                      }}>
                                        🟢 Server
                                      </span>
                                    )}
                                    {song.modes?.includes('file') && (
                                      <span style={{ 
                                        fontSize: '12px', 
                                        color: '#007bff',
                                        background: '#cce7ff',
                                        padding: '2px 6px', 
                                        borderRadius: '4px',
                                        fontWeight: '500'
                                      }}>
                                        🔵 Datei
                                      </span>
                                    )}
                                    {song.modes?.includes('ultrastar') && (
                                      <span style={{ 
                                        fontSize: '12px', 
                                        color: '#8e44ad',
                                        background: '#e8d5f2',
                                        padding: '2px 6px', 
                                        borderRadius: '4px',
                                        fontWeight: '500'
                                      }}>
                                        ⭐ Ultrastar
                                      </span>
                                    )}
                                    {song.mode === 'youtube' && (
                                      <span style={{ 
                                        fontSize: '12px', 
                                        color: '#dc3545',
                                        background: '#f8d7da',
                                        padding: '2px 6px', 
                                        borderRadius: '4px',
                                        fontWeight: '500'
                                      }}>
                                        🔴 YouTube
                                      </span>
                                    )}
                                    {song.modes?.includes('youtube_cache') && (
                                      <span style={{ 
                                        fontSize: '12px', 
                                        color: '#dc3545',
                                        background: '#f8d7da',
                                        padding: '2px 6px', 
                                        borderRadius: '4px',
                                        fontWeight: '500'
                                      }}>
                                        🎬 YouTube Cache
                                      </span>
                                    )}
                                    {hasMissingFiles(song) && (
                                      <span 
                                        style={{ 
                                          fontSize: '12px', 
                                          color: '#ff6b35',
                                          background: '#ffe6e0',
                                          padding: '2px 6px', 
                                          borderRadius: '4px',
                                          fontWeight: '500',
                                          cursor: 'help'
                                        }}
                                        title="Dieses Ultrastar-Video benötigt nach dem ersten Songwunsch länger für die Verarbeitung, da wichtige Dateien fehlen (Video-Datei oder HP2/HP5-Audio-Dateien)."
                                      >
                                        ⚠️ Verarbeitung
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Processing button for songs with all required files */}
                              {hasMissingFiles(song) && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <button
                                    onClick={() => handleStartProcessing(song)}
                                    disabled={actionLoading || processingSongs.has(`${song.artist}-${song.title}`)}
                                    style={{
                                      fontSize: '12px',
                                      padding: '6px 12px',
                                      backgroundColor: processingSongs.has(`${song.artist}-${song.title}`) ? '#6c757d' : '#28a745',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: (actionLoading || processingSongs.has(`${song.artist}-${song.title}`)) ? 'not-allowed' : 'pointer',
                                      fontWeight: '500',
                                      opacity: (actionLoading || processingSongs.has(`${song.artist}-${song.title}`)) ? 0.6 : 1,
                                      transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                      if (!actionLoading && !processingSongs.has(`${song.artist}-${song.title}`)) {
                                        e.currentTarget.style.backgroundColor = '#218838';
                                        e.currentTarget.style.transform = 'scale(1.05)';
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (!actionLoading && !processingSongs.has(`${song.artist}-${song.title}`)) {
                                        e.currentTarget.style.backgroundColor = '#28a745';
                                        e.currentTarget.style.transform = 'scale(1)';
                                      }
                                    }}
                                  >
                                    {processingSongs.has(`${song.artist}-${song.title}`) ? '⏳ Verarbeitung läuft...' : '🔧 Verarbeitung starten'}
                                  </button>
                                  
                                  {/* Test button for all songs */}
                                  <button
                                    onClick={() => handleTestSong(song)}
                                    disabled={actionLoading}
                                    style={{
                                      fontSize: '12px',
                                      padding: '6px 12px',
                                      backgroundColor: '#17a2b8',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                                      fontWeight: '500',
                                      opacity: actionLoading ? 0.6 : 1,
                                      transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                      if (!actionLoading) {
                                        e.currentTarget.style.backgroundColor = '#138496';
                                        e.currentTarget.style.transform = 'scale(1.05)';
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (!actionLoading) {
                                        e.currentTarget.style.backgroundColor = '#17a2b8';
                                        e.currentTarget.style.transform = 'scale(1)';
                                      }
                                    }}
                                  >
                                    🎤 Testen
                                  </button>
                                </div>
                              )}
                              
                              {/* Right side: Audio settings for Ultrastar songs */}
                              {song.modes?.includes('ultrastar') && (
                                <div style={{ flex: 1, padding: '8px', background: '#f8f9fa', borderRadius: '4px' }}>
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
                                        onChange={(e) => handleUltrastarAudioChange(song, e.target.value)}
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
                                        onChange={(e) => handleUltrastarAudioChange(song, e.target.value)}
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
                                        onChange={(e) => handleUltrastarAudioChange(song, e.target.value)}
                                        disabled={actionLoading}
                                      />
                                      Auswahl
                                    </label>
                                  </div>
                                </div>
                              )}
                              
                              {/* Test button for all songs - always on the right */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {/* Rename button for YouTube Cache songs */}
                                {song.modes?.includes('youtube_cache') && (
                                  <button
                                    onClick={() => handleRenameSong(song)}
                                    disabled={actionLoading}
                                    style={{
                                      fontSize: '12px',
                                      padding: '6px 12px',
                                      backgroundColor: '#ffc107',
                                      color: '#212529',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                                      fontWeight: '500',
                                      opacity: actionLoading ? 0.6 : 1,
                                      transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                      if (!actionLoading) {
                                        e.currentTarget.style.backgroundColor = '#e0a800';
                                        e.currentTarget.style.transform = 'scale(1.05)';
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (!actionLoading) {
                                        e.currentTarget.style.backgroundColor = '#ffc107';
                                        e.currentTarget.style.transform = 'scale(1)';
                                      }
                                    }}
                                  >
                                    ✏️ Umbenennen
                                  </button>
                                )}
                                
                                <button
                                  onClick={() => handleTestSong(song)}
                                  disabled={actionLoading}
                                  style={{
                                    fontSize: '12px',
                                    padding: '6px 12px',
                                    backgroundColor: '#17a2b8',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                                    fontWeight: '500',
                                    opacity: actionLoading ? 0.6 : 1,
                                    transition: 'all 0.2s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!actionLoading) {
                                      e.currentTarget.style.backgroundColor = '#138496';
                                      e.currentTarget.style.transform = 'scale(1.05)';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!actionLoading) {
                                      e.currentTarget.style.backgroundColor = '#17a2b8';
                                      e.currentTarget.style.transform = 'scale(1)';
                                    }
                                  }}
                                >
                                  🎤 Testen
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                          })}
                        </div>
                      ))}
                    </div>
                  );
                })()}
                <SettingsDescription>
                  Unsichtbare Songs erscheinen nicht in der öffentlichen Songliste (/new), sind aber im Admin-Dashboard weiterhin sichtbar.
                </SettingsDescription>
              </SettingsCard>
            </SettingsSection>
          )}
          
        </TabContent>
      </TabContainer>

      {showModal && selectedSong && (
        <Modal>
          <ModalContent>
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveSong();
                  }
                }}
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

      {/* Manual Song List Modal */}
      {showManualSongList && (
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
            maxWidth: '600px',
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
              <h3 style={{ margin: 0, color: '#333' }}>🎵 Server Songs</h3>
              <button
                onClick={handleCloseManualSongList}
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

            <input
              type="text"
              placeholder="Songs durchsuchen..."
              value={manualSongSearchTerm}
              onChange={(e) => setManualSongSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                marginBottom: '15px',
                fontSize: '14px'
              }}
            />
            
            <div style={{ display: 'flex', padding: '8px 10px', background: '#f8f9fa', borderRadius: '8px', marginBottom: '10px', fontSize: '12px', fontWeight: '600', color: '#666' }}>
              <div style={{ flex: 1, paddingRight: '10px' }}>INTERPRET</div>
              <div style={{ flex: 1, paddingLeft: '10px', borderLeft: '1px solid #eee' }}>SONGTITEL</div>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '400px' }}>
              {filteredManualSongs.length > 0 ? (() => {
                // Group songs by first letter of artist
                const groupedSongs = filteredManualSongs.reduce((groups, song) => {
                  const letter = getFirstLetter(song.artist);
                  if (!groups[letter]) {
                    groups[letter] = [];
                  }
                  groups[letter].push(song);
                  return groups;
                }, {} as Record<string, typeof filteredManualSongs>);
                
                const sortedGroups = Object.keys(groupedSongs).sort();
                
                return (
                  <>
                    {sortedGroups.map((letter) => (
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
                            onClick={() => handleSelectManualSong(song)}
                            style={{
                              padding: '10px',
                              border: '1px solid #eee',
                              borderRadius: '8px',
                              marginBottom: '8px',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'flex'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#f8f9fa';
                              e.currentTarget.style.borderColor = '#667eea';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'white';
                              e.currentTarget.style.borderColor = '#eee';
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
                    ))}
                  </>
                );
              })() : (
                <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                  {manualSongSearchTerm ? 'Keine Songs gefunden' : 'Keine Server Songs verfügbar'}
                </div>
              )}
            </div>
          </div>
        </div>
          )}

      {/* YouTube Download Dialog */}
      {showYouTubeDialog && (
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
            padding: '30px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
          }}>
            <h3 style={{
              margin: '0 0 20px 0',
              color: '#333',
              fontSize: '20px',
              fontWeight: '600'
            }}>
              📥 YouTube-Video herunterladen
            </h3>
            
            <p style={{
              margin: '0 0 20px 0',
              color: '#666',
              fontSize: '14px',
              lineHeight: '1.5'
            }}>
              Für <strong>{selectedSongForDownload?.artist} - {selectedSongForDownload?.title}</strong> wurde kein Video gefunden.
              Du kannst optional eine YouTube-URL eingeben, um das Video herunterzuladen, oder ohne Video fortfahren.
            </p>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#333'
              }}>
                YouTube-URL (optional):
              </label>
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e1e5e9',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
                disabled={downloadingVideo}
              />
            </div>
            
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={handleCloseYouTubeDialog}
                disabled={downloadingVideo}
                style={{
                  padding: '12px 24px',
                  border: '2px solid #e1e5e9',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  color: '#666',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: downloadingVideo ? 'not-allowed' : 'pointer',
                  opacity: downloadingVideo ? 0.6 : 1,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!downloadingVideo) {
                    e.currentTarget.style.borderColor = '#ccc';
                    e.currentTarget.style.backgroundColor = '#f8f9fa';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!downloadingVideo) {
                    e.currentTarget.style.borderColor = '#e1e5e9';
                    e.currentTarget.style.backgroundColor = 'white';
                  }
                }}
              >
                Abbrechen
              </button>
              
              <button
                onClick={handleProcessWithoutVideo}
                disabled={downloadingVideo}
                style={{
                  padding: '12px 24px',
                  border: '2px solid #28a745',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  color: '#28a745',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: downloadingVideo ? 'not-allowed' : 'pointer',
                  opacity: downloadingVideo ? 0.6 : 1,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!downloadingVideo) {
                    e.currentTarget.style.backgroundColor = '#28a745';
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!downloadingVideo) {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.color = '#28a745';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                ⚡ Ohne Video fortfahren
              </button>
              
              <button
                onClick={handleYouTubeDownload}
                disabled={downloadingVideo || !youtubeUrl.trim()}
                style={{
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: downloadingVideo || !youtubeUrl.trim() ? '#ccc' : '#667eea',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: downloadingVideo || !youtubeUrl.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!downloadingVideo && youtubeUrl.trim()) {
                    e.currentTarget.style.backgroundColor = '#5a6fd8';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!downloadingVideo && youtubeUrl.trim()) {
                    e.currentTarget.style.backgroundColor = '#667eea';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                {downloadingVideo ? '⏳ Download läuft...' : '📥 Herunterladen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* USDB Batch Download Dialog */}
      {showUsdbDialog && (
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
            padding: '30px',
            maxWidth: '1200px',
            width: '95%',
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
          }}>
            <h3 style={{
              margin: '0 0 20px 0',
              color: '#333',
              fontSize: '20px',
              fontWeight: '600'
            }}>
              🌐 USDB Song Management
            </h3>
            
            {/* Two-column layout */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '30px',
              minHeight: '500px'
            }}>
              {/* Left column: Batch Download */}
              <div style={{
                border: '2px solid #e1e5e9',
                borderRadius: '8px',
                padding: '20px',
                backgroundColor: '#f8f9fa'
              }}>
                <h4 style={{
                  margin: '0 0 15px 0',
                  color: '#333',
                  fontSize: '16px',
                  fontWeight: '600'
                }}>
                  📥 Batch-Download
                </h4>
            
                {/* Progress Bar */}
                {usdbBatchDownloading && (
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      marginBottom: '8px'
                    }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>
                        Fortschritt:
                      </span>
                      <span style={{ fontSize: '14px', color: '#666' }}>
                        {usdbBatchProgress.current} / {usdbBatchProgress.total} Downloads
                      </span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '8px',
                      backgroundColor: '#e1e5e9',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${(usdbBatchProgress.current / usdbBatchProgress.total) * 100}%`,
                        height: '100%',
                        backgroundColor: '#6f42c1',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>
                )}
            
                {/* Batch URL Fields */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', color: '#333' }}>
                    USDB-URLs (füge beliebig viele hinzu):
                  </label>
                  
                  {usdbBatchUrls.map((url, index) => (
                    <div key={index} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '10px', 
                      marginBottom: '10px' 
                    }}>
                      {/* X Button */}
                      {usdbBatchUrls.length > 1 && (
                        <button
                          onClick={() => handleRemoveBatchUrlField(index)}
                          disabled={usdbBatchCurrentDownloading === index}
                          style={{
                            width: '32px',
                            height: '32px',
                            border: 'none',
                            borderRadius: '6px',
                            backgroundColor: usdbBatchDownloading ? '#f8f9fa' : '#dc3545',
                            color: usdbBatchDownloading ? '#ccc' : 'white',
                            cursor: usdbBatchDownloading ? 'not-allowed' : 'pointer',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease',
                            flexShrink: 0
                          }}
                          onMouseEnter={(e) => {
                            if (!usdbBatchDownloading) {
                              e.currentTarget.style.backgroundColor = '#c82333';
                              e.currentTarget.style.transform = 'scale(1.05)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!usdbBatchDownloading) {
                              e.currentTarget.style.backgroundColor = '#dc3545';
                              e.currentTarget.style.transform = 'scale(1)';
                            }
                          }}
                        >
                          ×
                        </button>
                      )}
                      
                      {/* URL Input */}
                      <div style={{ flex: 1, position: 'relative' }}>
                        <input
                          type="text"
                          value={url}
                          onChange={(e) => handleBatchUrlChange(index, e.target.value)}
                          placeholder=""
                          disabled={usdbBatchCurrentDownloading === index}
                          style={{
                            width: '100%',
                            padding: '12px',
                            border: '2px solid #e1e5e9',
                            borderRadius: '8px',
                            fontSize: '14px',
                            transition: 'border-color 0.2s ease',
                            backgroundColor: usdbBatchDownloading ? '#f8f9fa' : 'white',
                            color: usdbBatchDownloading ? '#666' : '#333'
                          }}
                          onFocus={(e) => {
                            if (!usdbBatchDownloading) {
                              e.target.style.borderColor = '#667eea';
                            }
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = '#e1e5e9';
                          }}
                        />
                        
                        {/* Status Indicator */}
                        {usdbBatchResults[index] && (
                          <div style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            fontSize: '18px'
                          }}>
                            {usdbBatchResults[index].status === 'pending' && '⏳'}
                            {usdbBatchResults[index].status === 'downloading' && '🔄'}
                            {usdbBatchResults[index].status === 'completed' && '✅'}
                            {usdbBatchResults[index].status === 'error' && '❌'}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
            
                
                {/* Batch Download Buttons */}
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'flex-end'
                }}>
                  <button
                    onClick={handleBatchDownloadFromUSDB}
                    disabled={usdbBatchDownloading || usdbBatchUrls.filter(url => url.trim()).length === 0}
                    style={{
                      padding: '12px 24px',
                      border: 'none',
                      borderRadius: '8px',
                      backgroundColor: usdbBatchDownloading || usdbBatchUrls.filter(url => url.trim()).length === 0 ? '#ccc' : '#6f42c1',
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: usdbBatchDownloading || usdbBatchUrls.filter(url => url.trim()).length === 0 ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!usdbBatchDownloading && usdbBatchUrls.filter(url => url.trim()).length > 0) {
                        e.currentTarget.style.backgroundColor = '#5a2d91';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!usdbBatchDownloading && usdbBatchUrls.filter(url => url.trim()).length > 0) {
                        e.currentTarget.style.backgroundColor = '#6f42c1';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }
                    }}
                  >
                    {usdbBatchDownloading ? '⏳ Downloads laufen...' : '🌐 Batch-Download starten'}
                  </button>
                </div>
              </div>

              {/* Right column: Search */}
              <div style={{
                border: '2px solid #e1e5e9',
                borderRadius: '8px',
                padding: '20px',
                backgroundColor: '#f8f9fa'
              }}>
                <h4 style={{
                  margin: '0 0 15px 0',
                  color: '#333',
                  fontSize: '16px',
                  fontWeight: '600'
                }}>
                  🔍 Song-Suche
                </h4>

                {/* Search Form */}
                <div style={{ marginBottom: '20px' }}>
                  {/* Interpret and Title side by side */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '12px', 
                    marginBottom: '12px' 
                  }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#333', fontSize: '14px' }}>
                        Interpret:
                      </label>
                      <input
                        type="text"
                        value={usdbSearchInterpret}
                        onChange={(e) => setUsdbSearchInterpret(e.target.value)}
                        placeholder="z.B. ABBA"
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: '2px solid #e1e5e9',
                          borderRadius: '6px',
                          fontSize: '14px',
                          transition: 'border-color 0.2s ease'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#667eea'}
                        onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSearchUSDB();
                          }
                        }}
                      />
                    </div>
                    
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#333', fontSize: '14px' }}>
                        Titel (optional):
                      </label>
                      <input
                        type="text"
                        value={usdbSearchTitle}
                        onChange={(e) => setUsdbSearchTitle(e.target.value)}
                        placeholder="z.B. The Winner Takes It All"
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: '2px solid #e1e5e9',
                          borderRadius: '6px',
                          fontSize: '14px',
                          transition: 'border-color 0.2s ease'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#667eea'}
                        onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSearchUSDB();
                          }
                        }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleSearchUSDB}
                    disabled={usdbSearchLoading || (!usdbSearchInterpret.trim() && !usdbSearchTitle.trim())}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: 'none',
                      borderRadius: '6px',
                      backgroundColor: usdbSearchLoading || (!usdbSearchInterpret.trim() && !usdbSearchTitle.trim()) ? '#ccc' : '#28a745',
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: usdbSearchLoading || (!usdbSearchInterpret.trim() && !usdbSearchTitle.trim()) ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!usdbSearchLoading && (usdbSearchInterpret.trim() || usdbSearchTitle.trim())) {
                        e.currentTarget.style.backgroundColor = '#218838';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!usdbSearchLoading && (usdbSearchInterpret.trim() || usdbSearchTitle.trim())) {
                        e.currentTarget.style.backgroundColor = '#28a745';
                      }
                    }}
                  >
                    {usdbSearchLoading ? '⏳ Suche läuft...' : '🔍 Suchen'}
                  </button>
                </div>

                {/* Search Results */}
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {usdbSearchResults.length > 0 ? (
                    <div>
                      <div style={{ marginBottom: '10px', fontSize: '14px', fontWeight: '600', color: '#333' }}>
                        Gefundene Songs ({usdbSearchResults.length}):
                      </div>
                      {usdbSearchResults.map((song) => (
                        <div
                          key={song.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px',
                            marginBottom: '8px',
                            backgroundColor: 'white',
                            border: '1px solid #e1e5e9',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f8f9fa';
                            e.currentTarget.style.borderColor = '#667eea';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'white';
                            e.currentTarget.style.borderColor = '#e1e5e9';
                          }}
                          onClick={() => handleAddSearchResultToDownload(song)}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>
                              {song.artist}
                            </div>
                            <div style={{ fontSize: '12px', color: '#666' }}>
                              {song.title}
                            </div>
                          </div>
                          <div style={{ fontSize: '18px', color: '#28a745' }}>
                            ➕
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ 
                      textAlign: 'center', 
                      color: '#666', 
                      fontSize: '14px',
                      padding: '20px'
                    }}>
                      {usdbSearchLoading ? 'Suche läuft...' : 'Keine Suchergebnisse'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom buttons */}
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
              marginTop: '20px',
              paddingTop: '20px',
              borderTop: '1px solid #e1e5e9'
            }}>
              <button
                onClick={handleCloseUsdbDialog}
                disabled={usdbBatchDownloading}
                style={{
                  padding: '12px 24px',
                  border: '2px solid #e1e5e9',
                  borderRadius: '8px',
                  backgroundColor: usdbBatchDownloading ? '#f8f9fa' : 'white',
                  color: usdbBatchDownloading ? '#ccc' : '#666',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: usdbBatchDownloading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!usdbBatchDownloading) {
                    e.currentTarget.style.borderColor = '#ccc';
                    e.currentTarget.style.backgroundColor = '#f8f9fa';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!usdbBatchDownloading) {
                    e.currentTarget.style.borderColor = '#e1e5e9';
                    e.currentTarget.style.backgroundColor = 'white';
                  }
                }}
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {showRenameModal && renameSong && (
        <Modal>
          <ModalContent>
            <ModalTitle>✏️ Song umbenennen</ModalTitle>
            
            <FormGroup>
              <Label>Neuer Interpret:</Label>
              <Input
                type="text"
                value={renameData.newArtist}
                onChange={(e) => setRenameData(prev => ({ ...prev, newArtist: e.target.value }))}
                placeholder="Interpret eingeben"
                autoFocus
              />
            </FormGroup>
            
            <FormGroup>
              <Label>Neuer Songtitel:</Label>
              <Input
                type="text"
                value={renameData.newTitle}
                onChange={(e) => setRenameData(prev => ({ ...prev, newTitle: e.target.value }))}
                placeholder="Songtitel eingeben"
              />
            </FormGroup>
            
            <div style={{ 
              padding: '12px', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '6px', 
              marginBottom: '20px',
              fontSize: '14px',
              color: '#666'
            }}>
              <strong>Aktueller Name:</strong> {renameSong.artist} - {renameSong.title}
              <br />
              <strong>Neuer Name:</strong> {renameData.newArtist} - {renameData.newTitle}
            </div>
            
            <ModalButtons>
              <Button onClick={handleRenameCancel}>Abbrechen</Button>
              <Button 
                onClick={handleRenameConfirm}
                disabled={actionLoading || !renameData.newArtist.trim() || !renameData.newTitle.trim()}
                style={{
                  backgroundColor: actionLoading || !renameData.newArtist.trim() || !renameData.newTitle.trim() ? '#ccc' : '#ffc107',
                  color: '#212529'
                }}
              >
                {actionLoading ? '⏳ Wird umbenannt...' : '✏️ Umbenennen'}
              </Button>
            </ModalButtons>
          </ModalContent>
        </Modal>
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
                value={addSongData.singerName}
                onChange={(e) => setAddSongData(prev => ({ ...prev, singerName: e.target.value }))}
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
                  value={addSongData.artist}
                  onChange={(e) => {
                    setAddSongData(prev => ({ ...prev, artist: e.target.value }));
                    setAddSongSearchTerm(e.target.value);
                    triggerUSDBSearch(e.target.value, addSongData.title);
                  }}
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
                  value={addSongData.title}
                  onChange={(e) => {
                    setAddSongData(prev => ({ ...prev, title: e.target.value }));
                    setAddSongSearchTerm(e.target.value);
                    triggerUSDBSearch(addSongData.artist, e.target.value);
                  }}
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
                value={addSongData.youtubeUrl}
                onChange={(e) => setAddSongData(prev => ({ ...prev, youtubeUrl: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* Song List */}
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
                {addSongUsdbResults.length > 0 && (
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
                      USDB ({addSongUsdbResults.length})
                    </div>
                    {addSongUsdbResults.map((song, index) => (
                      <div
                        key={`usdb-${song.id}`}
                        onClick={() => handleSelectAddSong(song)}
                        style={{
                          padding: '10px',
                          border: '1px solid #eee',
                          borderRadius: '8px',
                          marginBottom: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          backgroundColor: addSongData.artist === song.artist && addSongData.title === song.title ? '#e3f2fd' : 'white'
                        }}
                        onMouseEnter={(e) => {
                          if (!(addSongData.artist === song.artist && addSongData.title === song.title)) {
                            e.currentTarget.style.background = '#f8f9fa';
                            e.currentTarget.style.borderColor = '#667eea';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!(addSongData.artist === song.artist && addSongData.title === song.title)) {
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
                {addSongUsdbLoading && (
                  <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                    🔍 USDB-Suche läuft...
                  </div>
                )}

                {/* Local Songs Section */}
                {filteredAddSongs.length > 0 ? (() => {
                  // Group songs by first letter of artist
                  const groupedSongs = filteredAddSongs.reduce((groups, song) => {
                    const letter = getFirstLetter(song.artist);
                    if (!groups[letter]) {
                      groups[letter] = [];
                    }
                    groups[letter].push(song);
                    return groups;
                  }, {} as Record<string, typeof filteredAddSongs>);
                  
                  const sortedGroups = Object.keys(groupedSongs).sort();
                  
                  return (
                    <>
                      {sortedGroups.map((letter) => (
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
                              onClick={() => handleSelectAddSong(song)}
                              style={{
                                padding: '10px',
                                border: '1px solid #eee',
                                borderRadius: '8px',
                                marginBottom: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                backgroundColor: addSongData.artist === song.artist && addSongData.title === song.title ? '#e3f2fd' : 'white'
                              }}
                              onMouseEnter={(e) => {
                                if (!(addSongData.artist === song.artist && addSongData.title === song.title)) {
                                  e.currentTarget.style.background = '#f8f9fa';
                                  e.currentTarget.style.borderColor = '#667eea';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!(addSongData.artist === song.artist && addSongData.title === song.title)) {
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
                      ))}
                    </>
                  );
                })() : (
                  !addSongUsdbLoading && !addSongUsdbResults.length && (
                    <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                      {addSongSearchTerm ? 'Keine Songs gefunden' : 'Keine Server Songs verfügbar'}
                    </div>
                  )
                )}
              </div>
            </div>

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

    </Container>
  );
};

export default AdminDashboard;