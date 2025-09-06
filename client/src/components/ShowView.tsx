import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { showAPI } from '../services/api';

interface CurrentSong {
  id: number;
  user_name: string;
  artist: string;
  title: string;
  youtube_url: string;
  mode: 'youtube' | 'local_video';
  position: number;
  duration_seconds?: number;
}

interface ShowData {
  currentSong: CurrentSong | null;
  nextSongs: Song[];
  showQRCodeOverlay: boolean;
  qrCodeDataUrl: string | null;
  overlayTitle: string;
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

const VideoElement = styled.video`
  width: 100%;
  height: 100%;
  object-fit: cover;
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

const TimerDisplay = styled.div`
  font-size: 1rem;
  color: #fff;
  font-weight: 600;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  background: rgba(0, 0, 0, 0.3);
  padding: 5px 10px;
  border-radius: 15px;
  margin-left: 20px;
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

const TransitionOverlay = styled.div<{ $isVisible: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
  opacity: ${props => props.$isVisible ? 1 : 0};
  visibility: ${props => props.$isVisible ? 'visible' : 'hidden'};
  transition: all 0.5s ease;
`;

const TransitionContent = styled.div`
  text-align: center;
  max-width: 800px;
  padding: 40px;
`;

const TransitionTitle = styled.h1`
  font-size: 3rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 30px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
`;

const NextSongInfo = styled.div`
  background: rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 30px;
  margin-bottom: 40px;
  backdrop-filter: blur(10px);
`;

const NextSinger = styled.div`
  font-size: 2.5rem;
  font-weight: 700;
  color: #ffd700;
  margin-bottom: 15px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
`;

const NextSong = styled.div`
  font-size: 1.8rem;
  color: #fff;
  font-weight: 500;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
`;

const QRCodeContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
`;

const QRCodeImage = styled.img`
  width: 200px;
  height: 200px;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
`;

const QRCodeText = styled.div`
  font-size: 1.2rem;
  color: #fff;
  text-align: center;
  max-width: 400px;
  line-height: 1.5;
`;

// QR Code Overlay Components
const QRCodeOverlay = styled.div<{ $isVisible: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 200;
  padding: 40px;
  opacity: ${props => props.$isVisible ? 1 : 0};
  visibility: ${props => props.$isVisible ? 'visible' : 'hidden'};
  transition: opacity 0.5s ease-in-out, visibility 0.5s ease-in-out;
`;

const QRCodeHeader = styled.h1`
  position: absolute;
  top: 40px;
  left: 50%;
  transform: translateX(-50%);
  color: #fff;
  font-size: 3rem;
  margin: 0;
  font-weight: bold;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
  text-align: center;
  z-index: 201;
`;

const QRCodeContent = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 60px;
  max-width: 1200px;
  width: 100%;
`;

const QRCodeLeftSide = styled.div`
  flex: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
`;

const QRCodeTitle = styled.h1`
  color: #fff;
  font-size: 4rem;
  margin: 0 0 40px 0;
  font-weight: bold;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
`;

const QRCodeNextSongInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: center;
`;

const QRCodeNextSinger = styled.h2`
  font-size: 3rem;
  margin: 0;
  font-weight: 600;
  color: #fff;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
`;

const QRCodeNextSongTitle = styled.h3`
  font-size: 2.5rem;
  margin: 0;
  font-weight: normal;
  color: #ffd700;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
`;

const QRCodeRightSide = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
`;

const QRCodeImageLarge = styled.img`
  width: 300px;
  height: 300px;
  border-radius: 15px;
  border: 20px solid white;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
`;

const QRCodeTextLarge = styled.p`
  color: #fff;
  font-size: 1.4rem;
  margin: 0;
  text-align: center;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  max-width: 300px;
`;

const QRCodeCloseButton = styled.button`
  background: #e74c3c;
  color: white;
  border: none;
  padding: 15px 30px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 1.2rem;
  font-weight: 600;
  margin-top: 30px;

  &:hover {
    background: #c0392b;
  }
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
  const [showTransition, setShowTransition] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [videoStartTime, setVideoStartTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [showQRCodeOverlay, setShowQRCodeOverlay] = useState(false);
  const [overlayTitle, setOverlayTitle] = useState('Willkommen beim Karaoke');

  const fetchCurrentSong = async () => {
    try {
      const response = await showAPI.getCurrentSong();
      const newSong = response.data.currentSong;
      const nextSongs = response.data.nextSongs || [];
      const overlayStatus = response.data.showQRCodeOverlay || false;
      const qrCodeDataUrl = response.data.qrCodeDataUrl;
      const title = response.data.overlayTitle || 'Willkommen beim Karaoke';
      
      
      // Update overlay status from API
      setShowQRCodeOverlay(overlayStatus);
      
      // Update QR code if provided
      if (qrCodeDataUrl) {
        setQrCodeUrl(qrCodeDataUrl);
      }
      
      // Update overlay title
      setOverlayTitle(title);
      
      // Nur State aktualisieren wenn sich der Song geändert hat
      if (!newSong || newSong.id !== lastSongId) {
        setCurrentSong(newSong);
        setLastSongId(newSong?.id || null);
        setError(null);
        
        
        // Start timer for new song
        if (newSong && newSong.duration_seconds) {
          setVideoStartTime(Date.now());
          setTimeRemaining(newSong.duration_seconds);
          console.log('⏱️ Timer started:', { 
            duration: newSong.duration_seconds,
            startTime: Date.now() 
          });
        } else {
          setVideoStartTime(null);
          setTimeRemaining(null);
        }
      }
      
      setNextSongs(nextSongs);
      setLoading(false);
    } catch (error: any) {
      console.error('❌ Error fetching current song:', error);
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

  // Timer effect
  useEffect(() => {
    if (!videoStartTime || !timeRemaining) return;

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - videoStartTime) / 1000);
      const remaining = Math.max(0, timeRemaining - elapsed);
      
      setTimeRemaining(remaining);
      
      console.log('⏱️ Timer update:', { 
        elapsed, 
        remaining, 
        duration: currentSong?.duration_seconds 
      });
      
      // Video ended - show transition
      if (remaining <= 0) {
        console.log('🎬 Video ended - showing transition overlay');
        setShowTransition(true);
        setVideoStartTime(null);
        setTimeRemaining(null);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [videoStartTime, timeRemaining, currentSong?.duration_seconds]);


  // Show transition overlay when no current song
  useEffect(() => {
    console.log('🎬 Video transition check:', { 
      loading, 
      currentSong: currentSong?.id, 
      showTransition: !loading && !currentSong 
    });
    
    if (!loading && !currentSong) {
      console.log('🎤 Showing transition overlay - no current song');
      setShowTransition(true);
    } else {
      console.log('🎵 Hiding transition overlay - song is playing');
      setShowTransition(false);
    }
  }, [loading, currentSong]);

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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isLocalVideo = currentSong?.mode === 'local_video';
  const embedUrl = currentSong?.youtube_url && !isLocalVideo ? getYouTubeEmbedUrl(currentSong.youtube_url) : null;

  return (
    <ShowContainer>
      {/* Fullscreen Video */}
      {currentSong?.youtube_url ? (
        <VideoWrapper>
          {isLocalVideo ? (
            <VideoElement
              key={currentSong?.id} // Force re-render only when song changes
              src={currentSong.youtube_url}
              title={`${currentSong?.user_name} - ${currentSong?.title}`}
              controls
              autoPlay
              onLoadStart={() => {
                console.log('🎬 Local video started:', { 
                  songId: currentSong?.id, 
                  title: currentSong?.title,
                  url: currentSong.youtube_url 
                });
              }}
              onEnded={() => {
                console.log('🎬 Local video ended:', { 
                  songId: currentSong?.id, 
                  title: currentSong?.title 
                });
              }}
            />
          ) : (
            <VideoIframe
              key={currentSong?.id} // Force re-render only when song changes
              src={embedUrl}
              title={`${currentSong?.user_name} - ${currentSong?.title}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onLoad={() => {
                console.log('🎬 YouTube video loaded:', { 
                  songId: currentSong?.id, 
                  title: currentSong?.title,
                  embedUrl 
                });
              }}
            />
          )}
        </VideoWrapper>
      ) : (
        <VideoWrapper>
          <NoVideoMessage>
            {currentSong ? '🎵 Kein YouTube-Link verfügbar' : '🎤 Kein Song ausgewählt'}
          </NoVideoMessage>
        </VideoWrapper>
      )}

      {/* Transition Overlay */}
      {showTransition && console.log('🎤 Rendering transition overlay:', { 
        showTransition, 
        currentSong: currentSong?.id,
        nextSongsCount: nextSongs.length 
      })}
      <TransitionOverlay $isVisible={showTransition}>
        <TransitionContent>
          <TransitionTitle>🎤 Nächster Song</TransitionTitle>
          
          {nextSongs.length > 0 ? (
            <NextSongInfo>
              <NextSinger>🎵 {nextSongs[0].user_name}</NextSinger>
              <NextSong>
                {nextSongs[0].artist ? `${nextSongs[0].artist} - ${nextSongs[0].title}` : nextSongs[0].title}
              </NextSong>
            </NextSongInfo>
          ) : (
            <NextSongInfo>
              <NextSinger>🎵 Kein Song in der Warteschlange</NextSinger>
              <NextSong>Warte auf neue Songwünsche...</NextSong>
            </NextSongInfo>
          )}

          <QRCodeContainer>
            <QRCodeImage 
              src={qrCodeUrl} 
              alt="QR Code für Songwünsche"
              onError={(e) => {
                console.error('❌ QR Code failed to load');
                e.currentTarget.style.display = 'none';
              }}
              onLoad={() => {
                console.log('📱 QR Code loaded successfully');
              }}
            />
            <QRCodeText>
              📱 QR-Code scannen für Songwünsche<br/>
              Oder besuche: {window.location.origin}/new
            </QRCodeText>
          </QRCodeContainer>
        </TransitionContent>
      </TransitionOverlay>

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
          {timeRemaining !== null && (
            <TimerDisplay>
              ⏱️ {formatTime(timeRemaining)}
            </TimerDisplay>
          )}
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

      {/* QR Code Overlay */}
      <QRCodeOverlay $isVisible={showQRCodeOverlay}>
        <QRCodeHeader>{overlayTitle}</QRCodeHeader>
        <QRCodeContent>
          <QRCodeLeftSide>
            <QRCodeTitle>🎤 Nächster Song</QRCodeTitle>
            
            {(() => {
              const nextSong = currentSong ? 
                nextSongs.find(song => song.position > currentSong.position) :
                nextSongs.find(song => song.position === 1);
              
              return nextSong ? (
                <QRCodeNextSongInfo>
                  <QRCodeNextSinger>
                    {nextSong.user_name}
                  </QRCodeNextSinger>
                  <QRCodeNextSongTitle>
                    {nextSong.artist ? `${nextSong.artist} - ${nextSong.title}` : nextSong.title}
                  </QRCodeNextSongTitle>
                </QRCodeNextSongInfo>
              ) : (
                <QRCodeNextSongInfo>
                  <QRCodeNextSinger>Keine Songs in der Warteschlange</QRCodeNextSinger>
                  <QRCodeNextSongTitle>Füge den ersten Song hinzu!</QRCodeNextSongTitle>
                </QRCodeNextSongInfo>
              );
            })()}
          </QRCodeLeftSide>
          
          <QRCodeRightSide>
            <QRCodeImageLarge 
              src={qrCodeUrl || ''}
              alt="QR Code für Song-Anfrage"
            />
            <QRCodeTextLarge>
              QR-Code scannen für neue Song-Anfragen
            </QRCodeTextLarge>
          </QRCodeRightSide>
        </QRCodeContent>
      </QRCodeOverlay>
    </ShowContainer>
  );
};

export default ShowView;
