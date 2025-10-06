import { styled } from "styled-components";

export const PlaylistContainer = styled.div`
  background: transparent;
  border-radius: 0;
  padding: 0;
  box-shadow: none;
`;

export const PlaylistHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

export const PlaylistTitle = styled.h2`
  color: #333;
  margin: 0;
`;

export const ControlButtons = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;

export const CenterButtons = styled.div`
  display: flex;
  gap: 15px;
  justify-content: center;
`;

export const RightButtons = styled.div`
  display: flex;
  gap: 8px;
`;

export const ControlButtonGroup = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

export const ControlButton = styled.button`
  background: #34495e;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1.2rem;
  transition: all 0.3s ease;
  min-width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover:not(:disabled) {
    background: #2c3e50;
    transform: scale(1.05);
  }

  &:disabled {
    background: #7f8c8d;
    cursor: not-allowed;
    transform: none;
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }
`;

export const SmallButton = styled.button<{ variant?: 'primary' | 'success' | 'danger' }>`
  background: ${props => 
    props.variant === 'success' ? '#27ae60' :
    props.variant === 'danger' ? '#e74c3c' :
    '#667eea'
  };
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: ${props => 
      props.variant === 'success' ? '#229954' :
      props.variant === 'danger' ? '#c0392b' :
      '#5a6fd8'
    };
    transform: translateY(-1px);
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
    transform: none;
  }
`;

export const QRCodeToggleButton = styled.button<{ $active: boolean }>`
  background: ${props => props.$active ? '#8e44ad' : '#95a5a6'};
  color: white;
  border: none;
  padding: 15px 25px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background-color 0.2s;

  &:hover {
    background: ${props => props.$active ? '#7d3c98' : '#7f8c8d'};
  }
`;

export const DropZone = styled.div<{ $isVisible?: boolean }>`
  height: 4px;
  background: #3498db;
  border-radius: 2px;
  margin: 5px 0;
  opacity: ${props => props.$isVisible ? 1 : 0};
  transition: opacity 0.2s ease;
  box-shadow: 0 0 10px rgba(52, 152, 219, 0.5);
`;

export const SongItem = styled.div<{ $isCurrent?: boolean; $hasNoYoutube?: boolean; $isPast?: boolean; $isDragging?: boolean; $isDropTarget?: boolean; $isBlocked?: boolean }>`
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border-radius: 8px;
  margin: 10px 0;
  background: ${props => 
    props.$isCurrent ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.25) 0%, rgba(118, 75, 162, 0.25) 100%)' :
    props.$isPast ? '#f8f9fa' :
    props.$hasNoYoutube ? '#fff3cd' :
    '#f8f9fa'
  };
  border: ${props => 
    props.$isCurrent ? '3px solid #5a6fd8' :
    props.$hasNoYoutube ? '2px solid #dc3545' :
    props.$isPast ? '1px solid #e9ecef' :
    props.$isDropTarget ? '2px dashed #3498db' :
    props.$isBlocked ? '2px solid rgb(220, 162, 53)' :
    '1px solid #dee2e6'
  };
  opacity: ${props => props.$isPast ? 0.6 : props.$isDragging ? 0.5 : 1};
  transition: all 0.3s ease;
  transform: ${props => props.$isDragging ? 'scale(1.02)' : 'none'};
  gap: 15px;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  box-shadow: ${props => 
    props.$isDragging ? '0 8px 25px rgba(0,0,0,0.15)' : 
    props.$isCurrent ? '0 4px 15px rgba(102, 126, 234, 0.3)' :
    'none'
  };
`;

export const DragHandle = styled.div`
  cursor: grab;
  padding: 8px;
  color: rgba(0, 0, 0, 0.4);
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s ease;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  touch-action: none;

  &:hover {
    color: rgba(0, 0, 0, 0.7);
    background: rgba(0, 0, 0, 0.1);
  }

  &:active {
    cursor: grabbing;
  }
`;
export const PositionBadge = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 100%;
  color: #6c757d;
  font-size: 1.1rem;
  font-weight: 600;
  font-family: monospace;
`;

export const SongContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export const SongName = styled.div<{ $isCurrent?: boolean }>`
  font-size: 1.1rem;
  font-weight: 600;
  color: ${props => props.$isCurrent ? '#5a6fd8' : '#333'};
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const DeviceId = styled.span<{ $isCurrent?: boolean }>`
  font-size: 0.85rem;
  color: ${props => props.$isCurrent ? '#5a6fd8' : '#666'};
  background: ${props => props.$isCurrent ? 'rgba(90, 111, 216, 0.1)' : '#f0f0f0'};
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.$isCurrent ? 'rgba(90, 111, 216, 0.2)' : '#e0e0e0'};
    transform: scale(1.05);
  }
`;

export const SongTitleRow = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
`;

export const HP5Badge = styled.div`
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  margin-left: 8px;
  background: #ff6b35;
  color: white;
  min-width: 40px;
  text-align: center;
`;

export const SongTitle = styled.div<{ $isCurrent?: boolean }>`
  flex: 1;
  font-size: 0.95rem;
  color: ${props => props.$isCurrent ? '#5a6fd8' : '#666'};
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
  user-select: text;
  display: flex;
  align-items: center;
  gap: 8px;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  
  &:hover {
    background: ${props => props.$isCurrent ? 'rgba(90, 111, 216, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
    color: ${props => props.$isCurrent ? '#4a5bb8' : '#333'};
  }
`;

export const YouTubeField = styled.input`
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.9rem;
  background: white;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: #3498db;
    box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
  }

  &:hover {
    border-color: #bbb;
  }

  &::placeholder {
    color: #999;
    font-style: italic;
  }
`;

export const SongInfo = styled.div`
  flex: 1;
`;

export const SongDetails = styled.div`
  font-size: 0.9rem;
  color: #666;
`;

export const SongActions = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
`;

export const Badge = styled.span<{ type: 'current' | 'no-youtube' }>`
  background: ${props => props.type === 'current' ? '#e74c3c' : '#f39c12'};
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: bold;
`;