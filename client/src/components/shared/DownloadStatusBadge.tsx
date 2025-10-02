import React from 'react';
import styled from 'styled-components';
import { getDownloadStatusText, DownloadStatus } from '../../utils/helper';

export const DownloadStatusBadgeStyle = styled.div<{ $status: DownloadStatus }>`
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  margin-left: 8px;
  min-width: 80px;
  text-align: center;
  background: ${props => {
    switch (props.$status) {
      case 'downloading': return '#ffc107';
      case 'ready': return '#28a745';
      case 'pending': return '#17a2b8';
      case 'downloaded': return '#28a745';
      case 'cached': return '#17a2b8';
      case 'failed': return '#dc3545';
      case 'magic-processing': return 'linear-gradient(135deg, #8e44ad, #9b59b6)';
      case 'magic-downloading': return 'linear-gradient(135deg, #3498db, #5dade2)';
      case 'magic-separating': return 'linear-gradient(135deg, #e74c3c, #ec7063)';
      case 'magic-transcribing': return 'linear-gradient(135deg, #f39c12, #f7dc6f)';
      case 'magic-completed': return 'linear-gradient(135deg, #27ae60, #58d68d)';
      case 'magic-failed': return 'linear-gradient(135deg, #e74c3c, #f1948a)';
      default: return '#6c757d';
    }
  }};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
`;

interface DownloadStatusBadgeProps {
    status: DownloadStatus;
  }
  
  const DownloadStatusBadge: React.FC<DownloadStatusBadgeProps> = ({ 
    status
  }) => {
    if (status === 'none' || status === 'ready' || status === 'pending') {
      return null;
    }
    return (
      <DownloadStatusBadgeStyle
        $status={status}
      >
     {getDownloadStatusText(status)}
      </DownloadStatusBadgeStyle>
    );
  };
  
  export default DownloadStatusBadge;