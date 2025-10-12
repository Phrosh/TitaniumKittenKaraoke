import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
// import { useTranslation } from 'react-i18next';
import { AD_HEIGHT } from './constants';

interface AdCornerProps {
  // qrCodeUrl: string;
}

const AdCornerContainer = styled.div`
  position: absolute;
  bottom: 20px;
  right: 20px;
  width: ${AD_HEIGHT};
  min-height: ${AD_HEIGHT};
  z-index: 15;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
`;

const AdCorner: React.FC<AdCornerProps> = ({ }) => {
  // const { t } = useTranslation();

  // if (!qrCodeUrl) {
  //   return null;
  // }
  
  const [page, setPage] = useState<number>(0);
  const PAGE_COUNT = 2;
  const PAGE_DURATION = 12000;
  const PAGE_TRANSITION_DURATION = 3;
  
  useEffect(() => {
    const interval = setInterval(() => {
      setPage((prevPage) => ((prevPage + 1) % PAGE_COUNT));
    }, PAGE_DURATION);
    return () => clearInterval(interval);
  }, []);

  return (
    <AdCornerContainer>
      <img 
        src="/tkk-logo.png" 
        alt="TKK Logo" 
        style={{
          position: 'absolute',
          top: '50%',
          transform: 'translateY(-50%)',
          left: 0,
          width: '100%',
          height: 'auto',
          transition: `opacity ${PAGE_TRANSITION_DURATION}s ease-in-out`,
          opacity: page === 0 ? 1 : 0,
        }}
      />
      <img 
        src="/tkk-text.png" 
        alt="TKK Text" 
        style={{
          position: 'absolute',
          top: '50%',
          transform: 'translateY(-50%)',
          left: 0,
          width: '100%',
          height: 'auto',
          opacity: page === 1 ? 1 : 0,
          transition: `opacity ${PAGE_TRANSITION_DURATION}s ease-in-out`,
        }}
      />
    </AdCornerContainer>
  );
};

export default AdCorner;
