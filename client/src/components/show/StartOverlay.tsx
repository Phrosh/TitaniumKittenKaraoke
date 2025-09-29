import React from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';

interface StartOverlayProps {
  show: boolean;
  onStartClick: () => void;
}

const StartOverlayContainer = styled.div<{ $isVisible: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 300;
  padding: 40px;
  opacity: ${props => props.$isVisible ? 1 : 0};
  visibility: ${props => props.$isVisible ? 'visible' : 'hidden'};
  transition: opacity 0.5s ease-in-out, visibility 0.5s ease-in-out;
`;

const StartButton = styled.button`
  background: linear-gradient(45deg, #ff6b6b, #ffd700);
  color: white;
  border: none;
  padding: 30px 60px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 3rem;
  font-weight: 700;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  transition: all 0.3s ease-in-out;
  min-width: 300px;
  text-transform: uppercase;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 15px 40px rgba(0, 0, 0, 0.7);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const StartOverlay: React.FC<StartOverlayProps> = ({
  show,
  onStartClick,
}) => {
  const { t } = useTranslation();

  return (
    <StartOverlayContainer $isVisible={show}>
      <StartButton onClick={onStartClick}>
        {t('showView.start')}
      </StartButton>
    </StartOverlayContainer>
  );
};

export default StartOverlay;
