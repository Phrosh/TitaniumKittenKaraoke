import React from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { EmergencyYouTubePending } from '../../utils/emergencyYouTube';

interface EmergencyYouTubeOverlayProps {
  pending: EmergencyYouTubePending | null;
  onOpenClick: () => void;
}

const Overlay = styled.div<{ $isVisible: boolean }>`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 350;
  padding: 40px;
  opacity: ${(p) => (p.$isVisible ? 1 : 0)};
  visibility: ${(p) => (p.$isVisible ? 'visible' : 'hidden')};
  transition: opacity 0.35s ease, visibility 0.35s ease;
`;

const Subtitle = styled.p`
  margin: 0 0 32px;
  color: rgba(255, 255, 255, 0.75);
  font-size: clamp(1rem, 2vw, 1.25rem);
  text-align: center;
  max-width: 720px;
`;

const OpenButton = styled.button`
  background: linear-gradient(45deg, #ff0000, #cc0000);
  color: white;
  border: none;
  padding: 28px 56px;
  border-radius: 20px;
  cursor: pointer;
  font-size: clamp(1.6rem, 4vw, 2.8rem);
  font-weight: 700;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  min-width: min(90vw, 520px);

  &:hover {
    transform: scale(1.04);
    box-shadow: 0 15px 40px rgba(0, 0, 0, 0.7);
  }

  &:active {
    transform: scale(0.98);
  }
`;

const EmergencyYouTubeOverlay: React.FC<EmergencyYouTubeOverlayProps> = ({
  pending,
  onOpenClick,
}) => {
  const { t } = useTranslation();
  const visible = !!pending?.videoId;

  const songLabel =
    pending?.artist && pending?.title
      ? `${pending.artist} – ${pending.title}`
      : pending?.title || pending?.artist || '';

  return (
    <Overlay $isVisible={visible}>
      {songLabel ? <Subtitle>{songLabel}</Subtitle> : null}
      <OpenButton type="button" onClick={onOpenClick}>
        {t('showView.emergencyYouTubeOpen')}
      </OpenButton>
    </Overlay>
  );
};

export default EmergencyYouTubeOverlay;
