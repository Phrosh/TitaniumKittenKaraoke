import React from 'react';
import styled from 'styled-components';

interface ApprovalData {
  singerName: string;
  artist: string;
  title: string;
  youtubeUrl: string;
  withBackgroundVocals: boolean;
}

interface ApprovalModalProps {
  show: boolean;
  pendingApprovals: any[];
  currentApprovalIndex: number;
  approvalData: ApprovalData;
  actionLoading: boolean;
  onClose: () => void;
  onReject: () => void;
  onApprove: () => void;
  children: React.ReactNode; // Form wird von außen übergeben (SongForm)
}

const Backdrop = styled.div`
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

const ModalCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 30px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
  padding-bottom: 15px;
  margin-bottom: 20px;
`;

const Title = styled.h3`
  margin: 0;
  color: #333;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
`;

const Actions = styled.div`
  display: flex;
  gap: 15px;
  justify-content: flex-end;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e1e5e9;
`;

const Button = styled.button<{ primary?: boolean }>`
  padding: 12px 24px;
  border: ${({ primary }) => (primary ? 'none' : '2px solid #e1e5e9')};
  border-radius: 8px;
  background-color: ${({ primary }) => (primary ? '#28a745' : 'white')};
  color: ${({ primary }) => (primary ? 'white' : '#666')};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  &:disabled {
    background-color: #ccc;
    color: ${({ primary }) => (primary ? 'white' : '#666')};
    cursor: not-allowed;
  }
`;

const ApprovalModal: React.FC<ApprovalModalProps> = ({
  show,
  pendingApprovals,
  currentApprovalIndex,
  approvalData,
  actionLoading,
  onClose,
  onReject,
  onApprove,
  children,
}) => {
  if (!show) return null;

  const approveDisabled =
    actionLoading ||
    !approvalData.singerName?.trim() ||
    (!approvalData.artist?.trim() && !approvalData.youtubeUrl?.trim());

  return (
    <Backdrop>
      <ModalCard>
        <Header>
          <Title>
            🎵 Songwunsch bestätigen
            {pendingApprovals.length > 1 && (
              <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#666', marginLeft: '10px' }}>
                ({currentApprovalIndex + 1} von {pendingApprovals.length})
              </span>
            )}
          </Title>
          <CloseButton onClick={onClose}>×</CloseButton>
        </Header>

        {children}

        <Actions>
          <Button onClick={onReject} disabled={actionLoading}>Ablehnen</Button>
          <Button primary onClick={onApprove} disabled={approveDisabled}>
            {actionLoading ? 'Hinzufügen...' : 'Akzeptieren'}
          </Button>
        </Actions>
      </ModalCard>
    </Backdrop>
  );
};

export default ApprovalModal;


