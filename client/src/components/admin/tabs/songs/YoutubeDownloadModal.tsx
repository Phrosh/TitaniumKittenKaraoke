import React, { useEffect, useState } from 'react';
import Button from '../../../shared/Button';
import toast from 'react-hot-toast';
import { songAPI } from '../../../../services/api';
import { useTranslation } from 'react-i18next';
import { createSanitizedFolderName } from '../../../../utils/filenameSanitizer';

interface YoutubeDownloadModalProps {
  show: boolean;
  selectedSongForDownload: any | null;
  onClose: () => void;
  onContinueWithoutVideo: () => void;
  startNormalProcessing: (song: any, songKey: string, folderName: string) => void;
}

const YoutubeDownloadModal: React.FC<YoutubeDownloadModalProps> = ({
  show,
  selectedSongForDownload,
  onClose,
  onContinueWithoutVideo,
  startNormalProcessing,
}) => {
  const { t } = useTranslation();
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [downloadingVideo, setDownloadingVideo] = useState(false);

  useEffect(() => {
    if (!show) {
      setYoutubeUrl('');
      setDownloadingVideo(false);
    }
  }, [show]);

  const handleYouTubeDownload = async () => {
    if (!youtubeUrl.trim()) {
      toast.error(t('youtubeDownloadModal.pleaseEnterUrl'));
      return;
    }
    
    if (!selectedSongForDownload) {
      toast.error(t('youtubeDownloadModal.noSongSelected'));
      return;
    }
    
    setDownloadingVideo(true);
    
    try {
      const folderName = selectedSongForDownload.folderName || createSanitizedFolderName(selectedSongForDownload.artist, selectedSongForDownload.title);
      
      toast(t('youtubeDownloadModal.downloadingVideo'), { icon: '📥' });
      
      const response = await songAPI.downloadYouTubeVideo(folderName, youtubeUrl);
      
      if (response.data.status === 'success') {
        toast.success(t('youtubeDownloadModal.videoDownloadedSuccessfully', { fileName: response.data.downloadedFile }));
        
        // Close dialog
        // setShowYouTubeDialog(false);
        // setSelectedSongForDownload(null);
        // setYoutubeUrl('');
        onClose();


        // Start normal processing after download
        const songKey = `${selectedSongForDownload.artist}-${selectedSongForDownload.title}`;
        await startNormalProcessing(selectedSongForDownload, songKey, folderName);
        
      } else {
        toast.error(t('youtubeDownloadModal.downloadFailed'));
      }
      
    } catch (error: any) {
      console.error('Error downloading YouTube video:', error);
      toast.error(error.response?.data?.error || t('youtubeDownloadModal.errorDownloadingVideo'));
    } finally {
      setDownloadingVideo(false);
    }
  };

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '30px',
        maxWidth: '500px',
        width: '90%',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
      }}>
        <h3 style={{
          margin: '0 0 20px 0',
          color: '#333',
          fontSize: '20px',
          fontWeight: '600'
        }}>
          📥 {t('youtubeDownloadModal.downloadYouTubeVideo')}
        </h3>
        
        <p style={{
          margin: '0 0 20px 0',
          color: '#666',
          fontSize: '14px',
          lineHeight: '1.5'
        }}>
          {t('youtubeDownloadModal.noVideoFound', { 
            artist: selectedSongForDownload?.artist, 
            title: selectedSongForDownload?.title 
          })}
        </p>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#333'
          }}>
            {t('youtubeDownloadModal.youtubeUrlOptional')}:
          </label>
          <input
            type="url"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            style={{
              width: '100%',
              padding: '12px',
              border: '2px solid #e1e5e9',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none',
              transition: 'border-color 0.2s ease'
            }}
            onFocus={(e) => e.target.style.borderColor = '#667eea'}
            onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
            disabled={downloadingVideo}
          />
        </div>
        
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={onClose}
            disabled={downloadingVideo}
            type="default"
            size="small"
          >
            {t('youtubeDownloadModal.cancel')}
          </Button>
          
          <Button
            onClick={onContinueWithoutVideo}
            disabled={downloadingVideo}
            variant="success"
            size="small"
            style={{ border: '2px solid #28a745', backgroundColor: 'white', color: '#28a745' }}
          >
            ⚡ {t('youtubeDownloadModal.continueWithoutVideo')}
          </Button>
          
          <Button
            onClick={handleYouTubeDownload}
            disabled={downloadingVideo || !youtubeUrl.trim()}
            size="small"
          >
            {downloadingVideo ? `⏳ ${t('youtubeDownloadModal.downloadRunning')}` : `📥 ${t('youtubeDownloadModal.download')}`}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default YoutubeDownloadModal;


