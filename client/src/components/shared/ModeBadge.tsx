import React from 'react';
import styled from 'styled-components';

export const ModeBadgeStyle = styled.div<{ $mode: 'youtube' | 'server_video' | 'file' | 'ultrastar' | 'youtube_cache' }>`
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: ${props => {
    switch (props.$mode) {
      case 'youtube': return '#ff4444';
      case 'server_video': return '#28a745';
      case 'file': return '#667eea';
      case 'ultrastar': return '#8e44ad';
      case 'youtube_cache': return '#dc3545';
      default: return '#ff4444';
    }
  }};
  color: white;
  min-width: 60px;
  text-align: center;
`;

interface ModeBadgeProps {
    mode: string;
  }
  
  const ModeBadge: React.FC<ModeBadgeProps> = ({ 
    mode
  }) => {
    return (
      <ModeBadgeStyle
        $mode={mode}
      >
      {mode === 'server_video' ? '🟢 Server' : 
       mode === 'file' ? '🔵 Datei' : 
       mode === 'ultrastar' ? '⭐ Ultrastar' : 
       mode === 'youtube_cache' ? '🎬 YouTube Cache' : '🔴 YouTube'}
      </ModeBadgeStyle>
    );
  };
  
  export default ModeBadge;