import React from 'react';
import styled from 'styled-components';

const StyledButton = styled.button<{ variant?: 'primary' | 'success' | 'danger' }>`
  background: ${props => 
    props.variant === 'success' ? '#27ae60' :
    props.variant === 'danger' ? '#e74c3c' :
    '#667eea'
  };
  color: white;
  border: none;
  padding: 15px 25px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 1.1rem;
  transition: all 0.3s ease;

  &:hover {
    background: ${props => 
      props.variant === 'success' ? '#229954' :
      props.variant === 'danger' ? '#c0392b' :
      '#5a6fd8'
    };
    transform: translateY(-2px);
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
    transform: none;
  }
`;

interface ButtonProps {
  variant?: 'primary' | 'success' | 'danger';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
  title?: string;
}

const Button: React.FC<ButtonProps> = ({ 
  variant = 'primary', 
  onClick, 
  disabled = false, 
  children, 
  style,
  title 
}) => {
  return (
    <StyledButton
      variant={variant}
      onClick={onClick}
      disabled={disabled}
      style={style}
      title={title}
    >
      {children}
    </StyledButton>
  );
};

export default Button;
