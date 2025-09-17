import React from 'react';
import styled from 'styled-components';

type ModalType = 'edit' | 'youtube';

interface EditSongModalProps {
  show: boolean;
  modalType: ModalType;
  formData: { title: string; artist: string; youtubeUrl: string };
  actionLoading: boolean;
  onClose: () => void;
  onSave: () => void;
  onFormDataChange: (field: 'title' | 'artist' | 'youtubeUrl', value: string) => void;
}

const Modal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background-color: white;
  border-radius: 12px;
  padding: 20px;
  max-width: 600px;
  width: 90%;
  max-height: 95vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
`;

const ModalTitle = styled.h3`
  margin: 0 0 16px 0;
  color: #333;
`;

const FormGroup = styled.div`
  margin-bottom: 14px;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #333;
`;

const Input = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 2px solid #e1e5e9;
  border-radius: 6px;
  font-size: 14px;
  &:focus {
    outline: none;
    border-color: #667eea;
  }
`;

const ModalButtons = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
`;

const Button = styled.button`
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  background-color: #e9ecef;
  color: #212529;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
`;

const PrimaryButton = styled(Button)`
  background-color: #28a745;
  color: white;
`;

const EditSongModal: React.FC<EditSongModalProps> = ({
  show,
  modalType,
  formData,
  actionLoading,
  onClose,
  onSave,
  onFormDataChange,
}) => {
  if (!show) return null;

  return (
    <Modal>
      <ModalContent>
        <ModalTitle>{modalType === 'youtube' ? 'YouTube Link hinzufügen' : 'Song bearbeiten'}</ModalTitle>

        <FormGroup>
          <Label>Titel:</Label>
          <Input
            type="text"
            value={formData.title}
            onChange={(e) => onFormDataChange('title', e.target.value)}
            disabled={modalType === 'youtube'}
          />
        </FormGroup>

        <FormGroup>
          <Label>Interpret:</Label>
          <Input
            type="text"
            value={formData.artist}
            onChange={(e) => onFormDataChange('artist', e.target.value)}
            disabled={modalType === 'youtube'}
          />
        </FormGroup>

        <FormGroup>
          <Label>YouTube URL:</Label>
          <Input
            type="url"
            value={formData.youtubeUrl}
            onChange={(e) => onFormDataChange('youtubeUrl', e.target.value)}
            onKeyDown={(e) => {
              if ((e as React.KeyboardEvent<HTMLInputElement>).key === 'Enter') {
                onSave();
              }
            }}
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </FormGroup>

        <ModalButtons>
          <Button onClick={onClose}>Abbrechen</Button>
          <PrimaryButton onClick={onSave} disabled={actionLoading}>
            {actionLoading ? 'Speichert...' : 'Speichern'}
          </PrimaryButton>
        </ModalButtons>
      </ModalContent>
    </Modal>
  );
};

export default EditSongModal;


