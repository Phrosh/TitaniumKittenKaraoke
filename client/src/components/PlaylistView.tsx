import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { songAPI } from '../services/api';
import { PlaylistResponse } from '../types';
import websocketService, { PlaylistUpdateData } from '../services/websocket';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const [playlistData, setPlaylistData] = useState<PlaylistResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handlePlaylistWebSocketUpdate = useCallback((data: PlaylistUpdateData) => {
    // Update playlist data with WebSocket data
    setPlaylistData({
      playlist: data.playlist,
      currentSong: data.currentSong,
      maxDelay: data.maxDelay,
      total: data.total
    });
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchPlaylist();
    
    // Connect to WebSocket
    websocketService.connect().then(() => {
      console.log('🔌 Connected to WebSocket for playlist updates');
      websocketService.joinPlaylistRoom();
    }).catch((error) => {
      console.error('🔌 Failed to connect to WebSocket, falling back to polling:', error);
      
      // Fallback to polling if WebSocket fails
      const interval = setInterval(fetchPlaylist, 5000);
      
      return () => {
        clearInterval(interval);
      };
    });

    // Set up WebSocket event listener
    websocketService.onPlaylistUpdate(handlePlaylistWebSocketUpdate);

    return () => {
      websocketService.offPlaylistUpdate(handlePlaylistWebSocketUpdate);
      websocketService.leavePlaylistRoom();
      websocketService.disconnect();
    };
  }, [handlePlaylistWebSocketUpdate]);

  const fetchPlaylist = async () => {
    try {
      const response = await songAPI.getPlaylist();
      setPlaylistData(response.data);
      setError(null);
    } catch (error: any) {
      setError(t('playlistView.errorLoadingPlaylist'));
      console.error('Error fetching playlist:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container>
        <LoadingMessage>{t('playlistView.loadingPlaylist')}</LoadingMessage>
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
  
  // Filter out past songs - only show current and future songs
  const visiblePlaylist = playlist.filter(song => !currentSong || song.position >= currentSong.position);

  return (
    <Container>
      <Header>
        <Title>🎤 {t('playlistView.karaokePlaylist')}</Title>
        <Subtitle>{t('playlistView.liveSongRequests')}</Subtitle>
      </Header>

      <PlaylistContainer>
        {visiblePlaylist.length === 0 ? (
          <EmptyMessage>
            <h3>🎵 {t('playlistView.noSongsInPlaylist')}</h3>
            <p>{t('playlistView.scanQrOrGoToNew')}</p>
          </EmptyMessage>
        ) : (
          visiblePlaylist.map((song) => {
            const isCurrent = currentSong?.id === song.id;
            
            return (
            <SongCard 
              key={song.id} 
              isCurrent={isCurrent}
              hasNoYoutube={!song.youtube_url}
            >
              <SongHeader>
                <SongTitle>{song.user_name}</SongTitle>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {currentSong?.id === song.id && (
                    <CurrentBadge>🎤 {t('playlistView.current')}</CurrentBadge>
                  )}
                  <Position>#{song.position}</Position>
                </div>
              </SongHeader>
              
              <SongUser>{song.artist && song.artist !== 'Unknown' ? `${song.artist} - ${song.title}` : song.title}</SongUser>
            </SongCard>
            );
          })
        )}
      </PlaylistContainer>
    </Container>
  );
};

export default PlaylistView;
