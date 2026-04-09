import React from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';

interface SmallModeBadgeProps {
  mode: string;
  modes?: string[];
}

const SmallBadge = styled.span<{ $color: string; $background: string }>`
  font-size: 12px;
  color: ${props => props.$color};
  background: ${props => props.$background};
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
  white-space: nowrap;
  font-variant-emoji: text;
`;

const SmallModeBadge: React.FC<SmallModeBadgeProps> = ({
  mode,
  modes
}) => {
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {modes?.includes('server_video') && (
        <SmallBadge $color="#28a745" $background="#d4edda">
          🟢 {t('badges.server')}
        </SmallBadge>
      )}
      {modes?.includes('file') && (
        <SmallBadge $color="#007bff" $background="#cce7ff">
          🔵 {t('badges.file')}
        </SmallBadge>
      )}
      {modes?.includes('ultrastar') && (
        <SmallBadge $color="#8e44ad" $background="#e8d5f2">
          ⭐ {t('badges.ultrastar')}
        </SmallBadge>
      )}
      {mode === 'youtube' && (
        <SmallBadge $color="#dc3545" $background="#f8d7da">
          🔴 {t('badges.youtube')}
        </SmallBadge>
      )}
      {modes?.includes('youtube_cache') && (
        <SmallBadge $color="#dc3545" $background="#f8d7da">
          🎬 {t('badges.youtubeCache')}
        </SmallBadge> 
      )}
      {mode === 'hp2' && (
        <SmallBadge $color="#fd7e14" $background="#fff3cd">
          🎤 {t('badges.backgroundVocals')}
        </SmallBadge>
      )}
      {mode === 'duett' && (
        <SmallBadge $color="#0066cc" $background="#e6f3ff">
          🎤🎤 {t('badges.duett')}
        </SmallBadge>
      )}
      {modes?.includes('magic-songs') && (
        // <SmallBadge $color="#8e44ad" $background="linear-gradient(135deg, #e8d5f2, #d4a5f0)">
        <SmallBadge $color="#3984B3" $background="linear-gradient(135deg, #D5F2EE, #B5C9EB)">
          ✨ {t('badges.magicSongs')}
        </SmallBadge>
      )}
      {modes?.includes('magic-videos') && (
        // <SmallBadge $color="#28a745" $background="linear-gradient(135deg, #d4edda, #a5e0a5)">
        <SmallBadge $color="#28a745" $background="linear-gradient(135deg, #DEEDB7, #a5e0a5)">
          ✨ {t('badges.magicVideos')}
        </SmallBadge>
      )}
      {modes?.includes('magic-youtube') && (
        // <SmallBadge $color="#dc3545" $background="linear-gradient(135deg, #f8d7da, #f0a5a5)">
        <SmallBadge $color="#C22F2F" $background="linear-gradient(135deg, #FFECC9, #f0a5a5)">
          ✨ {t('badges.magicYouTube')}
        </SmallBadge>
      )}
    </div>
  );
};

const DUET_TITLE_MARKER = '[DUET]';

/** Ersetzt das Literal "[DUET]" in Anzeigetexten durch das Duett-Badge. */
export const TextWithDuetBadge: React.FC<{ text: string }> = ({ text }) => {
  if (!text.includes(DUET_TITLE_MARKER)) {
    return <>{text}</>;
  }
  const parts = text.split(DUET_TITLE_MARKER);
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {part}
          {i < parts.length - 1 && <SmallModeBadge mode="duett" />}
        </React.Fragment>
      ))}
    </span>
  );
};

export default SmallModeBadge;