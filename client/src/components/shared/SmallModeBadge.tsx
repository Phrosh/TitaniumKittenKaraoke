import React from 'react';
import styled from 'styled-components';

interface SmallModeBadgeProps {
  mode: string;
  modes?: string[];
}

const SmallBadge = styled.span<{ $color: string; $background: string }>`
  font-size: 12px;
  color: ${props => props.$color};
  background: ${props => props.$background};
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
  white-space: nowrap;
`;

const SmallModeBadge: React.FC<SmallModeBadgeProps> = ({
  mode,
  modes
}) => {
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {modes?.includes('server_video') && (
        <SmallBadge $color="#28a745" $background="#d4edda">
          🟢 Server
        </SmallBadge>
      )}
      {modes?.includes('file') && (
        <SmallBadge $color="#007bff" $background="#cce7ff">
          🔵 Datei
        </SmallBadge>
      )}
      {modes?.includes('ultrastar') && (
        <SmallBadge $color="#8e44ad" $background="#e8d5f2">
          ⭐ Ultrastar
        </SmallBadge>
      )}
      {mode === 'youtube' && (
        <SmallBadge $color="#dc3545" $background="#f8d7da">
          🔴 YouTube
        </SmallBadge>
      )}
      {modes?.includes('youtube_cache') && (
        <SmallBadge $color="#dc3545" $background="#f8d7da">
          🎬 YouTube Cache
        </SmallBadge> 
      )}
      {mode === 'hp2' && (
        <SmallBadge $color="#fd7e14" $background="#fff3cd">
          🎤 BG
        </SmallBadge>
      )}
    </div>
  );
};

export default SmallModeBadge;