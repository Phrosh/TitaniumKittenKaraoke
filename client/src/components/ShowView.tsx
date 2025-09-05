import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { showAPI } from '../services/api';

interface CurrentSong {
  id: number;
  user_name: string;
  artist: string;
  title: string;
  youtube_url: string;
  position: number;
}

interface Song {
  id: number;
  user_name: string;
  artist: string;
  title: string;
  position: number;
}

const ShowContainer = styled.div`
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
`;

const VideoWrapper = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
`;

const VideoIframe = styled.iframe`
  width: 100%;
  height: 100%;
  border: none;
`;

const Header = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  padding: 20px 40px;
  z-index: 10;
`;

const HeaderContent = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
`;

const CurrentSongInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const SingerName = styled.div`
  font-size: 1.8rem;
  font-weight: 700;
  color: #fff;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SongTitle = styled.div`
  font-size: 1.2rem;
  color: #ffd700;
  font-weight: 500;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Footer = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  padding: 20px 40px;
  z-index: 10;
`;

const FooterContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`;

const NextSongsTitle = styled.div`
  font-size: 1rem;
  color: #ccc;
  margin-bottom: 10px;
  font-weight: 600;
`;

const NextSongsList = styled.div`
  display: flex;
  gap: 20px;
  width: 100%;
`;

const NextSongItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
`;

const NextSingerName = styled.div`
  font-size: 0.9rem;
  color: #fff;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const NextSongTitle = styled.div`
  font-size: 0.8rem;
  color: #ffd700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const NoVideoMessage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  font-size: 1.2rem;
  color: #666;
  background: #f8f9fa;
  border-radius: 15px;
  border: 2px dashed #dee2e6;
`;

const LoadingMessage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  font-size: 1.2rem;
  color: #666;
  background: #f8f9fa;
  border-radius: 15px;
`;

const ShowView: React.FC = () => {
  const [currentSong, setCurrentSong] = useState<CurrentSong | null>(null);
  const [nextSongs, setNextSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSongId, setLastSongId] = useState<number | null>(null);

  const fetchCurrentSong = async () => {
    try {
      const response = await showAPI.getCurrentSong();
      const newSong = response.data.currentSong;
      const nextSongs = response.data.nextSongs || [];
      
      // Nur State aktualisieren wenn sich der Song geändert hat
      if (!newSong || newSong.id !== lastSongId) {
        setCurrentSong(newSong);
        setLastSongId(newSong?.id || null);
        setError(null);
      }
      
      setNextSongs(nextSongs);
      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching current song:', error);
      setError('Fehler beim Laden des aktuellen Songs');
      setCurrentSong(null);
      setNextSongs([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentSong();
    
    // Refresh every 2 seconds to catch song changes
    const interval = setInterval(fetchCurrentSong, 2000);
    
    return () => clearInterval(interval);
  }, [lastSongId]);

  const getYouTubeEmbedUrl = (url: string) => {
    if (!url) return null;
    
    // Extract video ID from various YouTube URL formats
    const videoIdMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    
    if (videoIdMatch) {
      const videoId = videoIdMatch[1];
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
    }
    
    return null;
  };

  const embedUrl = currentSong?.youtube_url ? getYouTubeEmbedUrl(currentSong.youtube_url) : null;

  return (
    <ShowContainer>
      {/* Fullscreen Video */}
      {embedUrl ? (
        <VideoWrapper>
          <VideoIframe
            key={currentSong?.id} // Force re-render only when song changes
            src={embedUrl}
            title={`${currentSong?.user_name} - ${currentSong?.title}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </VideoWrapper>
      ) : (
        <VideoWrapper>
          <NoVideoMessage>
            {currentSong ? '🎵 Kein YouTube-Link verfügbar' : '🎤 Kein Song ausgewählt'}
          </NoVideoMessage>
        </VideoWrapper>
      )}

      {/* Header Overlay */}
      <Header>
        <HeaderContent>
          <CurrentSongInfo>
            <SingerName>
              {currentSong ? `🎵 ${currentSong.user_name}` : 'Warte auf Song...'}
            </SingerName>
            <SongTitle>
              {currentSong ? (
                currentSong.artist ? `${currentSong.artist} - ${currentSong.title}` : currentSong.title
              ) : (
                'Kein Song in der Warteschlange'
              )}
            </SongTitle>
          </CurrentSongInfo>
        </HeaderContent>
      </Header>

      {/* Footer Overlay */}
      <Footer>
        <FooterContent>
          <NextSongsTitle>🎤 Nächste Songs:</NextSongsTitle>
          <NextSongsList>
            {nextSongs.length > 0 ? (
              nextSongs.map((song, index) => (
                <NextSongItem key={song.id}>
                  <NextSingerName>{song.user_name}</NextSingerName>
                  <NextSongTitle>
                    {song.artist ? `${song.artist} - ${song.title}` : song.title}
                  </NextSongTitle>
                </NextSongItem>
              ))
            ) : (
              <NextSongItem>
                <NextSingerName>Keine weiteren Songs</NextSingerName>
                <NextSongTitle>Warteschlange ist leer</NextSongTitle>
              </NextSongItem>
            )}
          </NextSongsList>
        </FooterContent>
      </Footer>
    </ShowContainer>
  );
};

export default ShowView;
