import React from 'react';
import styled from 'styled-components';

interface YouTubeDownloadModalProps {
  show: boolean;
  selectedSongForDownload: { artist: string; title: string } | null;
  youtubeUrl: string;
  downloadingVideo: boolean;
  onClose: () => void;
  onUrlChange: (value: string) => void;
  onProcessWithoutVideo: () => void;
  onDownload: () => void;
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

const Card = styled.div`
  background-color: white;
  border-radius: 12px;
  padding: 30px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
`;

const Title = styled.h3`
  margin: 0 0 20px 0;
  color: #333;
  font-size: 20px;
  font-weight: 600;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #333;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease;
  &:focus {
    border-color: #667eea;
  }
`;

const Actions = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
`;

const Button = styled.button<{ kind?: 'default' | 'outline' | 'primary' }>`
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: ${({ kind }) => (kind === 'outline' ? '2px solid #e1e5e9' : 'none')};
  background-color: ${({ kind }) =>
    kind === 'primary' ? '#667eea' : kind === 'outline' ? 'white' : '#28a745'};
  color: ${({ kind }) => (kind === 'outline' ? '#666' : 'white')};
  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`;

const YouTubeDownloadModal: React.FC<YouTubeDownloadModalProps> = ({
  show,
  selectedSongForDownload,
  youtubeUrl,
  downloadingVideo,
  onClose,
  onUrlChange,
  onProcessWithoutVideo,
  onDownload,
}) => {
  if (!show) return null;

  return (
    <Backdrop>
      <Card>
        <Title>📥 YouTube-Video herunterladen</Title>
        <p style={{ margin: '0 0 20px 0', color: '#666', fontSize: 14, lineHeight: 1.5 }}>
          Für <strong>{selectedSongForDownload?.artist} - {selectedSongForDownload?.title}</strong> wurde kein
          Video gefunden. Du kannst optional eine YouTube-URL eingeben, um das Video herunterzuladen, oder ohne Video fortfahren.
        </p>

        <div style={{ marginBottom: 20 }}>
          <Label>YouTube-URL (optional):</Label>
          <Input
            type="url"
            value={youtubeUrl}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            disabled={downloadingVideo}
          />
        </div>

        <Actions>
          <Button kind="outline" onClick={onClose} disabled={downloadingVideo}>Abbrechen</Button>
          <Button kind="outline" onClick={onProcessWithoutVideo} disabled={downloadingVideo}>⚡ Ohne Video fortfahren</Button>
          <Button kind="primary" onClick={onDownload} disabled={downloadingVideo || !youtubeUrl.trim()}>
            {downloadingVideo ? '⏳ Download läuft...' : '📥 Herunterladen'}
          </Button>
        </Actions>
      </Card>
    </Backdrop>
  );
};

export default YouTubeDownloadModal;


