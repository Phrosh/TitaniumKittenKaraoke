import React from 'react';
import styled, { keyframes } from 'styled-components';
import { buildMarqueeSegment } from '../../utils/donationDisplay';
import { HIGHLIGHT_COLOR } from './constants';

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

/** Abstand zwischen den Schleifen-Inhalten, damit nicht derselbe Text doppelt nebeneinander wirkt */
const MarqueeGap = styled.span`
  flex-shrink: 0;
  display: inline-block;
  width: min(50vw, 900px);
  height: 1px;
`;

const OsdWrap = styled.div<{ $visible: boolean }>`
  position: absolute;
  top: 25vh;
  left: 50%;
  transform: translate(-50%, -50%);
  max-width: min(860px, 94vw);
  z-index: 12;
  padding: 28px 36px;
  border-radius: 22px;
  background: linear-gradient(
    165deg,
    rgba(24, 32, 48, 0.94) 0%,
    rgba(18, 24, 38, 0.96) 100%
  );
  color: rgba(255, 255, 255, 0.95);
  font-size: clamp(1.15rem, 2.8vw, 1.55rem);
  font-weight: 600;
  text-align: center;
  line-height: 1.45;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.35),
    0 0 0 1px rgba(255, 255, 255, 0.06),
    0 0 48px rgba(78, 145, 201, 0.12);
  border: 2px solid ${HIGHLIGHT_COLOR};
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  pointer-events: none;
  transition: opacity 0.45s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
`;

const OsdIcon = styled.span`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.35em;
  height: 1.35em;
  color: ${HIGHLIGHT_COLOR};
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35));

  svg {
    width: 100%;
    height: 100%;
  }
`;

const OsdBody = styled.div`
  flex: 1;
  min-width: 0;
`;

const OsdName = styled.span`
  color: ${HIGHLIGHT_COLOR};
  font-weight: 700;
`;

export interface SessionDonor {
  name: string;
  at?: string;
}

interface DonationMarqueeProps {
  donors: SessionDonor[];
  marqueeTemplate: string;
  marqueeSeparator: string;
}

export const DonationMarquee: React.FC<DonationMarqueeProps> = ({
  donors,
  marqueeTemplate,
  marqueeSeparator,
}) => {
  if (!donors.length) return null;

  const core = donors.map((d) => d.name.trim()).filter(Boolean);
  if (!core.length) return null;

  const segment = buildMarqueeSegment(marqueeTemplate, marqueeSeparator, core);

  return (
    <MarqueeBar aria-live="polite">
      <MarqueeTrack>
        <MarqueeChunk>{segment}</MarqueeChunk>
        <MarqueeGap aria-hidden />
        <MarqueeChunk>{segment}</MarqueeChunk>
        <MarqueeGap aria-hidden />
      </MarqueeTrack>
    </MarqueeBar>
  );
};

interface DonationTopOsdProps {
  visible: boolean;
  text: string;
  /** Spender-Name in Akzentfarbe (HIGHLIGHT_COLOR); Text wird an diesem Vorkommen aufgeteilt. */
  highlightName?: string | null;
}

function renderThanksLine(text: string, highlightName: string | null | undefined): React.ReactNode {
  const h = highlightName?.trim();
  if (!h || !text.includes(h)) {
    return text;
  }
  const i = text.indexOf(h);
  const before = text.slice(0, i);
  const after = text.slice(i + h.length);
  return (
    <>
      {before}
      <OsdName>{h}</OsdName>
      {after}
    </>
  );
}

const HeartSparkleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path
      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6.5 3.5 5 5.5 5c1.54 0 3.04 1 3.57 2.36h1.87C13.46 6 14.96 5 16.5 5 18.5 5 20 6.5 20 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      fill="currentColor"
      opacity="0.95"
    />
    <path
      d="M17.5 3.5l.6 1.3 1.4.2-1 1 .25 1.45-1.25-.65-1.25.65.25-1.45-1-1 1.4-.2.6-1.3z"
      fill="currentColor"
      opacity="0.85"
    />
  </svg>
);

export const DonationTopOsd: React.FC<DonationTopOsdProps> = ({ visible, text, highlightName }) => (
  <OsdWrap $visible={visible} role="status" aria-live="polite">
    {visible ? (
      <>
        <OsdIcon aria-hidden>
          <HeartSparkleIcon />
        </OsdIcon>
        <OsdBody>{renderThanksLine(text, highlightName ?? null)}</OsdBody>
      </>
    ) : null}
  </OsdWrap>
);
