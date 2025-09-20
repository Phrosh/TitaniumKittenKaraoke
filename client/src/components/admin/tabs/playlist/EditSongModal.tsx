import React, { useState, useEffect } from 'react';
import { Modal, ModalContent, ModalTitle, FormGroup, Label, Input, ModalButtons } from '../../../shared/style';
import Button from '../../../shared/Button';
import { useTranslation } from 'react-i18next';

type ModalType = 'edit' | 'youtube';

interface EditSongModalProps {
  show: boolean;
  onClose: () => void;
  onSave: () => void;
  modalType: ModalType;
  formData: { title: string; artist: string; youtubeUrl: string };
  setFormData: (data: { title: string; artist: string; youtubeUrl: string }) => void;
}

const EditSongModal: React.FC<EditSongModalProps> = ({
  show,
  onClose,
  onSave,
  modalType,
  formData,
  setFormData,
}) => {
  const { t } = useTranslation();
  const [actionLoading, setActionLoading] = useState(false);
    if (!show) return null;

    return (
        <Modal>
            <ModalContent>
                <ModalTitle>
                {modalType === 'youtube' ? t('modals.editSong.addYoutubeLink') : t('modals.editSong.editSong')}
                </ModalTitle>
                
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


