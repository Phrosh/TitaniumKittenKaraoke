import React, { useState, useEffect } from 'react';
import { Modal, ModalContent, ModalTitle, FormGroup, Label, Input, ModalButtons } from '../../../shared/style';
import Button from '../../../shared/Button';
import { useTranslation } from 'react-i18next';
import SmallModeBadge from '../../../shared/SmallModeBadge';
import { isSongInYouTubeCache } from '../../../../utils/helper';
import { extractVideoIdFromUrl } from '../../../../utils/youtubeUrlCleaner';
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
}) => {
  const { t } = useTranslation();
  const [actionLoading, setActionLoading] = useState(false);
  
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
    
    return null;
  };
  
  const cacheInfo = getCacheInfo();
  
  if (!show) return null;

    return (
        <Modal>
            <ModalContent>
                <ModalTitle>
                {modalType === 'youtube' ? t('modals.editSong.addYoutubeLink') : t('modals.editSong.editSong')}
                </ModalTitle>
                
                <FormGroup>
                <Label>{t('songForm.singerName')}:</Label>
                <Input
                    type="text"
                    value={formData.singerName || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, singerName: e.target.value }))}
                    placeholder={t('songForm.singerNamePlaceholder')}
                />
                </FormGroup>
                
                <FormGroup>
                <Label>{t('modals.editSong.title')}:</Label>
                <Input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    disabled={modalType === 'youtube'}
                />
                </FormGroup>
                
                <FormGroup>
                <Label>{t('modals.editSong.artist')}:</Label>
                <Input
                    type="text"
                    value={formData.artist}
                    onChange={(e) => setFormData(prev => ({ ...prev, artist: e.target.value }))}
                    disabled={modalType === 'youtube'}
                />
                </FormGroup>
                
                {shouldShowYouTubeUrl() && (
                <FormGroup>
                <Label>{t('modals.editSong.youtubeUrl')}:</Label>
                <Input
                    type="url"
                    value={formData.youtubeUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, youtubeUrl: e.target.value }))}
                    onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        onSave();
                    }
                    }}
                    placeholder="https://www.youtube.com/watch?v=..."
                />
                </FormGroup>
                )}

                {/* Cache Info */}
                {cacheInfo && (
                  <div style={{
                    padding: '12px',
                    backgroundColor: '#e8f5e8',
                    border: '1px solid #4caf50',
                    borderRadius: '6px',
                    marginBottom: '15px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ fontSize: '14px', fontWeight: '500', color: '#2e7d32' }}>
                      ✅ {t('songForm.songFoundAs')}:
                    </span>
                    <SmallModeBadge mode="" modes={cacheInfo.modes} />
                  </div>
                )}

                {/* YouTube Mode Radio Buttons */}
                {formData.youtubeUrl && !cacheInfo && (
                  <FormGroup>
                    <Label>{t('modals.editSong.youtubeMode')}:</Label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="youtubeMode"
                          value="karaoke"
                          checked={formData.youtubeMode === 'karaoke'}
                          onChange={(e) => setFormData(prev => ({ ...prev, youtubeMode: e.target.value as 'karaoke' | 'magic' }))}
                        />
                        <span>{t('modals.editSong.youtubeModeKaraoke')}</span>
                        <SmallModeBadge mode="youtube" modes={[]} />
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="youtubeMode"
                          value="magic"
                          checked={formData.youtubeMode === 'magic'}
                          onChange={(e) => setFormData(prev => ({ ...prev, youtubeMode: e.target.value as 'karaoke' | 'magic' }))}
                        />
                        <span>{t('modals.editSong.youtubeModeMagic')}</span>
                        <SmallModeBadge mode="" modes={['magic-youtube']} />
                      </label>
                    </div>
                  </FormGroup>
                )}

                {shouldShowBackgroundVocals() && (
                    <FormGroup>
                    <Label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={formData.withBackgroundVocals || false}
                            onChange={(e) => setFormData(prev => ({ ...prev, withBackgroundVocals: e.target.checked }))}
                        />
                        <span>{t('songForm.withBackgroundVocals')}</span>
                    </Label>
                    </FormGroup>
                )}
                
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
            </ModalContent>
        </Modal>
    );
};

export default EditSongModal;


