import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ModalContent, ModalTitle, ModalButtons, FormGroup, Label, Input } from '../../../shared/style';
import Button from '../../../shared/Button';


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
  const { t } = useTranslation();
  
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
            <ModalTitle>✏️ {t('renameModal.title')}</ModalTitle>
            
            <FormGroup>
              <Label>{t('renameModal.newArtist')}</Label>
              <Input
                type="text"
                value={renameData.newArtist}
                onChange={(e) => setRenameData(prev => ({ ...prev, newArtist: e.target.value }))}
                placeholder={t('renameModal.artistPlaceholder')}
                autoFocus
              />
            </FormGroup>
            
            <FormGroup>
              <Label>{t('renameModal.newTitle')}</Label>
              <Input
                type="text"
                value={renameData.newTitle}
                onChange={(e) => setRenameData(prev => ({ ...prev, newTitle: e.target.value }))}
                placeholder={t('renameModal.titlePlaceholder')}
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
              <strong>{t('renameModal.currentName')}:</strong> {renameSong.artist} - {renameSong.title}
              <br />
              <strong>{t('renameModal.newName')}:</strong> {renameData.newArtist} - {renameData.newTitle}
            </div>
            
            <ModalButtons>
              <Button onClick={onClose}>{t('common.cancel')}</Button>
              <Button 
                onClick={() => onConfirm(renameData)}
                disabled={actionLoading || !renameData.newArtist.trim() || !renameData.newTitle.trim()}
                style={{
                  backgroundColor: actionLoading || !renameData.newArtist.trim() || !renameData.newTitle.trim() ? '#ccc' : '#ffc107',
                  color: '#212529'
                }}
              >
                {actionLoading ? `⏳ ${t('renameModal.renaming')}` : `✏️ ${t('renameModal.rename')}`}
              </Button>
            </ModalButtons>
          </ModalContent>
        </Modal>
  );
};

export default RenameModal;


