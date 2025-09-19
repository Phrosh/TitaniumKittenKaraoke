import React from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';

const ApprovalNotificationBar = styled.div`
  background: linear-gradient(135deg, #ff6b6b, #ff8e8e);
  color: white;
  padding: 15px 20px;
  border-radius: 12px;
  margin-bottom: 20px;
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(255, 107, 107, 0.4);
  }
`;

const ApprovalNotificationContent = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const ApprovalNotificationIcon = styled.div`
  font-size: 24px;
  animation: pulse 2s infinite;
  
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); }
  }
`;

const ApprovalNotificationText = styled.div`
  font-size: 16px;
  font-weight: 600;
`;

const ApprovalNotificationCount = styled.div`
  background: rgba(255, 255, 255, 0.2);
  padding: 8px 12px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 14px;
`;

interface ApprovalNotificationBarProps {
  pendingApprovalsCount: number;
  onNotificationClick: () => void;
}

const ApprovalNotificationBarComponent: React.FC<ApprovalNotificationBarProps> = ({
  pendingApprovalsCount,
  onNotificationClick
}) => {
  const { t } = useTranslation();

  if (pendingApprovalsCount <= 0) {
    return null;
  }

  return (
    <ApprovalNotificationBar onClick={onNotificationClick}>
      <ApprovalNotificationContent>
        <ApprovalNotificationIcon>🎵</ApprovalNotificationIcon>
        <ApprovalNotificationText>
          {pendingApprovalsCount === 1
            ? t('approvalNotification.singleSong')
            : t('approvalNotification.multipleSongs', { count: pendingApprovalsCount })
          }
        </ApprovalNotificationText>
      </ApprovalNotificationContent>
      <ApprovalNotificationCount>
        {pendingApprovalsCount}
      </ApprovalNotificationCount>
    </ApprovalNotificationBar>
  );
};

export default ApprovalNotificationBarComponent;
