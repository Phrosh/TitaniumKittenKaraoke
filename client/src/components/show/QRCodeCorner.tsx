import React from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { AD_HEIGHT } from './constants';

interface QRCodeCornerProps {
  qrCodeUrl: string;
  isVisible: boolean;
}

const QRCodeCornerContainer = styled.div<{ $isVisible: boolean }>`
  position: absolute;
  bottom: 20px;
  left: 20px;
  z-index: 15;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  opacity: ${props => props.$isVisible ? 1 : 0};
  visibility: ${props => props.$isVisible ? 'visible' : 'hidden'};
  transition: opacity 0.5s ease-in-out, visibility 0.5s ease-in-out;
`;

const QRCodeImageSmall = styled.img`
  width: 15vh;
  height: 15vh;
  border-radius: 8px;
  border: 3px solid white;
  box-shadow: 0 0 3vh rgba(0, 0, 0, 1);
  background: white;
`;

const QRCodeTextSmall = styled.div`
  color: white;
  font-size: 1.5vh;
  text-align: center;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  max-width: ${AD_HEIGHT};
  font-weight: 500;
`;

const QRCodeCorner: React.FC<QRCodeCornerProps> = ({ qrCodeUrl, isVisible }) => {
  const { t } = useTranslation();

  if (!qrCodeUrl) {
    return null;
  }

  return (
    <QRCodeCornerContainer $isVisible={isVisible}>
      <QRCodeImageSmall 
        src={qrCodeUrl}
        alt={t('showView.qrCodeForSongRequest')}
      />
      <QRCodeTextSmall>
        {t('showView.scanQrCodeForNewRequests')}
      </QRCodeTextSmall>
    </QRCodeCornerContainer>
  );
};

export default QRCodeCorner;
