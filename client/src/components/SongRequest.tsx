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
  max-height: 100vh;
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

// Format-Modal styled components
const FormatModal = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: ${props => props.$isOpen ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  z-index: 1001;
`;

const FormatModalContent = styled.div`
  background: white;
  border-radius: 12px;
  padding: 30px;
  max-width: 500px;
  width: 90%;
`;

const FormatModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const FormatModalTitle = styled.h3`
  margin: 0;
  color: #333;
`;

const FormatModalCloseButton = styled.button`
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  
  &:hover {
    color: #333;
  }
`;

const FormatModalBody = styled.div`
  margin-bottom: 20px;
`;

const FormatModalText = styled.p`
  color: #666;
  margin-bottom: 20px;
  line-height: 1.5;
`;

const FormatModalInputs = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

const FormatModalRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const FormatModalInput = styled.input`
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

const FormatModalButtons = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
`;

const FormatModalButton = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  
  ${props => props.$variant === 'primary' ? `
    background: #667eea;
    color: white;
    
    &:hover {
      background: #5a6fd8;
    }
    
    &:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
  ` : `
    background: #f8f9fa;
    color: #666;
    border: 2px solid #e1e5e9;
    
    &:hover {
      background: #e9ecef;
    }
  `}
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
  const [serverVideos, setServerVideos] = useState<any[]>([]);
  const [ultrastarSongs, setUltrastarSongs] = useState<any[]>([]);
  const [fileSongs, setFileSongs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [youtubeEnabled, setYoutubeEnabled] = useState(true);
  const [withBackgroundVocals, setWithBackgroundVocals] = useState(false);
  const [ultrastarAudioSettings, setUltrastarAudioSettings] = useState<Record<string, string>>({});
  
  // Modal states für Format-Korrektur
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [formatModalArtist, setFormatModalArtist] = useState('');
  const [formatModalTitle, setFormatModalTitle] = useState('');
  const [pendingSongInput, setPendingSongInput] = useState('');
  const [randomExampleSong, setRandomExampleSong] = useState({ artist: 'Queen', title: 'Bohemian Rhapsody' });

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
    // Load YouTube enabled setting and songs
    const loadInitialData = async () => {
      try {
        const response = await songAPI.getYouTubeEnabled();
        const youtubeEnabledValue = response.data.settings.youtube_enabled;
        setYoutubeEnabled(youtubeEnabledValue === 'true' || youtubeEnabledValue === undefined);
      } catch (error) {
        console.error('Error loading YouTube setting:', error);
        // Default to true if error
        setYoutubeEnabled(true);
      }

      // Load songs for random examples
      try {
        const [localResponse, ultrastarResponse, fileResponse] = await Promise.all([
          songAPI.getServerVideos(),
          songAPI.getUltrastarSongs(),
          songAPI.getFileSongs()
        ]);
        
        const serverVideos = localResponse.data.videos || [];
        const ultrastarSongs = ultrastarResponse.data.songs || [];
        const fileSongs = fileResponse.data.fileSongs || [];
        
        // Try to get invisible songs, but don't fail if it doesn't work
        let invisibleSongs = [];
        try {
          const invisibleResponse = await songAPI.getInvisibleSongs();
          invisibleSongs = invisibleResponse.data.invisibleSongs || [];
        } catch (invisibleError) {
          console.warn('Could not load invisible songs, continuing without filter:', invisibleError);
        }
        
        // Combine and deduplicate songs
        const allSongs = [...fileSongs];
        
        // Add server videos
        serverVideos.forEach((serverVideo: any) => {
          const exists = allSongs.some(song => 
            song.artist.toLowerCase() === serverVideo.artist.toLowerCase() &&
            song.title.toLowerCase() === serverVideo.title.toLowerCase()
          );
          if (!exists) {
            allSongs.push(serverVideo);
          }
        });
        
        // Add ultrastar songs
        ultrastarSongs.forEach((ultrastarSong: any) => {
          const exists = allSongs.some(song => 
            song.artist.toLowerCase() === ultrastarSong.artist.toLowerCase() &&
            song.title.toLowerCase() === ultrastarSong.title.toLowerCase()
          );
          if (!exists) {
            allSongs.push(ultrastarSong);
          }
        });
        
        // Filter out invisible songs (if we have the list)
        const visibleSongs = allSongs.filter(song => {
          return !invisibleSongs.some((invisible: any) => 
            invisible.artist.toLowerCase() === song.artist.toLowerCase() &&
            invisible.title.toLowerCase() === song.title.toLowerCase()
          );
        });
        
        // Sort alphabetically by artist, then by title
        visibleSongs.sort((a, b) => {
          const artistA = a.artist.toLowerCase();
          const artistB = b.artist.toLowerCase();
          if (artistA !== artistB) {
            return artistA.localeCompare(artistB);
          }
          return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
        });
        
        setServerVideos(visibleSongs);
        setUltrastarSongs(ultrastarSongs);
        setFileSongs(fileSongs);
        
        // Set random example song
        if (visibleSongs.length > 0) {
          const randomIndex = Math.floor(Math.random() * visibleSongs.length);
          const randomSong = visibleSongs[randomIndex];
          setRandomExampleSong({ artist: randomSong.artist, title: randomSong.title });
        }
      } catch (error) {
        console.error('Error loading songs for examples:', error);
      }
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    // Load Ultrastar audio settings
    const loadUltrastarAudioSettings = async () => {
      try {
        const response = await songAPI.getUltrastarAudioSettings();
        const audioSettings = response.data.ultrastarAudioSettings || [];
        
        // Convert to lookup object
        const audioSettingsMap: Record<string, string> = {};
        audioSettings.forEach((setting: any) => {
          const key = `${setting.artist}-${setting.title}`;
          audioSettingsMap[key] = setting.audio_preference;
        });
        setUltrastarAudioSettings(audioSettingsMap);
      } catch (error) {
        console.error('Error loading ultrastar audio settings:', error);
      }
    };

    loadUltrastarAudioSettings();
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

  // YouTube-Link-Erkennung
  const isYouTubeLink = (input: string): boolean => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i;
    return youtubeRegex.test(input.trim());
  };

  // Validierung des Songtitel-Formats
  const isValidSongFormat = (input: string): boolean => {
    if (!input.trim()) return false;
    if (isYouTubeLink(input)) return true; // YouTube-Links sind immer gültig
    
    // Prüfe auf Format "Interpret - Songname"
    const parts = input.split(' - ');
    return parts.length >= 2 && parts[0].trim() !== '' && parts.slice(1).join(' - ').trim() !== '';
  };

  // Zufälligen Beispiel-Song aus verfügbaren Songs auswählen
  const getRandomExampleSong = () => {
    const allSongs = [...serverVideos, ...ultrastarSongs, ...fileSongs];
    if (allSongs.length > 0) {
      const randomIndex = Math.floor(Math.random() * allSongs.length);
      const randomSong = allSongs[randomIndex];
      return { artist: randomSong.artist, title: randomSong.title };
    }
    return { artist: 'Queen', title: 'Bohemian Rhapsody' }; // Fallback
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validierung des Songtitel-Formats
    if (!isValidSongFormat(formData.songInput)) {
      // Öffne Modal für Format-Korrektur
      setPendingSongInput(formData.songInput);
      
      // Leere Felder - keine Vorausfüllung
      setFormatModalArtist('');
      setFormatModalTitle('');
      
      // Generiere neuen zufälligen Beispiel-Song
      const exampleSong = getRandomExampleSong();
      setRandomExampleSong(exampleSong);
      
      setShowFormatModal(true);
      return;
    }
    
    setLoading(true);
    setMessage(null);

    try {
      const requestData = {
        ...formData,
        withBackgroundVocals: isUltrastarSong() ? withBackgroundVocals : undefined
      };
      
      const response = await songAPI.requestSong(requestData);
      
      setMessage({
        type: 'success',
        text: `Song "${response.data.song.title}" wurde erfolgreich zur Playlist hinzugefügt!`
      });
      
      // Reset form - keep name, clear only song input and background vocals
      setFormData(prev => ({ ...prev, songInput: '' }));
      setWithBackgroundVocals(false);
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
    // Songs sind bereits geladen, öffne einfach das Modal
    setShowSongList(true);
  };

  const handleCloseSongList = () => {
    setShowSongList(false);
    setSearchTerm('');
  };

  const handleSelectSong = (video: any) => {
    const songInput = `${video.artist} - ${video.title}`;
    setFormData(prev => ({ ...prev, songInput }));
    setWithBackgroundVocals(false); // Reset checkbox when selecting new song
    handleCloseSongList();
  };

  // Handler für Format-Modal
  const handleFormatModalConfirm = () => {
    if (formatModalArtist.trim() && formatModalTitle.trim()) {
      const correctedInput = `${formatModalArtist.trim()} - ${formatModalTitle.trim()}`;
      setFormData(prev => ({ ...prev, songInput: correctedInput }));
      setShowFormatModal(false);
      setFormatModalArtist('');
      setFormatModalTitle('');
      setPendingSongInput('');
    }
  };

  const handleFormatModalCancel = () => {
    setShowFormatModal(false);
    setFormatModalArtist('');
    setFormatModalTitle('');
    setPendingSongInput('');
  };

  // Check if the selected song is an Ultrastar song
  const isUltrastarSong = () => {
    if (!formData.songInput) return false;
    return ultrastarSongs.some(song => 
      `${song.artist} - ${song.title}` === formData.songInput
    );
  };

  const filteredVideos = serverVideos.filter(video =>
    video.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
    video.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${video.artist} - ${video.title}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group songs by first letter of artist
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

  const groupedSongs = filteredVideos.reduce((groups, song) => {
    const letter = getFirstLetter(song.artist);
    if (!groups[letter]) {
      groups[letter] = [];
    }
    groups[letter].push(song);
    return groups;
  }, {} as Record<string, typeof filteredVideos>);

  const sortedGroups = Object.keys(groupedSongs).sort();

  return (
    <Container>
      <Card>
      
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

          <FormGroup style={{ marginBottom: '-10px' }}>
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
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px', marginTop: '-10px' }}>
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

          {/* Background Vocals Checkbox - only show for Ultrastar songs with "choice" setting */}
          {isUltrastarSong() && (() => {
            const songKey = `${formData.songInput.split(' - ')[0]}-${formData.songInput.split(' - ').slice(1).join(' - ')}`;
            const audioPreference = ultrastarAudioSettings[songKey];
            return !audioPreference || audioPreference === 'choice';
          })() && (
            <FormGroup>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="withBackgroundVocals"
                  checked={withBackgroundVocals}
                  onChange={(e) => setWithBackgroundVocals(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <Label htmlFor="withBackgroundVocals" style={{ marginBottom: 0, cursor: 'pointer' }}>
                  Mit Background-Gesang
                </Label>
              </div>
            </FormGroup>
          )}

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
        
        <QRCodeContainer>
          <h3>QR Code für andere Geräte:</h3>
          {qrCodeDataUrl && <QRCodeImage src={qrCodeDataUrl} alt="QR Code" />}
        </QRCodeContainer>

      </Card>

      {/* Song List Modal */}
      <SongListModal $isOpen={showSongList}>
        <SongListContent>
          <SongListHeader>
            <SongListTitle>🎵 Alle Songs</SongListTitle>
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
          
          <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {filteredVideos.length > 0 ? (
              sortedGroups.map((letter) => (
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
                  {groupedSongs[letter].map((video, index) => (
                    <SongItem key={`${letter}-${index}`} onClick={() => handleSelectSong(video)}>
                      <SongArtist>{video.artist}</SongArtist>
                      <SongTitle>{video.title}</SongTitle>
                    </SongItem>
                  ))}
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                {searchTerm ? 'Keine Songs gefunden' : 'Keine Songs verfügbar'}
              </div>
            )}
          </div>
        </SongListContent>
      </SongListModal>

      {/* Format-Korrektur Modal */}
      <FormatModal $isOpen={showFormatModal}>
        <FormatModalContent>
          <FormatModalHeader>
            <FormatModalTitle>🎵 Songtitel-Format korrigieren</FormatModalTitle>
            <FormatModalCloseButton onClick={handleFormatModalCancel}>×</FormatModalCloseButton>
          </FormatModalHeader>
          
          <FormatModalBody>
            <FormatModalText>
              Der Songtitel sollte im Format <strong>"Interpret - Songname"</strong> eingegeben werden.
              {pendingSongInput && (
                <>
                  <br /><br />
                  <strong>Eingegeben:</strong> "{pendingSongInput}"
                </>
              )}
            </FormatModalText>
            
            <FormatModalInputs>
              <FormatModalRow>
                <Label htmlFor="formatModalArtist" style={{ marginBottom: 0, minWidth: '80px' }}>Interpret:</Label>
                <FormatModalInput
                  type="text"
                  id="formatModalArtist"
                  value={formatModalArtist}
                  onChange={(e) => setFormatModalArtist(e.target.value)}
                  placeholder={`z.B. ${randomExampleSong.artist}`}
                  autoFocus
                />
              </FormatModalRow>
              
              <FormatModalRow>
                <Label htmlFor="formatModalTitle" style={{ marginBottom: 0, minWidth: '80px' }}>Songtitel:</Label>
                <FormatModalInput
                  type="text"
                  id="formatModalTitle"
                  value={formatModalTitle}
                  onChange={(e) => setFormatModalTitle(e.target.value)}
                  placeholder={`z.B. ${randomExampleSong.title}`}
                />
              </FormatModalRow>
            </FormatModalInputs>
          </FormatModalBody>
          
          <FormatModalButtons>
            <FormatModalButton onClick={handleFormatModalCancel}>
              Abbrechen
            </FormatModalButton>
            <FormatModalButton 
              $variant="primary"
              onClick={handleFormatModalConfirm}
              disabled={!formatModalArtist.trim() || !formatModalTitle.trim()}
            >
              Korrigieren
            </FormatModalButton>
          </FormatModalButtons>
        </FormatModalContent>
      </FormatModal>
    </Container>
  );
};

export default SongRequest;
