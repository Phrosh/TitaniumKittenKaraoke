import React from 'react';
import { Modal, ModalContent, ModalTitle, ModalButtons } from '../../../shared/style';
import { Button } from '../../../shared';
import SmallModeBadge from '../../../shared/SmallModeBadge';

interface DeleteModalProps {
  show: boolean;
  deleteSong: any | null;
  actionLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteModal: React.FC<DeleteModalProps> = ({
  show,
  deleteSong,
  actionLoading,
  onClose,
  onConfirm,
}) => {
  if (!show || !deleteSong) return null;

  return (
    <Modal>
          <ModalContent>
            <ModalTitle>🗑️ Song löschen</ModalTitle>
            
            <div style={{ 
              padding: '20px', 
              backgroundColor: '#fff5f5', 
              borderRadius: '8px', 
              marginBottom: '20px',
              border: '1px solid #fed7d7',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '18px', fontWeight: '600', color: '#c53030', marginBottom: '10px' }}>
                ⚠️ Achtung: Diese Aktion kann nicht rückgängig gemacht werden!
              </div>
              <div style={{ fontSize: '16px', color: '#2d3748', marginBottom: '15px' }}>
                Möchtest du den Song wirklich löschen?
              </div>
              <div style={{ 
                fontSize: '14px', 
                color: '#4a5568',
                backgroundColor: 'white',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0'
              }}>
                <strong>Song:</strong> {deleteSong.artist} - {deleteSong.title}
                <SmallModeBadge mode={deleteSong.mode} modes={deleteSong.modes} />
              </div>
            </div>
            
            <ModalButtons>
              <Button onClick={onClose}>Abbrechen</Button>
              <Button 
                onClick={onConfirm}
                disabled={actionLoading}
                style={{
                  backgroundColor: actionLoading ? '#ccc' : '#dc3545',
                  color: 'white'
                }}
              >
                {actionLoading ? '⏳ Wird gelöscht...' : '🗑️ Endgültig löschen'}
              </Button>
            </ModalButtons>
          </ModalContent>
        </Modal>
  );
};

export default DeleteModal;


