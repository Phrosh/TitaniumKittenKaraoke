import React, { useState, useEffect } from 'react';
import { Modal, ModalContent, ModalTitle, ModalButtons } from '../../../shared/style';
import Button from '../../../shared/Button';
import SongForm from '../../SongForm';
import { useTranslation } from 'react-i18next';
import SmallModeBadge from '../../../shared/SmallModeBadge';
import { isSongInYouTubeCache } from '../../../../utils/helper';
import { extractVideoIdFromUrl, isYouTubeUrl } from '../../../../utils/youtubeUrlCleaner';
import { AdminDashboardData } from '../../../types';

type ModalType = 'edit' | 'youtube';

interface EditSongModalProps {
  show: boolean;
  onClose: () => void;
  onSave: () => void;
  modalType: ModalType;
  formData: { 
    title: string; 
    artist: string; 
    youtubeUrl: string; 
    youtubeMode: 'karaoke' | 'magic';
    singerName?: string;
    withBackgroundVocals?: boolean;
  };
  setFormData: (data: { 
    title: string; 
    artist: string; 
    youtubeUrl: string; 
    youtubeMode: 'karaoke' | 'magic';
    singerName?: string;
    withBackgroundVocals?: boolean;
  }) => void;
  currentSong?: any; // To check song mode and API routes
  dashboardData?: AdminDashboardData;
  manualSongList?: any[];
}

const EditSongModal: React.FC<EditSongModalProps> = ({
  show,
  onClose,
  onSave,
  modalType,
  formData,
  setFormData,
  currentSong,
  dashboardData,
  manualSongList = [],
}) => {
  const { t } = useTranslation();
  const [actionLoading, setActionLoading] = useState(false);
  const [editSongUsdbResults, setEditSongUsdbResults] = useState<any[]>([]);
  const [editSongUsdbLoading, setEditSongUsdbLoading] = useState(false);
  const [editSongSearchTerm, setEditSongSearchTerm] = useState('');
  
  // Check if YouTube URL field should be shown
  const shouldShowYouTubeUrl = () => {
    // Always show if URL is empty
    if (!formData.youtubeUrl.trim()) return true;
    
    // Check if URL contains API routes (like /api/ or server endpoints)
    const hasApiRoute = formData.youtubeUrl.includes('/api/') || 
                       formData.youtubeUrl.includes('localhost') ||
                       formData.youtubeUrl.includes('127.0.0.1') ||
                       formData.youtubeUrl.match(/:\d{4,5}/); // Port numbers
    
    // Show if it's NOT an API route (i.e., it's a real YouTube URL)
    return !hasApiRoute;
  };
  
  // Check if background vocals option should be shown
  const shouldShowBackgroundVocals = () => {
    return currentSong && (currentSong.mode === 'ultrastar' || currentSong.mode === 'magic-youtube' || currentSong.modes?.includes('ultrastar') || currentSong.modes?.includes('magic-youtube'));
  };
  
  // Cache detection logic
  const getCacheInfo = () => {
    if (!dashboardData) return null;
    
    // Check if we have a YouTube URL first
    if (formData.youtubeUrl.trim()) {
      const videoId = extractVideoIdFromUrl(formData.youtubeUrl);
      
      if (videoId) {
        // Check if this video ID exists in YouTube cache
        const song = {
          artist: formData.artist || '',
          title: formData.title || '',
          youtube_url: formData.youtubeUrl
        };
        
        const isInYouTubeCache = isSongInYouTubeCache(song, dashboardData.youtubeSongs);
        
        // Also check if this video ID exists in magic-youtube cache
        const magicYouTubeSongs = dashboardData.magicYouTubeSongs || [];
        
        const foundInMagicYouTube = magicYouTubeSongs.some((magicSong: any) => {
          // Check if any video file matches this video ID
          if (magicSong.videoFiles && Array.isArray(magicSong.videoFiles)) {
            const found = magicSong.videoFiles.some((videoFile: string) => {
              // Extract filename without extension for exact match
              const fileName = videoFile.split('/').pop() || videoFile;
              const nameWithoutExt = fileName.split('.')[0];
              return nameWithoutExt === videoId;
            });
            return found;
          }
          // Check main video file
          if (magicSong.videoFile) {
            const fileName = magicSong.videoFile.split('/').pop() || magicSong.videoFile;
            const nameWithoutExt = fileName.split('.')[0];
            return nameWithoutExt === videoId;
          }
          return false;
        });
        
        // Prioritize Magic YouTube cache over regular YouTube cache
        if (foundInMagicYouTube) {
          return {
            found: true,
            modes: ['magic-youtube'],
            type: 'magic-youtube'
          };
        }
        
        if (isInYouTubeCache) {
          return {
            found: true,
            modes: ['youtube_cache'],
            type: 'youtube_cache'
          };
        }
      }
    }
    
    // If no YouTube URL or not found in cache, check local songs
    if (!formData.artist.trim() || !formData.title.trim()) {
      return null;
    }
    
    const song = {
      artist: formData.artist,
      title: formData.title,
      youtube_url: formData.youtubeUrl
    };
    
    // Check if song is in YouTube cache
    const isInYouTubeCache = isSongInYouTubeCache(song, dashboardData.youtubeSongs);
    
    // Check if song exists in local song list (ultrastar, magic-songs, etc.)
    const localSong = manualSongList.find(s => 
      s.artist?.toLowerCase() === formData.artist.toLowerCase() &&
      s.title?.toLowerCase() === formData.title.toLowerCase()
    );
    
    if (localSong) {
      return {
        found: true,
        modes: localSong.modes || ['file'], // Use actual song modes
        type: 'local'
      };
    }
    
    if (isInYouTubeCache) {
      return {
        found: true,
        modes: ['youtube_cache'],
        type: 'youtube_cache'
      };
    }
    
    return null;
  };
  
  const cacheInfo = getCacheInfo();

  // Check if YouTube mode options should be shown
  const shouldShowYouTubeMode = () => {
    // Only show if there's a YouTube URL and it's a real YouTube URL (not an API route)
    if (!formData.youtubeUrl || !formData.youtubeUrl.trim()) {
      return false;
    }
    
    // Check if it's a real YouTube URL (not an API route)
    const isRealYouTubeUrl = isYouTubeUrl(formData.youtubeUrl);
    
    // Only show if it's a real YouTube URL and no cache info is available
    return isRealYouTubeUrl && !cacheInfo;
  };

  // Filter songs based on search term
  const filteredEditSongs = manualSongList.filter(song =>
    song.artist.toLowerCase().includes(editSongSearchTerm.toLowerCase()) ||
    song.title.toLowerCase().includes(editSongSearchTerm.toLowerCase()) ||
    `${song.artist} - ${song.title}`.toLowerCase().includes(editSongSearchTerm.toLowerCase())
  );

  const handleSelectEditSong = (song: any) => {
    setFormData(prev => ({
      ...prev,
      artist: song.artist,
      title: song.title,
      youtubeUrl: '' // Clear YouTube URL when selecting from list
    }));
  };

  useEffect(() => {
    if (!show) {
      setActionLoading(false);
      setEditSongUsdbResults([]);
      setEditSongUsdbLoading(false);
      setEditSongSearchTerm('');
    } else {
      setActionLoading(false);
    }
  }, [show]);
  
  // Check if song list should be shown (when YouTube URL is empty)
  const shouldShowSongList = () => {
    return !formData.youtubeUrl.trim();
  };

  if (!show) return null;

    return (
        <Modal>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '20px',
              maxWidth: '800px',
              width: '90%',
              maxHeight: '95vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                borderBottom: '1px solid #eee',
                paddingBottom: '15px'
              }}>
                <h3 style={{ margin: 0, color: '#333' }}>
                  {modalType === 'youtube' ? t('modals.editSong.addYoutubeLink') : t('modals.editSong.editSong')}
                </h3>
                <Button
                  onClick={onClose}
                  type="default"
                  size="small"
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    padding: '0',
                    minWidth: 'auto'
                  }}
                >
                  ×
                </Button>
              </div>

              {/* Song Form */}
              <SongForm
                singerName={formData.singerName || ''}
                artist={formData.artist}
                title={formData.title}
                youtubeUrl={formData.youtubeUrl}
                youtubeMode={formData.youtubeMode}
                withBackgroundVocals={Boolean(formData.withBackgroundVocals)}
                onSingerNameChange={(value) => setFormData(prev => ({ ...prev, singerName: value }))}
                songData={formData}
                setSongData={setFormData}
                setSongSearchTerm={setEditSongSearchTerm}
                onYoutubeUrlChange={(value) => setFormData(prev => ({ ...prev, youtubeUrl: value }))}
                onYoutubeModeChange={(mode) => setFormData(prev => ({ ...prev, youtubeMode: mode }))}
                onWithBackgroundVocalsChange={(checked) => setFormData(prev => ({ ...prev, withBackgroundVocals: checked }))}
                showSongList={shouldShowSongList()}
                songList={filteredEditSongs}
                onSongSelect={handleSelectEditSong}
                usdbResults={editSongUsdbResults}
                usdbLoading={editSongUsdbLoading}
                setUsdbResults={setEditSongUsdbResults}
                setUsdbLoading={setEditSongUsdbLoading}
                hideYoutubeModeOptions={!!cacheInfo || !shouldShowYouTubeMode()}
                cacheInfo={cacheInfo}
              />
                
              {/* Buttons */}
              <ModalButtons>
                <Button 
                    onClick={onClose}
                    type="default"
                    size="small"
                >
                    {t('modals.editSong.cancel')}
                </Button>
                <Button 
                    onClick={onSave}
                    disabled={actionLoading}
                    size="small"
                >
                    {actionLoading ? t('modals.editSong.saving') : t('modals.editSong.save')}
                </Button>
              </ModalButtons>
            </div>
        </Modal>
    );
};

export default EditSongModal;


