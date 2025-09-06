import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { songAPI } from '../services/api';
import { SongRequestData } from '../types';

const Container = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
`;

const Card = styled.div`
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  padding: 40px;
  max-width: 500px;
  width: 100%;
`;

const Title = styled.h1`
  text-align: center;
  color: #333;
  margin-bottom: 30px;
  font-size: 2rem;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
`;

const Label = styled.label`
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
`;

const Input = styled.input`
  padding: 12px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.3s ease;

  &:focus {
    outline: none;
    border-color: #667eea;
  }
`;

const TextArea = styled.textarea`
  padding: 12px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 16px;
  resize: vertical;
  min-height: 100px;
  transition: border-color 0.3s ease;

  &:focus {
    outline: none;
    border-color: #667eea;
  }
`;

const Button = styled.button`
  background: #667eea;
  color: white;
  border: none;
  padding: 15px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: #5a6fd8;
    transform: translateY(-2px);
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
    transform: none;
  }
`;

const Alert = styled.div<{ type: 'success' | 'error' }>`
  padding: 15px;
  border-radius: 8px;
  margin: 20px 0;
  background: ${props => props.type === 'success' ? '#d4edda' : '#f8d7da'};
  color: ${props => props.type === 'success' ? '#155724' : '#721c24'};
  border: 1px solid ${props => props.type === 'success' ? '#c3e6cb' : '#f5c6cb'};
`;

const QRCodeContainer = styled.div`
  text-align: center;
  margin: 30px 0;
`;

const LocalSongsSection = styled.div`
  margin-top: 15px;
`;

const LocalSongsButton = styled.button`
  background: #28a745;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: 15px;

  &:hover {
    background: #218838;
    transform: translateY(-1px);
  }
`;

const SongListModal = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: ${props => props.$isOpen ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const SongListContent = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
`;

const SongListHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const SongListTitle = styled.h3`
  margin: 0;
  color: #333;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  
  &:hover {
    color: #333;
  }
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
  margin-bottom: 15px;
`;

const SongItem = styled.div`
  padding: 10px;
  border: 1px solid #eee;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  
  &:hover {
    background: #f8f9fa;
    border-color: #667eea;
  }
`;

const SongArtist = styled.div`
  font-weight: 600;
  color: #333;
  flex: 1;
  padding-right: 10px;
`;

const SongTitle = styled.div`
  color: #666;
  font-size: 14px;
  flex: 1;
  padding-left: 10px;
  border-left: 1px solid #eee;
`;

const QRCodeImage = styled.img`
  max-width: 200px;
  border-radius: 8px;
`;


const SongRequest: React.FC = () => {
  const [formData, setFormData] = useState<SongRequestData>({
    name: '',
    songInput: '',
    deviceId: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [deviceId, setDeviceId] = useState<string>('');
  const [showSongList, setShowSongList] = useState(false);
  const [localVideos, setLocalVideos] = useState<any[]>([]);
  const [fileSongs, setFileSongs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [youtubeEnabled, setYoutubeEnabled] = useState(true);

  useEffect(() => {
    // Generate or retrieve device ID
    const storedDeviceId = localStorage.getItem('karaokeDeviceId');
    if (storedDeviceId) {
      setDeviceId(storedDeviceId);
      setFormData(prev => ({ ...prev, deviceId: storedDeviceId }));
    } else {
      // Generate new device ID (3 random letters)
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let newDeviceId = '';
      for (let i = 0; i < 3; i++) {
        newDeviceId += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      setDeviceId(newDeviceId);
      setFormData(prev => ({ ...prev, deviceId: newDeviceId }));
      localStorage.setItem('karaokeDeviceId', newDeviceId);
    }

    // Generate QR code
    generateQRCode();
  }, []);

  useEffect(() => {
    // Load YouTube enabled setting
    const loadYouTubeSetting = async () => {
      try {
        const response = await songAPI.getYouTubeEnabled();
        const youtubeEnabledValue = response.data.settings.youtube_enabled;
        setYoutubeEnabled(youtubeEnabledValue === 'true' || youtubeEnabledValue === undefined);
      } catch (error) {
        console.error('Error loading YouTube setting:', error);
        // Default to true if error
        setYoutubeEnabled(true);
      }
    };

    loadYouTubeSetting();
  }, []);

  const generateQRCode = async () => {
    try {
      const qrData = await songAPI.getQRData();
      // Use the data URL generated by the backend
      if (qrData.data.qrCodeDataUrl) {
        setQrCodeDataUrl(qrData.data.qrCodeDataUrl);
      } else {
        // Fallback to external API
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData.data.url)}&format=png&ecc=M&margin=1`;
        setQrCodeDataUrl(qrCodeUrl);
      }
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await songAPI.requestSong(formData);
      
      setMessage({
        type: 'success',
        text: `Song "${response.data.song.title}" wurde erfolgreich zur Playlist hinzugefügt!`
      });
      
      // Reset form - keep name, clear only song input
      setFormData(prev => ({ ...prev, songInput: '' }));
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Fehler beim Hinzufügen des Songs'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSongList = async () => {
    try {
      const [localResponse, fileResponse] = await Promise.all([
        songAPI.getLocalVideos(),
        songAPI.getFileSongs()
      ]);
      
      const localVideos = localResponse.data.videos || [];
      const fileSongs = fileResponse.data.fileSongs || [];
      
      // Combine and deduplicate songs
      const allSongs = [...fileSongs];
      localVideos.forEach(localVideo => {
        const exists = allSongs.some(song => 
          song.artist.toLowerCase() === localVideo.artist.toLowerCase() &&
          song.title.toLowerCase() === localVideo.title.toLowerCase()
        );
        if (!exists) {
          allSongs.push(localVideo);
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
      
      setLocalVideos(allSongs);
      setShowSongList(true);
    } catch (error) {
      console.error('Error loading songs:', error);
      setMessage({
        type: 'error',
        text: 'Fehler beim Laden der Songs'
      });
    }
  };

  const handleCloseSongList = () => {
    setShowSongList(false);
    setSearchTerm('');
  };

  const handleSelectSong = (video: any) => {
    const songInput = `${video.artist} - ${video.title}`;
    setFormData(prev => ({ ...prev, songInput }));
    handleCloseSongList();
  };

  const filteredVideos = localVideos.filter(video =>
    video.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
    video.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${video.artist} - ${video.title}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Container>
      <Card>
        

        <QRCodeContainer>
          <h3>QR Code für andere Geräte:</h3>
          {qrCodeDataUrl && <QRCodeImage src={qrCodeDataUrl} alt="QR Code" />}
        </QRCodeContainer>

        <Form onSubmit={handleSubmit}>
          <FormGroup>
            <Label htmlFor="name">Dein Name:</Label>
            <Input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              placeholder="Gib deinen Namen ein"
            />
          </FormGroup>

          <FormGroup>
            <Label htmlFor="songInput">Song Wunsch:</Label>
            {youtubeEnabled ? (
              <Input
                type="text"
                id="songInput"
                name="songInput"
                value={formData.songInput}
                onChange={handleInputChange}
                required
                placeholder="Interpret - Songtitel oder YouTube Link"
              />
            ) : (
              <div style={{
                padding: '12px',
                border: '2px solid #e1e5e9',
                borderRadius: '8px',
                background: '#f8f9fa',
                fontSize: '16px',
                color: formData.songInput ? '#333' : '#666',
                fontWeight: formData.songInput ? '500' : 'normal',
                fontStyle: formData.songInput ? 'normal' : 'italic',
                minHeight: '48px',
                display: 'flex',
                alignItems: 'center'
              }}>
                {formData.songInput || 'Bitte wähle einen Song aus der Songliste'}
              </div>
            )}
          </FormGroup>

          <LocalSongsSection>
            {youtubeEnabled && (
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
                Oder nimm einen Song aus der Liste:
              </div>
            )}
            <LocalSongsButton 
              type="button" 
              onClick={handleOpenSongList}
            >
              🎵 Songliste öffnen
            </LocalSongsButton>
          </LocalSongsSection>

          {message && (
            <Alert type={message.type}>
              {message.text}
            </Alert>
          )}

          <Button 
            type="submit" 
            disabled={loading || !formData.name.trim() || !formData.songInput.trim()}
          >
            {loading ? 'Wird hinzugefügt...' : 'Song hinzufügen'}
          </Button>
        </Form>

        <div style={{ textAlign: 'center', marginTop: '20px', color: '#666' }}>
          <p>Du kannst mehrere Songs hinzufügen!</p>
          <p>Das System sorgt für eine faire Reihenfolge.</p>
        </div>
      </Card>

      {/* Song List Modal */}
      <SongListModal $isOpen={showSongList}>
        <SongListContent>
          <SongListHeader>
            <SongListTitle>🎵 Lokale Songs</SongListTitle>
            <CloseButton onClick={handleCloseSongList}>×</CloseButton>
          </SongListHeader>
          
          <SearchInput
            type="text"
            placeholder="Songs durchsuchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          
          <div style={{ display: 'flex', padding: '8px 10px', background: '#f8f9fa', borderRadius: '8px', marginBottom: '10px', fontSize: '12px', fontWeight: '600', color: '#666' }}>
            <div style={{ flex: 1, paddingRight: '10px' }}>INTERPRET</div>
            <div style={{ flex: 1, paddingLeft: '10px', borderLeft: '1px solid #eee' }}>SONGTITEL</div>
          </div>
          
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {filteredVideos.length > 0 ? (
              filteredVideos.map((video, index) => (
                <SongItem key={index} onClick={() => handleSelectSong(video)}>
                  <SongArtist>{video.artist}</SongArtist>
                  <SongTitle>{video.title}</SongTitle>
                </SongItem>
              ))
            ) : (
              <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                {searchTerm ? 'Keine Songs gefunden' : 'Keine lokalen Songs verfügbar'}
              </div>
            )}
          </div>
        </SongListContent>
      </SongListModal>
    </Container>
  );
};

export default SongRequest;
