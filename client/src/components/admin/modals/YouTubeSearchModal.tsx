import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { songAPI } from '../../../services/api';

interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  url: string;
  channelTitle: string;
}

interface YouTubeSearchModalProps {
  show: boolean;
  searchQuery: string;
  onClose: () => void;
  onSelectVideo: (url: string) => void;
}

const Backdrop = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 30px;
  max-width: 700px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
  padding-bottom: 15px;
  margin-bottom: 20px;
`;

const Title = styled.h3`
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

const VideoList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const VideoItem = styled.div`
  display: flex;
  gap: 12px;
  padding: 12px;
  border: 1px solid #eee;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: #f8f9fa;
    border-color: #667eea;
  }
`;

const Thumbnail = styled.img`
  width: 120px;
  height: 90px;
  object-fit: cover;
  border-radius: 6px;
  flex-shrink: 0;
`;

const VideoInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const VideoTitle = styled.div`
  font-weight: 600;
  color: #333;
  font-size: 14px;
  line-height: 1.4;
`;

const VideoChannel = styled.div`
  font-size: 12px;
  color: #666;
`;

const VideoDescription = styled.div`
  font-size: 12px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

const LoadingContainer = styled.div`
  text-align: center;
  padding: 40px;
  color: #666;
`;

const ErrorContainer = styled.div`
  text-align: center;
  padding: 40px;
  color: #dc3545;
`;

const EmptyContainer = styled.div`
  text-align: center;
  padding: 40px;
  color: #666;
`;

const YouTubeSearchModal: React.FC<YouTubeSearchModalProps> = ({
  show,
  searchQuery,
  onClose,
  onSelectVideo,
}) => {
  const { t } = useTranslation();
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (show && searchQuery) {
      searchVideos();
    } else {
      setVideos([]);
      setError(null);
    }
  }, [show, searchQuery]);

  const searchVideos = async () => {
    setLoading(true);
    setError(null);
    setVideos([]);

    try {
      const response = await songAPI.searchYouTube(searchQuery, 20);
      setVideos(response.data.videos || []);
    } catch (err: any) {
      console.error('Error searching YouTube:', err);
      setError(err.response?.data?.message || 'Fehler beim Suchen von YouTube-Videos');
    } finally {
      setLoading(false);
    }
  };

  const handleVideoSelect = (video: YouTubeVideo) => {
    onSelectVideo(video.url);
    onClose();
  };

  if (!show) return null;

  return (
    <Backdrop onClick={onClose}>
      <ModalCard onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>
            🔍 {t('youtubeSearchModal.title', 'YouTube-Videosuche')}
          </Title>
          <CloseButton onClick={onClose}>×</CloseButton>
        </Header>

        {loading && (
          <LoadingContainer>
            🔍 {t('youtubeSearchModal.searching', 'Suche nach Videos...')}
          </LoadingContainer>
        )}

        {error && (
          <ErrorContainer>
            ❌ {error}
          </ErrorContainer>
        )}

        {!loading && !error && videos.length === 0 && (
          <EmptyContainer>
            {t('youtubeSearchModal.noResults', 'Keine Videos gefunden')}
          </EmptyContainer>
        )}

        {!loading && !error && videos.length > 0 && (
          <VideoList>
            {videos.map((video) => (
              <VideoItem
                key={video.id}
                onClick={() => handleVideoSelect(video)}
              >
                <Thumbnail
                  src={video.thumbnail}
                  alt={video.title}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/120x90?text=No+Image';
                  }}
                />
                <VideoInfo>
                  <VideoTitle>{video.title}</VideoTitle>
                  {video.channelTitle && (
                    <VideoChannel>{video.channelTitle}</VideoChannel>
                  )}
                  {video.description && (
                    <VideoDescription>{video.description}</VideoDescription>
                  )}
                </VideoInfo>
              </VideoItem>
            ))}
          </VideoList>
        )}
      </ModalCard>
    </Backdrop>
  );
};

export default YouTubeSearchModal;

