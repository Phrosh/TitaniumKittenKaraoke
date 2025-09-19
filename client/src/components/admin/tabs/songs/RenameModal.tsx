import React, { useEffect, useState } from 'react';
import { Modal, ModalContent, ModalTitle, ModalButtons, FormGroup, Label, Input } from '../../../shared/style';
import { Button } from '../../../shared';


interface RenameModalProps {
  show: boolean;
  renameSong: any | null;
  actionLoading: boolean;
  onClose: () => void;
  onConfirm: (renameData: { newArtist: string; newTitle: string }) => void;
}

const RenameModal: React.FC<RenameModalProps> = ({
  show,
  renameSong,
  actionLoading,
  onClose,
  onConfirm,
}) => {
  const [renameData, setRenameData] = useState({
      newArtist: '',
      newTitle: ''
  });

  useEffect(() => {
    if (show) {
      setRenameData({
        newArtist: renameSong.artist,
        newTitle: renameSong.title
      });
    }
  }, [show, renameSong]);

  if (!show || !renameSong) return null;

  return (
    <Modal>
          <ModalContent>
            <ModalTitle>✏️ Song umbenennen</ModalTitle>
            
            <FormGroup>
              <Label>Neuer Interpret:</Label>
              <Input
                type="text"
                value={renameData.newArtist}
                onChange={(e) => setRenameData(prev => ({ ...prev, newArtist: e.target.value }))}
                placeholder="Interpret eingeben"
                autoFocus
              />
            </FormGroup>
            
            <FormGroup>
              <Label>Neuer Songtitel:</Label>
              <Input
                type="text"
                value={renameData.newTitle}
                onChange={(e) => setRenameData(prev => ({ ...prev, newTitle: e.target.value }))}
                placeholder="Songtitel eingeben"
              />
            </FormGroup>
            
            <div style={{ 
              padding: '12px', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '6px', 
              marginBottom: '20px',
              fontSize: '14px',
              color: '#666'
            }}>
              <strong>Aktueller Name:</strong> {renameSong.artist} - {renameSong.title}
              <br />
              <strong>Neuer Name:</strong> {renameData.newArtist} - {renameData.newTitle}
            </div>
            
            <ModalButtons>
              <Button onClick={onClose}>Abbrechen</Button>
              <Button 
                onClick={onConfirm(renameData)}
                disabled={actionLoading || !renameData.newArtist.trim() || !renameData.newTitle.trim()}
                style={{
                  backgroundColor: actionLoading || !renameData.newArtist.trim() || !renameData.newTitle.trim() ? '#ccc' : '#ffc107',
                  color: '#212529'
                }}
              >
                {actionLoading ? '⏳ Wird umbenannt...' : '✏️ Umbenennen'}
              </Button>
            </ModalButtons>
          </ModalContent>
        </Modal>
  );
};

export default RenameModal;


