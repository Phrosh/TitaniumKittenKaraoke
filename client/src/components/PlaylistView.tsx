import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { songAPI } from '../services/api';
import { PlaylistResponse } from '../types';

const Container = styled.div`
  min-height: 100vh;
  padding: 20px;
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 40px;
`;

const Title = styled.h1`
  color: white;
  font-size: 3rem;
  margin-bottom: 20px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
`;

const Subtitle = styled.p`
  color: rgba(255, 255, 255, 0.9);
  font-size: 1.2rem;
`;

const PlaylistContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
`;

const SongCard = styled.div<{ isCurrent?: boolean; hasNoYoutube?: boolean; isPast?: boolean }>`
  background: ${props => 
    props.isCurrent ? 'white' :
    props.isPast ? '#f8f9fa' : 
    'white'
  };
  border-radius: 12px;
  padding: 20px;
  margin: 15px 0;
  box-shadow: ${props => 
    props.isCurrent ? '0 8px 25px rgba(231, 76, 60, 0.3)' :
    props.isPast ? '0 2px 8px rgba(0, 0, 0, 0.05)' :
    '0 5px 15px rgba(0, 0, 0, 0.1)'
  };
  border: ${props => 
    props.isCurrent ? '3px solid #e74c3c' :
    props.isPast ? '1px solid #e9ecef' :
    '1px solid #dee2e6'
  };
  transition: all 0.3s ease;
  opacity: ${props => props.isPast ? 0.6 : 1};

  &:hover {
    transform: ${props => props.isPast ? 'none' : 'translateY(-2px)'};
  }
`;

const SongHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
`;

const SongTitle = styled.h3`
  color: #333;
  margin: 0;
`;

const Position = styled.span`
  background: #667eea;
  color: white;
  padding: 5px 10px;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: bold;
`;

const SongArtist = styled.p`
  color: #666;
  margin: 5px 0;
`;

const SongUser = styled.p`
  color: #999;
  font-size: 0.9rem;
  margin: 5px 0;
`;

const CurrentBadge = styled.span`
  background: #e74c3c;
  color: white;
  padding: 5px 10px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: bold;
`;

const NoYoutubeBadge = styled.span`
  background: #f39c12;
  color: white;
  padding: 5px 10px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: bold;
`;

const StatsContainer = styled.div`
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 30px;
  backdrop-filter: blur(10px);
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 20px;
`;

const StatItem = styled.div`
  text-align: center;
  color: white;
`;

const StatNumber = styled.div`
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 5px;
`;

const StatLabel = styled.div`
  font-size: 0.9rem;
  opacity: 0.8;
`;

const LoadingMessage = styled.div`
  text-align: center;
  color: white;
  font-size: 1.2rem;
  padding: 40px;
`;

const EmptyMessage = styled.div`
  text-align: center;
  color: white;
  font-size: 1.2rem;
  padding: 40px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  backdrop-filter: blur(10px);
`;

const PlaylistView: React.FC = () => {
  const [playlistData, setPlaylistData] = useState<PlaylistResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlaylist();
    // Refresh every 5 seconds
    const interval = setInterval(fetchPlaylist, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchPlaylist = async () => {
    try {
      const response = await songAPI.getPlaylist();
      setPlaylistData(response.data);
      setError(null);
    } catch (error: any) {
      setError('Fehler beim Laden der Playlist');
      console.error('Error fetching playlist:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container>
        <LoadingMessage>Lade Playlist...</LoadingMessage>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <EmptyMessage>{error}</EmptyMessage>
      </Container>
    );
  }

  const { playlist, currentSong, total } = playlistData || { playlist: [], currentSong: null, total: 0 };

  return (
    <Container>
      <Header>
        <Title>🎤 Karaoke Playlist</Title>
        <Subtitle>Live Song Requests</Subtitle>
      </Header>

      <PlaylistContainer>
        <StatsContainer>
          <StatsGrid>
            <StatItem>
              <StatNumber>{total}</StatNumber>
              <StatLabel>Gesamt Songs</StatLabel>
            </StatItem>
            <StatItem>
              <StatNumber>{playlist.filter(s => !s.youtube_url).length}</StatNumber>
              <StatLabel>Ohne YouTube Link</StatLabel>
            </StatItem>
            <StatItem>
              <StatNumber>{playlist.length > 0 ? playlist[0]?.position || 0 : 0}</StatNumber>
              <StatLabel>Als nächstes</StatLabel>
            </StatItem>
          </StatsGrid>
        </StatsContainer>

        {playlist.length === 0 ? (
          <EmptyMessage>
            <h3>🎵 Keine Songs in der Playlist</h3>
            <p>Scanne den QR Code oder gehe zu /new um Songs hinzuzufügen!</p>
          </EmptyMessage>
        ) : (
          playlist.map((song) => {
            const isCurrent = currentSong?.id === song.id;
            const isPast = currentSong && song.position < currentSong.position;
            
            return (
            <SongCard 
              key={song.id} 
              isCurrent={isCurrent}
              hasNoYoutube={!song.youtube_url}
              isPast={isPast}
            >
              <SongHeader>
                <SongTitle>{song.title}</SongTitle>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {currentSong?.id === song.id && (
                    <CurrentBadge>🎤 AKTUELL</CurrentBadge>
                  )}
                  {!song.youtube_url && (
                    <NoYoutubeBadge>⚠️ Kein Link</NoYoutubeBadge>
                  )}
                  <Position>#{song.position}</Position>
                </div>
              </SongHeader>
              
              {song.artist && song.artist !== 'Unknown' && (
                <SongArtist>👤 {song.artist}</SongArtist>
              )}
              
              <SongUser>📱 {song.user_name} ({song.device_id})</SongUser>
            </SongCard>
            );
          })
        )}
      </PlaylistContainer>
    </Container>
  );
};

export default PlaylistView;
