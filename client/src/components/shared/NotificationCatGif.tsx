import React from 'react';
import styled from 'styled-components';

const CatGifImage = styled.img<{ $size?: 'sm' | 'md' | 'lg' }>`
  flex-shrink: 0;
  object-fit: cover;
  border-radius: ${(p) => (p.$size === 'sm' ? '8px' : '14px')};
  border: 2px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
  width: ${(p) => {
    if (p.$size === 'sm') return '56px';
    if (p.$size === 'lg') return 'clamp(88px, 14vw, 128px)';
    return 'clamp(72px, 12vw, 110px)';
  }};
  height: ${(p) => {
    if (p.$size === 'sm') return '56px';
    if (p.$size === 'lg') return 'clamp(88px, 14vw, 128px)';
    return 'clamp(72px, 12vw, 110px)';
  }};
`;

interface NotificationCatGifProps {
  src: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const NotificationCatGif: React.FC<NotificationCatGifProps> = ({ src, size = 'md', className }) => (
  <CatGifImage src={src} alt="" aria-hidden className={className} $size={size} />
);

export default NotificationCatGif;
