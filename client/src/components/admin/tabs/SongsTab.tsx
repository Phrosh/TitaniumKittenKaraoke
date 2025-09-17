import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import { adminAPI, songAPI } from '../../../services/api';
import USDBDownloadModal from '../modals/usdb/UsdbDownloadModal';
import DeleteModal from '../modals/DeleteModal';
import RenameModal from '../modals/RenameModal';

// Styled Components für SongsTab
const SettingsSection = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
`;

const SettingsTitle = styled.h3`
  color: #333;
  margin: 0 0 20px 0;
  font-size: 1.3rem;
  font-weight: 600;
`;

const SettingsCard = styled.div`
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid #e9ecef;
`;

const SettingsLabel = styled.label`
  display: block;
  font-weight: 600;
  margin-bottom: 10px;
  color: #333;
  font-size: 1rem;
`;

const SettingsInput = styled.input`
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: #3498db;
    box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
  }
`;

const SettingsDescription = styled.div`
  font-size: 0.9rem;
  color: #666;
  margin-top: 10px;
  line-height: 1.4;
`;

const TabButton = styled.button<{ $active: boolean; $color?: string }>`
  padding: 10px 20px;
  border: 2px solid;
  border-color: ${props => props.$active ? (props.$color || '#667eea') : '#e1e5e9'};
  background: ${props => props.$active ? (props.$color || '#667eea') : 'white'};
  color: ${props => props.$active ? 'white' : '#333'};
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.3s ease;
`;

const UsdbButton = styled.button`
  background: #6f42c1;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  justify-content: center;

  &:hover:not(:disabled) {
    background: #5a2d91;
    transform: translateY(-1px);
  }

  &:disabled {
    background: #6c757d;
    cursor: not-allowed;
    transform: none;
  }
`;

const SongItem = styled.div<{ $isInvisible: boolean }>`
  display: flex;
  align-items: center;
  padding: 12px;
  border: 1px solid #eee;
  border-radius: 6px;
  margin-bottom: 8px;
  background: ${props => props.$isInvisible ? '#f8f9fa' : '#fff'};
  opacity: ${props => props.$isInvisible ? 0.7 : 1};
  gap: 12px;
`;

const SongInfo = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 20px;
`;

const SongTitle = styled.div`
  flex: 1;
`;

const SongName = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
`;

const SongText = styled.div`
  font-weight: 600;
  font-size: 16px;
  color: #333;
  cursor: pointer;
  user-select: none;
`;

const ModeTags = styled.div`
  display: flex;
  gap: 4px;
`;

const ModeTag = styled.span<{ $color: string; $background: string }>`
  font-size: 12px;
  color: ${props => props.$color};
  background: ${props => props.$background};
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
`;

const ActionButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ActionButton = styled.button<{ $variant: 'success' | 'info' | 'warning' | 'danger' }>`
  font-size: 12px;
  padding: 6px 12px;
  background: ${props => 
    props.$variant === 'success' ? '#28a745' :
    props.$variant === 'info' ? '#17a2b8' :
    props.$variant === 'warning' ? '#ffc107' :
    '#dc3545'
  };
  color: ${props => props.$variant === 'warning' ? '#000' : 'white'};
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  opacity: 1;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: ${props => 
      props.$variant === 'success' ? '#218838' :
      props.$variant === 'info' ? '#138496' :
      props.$variant === 'warning' ? '#e0a800' :
      '#c82333'
    };
    transform: scale(1.05);
  }

  &:disabled {
    background: #6c757d;
    cursor: not-allowed;
    transform: none;
    opacity: 0.6;
  }
`;

const GroupHeader = styled.div`
  position: sticky;
  top: 0;
  background: #adb5bd;
  color: white;
  padding: 8px 15px;
  font-size: 16px;
  font-weight: bold;
  z-index: 10;
  border-bottom: 2px solid #9ca3af;
`;

const SongsList = styled.div`
  margin-top: 10px;
  max-height: 500px;
  overflow-y: auto;
`;

interface SongsTabProps {
  // Nur die Callback-Funktionen für externe Modals werden von außen benötigt
  // onOpenUsdbDialog: () => void;
  // onRenameSong: (song: any) => void;
  // onDeleteSongFromLibrary: (song: any) => void;
  processingSongs: Set<string>;
  setProcessingSongs: (processingSongs: Set<string>) => void;
}

const SongsTab: React.FC<SongsTabProps> = ({
  // onOpenUsdbDialog,
  // onRenameSong,
  // onDeleteSongFromLibrary
  processingSongs,
  setProcessingSongs
}) => {
  // Songs State
  const [songs, setSongs] = useState<any[]>([]);
  const [invisibleSongs, setInvisibleSongs] = useState<any[]>([]);
  const [songSearchTerm, setSongSearchTerm] = useState('');
  const [songTab, setSongTab] = useState<'all' | 'visible' | 'invisible'>('all');
  const [ultrastarAudioSettings, setUltrastarAudioSettings] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameSong, setRenameSong] = useState<any>(null);
  const [renameData, setRenameData] = useState({
    newArtist: '',
    newTitle: ''
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteSong, setDeleteSong] = useState<any>(null);
  
  const [showUsdbDialog, setShowUsdbDialog] = useState(false);

  // Load songs when component mounts
  useEffect(() => {
    fetchSongs();
    fetchInvisibleSongs();
  }, []);

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
      
      // Create audio settings map
      const audioSettingsMap: Record<string, string> = {};
      audioSettings.forEach((setting: any) => {
        const key = `${setting.artist}-${setting.title}`;
        audioSettingsMap[key] = setting.audio_preference;
      });
      setUltrastarAudioSettings(audioSettingsMap);
      
      // Combine and deduplicate songs, preserving all modes
      const allSongs = [...fileSongs];
      
      // Add server videos
      serverVideos.forEach((serverVideo: any) => {
        const existingSong = allSongs.find(song => 
          song.artist.toLowerCase() === serverVideo.artist.toLowerCase() &&
          song.title.toLowerCase() === serverVideo.title.toLowerCase()
        );
        
        if (existingSong) {
          // Add server_video mode to existing song
          if (!existingSong.modes) existingSong.modes = [];
          if (!existingSong.modes.includes('server_video')) {
            existingSong.modes.push('server_video');
          }
        } else {
          // Add new song with server_video mode
          allSongs.push({
            ...serverVideo,
            modes: ['server_video']
          });
        }
      });
      
      // Add ultrastar songs
      ultrastarSongs.forEach((ultrastarSong: any) => {
        const existingSong = allSongs.find(song => 
          song.artist.toLowerCase() === ultrastarSong.artist.toLowerCase() &&
          song.title.toLowerCase() === ultrastarSong.title.toLowerCase()
        );
        
        if (existingSong) {
          // Add ultrastar mode to existing song
          if (!existingSong.modes) existingSong.modes = [];
          if (!existingSong.modes.includes('ultrastar')) {
            existingSong.modes.push('ultrastar');
          }
          // Add ultrastar-specific properties
          existingSong.hasVideo = ultrastarSong.hasVideo;
          existingSong.hasHp2Hp5 = ultrastarSong.hasHp2Hp5;
          existingSong.folderName = ultrastarSong.folderName;
        } else {
          // Add new song with ultrastar mode
          allSongs.push({
            ...ultrastarSong,
            modes: ['ultrastar']
          });
        }
      });
      
      // Add YouTube songs
      youtubeSongs.forEach((youtubeSong: any) => {
        const existingSong = allSongs.find(song => 
          song.artist.toLowerCase() === youtubeSong.artist.toLowerCase() &&
          song.title.toLowerCase() === youtubeSong.title.toLowerCase()
        );
        
        if (existingSong) {
          // Add youtube mode to existing song
          if (!existingSong.modes) existingSong.modes = [];
          if (!existingSong.modes.includes('youtube')) {
            existingSong.modes.push('youtube');
          }
          // Add YouTube-specific properties
          existingSong.youtubeUrl = youtubeSong.youtubeUrl;
          existingSong.videoFiles = youtubeSong.videoFiles;
        } else {
          // Add new song with youtube mode
          allSongs.push({
            ...youtubeSong,
            modes: ['youtube']
          });
        }
      });
      
      // Sort by artist, then by title
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

  const handleStartProcessing = async (song: any) => {
    const songKey = `${song.artist}-${song.title}`;
    
    try {
      const folderName = song.folderName || `${song.artist} - ${song.title}`;
      
      // Add to processing set
      setProcessingSongs(prev => new Set(prev).add(songKey));
      
      const response = await adminAPI.checkVideoNeeds(folderName);
      
      if (response.data.needsVideo) {
        toast.success(`Video wird für "${song.artist} - ${song.title}" verarbeitet`);
      } else {
        toast.info(`Kein Video erforderlich für "${song.artist} - ${song.title}"`);
      }
      
      // Refresh songs to get updated status
      await fetchSongs();
      
    } catch (error: any) {
      console.error('Error checking video needs:', error);
      toast.error(error.response?.data?.error || 'Fehler beim Prüfen der Video-Anforderungen');
    } finally {
      // Remove from processing set
      setProcessingSongs(prev => {
        const newSet = new Set(prev);
        newSet.delete(songKey);
        return newSet;
      });
    }
  };

  const handleTestSong = async (song: { artist: string; title: string; modes?: string[]; youtubeUrl?: string }) => {
    setActionLoading(true);
    
    try {
      // Determine the best mode and URL for the song
      let mode = 'youtube';
      let url = song.youtubeUrl;
      
      // Prefer server_video if available
      if (song.modes?.includes('server_video')) {
        mode = 'server_video';
        url = `http://localhost:4000/${song.artist} - ${song.title}.mp4`;
      }
      
      const response = await adminAPI.testSong(song.artist, song.title, mode, url);
      
      if (response.data.success) {
        toast.success(`Test-Song "${song.artist} - ${song.title}" zur Playlist hinzugefügt`);
      } else {
        toast.error(response.data.message || 'Fehler beim Testen des Songs');
      }
    } catch (error: any) {
      console.error('Error testing song:', error);
      toast.error(error.response?.data?.message || 'Fehler beim Testen des Songs');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUltrastarAudioChange = async (song: any, audioPreference: string) => {
    setActionLoading(true);
    try {
      const songKey = `${song.artist}-${song.title}`;
      
      if (audioPreference === 'choice') {
        // Remove the setting (user will choose each time)
        await adminAPI.removeUltrastarAudioSetting(song.artist, song.title);
        setUltrastarAudioSettings(prev => {
          const newSettings = { ...prev };
          delete newSettings[songKey];
          return newSettings;
        });
        toast.success(`Audio-Einstellung für "${song.artist} - ${song.title}" entfernt`);
      } else {
        // Set the preference
        await adminAPI.setUltrastarAudioSetting(song.artist, song.title, audioPreference);
        setUltrastarAudioSettings(prev => ({
          ...prev,
          [songKey]: audioPreference
        }));
        toast.success(`Audio-Einstellung für "${song.artist} - ${song.title}" gesetzt`);
      }
    } catch (error: any) {
      console.error('Error updating ultrastar audio setting:', error);
      toast.error('Fehler beim Aktualisieren der Audio-Einstellung');
    } finally {
      setActionLoading(false);
    }
  };

  // Check if Ultrastar song has all required files for processing
  const canProcessSong = (song: any) => {
    if (!song.modes?.includes('ultrastar')) return false;
    
    // If the properties are undefined, we can't determine if files are present
    // So we assume they are missing (don't show button)
    if (song.hasVideo === undefined || song.hasHp2Hp5 === undefined) {
      return false;
    }
    
    const hasVideo = song.hasVideo === true || song.hasVideo === 'true';
    const hasHp2Hp5 = song.hasHp2Hp5 === true || song.hasHp2Hp5 === 'true';
    
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
    
    const hasVideo = song.hasVideo === true || song.hasVideo === 'true';
    const hasHp2Hp5 = song.hasHp2Hp5 === true || song.hasHp2Hp5 === 'true';
    
    // Show warning if video OR HP2/HP5 files are missing
    return !hasVideo || !hasHp2Hp5;
  };

  const getFirstLetter = (text: string) => {
    return text.charAt(0).toUpperCase();
  };
  const getVisibleSongsCount = () => {
    return songs.filter(song => !invisibleSongs.some(invisible => 
      invisible.artist.toLowerCase() === song.artist.toLowerCase() &&
      invisible.title.toLowerCase() === song.title.toLowerCase()
    )).length;
  };

  const getInvisibleSongsCount = () => {
    return songs.filter(song => invisibleSongs.some(invisible => 
      invisible.artist.toLowerCase() === song.artist.toLowerCase() &&
      invisible.title.toLowerCase() === song.title.toLowerCase()
    )).length;
  };

  const getFilteredSongs = () => {
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
    
    return filteredSongs;
  };

  const getGroupedSongs = () => {
    const filteredSongs = getFilteredSongs();
    
    // Group songs by first letter of artist
    const groupedSongs = filteredSongs.reduce((groups, song) => {
      const letter = getFirstLetter(song.artist);
      if (!groups[letter]) {
        groups[letter] = [];
      }
      groups[letter].push(song);
      return groups;
    }, {} as Record<string, typeof filteredSongs>);
    
    return Object.keys(groupedSongs).sort();
  };

  const getCurrentTabCount = () => {
    switch (songTab) {
      case 'visible':
        return getVisibleSongsCount();
      case 'invisible':
        return getInvisibleSongsCount();
      default:
        return songs.length;
    }
  };

  const getCurrentTabLabel = () => {
    switch (songTab) {
      case 'visible':
        return `Eingeblendete Songs (${getVisibleSongsCount()}):`;
      case 'invisible':
        return `Ausgeblendete Songs (${getInvisibleSongsCount()}):`;
      default:
        return `Alle Songs (${songs.length}):`;
    }
  };

  return (
    <>
    <SettingsSection>
      <SettingsTitle>🎵 Songverwaltung</SettingsTitle>
      
      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        {/* Left column: Song management buttons and search */}
        <div style={{ flex: '1', minWidth: '0' }}>
          {/* Song Tabs */}
          <SettingsCard>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <TabButton
                $active={songTab === 'all'}
                onClick={() => setSongTab('all')}
              >
                Alle Songs ({songs.length})
              </TabButton>
              <TabButton
                $active={songTab === 'visible'}
                $color="#28a745"
                onClick={() => setSongTab('visible')}
              >
                Eingeblendete ({getVisibleSongsCount()})
              </TabButton>
              <TabButton
                $active={songTab === 'invisible'}
                $color="#dc3545"
                onClick={() => setSongTab('invisible')}
              >
                Ausgeblendete ({getInvisibleSongsCount()})
              </TabButton>
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
              <UsdbButton
                type="button"
                onClick={() => {
                  setShowUsdbDialog(true);
                }}
              >
                🌐 USDB Song laden
              </UsdbButton>
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
        <SettingsLabel>{getCurrentTabLabel()}</SettingsLabel>
        {songs.length === 0 ? (
          <div style={{ color: '#666', fontStyle: 'italic' }}>
            Keine Songs vorhanden
          </div>
        ) : (() => {
          const filteredSongs = getFilteredSongs();
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
            <SongsList>
              {sortedGroups.map((letter) => (
                <div key={letter}>
                  <GroupHeader>{letter}</GroupHeader>
                  {groupedSongs[letter].map((song: any) => {
                    const isInvisible = invisibleSongs.some(invisible => 
                      invisible.artist.toLowerCase() === song.artist.toLowerCase() &&
                      invisible.title.toLowerCase() === song.title.toLowerCase()
                    );
                    
                    return (
                      <SongItem key={`${song.artist}-${song.title}`} $isInvisible={isInvisible}>
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
                        <SongInfo>
                          {/* Left side: Song info */}
                          <SongTitle>
                            <SongName>
                              <SongText
                                onClick={() => handleToggleSongVisibility(song)}
                                title="Klicken zum Umschalten der Sichtbarkeit"
                              >
                                {song.artist} - {song.title}
                              </SongText>
                              <ModeTags>
                                {song.modes?.includes('server_video') && (
                                  <ModeTag $color="#28a745" $background="#d4edda">
                                    🟢 Server
                                  </ModeTag>
                                )}
                                {song.modes?.includes('file') && (
                                  <ModeTag $color="#007bff" $background="#cce7ff">
                                    🔵 Datei
                                  </ModeTag>
                                )}
                                {song.modes?.includes('ultrastar') && (
                                  <ModeTag $color="#8e44ad" $background="#e8d5f2">
                                    ⭐ Ultrastar
                                  </ModeTag>
                                )}
                                {song.mode === 'youtube' && (
                                  <ModeTag $color="#dc3545" $background="#f8d7da">
                                    🔴 YouTube
                                  </ModeTag>
                                )}
                                {song.modes?.includes('youtube_cache') && (
                                  <ModeTag $color="#dc3545" $background="#f8d7da">
                                    🎬 YouTube Cache
                                  </ModeTag>
                                )}
                                {hasMissingFiles(song) && (
                                  <ModeTag 
                                    $color="#ff6b35" 
                                    $background="#ffe6e0"
                                    title="Dieses Ultrastar-Video benötigt nach dem ersten Songwunsch länger für die Verarbeitung, da wichtige Dateien fehlen (Video-Datei oder HP2/HP5-Audio-Dateien)."
                                    style={{ cursor: 'help' }}
                                  >
                                    ⚠️ Verarbeitung
                                  </ModeTag>
                                )}
                              </ModeTags>
                            </SongName>
                          </SongTitle>
                          
                          {/* Action buttons */}
                          <ActionButtons>
                            {hasMissingFiles(song) && (
                              <ActionButton
                                $variant="success"
                                onClick={() => handleStartProcessing(song)}
                                disabled={actionLoading || processingSongs.has(`${song.artist}-${song.title}`)}
                              >
                                {processingSongs.has(`${song.artist}-${song.title}`) ? '⏳ Verarbeitung läuft...' : '🔧 Verarbeitung starten'}
                              </ActionButton>
                            )}
                          </ActionButtons>
                        </SongInfo>
                        
                        {/* Audio settings for Ultrastar songs */}
                        {song.modes?.includes('ultrastar') && (
                          <div style={{ flex: 1, padding: '8px', background: '#f8f9fa', borderRadius: '4px', marginTop: '8px' }}>
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
                        
                        {/* Action buttons for all songs - positioned at the right */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                          <ActionButton
                            $variant="warning"
                            onClick={() => handleRenameSong(song)}
                            disabled={actionLoading}
                          >
                            ✏️ Umbenennen
                          </ActionButton>
                          
                          <ActionButton
                            $variant="danger"
                            onClick={() => onDeleteSongFromLibrary(song)}
                            disabled={actionLoading}
                          >
                            🗑️ Löschen
                          </ActionButton>
                          
                          <ActionButton
                            $variant="info"
                            onClick={() => handleTestSong(song)}
                            disabled={actionLoading}
                          >
                            🎵 Testen
                          </ActionButton>
                        </div>
                      </SongItem>
                    );
                  })}
                </div>
              ))}
            </SongsList>
          );
        })()}
      </SettingsCard>
    </SettingsSection>

      {/* Rename Modal */}
      <RenameModal
        show={showRenameModal && !!renameSong}
        renameSong={renameSong}
        renameData={renameData}
        actionLoading={actionLoading}
        onClose={handleRenameCancel}
        onConfirm={handleRenameConfirm}
        onRenameDataChangse={(field, value) => setRenameData(prev => ({ ...prev, [field]: value }))}
      />

      {/* Delete Modal */}
      <DeleteModal
        show={showDeleteModal && !!deleteSong}
        deleteSong={deleteSong}
        actionLoading={actionLoading}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
      />
      {/* USDB Batch Download Dialog */}
      {/* {here} */}
      <USDBDownloadModal
        show={showUsdbDialog}
        // usdbBatchUrls={usdbBatchUrls}
        // usdbBatchDownloading={usdbBatchDownloading}
        // usdbBatchCurrentDownloading={usdbBatchCurrentDownloading}
        // usdbBatchProgress={usdbBatchProgress}
        // onClose={handleCloseUsdbDialog}
        // onBatchUrlChange={handleBatchUrlChange}
        // onAddBatchUrlField={handleAddBatchUrlField}
        // onRemoveBatchUrlField={handleRemoveBatchUrlField}
        // onStartBatchDownload={handleStartBatchDownload}
        // handleRemoveBatchUrlField={handleRemoveBatchUrlField}
        // handleBatchUrlChange={handleBatchUrlChange}
        // usdbBatchResults={usdbBatchResults}
        // handleBatchDownloadFromUSDB={handleBatchDownloadFromUSDB}
        // usdbSearchInterpret={usdbSearchInterpret}
        // setUsdbSearchInterpret={setUsdbSearchInterpret}
        // usdbSearchTitle={usdbSearchTitle}
        // setUsdbSearchTitle={setUsdbSearchTitle}
        // usdbSearchResults={usdbSearchResults}
        // handleAddSearchResultToDownload={handleAddSearchResultToDownload}
        // handleSearchUSDB={handleSearchUSDB}
        // usdbSearchLoading={usdbSearchLoading}
        fetchSongs={fetchSongs}
        handleCloseUsdbDialog={() => {
          setShowUsdbDialog(false);
        }}
      />
    </>
  );
};

export default SongsTab;
