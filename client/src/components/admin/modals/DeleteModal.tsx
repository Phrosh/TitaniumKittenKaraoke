import React from 'react';
import styled from 'styled-components';

interface DeleteModalProps {
  show: boolean;
  deleteSong: any | null;
  actionLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
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
  max-width: 640px;
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

const WarningBox = styled.div`
  padding: 20px;
  background-color: #fff5f5;
  border-radius: 8px;
  margin-bottom: 20px;
  border: 1px solid #fed7d7;
  text-align: center;
`;

const DangerText = styled.div`
  font-size: 18px;
  font-weight: 600;
  color: #c53030;
  margin-bottom: 10px;
`;

const InfoText = styled.div`
  font-size: 16px;
  color: #2d3748;
  margin-bottom: 15px;
`;

const DetailBox = styled.div`
  font-size: 14px;
  color: #4a5568;
  background-color: white;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
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

const DangerButton = styled(Button)<{ disabled?: boolean }>`
  background-color: ${({ disabled }) => (disabled ? '#ccc' : '#dc3545')};
  color: white;
`;

const DeleteModal: React.FC<DeleteModalProps> = ({
  show,
  deleteSong,
  actionLoading,
  onClose,
  onConfirm,
}) => {
  if (!show || !deleteSong) return null;

  const songType = deleteSong.modes?.includes('server_video')
    ? '🟢 Server-Video'
    : deleteSong.modes?.includes('file')
    ? '🔵 Datei-Song'
    : deleteSong.modes?.includes('ultrastar')
    ? '⭐ Ultrastar-Song'
    : deleteSong.mode === 'youtube'
    ? '🔴 YouTube-Song'
    : deleteSong.modes?.includes('youtube_cache')
    ? '🎬 YouTube-Cache'
    : 'Unbekannt';

  return (
    <Modal>
      <ModalContent>
        <ModalTitle>🗑️ Song löschen</ModalTitle>

        <WarningBox>
          <DangerText>⚠️ Achtung: Diese Aktion kann nicht rückgängig gemacht werden!</DangerText>
          <InfoText>Möchtest du den Song wirklich löschen?</InfoText>
          <DetailBox>
            <strong>Song:</strong> {deleteSong.artist} - {deleteSong.title}
            <br />
            <strong>Typ:</strong> {songType}
          </DetailBox>
        </WarningBox>

        <ModalButtons>
          <Button onClick={onClose}>Abbrechen</Button>
          <DangerButton onClick={onConfirm} disabled={actionLoading}>
            {actionLoading ? '⏳ Wird gelöscht...' : '🗑️ Endgültig löschen'}
          </DangerButton>
        </ModalButtons>
      </ModalContent>
    </Modal>
  );
};

export default DeleteModal;


