import React from 'react';
import styled from 'styled-components';

const StyledSmallButton = styled.button<{ variant?: 'primary' | 'success' | 'danger' }>`
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

interface SmallButtonProps {
  variant?: 'primary' | 'success' | 'danger';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
  title?: string;
}

const SmallButton: React.FC<SmallButtonProps> = ({ 
  variant = 'primary', 
  onClick, 
  disabled = false, 
  children, 
  style,
  title 
}) => {
  return (
    <StyledSmallButton
      variant={variant}
      onClick={onClick}
      disabled={disabled}
      style={style}
      title={title}
    >
      {children}
    </StyledSmallButton>
  );
};

export default SmallButton;
