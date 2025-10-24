import React from 'react';
import styled from 'styled-components';
import { DownloadStatus } from '../../utils/helper';
import { useTranslation } from 'react-i18next';

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
      case 'pending': return '#6c757d';
      case 'downloading': return '#ffc107';
      case 'transcoding': return 'linear-gradient(135deg, #9b59b6, #bb8fce)';
      case 'separating': return 'linear-gradient(135deg, #e74c3c, #ec7063)';
      case 'dereverbing': return 'linear-gradient(135deg, #2ecc71, #58d68d)';
      case 'transcribing': return 'linear-gradient(135deg, #f39c12, #f7dc6f)';
      case 'finished': return '#28a745';
      case 'failed': return '#dc3545';
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
    const { t } = useTranslation();
    const realStatus = status;

    if (['none', 'ready'].includes(realStatus))
      return null;

    const textMap: Record<DownloadStatus, string> = {
      pending: `⏳ ${t('status.pending')}`,
      downloading: `📥 ${t('status.downloading')}`,
      transcoding: `🎬 ${t('status.transcoding')}`,
      separating: `🎵 ${t('status.separating')}`,
      dereverbing: `🧼 ${t('status.dereverbing')}`,
      transcribing: `📝 ${t('status.transcribing')}`,
      finished: t('status.finished'),
      failed: `❌ ${t('status.failed')}`,
    };

    return (
      <DownloadStatusBadgeStyle
        $status={realStatus}
      >
     {textMap[realStatus] || `[${realStatus}]`}
     {/* [{realStatus}] */}
      </DownloadStatusBadgeStyle>
    );
  };
  
  export default DownloadStatusBadge;