import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import NotificationCatGif from '../shared/NotificationCatGif';
import { buildMarqueeSegment } from '../../utils/donationDisplay';
import { loadCatGifs, pickRandomCatGifUrl } from '../../utils/catGifs';
import { HIGHLIGHT_COLOR, PRIMARY_COLOR } from './constants';

const OSDEnterMs = 180;
const OSDExitMs = 480;
/** Feuerwerk/Konfetti: längere, langzamere Animationen (Faktor auf Basis der „normalen“ Dauer) */
const CELEBRATION_TIME_MULTIPLIER = 3;
/** Kurz nach Sichtbarkeit – parallel zum Aufklappen der Box */
const CONFETTI_AFTER_MS = 45;
/** Layer sichtbar, bis alle langsamen Partikel ausgelaufen sind */
const CONFETTI_SHOW_MS = 4800 * CELEBRATION_TIME_MULTIPLIER;
const FLASH_BURST_MS = 650 * CELEBRATION_TIME_MULTIPLIER;

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

const osdFoldIn = keyframes`
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scaleY(0.08);
  }
  18% {
    opacity: 1;
  }
  55% {
    transform: translate(-50%, -50%) scaleY(1.08);
  }
  74% {
    transform: translate(-50%, -50%) scaleY(0.95);
  }
  86% {
    transform: translate(-50%, -50%) scaleY(1.02);
  }
  100% {
    transform: translate(-50%, -50%) scaleY(1);
    opacity: 1;
  }
`;

const osdFoldOut = keyframes`
  0% {
    transform: translate(-50%, -50%) scaleY(1);
    opacity: 1;
  }
  30% {
    transform: translate(-50%, -50%) scaleY(1.05);
  }
  100% {
    transform: translate(-50%, -50%) scaleY(0.07);
    opacity: 0;
  }
`;

/** Bühne: Platz für Konfetti (hinten) + Schild (vorne), gemeinsamer Anker 25vh */
const OsdStage = styled.div`
  position: absolute;
  top: 25vh;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 12;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ConfettiHost = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(720px, 98vw);
  height: min(440px, 52vh);
  transform: translate(-50%, -50%);
  z-index: 0;
  overflow: visible;
`;

const flashPop = keyframes`
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.35);
  }
  28% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.12);
  }
`;

const FlashBurst = styled.div`
  position: absolute;
  left: 50%;
  top: 46%;
  width: min(560px, 96vw);
  height: min(380px, 58vh);
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 0;
  background: radial-gradient(
    ellipse 78% 68% at 50% 44%,
    rgba(255, 232, 150, 0.5) 0%,
    rgba(255, 200, 90, 0.28) 22%,
    rgba(78, 145, 201, 0.2) 42%,
    transparent 70%
  );
  animation: ${flashPop} ${FLASH_BURST_MS}ms ease-out forwards;
  filter: blur(0.5px);
`;

const fireworkStreakAnim = keyframes`
  0% {
    opacity: 0;
    transform: rotate(var(--streak-deg)) scaleY(0.06);
  }
  22% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: rotate(var(--streak-deg)) scaleY(1.08);
  }
`;

const FireworkStreak = styled.div<{
  $deg: number;
  $len: number;
  $delay: number;
  $dur: number;
  $color: string;
}>`
  position: absolute;
  left: 50%;
  top: 50%;
  --streak-deg: ${(p) => p.$deg}deg;
  width: 4px;
  height: ${(p) => p.$len}px;
  margin-left: -2px;
  margin-top: ${(p) => -p.$len}px;
  transform-origin: 50% 100%;
  border-radius: 3px;
  pointer-events: none;
  z-index: 1;
  background: linear-gradient(
    to top,
    transparent 0%,
    ${(p) => p.$color} 45%,
    rgba(255, 255, 255, 0.85) 100%
  );
  box-shadow:
    0 0 10px ${(p) => p.$color},
    0 0 18px rgba(255, 255, 255, 0.35);
  filter: blur(0.4px);
  animation-name: ${fireworkStreakAnim};
  animation-duration: ${(p) => p.$dur}ms;
  animation-timing-function: cubic-bezier(0.2, 0.85, 0.36, 1);
  animation-fill-mode: forwards;
  animation-delay: ${(p) => p.$delay}ms;
`;

const confettiBurst = keyframes`
  0% {
    opacity: 1;
    transform: translate(0, 0) rotate(0deg) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(var(--tx), var(--ty)) rotate(var(--rot)) scale(0.25);
  }
`;

const ConfettiBit = styled.span<{
  $w: number;
  $h: number;
  $bg: string;
  $br: string;
  $tx: string;
  $ty: string;
  $rot: string;
  $dur: number;
  $delay: number;
}>`
  position: absolute;
  left: 50%;
  top: 48%;
  width: ${(p) => p.$w}px;
  height: ${(p) => p.$h}px;
  margin-left: ${(p) => -p.$w / 2}px;
  margin-top: ${(p) => -p.$h / 2}px;
  background: ${(p) => p.$bg};
  border-radius: ${(p) => p.$br};
  box-shadow: 0 0 1px rgba(255, 255, 255, 0.35);
  --tx: ${(p) => p.$tx};
  --ty: ${(p) => p.$ty};
  --rot: ${(p) => p.$rot};
  opacity: 0;
  z-index: 2;
  animation-name: ${confettiBurst};
  animation-duration: ${(p) => p.$dur}ms;
  animation-timing-function: cubic-bezier(0.22, 0.82, 0.42, 0.97);
  animation-fill-mode: forwards;
  animation-delay: ${(p) => p.$delay}ms;
`;

const OsdWrap = styled.div<{ $motion: 'in' | 'out' }>`
  position: relative;
  z-index: 1;
  transform-origin: center center;
  max-width: min(860px, 94vw);
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
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);

  ${(p) =>
    p.$motion === 'in'
      ? css`
          animation: ${osdFoldIn} ${OSDEnterMs}ms cubic-bezier(0.34, 1.35, 0.64, 1) forwards;
        `
      : css`
          animation: ${osdFoldOut} ${OSDExitMs}ms ease-in forwards;
        `}
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

const CONFETTI_COLORS = [
  HIGHLIGHT_COLOR,
  PRIMARY_COLOR,
  '#e879a9',
  '#7dd3a5',
  '#c4a6ff',
  '#ffe066',
  '#ff9f7a',
  '#fff',
];

type ConfettiParticle = {
  id: number;
  w: number;
  h: number;
  bg: string;
  br: string;
  tx: string;
  ty: string;
  rot: string;
  dur: number;
  delay: number;
};

type FireworkStreakParticle = {
  id: number;
  deg: number;
  len: number;
  delay: number;
  dur: number;
  color: string;
};

function makeRng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildConfettiParticles(seed: number, count: number): ConfettiParticle[] {
  const rnd = makeRng(seed);
  const particles: ConfettiParticle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = rnd() * Math.PI * 2;
    const dist = 110 + rnd() * 220;
    const tx = `${Math.cos(angle) * dist}px`;
    const ty = `${Math.sin(angle) * dist - rnd() * 55}px`;
    const rot = `${(rnd() - 0.5) * 1080}deg`;
    const square = rnd() > 0.42;
    const w = square ? 5 + rnd() * 7 : 3 + rnd() * 4;
    const h = square ? w : 8 + rnd() * 11;
    const br = rnd() > 0.58 ? '50%' : `${rnd() * 3}px`;
    const bg = CONFETTI_COLORS[Math.floor(rnd() * CONFETTI_COLORS.length)];
    particles.push({
      id: i,
      w,
      h,
      bg,
      br,
      tx,
      ty,
      rot,
      dur: (950 + Math.floor(rnd() * 850)) * CELEBRATION_TIME_MULTIPLIER,
      delay: Math.floor(rnd() * 120) * CELEBRATION_TIME_MULTIPLIER,
    });
  }
  return particles;
}

function buildFireworkStreaks(seed: number, count: number): FireworkStreakParticle[] {
  const rnd = makeRng(seed + 31_337);
  const streaks: FireworkStreakParticle[] = [];
  for (let i = 0; i < count; i++) {
    streaks.push({
      id: i,
      deg: rnd() * 360,
      len: 62 + rnd() * 118,
      delay: Math.floor(rnd() * 140) * CELEBRATION_TIME_MULTIPLIER,
      dur: (480 + Math.floor(rnd() * 520)) * CELEBRATION_TIME_MULTIPLIER,
      color: CONFETTI_COLORS[Math.floor(rnd() * CONFETTI_COLORS.length)],
    });
  }
  return streaks;
}

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

export const DonationTopOsd: React.FC<DonationTopOsdProps> = ({ visible, text, highlightName }) => {
  const panelOpenRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [motion, setMotion] = useState<'in' | 'out' | 'idle'>('idle');
  const [confettiBurstId, setConfettiBurstId] = useState(0);
  const [confettiActive, setConfettiActive] = useState(false);
  const [catGifUrl, setCatGifUrl] = useState<string | null>(null);

  useEffect(() => {
    loadCatGifs();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    loadCatGifs().then((files) => {
      if (!cancelled) {
        setCatGifUrl(pickRandomCatGifUrl(files));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [visible, text]);

  useLayoutEffect(() => {
    if (visible) {
      panelOpenRef.current = true;
      setMounted(true);
      setMotion('in');
      return;
    }
    if (!panelOpenRef.current) return;
    setMotion('out');
    const done = window.setTimeout(() => {
      panelOpenRef.current = false;
      setMounted(false);
      setMotion('idle');
      setConfettiActive(false);
    }, OSDExitMs);
    return () => window.clearTimeout(done);
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const show = window.setTimeout(() => {
      setConfettiBurstId((k) => k + 1);
      setConfettiActive(true);
    }, CONFETTI_AFTER_MS);
    const hide = window.setTimeout(() => setConfettiActive(false), CONFETTI_AFTER_MS + CONFETTI_SHOW_MS);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [visible, text]);

  const celebrationSeed = confettiBurstId * 9973 + text.length * 13;

  const confettiParticles = useMemo(
    () => (confettiActive ? buildConfettiParticles(celebrationSeed, 78) : []),
    [confettiActive, celebrationSeed]
  );

  const fireworkStreaks = useMemo(
    () => (confettiActive ? buildFireworkStreaks(celebrationSeed, 44) : []),
    [confettiActive, celebrationSeed]
  );

  if (!mounted && !visible) {
    return null;
  }

  const boxMotion: 'in' | 'out' = motion === 'out' ? 'out' : 'in';

  return (
    <OsdStage>
      {confettiActive ? (
        <ConfettiHost aria-hidden>
          <FlashBurst />
          {fireworkStreaks.map((s) => (
            <FireworkStreak
              key={`fw-${confettiBurstId}-${s.id}`}
              $deg={s.deg}
              $len={s.len}
              $delay={s.delay}
              $dur={s.dur}
              $color={s.color}
            />
          ))}
          {confettiParticles.map((p) => (
            <ConfettiBit
              key={`cf-${confettiBurstId}-${p.id}`}
              $w={p.w}
              $h={p.h}
              $bg={p.bg}
              $br={p.br}
              $tx={p.tx}
              $ty={p.ty}
              $rot={p.rot}
              $dur={p.dur}
              $delay={p.delay}
            />
          ))}
        </ConfettiHost>
      ) : null}
      <OsdWrap $motion={boxMotion} role="status" aria-live="polite">
        {catGifUrl ? <NotificationCatGif src={catGifUrl} /> : (
          <OsdIcon aria-hidden>
            <HeartSparkleIcon />
          </OsdIcon>
        )}
        <OsdBody>{renderThanksLine(text, highlightName ?? null)}</OsdBody>
      </OsdWrap>
    </OsdStage>
  );
};
