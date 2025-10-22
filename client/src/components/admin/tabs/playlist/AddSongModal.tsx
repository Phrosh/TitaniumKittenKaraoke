import React, { useState, useEffect } from 'react';
import { Modal, ModalButtons } from '../../../shared/style';
import Button from '../../../shared/Button';
import SongForm from '../../SongForm';
import { useTranslation } from 'react-i18next';
import { isSongInYouTubeCache } from '../../../../utils/helper';
import { extractVideoIdFromUrl } from '../../../../utils/youtubeUrlCleaner';
import { AdminDashboardData } from '../../../../types';

interface AddSongModalProps {
  show: boolean;
  onClose: () => void;
  onSave: () => void;
  addSongData: { singerName: string; artist: string; title: string; youtubeUrl: string; youtubeMode: 'karaoke' | 'magic'; withBackgroundVocals: boolean };
  setAddSongData: (data: { singerName: string; artist: string; title: string; youtubeUrl: string; youtubeMode: 'karaoke' | 'magic'; withBackgroundVocals: boolean }) => void;
  manualSongList: any[];
  dashboardData: AdminDashboardData;
}

const AddSongModal: React.FC<AddSongModalProps> = ({
  show,
  onClose,
  onSave,
  addSongData,
  setAddSongData,
  manualSongList,
  dashboardData,
}) => {
  const { t } = useTranslation();
  const [actionLoading, setActionLoading] = useState(false);
    const [addSongUsdbResults, setAddSongUsdbResults] = useState<any[]>([]);
    const [addSongUsdbLoading, setAddSongUsdbLoading] = useState(false);
    // const [addSongUsdbTimeout, setAddSongUsdbTimeout] = useState<NodeJS.Timeout | null>(null);
    const [addSongSearchTerm, setAddSongSearchTerm] = useState('');
    
  // Cache detection logic
  const getCacheInfo = () => {
    // Check if we have a YouTube URL first
    if (addSongData.youtubeUrl.trim()) {
      const videoId = extractVideoIdFromUrl(addSongData.youtubeUrl);
      
      if (videoId) {
        // Check if this video ID exists in YouTube cache
        const song = {
          artist: addSongData.artist || '',
          title: addSongData.title || '',
          youtube_url: addSongData.youtubeUrl
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
    if (!addSongData.artist.trim() || !addSongData.title.trim()) {
      return null;
    }
    
    const song = {
      artist: addSongData.artist,
      title: addSongData.title,
      youtube_url: addSongData.youtubeUrl
    };
    
    // Check if song is in YouTube cache
    const isInYouTubeCache = isSongInYouTubeCache(song, dashboardData.youtubeSongs);
    
    // Check if song exists in local song list (ultrastar, magic-songs, etc.)
    const localSong = manualSongList.find(s => 
      s.artist?.toLowerCase() === addSongData.artist.toLowerCase() &&
      s.title?.toLowerCase() === addSongData.title.toLowerCase()
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
    
  const handleSelectAddSong = (song: any) => {
    setAddSongData(prev => ({
      ...prev,
      artist: song.artist,
      title: song.title,
      youtubeUrl: '' // Clear YouTube URL when selecting from list
    }));
  };

  const filteredAddSongs = manualSongList.filter(song =>
    song.artist.toLowerCase().includes(addSongSearchTerm.toLowerCase()) ||
    song.title.toLowerCase().includes(addSongSearchTerm.toLowerCase()) ||
    `${song.artist} - ${song.title}`.toLowerCase().includes(addSongSearchTerm.toLowerCase())
  );

  useEffect(() => {
    if (!show) {
        setActionLoading(false);
        setAddSongUsdbResults([]);
        setAddSongUsdbLoading(false);
        setAddSongSearchTerm('');
    } else {
        // Reset loading state when modal opens
        setActionLoading(false);
    }
  }, [show]);

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
                <h3 style={{ margin: 0, color: '#333' }}>➕ {t('modals.addSong.title')}</h3>
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
              singerName={addSongData.singerName}
              artist={addSongData.artist}
              title={addSongData.title}
              youtubeUrl={addSongData.youtubeUrl}
              youtubeMode={addSongData.youtubeMode}
              withBackgroundVocals={Boolean((addSongData as any).withBackgroundVocals)}
              onSingerNameChange={(value) => setAddSongData(prev => ({ ...prev, singerName: value }))}
              songData={addSongData}
              setSongData={setAddSongData}
              setSongSearchTerm={setAddSongSearchTerm}
              onYoutubeUrlChange={(value) => setAddSongData(prev => ({ ...prev, youtubeUrl: value }))}
              onYoutubeModeChange={(mode) => setAddSongData(prev => ({ ...prev, youtubeMode: mode }))}
              onWithBackgroundVocalsChange={(checked) => setAddSongData(prev => ({ ...prev, withBackgroundVocals: checked }))}
              showSongList={true}
              songList={filteredAddSongs}
              onSongSelect={handleSelectAddSong}
              usdbResults={addSongUsdbResults}
              usdbLoading={addSongUsdbLoading}
              setUsdbResults={setAddSongUsdbResults}
              setUsdbLoading={setAddSongUsdbLoading}
              hideYoutubeModeOptions={!!cacheInfo}
              cacheInfo={cacheInfo}
            />
  
  
              {/* Buttons */}
              <ModalButtons>
                <Button
                  onClick={() => {
                    onClose();
                  }}
                  disabled={actionLoading}
                  type="default"
                  size="small"
                >
                  {t('modals.addSong.cancel')}
                </Button>
                <Button
                  onClick={() => {
                    setActionLoading(true);
                    onSave();
                  }}
                  disabled={actionLoading || !addSongData.singerName.trim() || (!addSongData.artist.trim() && !addSongData.youtubeUrl.trim())}
                  size="small"
                >
                  {actionLoading ? t('modals.addSong.adding') : t('modals.addSong.add')}
                </Button>
                </ModalButtons>
              </div>
          </Modal>
    );
};

export default AddSongModal;


