import React, { useState, useEffect } from 'react';
import { Modal, ModalContent, ModalTitle, FormGroup, Label, Input, ModalButtons } from '../../../shared/style';
import Button from '../../../shared/Button';
import SongForm from '../../SongForm';
import { useTranslation } from 'react-i18next';

interface AddSongModalProps {
  show: boolean;
  onClose: () => void;
  onSave: () => void;
  addSongData: { singerName: string; artist: string; title: string; youtubeUrl: string; youtubeMode: 'karaoke' | 'magic'; withBackgroundVocals: boolean };
  setAddSongData: (data: { singerName: string; artist: string; title: string; youtubeUrl: string; youtubeMode: 'karaoke' | 'magic'; withBackgroundVocals: boolean }) => void;
  manualSongList: any[];
}

const AddSongModal: React.FC<AddSongModalProps> = ({
  show,
  onClose,
  onSave,
  addSongData,
  setAddSongData,
  manualSongList,
}) => {
  const { t } = useTranslation();
  const [actionLoading, setActionLoading] = useState(false);
    const [addSongUsdbResults, setAddSongUsdbResults] = useState<any[]>([]);
    const [addSongUsdbLoading, setAddSongUsdbLoading] = useState(false);
    // const [addSongUsdbTimeout, setAddSongUsdbTimeout] = useState<NodeJS.Timeout | null>(null);
    const [addSongSearchTerm, setAddSongSearchTerm] = useState('');
    
  const handleSelectAddSong = (song: any) => {
    setAddSongData(prev => ({
      ...prev,
      artist: song.artist,
      title: song.title
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


