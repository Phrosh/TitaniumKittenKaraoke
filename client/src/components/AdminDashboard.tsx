import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { adminAPI, playlistAPI } from '../services/api';
import { AdminDashboardData, Song } from '../types';

const Container = styled.div`
  min-height: 100vh;
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

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
`;

const StatCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
`;

const StatNumber = styled.div`
  font-size: 2rem;
  font-weight: bold;
  color: #667eea;
  margin-bottom: 5px;
`;

const StatLabel = styled.div`
  color: #666;
  font-size: 0.9rem;
`;

const PlaylistContainer = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
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
  padding: 10px 15px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
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

const SongItem = styled.div<{ isCurrent?: boolean; hasNoYoutube?: boolean }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border-radius: 8px;
  margin: 10px 0;
  background: ${props => 
    props.isCurrent ? '#fff3cd' :
    props.hasNoYoutube ? '#fff3cd' :
    '#f8f9fa'
  };
  border-left: 4px solid ${props => 
    props.isCurrent ? '#e74c3c' :
    props.hasNoYoutube ? '#f39c12' :
    '#27ae60'
  };
`;

const SongInfo = styled.div`
  flex: 1;
`;

const SongTitle = styled.div`
  font-weight: bold;
  color: #333;
  margin-bottom: 5px;
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

const TextArea = styled.textarea`
  width: 100%;
  padding: 10px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 14px;
  resize: vertical;
  min-height: 80px;

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
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
    // Refresh every 10 seconds
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await adminAPI.getDashboard();
      setDashboardData(response.data);
    } catch (error: any) {
      if (error.response?.status === 401) {
        navigate('/admin/login');
      }
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text + ' Karaoke');
    alert('Text in Zwischenablage kopiert: "' + text + ' Karaoke"');
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

  return (
    <Container>
      <Header>
        <Title>🎤 Admin Dashboard</Title>
        <LogoutButton onClick={handleLogout}>Abmelden</LogoutButton>
      </Header>

      <StatsGrid>
        <StatCard>
          <StatNumber>{stats.totalSongs}</StatNumber>
          <StatLabel>Gesamt Songs</StatLabel>
        </StatCard>
        <StatCard>
          <StatNumber>{stats.pendingSongs}</StatNumber>
          <StatLabel>Ohne YouTube Link</StatLabel>
        </StatCard>
        <StatCard>
          <StatNumber>{stats.totalUsers}</StatNumber>
          <StatLabel>Nutzer</StatLabel>
        </StatCard>
        <StatCard>
          <StatNumber>{stats.songsWithYoutube}</StatNumber>
          <StatLabel>Mit YouTube Link</StatLabel>
        </StatCard>
      </StatsGrid>

      <PlaylistContainer>
        <PlaylistHeader>
          <PlaylistTitle>Playlist ({playlist.length} Songs)</PlaylistTitle>
          <ControlButtons>
            <Button 
              variant="success" 
              onClick={handleNextSong}
              disabled={actionLoading}
            >
              ⏭️ Weiter
            </Button>
          </ControlButtons>
        </PlaylistHeader>

        {playlist.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            Keine Songs in der Playlist
          </div>
        ) : (
          playlist.map((song) => (
            <SongItem 
              key={song.id} 
              isCurrent={currentSong?.id === song.id}
              hasNoYoutube={!song.youtube_url}
            >
              <SongInfo>
                <SongTitle>{song.title}</SongTitle>
                <SongDetails>
                  {song.artist && song.artist !== 'Unknown' && `👤 ${song.artist} • `}
                  📱 {song.user_name} ({song.device_id}) • 
                  Position #{song.position}
                </SongDetails>
              </SongInfo>
              
              <SongActions>
                {currentSong?.id === song.id && (
                  <Badge type="current">🎤 AKTUELL</Badge>
                )}
                {!song.youtube_url && (
                  <Badge type="no-youtube">⚠️ Kein Link</Badge>
                )}
                
                <Button 
                  variant="success"
                  onClick={() => handlePlaySong(song.id)}
                  disabled={actionLoading}
                >
                  ▶️
                </Button>
                
                <Button 
                  onClick={() => openModal(song, 'edit')}
                  disabled={actionLoading}
                >
                  ✏️
                </Button>
                
                <Button 
                  onClick={() => openModal(song, 'youtube')}
                  disabled={actionLoading}
                >
                  🔗
                </Button>
                
                <Button 
                  onClick={() => copyToClipboard(`${song.artist} - ${song.title}`)}
                  disabled={actionLoading}
                >
                  📋
                </Button>
                
                <Button 
                  variant="danger"
                  onClick={() => handleDeleteSong(song.id)}
                  disabled={actionLoading}
                >
                  🗑️
                </Button>
              </SongActions>
            </SongItem>
          ))
        )}
      </PlaylistContainer>

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