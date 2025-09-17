import React from 'react';
import styled from 'styled-components';

interface RenameModalProps {
  show: boolean;
  renameSong: any | null;
  renameData: { newArtist: string; newTitle: string };
  actionLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onRenameDataChange: (field: 'newArtist' | 'newTitle', value: string) => void;
}

const Modal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
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
  font-size: 18px;
  font-weight: 600;
  color: #333;
`;

const FormGroup = styled.div`
  margin-bottom: 16px;
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

const PrimaryButton = styled(Button)<{ disabled?: boolean }>`
  background-color: ${({ disabled }) => (disabled ? '#ccc' : '#ffc107')};
  color: #212529;
`;

const InfoBox = styled.div`
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 6px;
  margin-bottom: 20px;
  font-size: 14px;
  color: #666;
`;

const RenameModal: React.FC<RenameModalProps> = ({
  show,
  renameSong,
  renameData,
  actionLoading,
  onClose,
  onConfirm,
  onRenameDataChange,
}) => {
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
            onChange={(e) => onRenameDataChange('newArtist', e.target.value)}
            placeholder="Interpret eingeben"
            autoFocus
          />
        </FormGroup>

        <FormGroup>
          <Label>Neuer Songtitel:</Label>
          <Input
            type="text"
            value={renameData.newTitle}
            onChange={(e) => onRenameDataChange('newTitle', e.target.value)}
            placeholder="Songtitel eingeben"
          />
        </FormGroup>

        <InfoBox>
          <strong>Aktueller Name:</strong> {renameSong.artist} - {renameSong.title}
          <br />
          <strong>Neuer Name:</strong> {renameData.newArtist} - {renameData.newTitle}
        </InfoBox>

        <ModalButtons>
          <Button onClick={onClose}>Abbrechen</Button>
          <PrimaryButton
            onClick={onConfirm}
            disabled={
              actionLoading ||
              !renameData.newArtist.trim() ||
              !renameData.newTitle.trim()
            }
          >
            {actionLoading ? '⏳ Wird umbenannt...' : '✏️ Umbenennen'}
          </PrimaryButton>
        </ModalButtons>
      </ModalContent>
    </Modal>
  );
};

export default RenameModal;


