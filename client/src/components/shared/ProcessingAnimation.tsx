import styled, { keyframes, css } from 'styled-components';

// Zentrale Farbdefinitionen für Processing-Animation
export const PROCESSING_COLORS = {
  primary: 'rgb(248, 249, 250)', // Gleiche Farbe wie der Box-Hintergrund
  highlight: 'rgba(255, 243, 201, 1)',
  secondary: 'rgb(248, 249, 250)' // Gleiche Farbe wie der Box-Hintergrund
} as const;

// Keyframe-Animation für wandernden Farbverlauf (von links nach rechts)
const processingGradientAnimation = keyframes`
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
`;

// Styled Component für Processing-Animation
export const ProcessingAnimationWrapper = styled.div<{ $isProcessing: boolean }>`
  position: relative;
  overflow: hidden;
  
  ${props => props.$isProcessing && css`
    background: linear-gradient(
      90deg,
      ${PROCESSING_COLORS.primary} 0%,
      ${PROCESSING_COLORS.primary} 30%,
      ${PROCESSING_COLORS.highlight} 50%,
      ${PROCESSING_COLORS.primary} 70%,
      ${PROCESSING_COLORS.primary} 100%
    );
    background-size: 200% 100%;
    animation: ${processingGradientAnimation} 2s ease-in-out infinite;
  `}
`;

// Utility-Funktion um Processing-Status zu prüfen
export const isSongProcessing = (song: any, processingSongs: Set<string>, songStatuses: Map<string, string>): boolean => {
  const songKey = `${song.artist}-${song.title}`;
  const wsStatus = songStatuses.get(songKey);
  const apiStatus = song.download_status || song.status;
  const processingStatus = wsStatus || apiStatus;
  const hasActiveStatus = processingStatus && !['finished', 'ready', 'failed'].includes(processingStatus);
  
  return processingSongs.has(songKey) || hasActiveStatus;
};
