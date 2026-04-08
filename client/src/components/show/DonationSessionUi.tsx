import React from 'react';
import styled, { keyframes } from 'styled-components';
import { useTranslation } from 'react-i18next';

const marqueeScroll = keyframes`
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
`;

const MarqueeBar = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 40px;
  background: linear-gradient(90deg, #1a0f2e 0%, #3d2a63 50%, #1a0f2e 100%);
  z-index: 11;
  overflow: hidden;
  display: flex;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  pointer-events: none;
`;

const MarqueeTrack = styled.div`
  display: flex;
  width: max-content;
  animation: ${marqueeScroll} 38s linear infinite;
`;

const MarqueeChunk = styled.span`
  display: inline-flex;
  align-items: center;
  padding-left: 48px;
  font-size: 1rem;
  font-weight: 600;
  color: #f3e8ff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  white-space: nowrap;
`;

const OsdWrap = styled.div<{ $visible: boolean }>`
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  max-width: min(720px, 92vw);
  z-index: 12;
  padding: 14px 22px;
  border-radius: 14px;
  background: rgba(12, 8, 20, 0.88);
  color: #fff;
  font-size: 1.05rem;
  font-weight: 600;
  text-align: center;
  line-height: 1.35;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.12);
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  pointer-events: none;
  transition: opacity 0.45s ease;
`;

export interface SessionDonor {
  name: string;
  at?: string;
}

interface DonationMarqueeProps {
  donors: SessionDonor[];
}

export const DonationMarquee: React.FC<DonationMarqueeProps> = ({ donors }) => {
  const { t } = useTranslation();
  if (!donors.length) return null;

  const core = donors.map((d) => d.name.trim()).filter(Boolean);
  if (!core.length) return null;

  const segment = `${t('showView.donorMarqueePrefix')} ${core.join(` ${t('showView.donorMarqueeSep')} `)} ${t('showView.donorMarqueeSuffix')}`;
  const doubled = (
    <>
      <MarqueeChunk>{segment}</MarqueeChunk>
      <MarqueeChunk>{segment}</MarqueeChunk>
    </>
  );

  return (
    <MarqueeBar aria-live="polite">
      <MarqueeTrack>{doubled}</MarqueeTrack>
    </MarqueeBar>
  );
};

interface DonationTopOsdProps {
  visible: boolean;
  text: string;
  topPx: number;
}

export const DonationTopOsd: React.FC<DonationTopOsdProps> = ({ visible, text, topPx }) => (
  <OsdWrap $visible={visible} style={{ top: topPx }}>
    {visible ? text : ''}
  </OsdWrap>
);
