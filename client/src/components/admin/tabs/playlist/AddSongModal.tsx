import React, { useState, useEffect } from 'react';
import { Modal, ModalContent, ModalTitle, FormGroup, Label, Input, ModalButtons } from '../../../shared/style';
import Button from '../../../shared/Button';
import SongForm from '../../SongForm';

interface AddSongModalProps {
  show: boolean;
  onClose: () => void;
  onSave: () => void;
  addSongData: { singerName: string; artist: string; title: string; youtubeUrl: string };
  setAddSongData: (data: { singerName: string; artist: string; title: string; youtubeUrl: string }) => void;
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

    const [actionLoading, setActionLoading] = useState(false);
    const [addSongUsdbResults, setAddSongUsdbResults] = useState<any[]>([]);
    const [addSongUsdbLoading, setAddSongUsdbLoading] = useState(false);
    // const [addSongUsdbTimeout, setAddSongUsdbTimeout] = useState<NodeJS.Timeout | null>(null);
    const [addSongSearchTerm, setAddSongSearchTerm] = useState('');

    const handleClose = () => {
        setAddSongData({
            singerName: '',
            artist: '',
            title: '',
            youtubeUrl: ''
          });
          setAddSongUsdbResults([]);
          setAddSongUsdbLoading(false);
          setAddSongSearchTerm('');
          setActionLoading(false);

          // Clear any pending timeout
        //   if (addSongUsdbTimeout) {
        //     clearTimeout(addSongUsdbTimeout);
        //     setAddSongUsdbTimeout(null);
        //   }
    };
    
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
                <h3 style={{ margin: 0, color: '#333' }}>➕ Song hinzufügen</h3>
                <button
                  onClick={onClose}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#666'
                  }}
                >
                  ×
                </button>
              </div>
  
              {/* Song Form */}
            <SongForm
              singerName={addSongData.singerName}
              artist={addSongData.artist}
              title={addSongData.title}
              youtubeUrl={addSongData.youtubeUrl}
              withBackgroundVocals={false}
              onSingerNameChange={(value) => setAddSongData(prev => ({ ...prev, singerName: value }))}
              songData={addSongData}
              setSongData={setAddSongData}
              setSongSearchTerm={setAddSongSearchTerm}
              onYoutubeUrlChange={(value) => setAddSongData(prev => ({ ...prev, youtubeUrl: value }))}
              onWithBackgroundVocalsChange={() => {}} // Not used in Add Song Modal
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
                <button
                  onClick={() => {
                    onClose();
                    handleClose();
                  }}
                  disabled={actionLoading}
                  style={{
                    padding: '12px 24px',
                    border: '2px solid #e1e5e9',
                    borderRadius: '8px',
                    backgroundColor: actionLoading ? '#f8f9fa' : 'white',
                    color: actionLoading ? '#ccc' : '#666',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Abbrechen
                </button>
                <button
                  onClick={() => {
                    setActionLoading(true);
                    onSave();
                    onClose();
                    handleClose();
                  }}
                  disabled={actionLoading || !addSongData.singerName.trim() || (!addSongData.artist.trim() && !addSongData.youtubeUrl.trim())}
                    style={{
                    padding: '12px 24px',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: actionLoading || !addSongData.singerName.trim() || (!addSongData.artist.trim() && !addSongData.youtubeUrl.trim()) ? '#ccc' : '#28a745',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: actionLoading || !addSongData.singerName.trim() || (!addSongData.artist.trim() && !addSongData.youtubeUrl.trim()) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {actionLoading ? 'Hinzufügen...' : 'Hinzufügen'}
                </button>
                </ModalButtons>
              </div>
          </Modal>
    );
};

export default AddSongModal;


