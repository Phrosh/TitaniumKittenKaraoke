import React from 'react';
import styled from 'styled-components';

const StyledButton = styled.button<{ 
  variant?: 'primary' | 'success' | 'danger' | 'secondary' | 'default';
  size?: 'small' | 'medium' | 'large';
  type?: 'primary' | 'secondary' | 'default' | 'danger';
}>`
  font-variant-emoji: text;
  background: ${props => {
    if (props.type === 'danger') return '#e74c3c';
    if (props.type === 'secondary') return '#6c757d';
    if (props.type === 'default') return '#f8f9fa';
    if (props.variant === 'success') return '#27ae60';
    if (props.variant === 'danger') return '#e74c3c';
    if (props.variant === 'secondary') return '#6c757d';
    return '#667eea';
  }};
  color: ${props => {
    if (props.type === 'default') return '#333';
    return 'white';
  }};
  border: ${props => {
    if (props.type === 'default') return '2px solid #e1e5e9';
    return 'none';
  }};
  padding: ${props => {
    if (props.size === 'small') return '8px 16px';
    if (props.size === 'large') return '20px 35px';
    return '15px 25px';
  }};
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: ${props => {
    if (props.size === 'small') return '0.9rem';
    if (props.size === 'large') return '1.3rem';
    return '1.1rem';
  }};
  transition: all 0.3s ease;

  &:hover {
    background: ${props => {
      if (props.type === 'danger') return '#c0392b';
      if (props.type === 'secondary') return '#5a6268';
      if (props.type === 'default') return '#e9ecef';
      if (props.variant === 'success') return '#229954';
      if (props.variant === 'danger') return '#c0392b';
      if (props.variant === 'secondary') return '#5a6268';
      return '#5a6fd8';
    }};
    transform: ${props => props.disabled ? 'none' : 'translateY(-2px)'};
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
    transform: none;
  }
`;

interface ButtonProps {
  variant?: 'primary' | 'success' | 'danger' | 'secondary' | 'default';
  size?: 'small' | 'medium' | 'large';
  type?: 'primary' | 'secondary' | 'default' | 'danger';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
  title?: string;
}

const Button: React.FC<ButtonProps> = ({ 
  variant = 'primary', 
  size = 'medium',
  type,
  onClick, 
  disabled = false, 
  children, 
  style,
  title 
}) => {
  return (
    <StyledButton
      variant={variant}
      size={size}
      type={type}
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
