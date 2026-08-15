import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useTranslation } from 'react-i18next';
import { songAPI } from '../../services/api';
import { MyQueueItem } from '../../types';
import websocketService, { ShowUpdateData } from '../../services/websocket';

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.75; }
`;

const QueueStickyBar = styled.div<{ $visible: boolean; $variant: 'waiting' | 'next' | 'current' }>`
  display: ${(p) => (p.$visible ? 'flex' : 'none')};
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 2400;
  padding: 14px 18px calc(14px + env(safe-area-inset-bottom, 0px));
  justify-content: center;
  align-items: center;
  gap: 10px;
  text-align: center;
  border-top: 1px solid transparent;
  box-shadow: 0 -6px 24px rgba(0, 0, 0, 0.1);
  ${(p) => {
    if (p.$variant === 'current') {
      return css`
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #fff;
        border-top-color: transparent;
        animation: ${pulse} 2.2s ease-in-out infinite;
      `;
    }
    if (p.$variant === 'next') {
      return css`
        background: linear-gradient(135deg, rgba(102, 126, 234, 0.95) 0%, rgba(118, 75, 162, 0.95) 100%);
        color: #fff;
        border-top-color: transparent;
      `;
    }
    return css`
      background: rgba(255, 255, 255, 0.98);
      color: #333;
      border-top-color: #e1e5e9;
    `;
  }}
`;

const BarEmoji = styled.span`
  font-size: 1.25rem;
  line-height: 1;
  flex-shrink: 0;
`;

const BarText = styled.span`
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.35;
`;

/** Nächsten relevanten Playlist-Eintrag wählen (aktuell > nächster > sonst wenigste Songs davor). */
function pickNearestPlaylistItem(items: MyQueueItem[]): MyQueueItem | null {
  const relevant = items.filter((i) => i.status === 'current' || i.status === 'queued');
  if (relevant.length === 0) return null;

  const current = relevant.find((i) => i.status === 'current');
  if (current) return current;

  return relevant.reduce((best, item) => {
    const bestBefore = best.songsBefore ?? Number.POSITIVE_INFINITY;
    const itemBefore = item.songsBefore ?? Number.POSITIVE_INFINITY;
    return itemBefore < bestBefore ? item : best;
  });
}

interface Props {
  deviceId: string;
  refreshTrigger?: number;
  /** z. B. Spenden-Bottom-Bar ist offen */
  suppressed?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
}

const MyQueueStatus: React.FC<Props> = ({
  deviceId,
  refreshTrigger = 0,
  suppressed = false,
  onVisibilityChange,
}) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<MyQueueItem[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCurrentSongIdRef = useRef<number | null | undefined>(undefined);

  const fetchQueue = useCallback(async () => {
    if (!deviceId) return;
    try {
      const { data } = await songAPI.getMyQueue(deviceId);
      setItems(data.items || []);
    } catch {
      /* ignore – Gast sieht einfach nichts */
    }
  }, [deviceId]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue, refreshTrigger]);

  useEffect(() => {
    const handlePlaylistUpdate = () => fetchQueue();

    const handleShowUpdate = (data: ShowUpdateData) => {
      const nextId = data.currentSong?.id ?? null;
      if (lastCurrentSongIdRef.current !== nextId) {
        lastCurrentSongIdRef.current = nextId;
        fetchQueue();
      }
    };

    const handleQueueRefresh = () => fetchQueue();

    websocketService.connect().then(() => {
      websocketService.joinPlaylistRoom();
      websocketService.onPlaylistUpdate(handlePlaylistUpdate);
      websocketService.onShowUpdate(handleShowUpdate);
      websocketService.onQueueRefresh(handleQueueRefresh);
    }).catch(() => {
      pollRef.current = setInterval(fetchQueue, 30000);
    });

    return () => {
      websocketService.offPlaylistUpdate(handlePlaylistUpdate);
      websocketService.offShowUpdate(handleShowUpdate);
      websocketService.offQueueRefresh(handleQueueRefresh);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchQueue]);

  const nearest = useMemo(() => pickNearestPlaylistItem(items), [items]);

  useEffect(() => {
    if (nearest?.status !== 'current') return;

    // Das Song-Ende erzeugt nicht zwingend ein Playlist-Event. Bis dahin
    // regelmäßig aktualisieren und spätestens nach der Restlaufzeit neu laden.
    const remainingSeconds = nearest.estimatedWaitSeconds ?? 15;
    const refreshAfterMs = Math.max(1000, Math.min(remainingSeconds * 1000 + 500, 15000));
    const timeout = setTimeout(fetchQueue, refreshAfterMs);

    return () => clearTimeout(timeout);
  }, [nearest, fetchQueue]);

  const message = useMemo(() => {
    if (!nearest) return null;
    if (nearest.status === 'current') {
      return {
        text: t('songRequest.queueBarYourTurn'),
        variant: 'current' as const,
        emoji: '🎶',
      };
    }
    const songsBefore = nearest.songsBefore ?? 0;
    if (songsBefore <= 1) {
      return {
        text: t('songRequest.queueBarNextUp'),
        variant: 'next' as const,
        emoji: '🎤',
      };
    }
    return {
      text: t('songRequest.queueBarSongsUntilTurn', { count: songsBefore }),
      variant: 'waiting' as const,
      emoji: '🎤',
    };
  }, [nearest, t]);

  const visible = Boolean(message) && !suppressed;

  useEffect(() => {
    onVisibilityChange?.(visible);
  }, [visible, onVisibilityChange]);

  return (
    <QueueStickyBar
      $visible={visible}
      $variant={message?.variant ?? 'waiting'}
      role="status"
      aria-live="polite"
    >
      {message && (
        <>
          <BarEmoji aria-hidden>{message.emoji}</BarEmoji>
          <BarText>{message.text}</BarText>
        </>
      )}
    </QueueStickyBar>
  );
};

export default MyQueueStatus;
