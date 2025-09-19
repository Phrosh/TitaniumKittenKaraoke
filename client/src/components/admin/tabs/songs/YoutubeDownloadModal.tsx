import React, { useEffect, useState } from 'react';
import { Button } from '../../../shared';
import toast from 'react-hot-toast';
import { songAPI } from '../../../../services/api';

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
      toast.error('Bitte gib eine YouTube-URL ein');
      return;
    }
    
    if (!selectedSongForDownload) {
      toast.error('Kein Song für Download ausgewählt');
      return;
    }
    
    setDownloadingVideo(true);
    
    try {
      const folderName = selectedSongForDownload.folderName || `${selectedSongForDownload.artist} - ${selectedSongForDownload.title}`;
      
      toast('YouTube-Video wird heruntergeladen...', { icon: '📥' });
      
      const response = await songAPI.downloadYouTubeVideo(folderName, youtubeUrl);
      
      if (response.data.status === 'success') {
        toast.success(`Video erfolgreich heruntergeladen: ${response.data.downloadedFile}`);
        
        // Close dialog
        // setShowYouTubeDialog(false);
        // setSelectedSongForDownload(null);
        // setYoutubeUrl('');
        onClose();


        // Start normal processing after download
        const songKey = `${selectedSongForDownload.artist}-${selectedSongForDownload.title}`;
        await startNormalProcessing(selectedSongForDownload, songKey, folderName);
        
      } else {
        toast.error('Download fehlgeschlagen');
      }
      
    } catch (error: any) {
      console.error('Error downloading YouTube video:', error);
      toast.error(error.response?.data?.error || 'Fehler beim Herunterladen des YouTube-Videos');
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
          📥 YouTube-Video herunterladen
        </h3>
        
        <p style={{
          margin: '0 0 20px 0',
          color: '#666',
          fontSize: '14px',
          lineHeight: '1.5'
        }}>
          Für <strong>{selectedSongForDownload?.artist} - {selectedSongForDownload?.title}</strong> wurde kein Video gefunden.
          Du kannst optional eine YouTube-URL eingeben, um das Video herunterzuladen, oder ohne Video fortfahren.
        </p>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#333'
          }}>
            YouTube-URL (optional):
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
          <button
            onClick={onClose}
            disabled={downloadingVideo}
            style={{
              padding: '12px 24px',
              border: '2px solid #e1e5e9',
              borderRadius: '8px',
              backgroundColor: 'white',
              color: '#666',
              fontSize: '14px',
              fontWeight: '500',
              cursor: downloadingVideo ? 'not-allowed' : 'pointer',
              opacity: downloadingVideo ? 0.6 : 1,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!downloadingVideo) {
                e.currentTarget.style.borderColor = '#ccc';
                e.currentTarget.style.backgroundColor = '#f8f9fa';
              }
            }}
            onMouseLeave={(e) => {
              if (!downloadingVideo) {
                e.currentTarget.style.borderColor = '#e1e5e9';
                e.currentTarget.style.backgroundColor = 'white';
              }
            }}
          >
            Abbrechen
          </button>
          
          <button
            onClick={onContinueWithoutVideo}
            disabled={downloadingVideo}
            style={{
              padding: '12px 24px',
              border: '2px solid #28a745',
              borderRadius: '8px',
              backgroundColor: 'white',
              color: '#28a745',
              fontSize: '14px',
              fontWeight: '500',
              cursor: downloadingVideo ? 'not-allowed' : 'pointer',
              opacity: downloadingVideo ? 0.6 : 1,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!downloadingVideo) {
                e.currentTarget.style.backgroundColor = '#28a745';
                e.currentTarget.style.color = 'white';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!downloadingVideo) {
                e.currentTarget.style.backgroundColor = 'white';
                e.currentTarget.style.color = '#28a745';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            ⚡ Ohne Video fortfahren
          </button>
          
          <button
            onClick={handleYouTubeDownload}
            disabled={downloadingVideo || !youtubeUrl.trim()}
            style={{
              padding: '12px 24px',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: downloadingVideo || !youtubeUrl.trim() ? '#ccc' : '#667eea',
              color: 'white',
              fontSize: '14px',
              fontWeight: '500',
              cursor: downloadingVideo || !youtubeUrl.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!downloadingVideo && youtubeUrl.trim()) {
                e.currentTarget.style.backgroundColor = '#5a6fd8';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!downloadingVideo && youtubeUrl.trim()) {
                e.currentTarget.style.backgroundColor = '#667eea';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            {downloadingVideo ? '⏳ Download läuft...' : '📥 Herunterladen'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default YoutubeDownloadModal;


