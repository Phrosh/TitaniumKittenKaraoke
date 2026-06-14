import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { useTranslation } from 'react-i18next';
import { songAPI } from '../../services/api';
import { MyQueueItem } from '../../types';
import websocketService from '../../services/websocket';

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.65; }
`;

const QueueSection = styled.section`
  margin-bottom: 24px;
  padding: 20px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  border: 1px solid rgba(102, 126, 234, 0.25);
`;

const QueueHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
`;

const QueueTitle = styled.h2`
  margin: 0;
  font-size: 1.15rem;
  color: #333;
  font-weight: 700;
`;

const QueueSubtitle = styled.p`
  margin: 0 0 14px;
  font-size: 0.85rem;
  color: #666;
  line-height: 1.4;
`;

const QueueItemCard = styled.div<{ $isCurrent?: boolean }>`
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-top: 10px;
  box-shadow: 0 2px 10px rgba(102, 126, 234, 0.1);
  border: 1px solid ${(p) => (p.$isCurrent ? '#667eea' : '#e9ecef')};
  ${(p) =>
    p.$isCurrent
      ? `box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.25), 0 4px 14px rgba(102, 126, 234, 0.15);`
      : ''}
`;

const SongLine = styled.div`
  font-weight: 600;
  color: #333;
  font-size: 0.95rem;
  line-height: 1.35;
  margin-bottom: 12px;
`;

const StatsRow = styled.div`
  display: flex;
  gap: 10px;
`;

const StatBadge = styled.div<{ $variant?: 'primary' | 'time' | 'pending' | 'current' }>`
  flex: 1;
  text-align: center;
  padding: 10px 8px;
  border-radius: 10px;
  background: ${(p) => {
    if (p.$variant === 'current') return 'linear-gradient(135deg, #667eea, #764ba2)';
    if (p.$variant === 'pending') return '#fff8e6';
    if (p.$variant === 'time') return '#f0f4ff';
    return '#f8f9fa';
  }};
  color: ${(p) => (p.$variant === 'current' ? 'white' : '#333')};
  border: 1px solid
    ${(p) => {
      if (p.$variant === 'current') return 'transparent';
      if (p.$variant === 'pending') return '#ffe08a';
      if (p.$variant === 'time') return '#c5d0f5';
      return '#e9ecef';
    }};
`;

const StatValue = styled.div`
  font-size: 1.35rem;
  font-weight: 800;
  line-height: 1.2;
`;

const StatLabel = styled.div`
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.85;
  margin-top: 2px;
`;

const ProgressTrack = styled.div`
  height: 5px;
  background: #e9ecef;
  border-radius: 3px;
  overflow: hidden;
  margin-top: 12px;
`;

const ProgressFill = styled.div<{ $pct: number; $isCurrent?: boolean }>`
  height: 100%;
  width: ${(p) => Math.min(100, Math.max(0, p.$pct))}%;
  background: ${(p) =>
    p.$isCurrent
      ? 'linear-gradient(90deg, #667eea, #764ba2)'
      : 'linear-gradient(90deg, #a8b4f0, #667eea)'};
  border-radius: 3px;
  transition: width 0.6s ease;
  ${(p) => (p.$isCurrent ? `animation: ${pulse} 2s ease-in-out infinite;` : '')}
`;

function formatWaitMinutes(seconds: number, t: (key: string, opts?: object) => string): string {
  if (seconds < 60) return t('songRequest.queueLessThanOneMinute');
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t('songRequest.queueAboutMinutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return t('songRequest.queueAboutHours', { count: hours });
  return t('songRequest.queueAboutHoursMinutes', { hours, minutes: rest });
}

function progressPercent(item: MyQueueItem, maxWait: number): number {
  if (item.status === 'current') return 100;
  if (item.status === 'pending_approval') return 5;
  if (!item.estimatedWaitSeconds || maxWait <= 0) return 0;
  return Math.max(8, 100 - (item.estimatedWaitSeconds / maxWait) * 100);
}

interface Props {
  deviceId: string;
  refreshTrigger?: number;
}

const MyQueueStatus: React.FC<Props> = ({ deviceId, refreshTrigger = 0 }) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<MyQueueItem[]>([]);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [liveNow, setLiveNow] = useState(Date.now());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchQueue = useCallback(async () => {
    if (!deviceId) return;
    try {
      const { data } = await songAPI.getMyQueue(deviceId);
      setItems(data.items || []);
      setFetchedAt(Date.now());
    } catch {
      /* ignore – Gast sieht einfach nichts */
    }
  }, [deviceId]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue, refreshTrigger]);

  useEffect(() => {
    websocketService.connect().then(() => {
      websocketService.joinPlaylistRoom();
      websocketService.onPlaylistUpdate(() => fetchQueue());
    }).catch(() => {
      pollRef.current = setInterval(fetchQueue, 30000);
    });

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchQueue]);

  useEffect(() => {
    const interval = setInterval(() => setLiveNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (items.length === 0) return null;

  const elapsedSinceFetch = fetchedAt ? (liveNow - fetchedAt) / 1000 : 0;

  const liveItems = items.map((item) => {
    if (item.status === 'pending_approval' || item.estimatedWaitSeconds == null) return item;
    const liveWait = Math.max(0, Math.round(item.estimatedWaitSeconds - elapsedSinceFetch));
    return { ...item, estimatedWaitSeconds: liveWait };
  });

  const maxWait = Math.max(
    ...liveItems
      .filter((i) => i.estimatedWaitSeconds != null)
      .map((i) => i.estimatedWaitSeconds as number),
    1
  );

  return (
    <QueueSection aria-live="polite">
      <QueueHeader>
        <span style={{ fontSize: '1.4rem' }}>🎤</span>
        <QueueTitle>{t('songRequest.queueTitle')}</QueueTitle>
      </QueueHeader>
      <QueueSubtitle>{t('songRequest.queueSubtitle')}</QueueSubtitle>

      {liveItems.map((item) => {
        const songLabel =
          item.artist && item.title
            ? `${item.artist} – ${item.title}`
            : item.title || item.artist || t('songRequest.queueUnknownSong');

        if (item.status === 'pending_approval') {
          return (
            <QueueItemCard key={`pending-${item.id}`}>
              <SongLine>{songLabel}</SongLine>
              <StatBadge $variant="pending">
                <StatValue style={{ fontSize: '1rem' }}>⏳</StatValue>
                <StatLabel>{t('songRequest.queuePendingApproval')}</StatLabel>
              </StatBadge>
            </QueueItemCard>
          );
        }

        if (item.status === 'current') {
          return (
            <QueueItemCard key={item.id} $isCurrent>
              <SongLine>{songLabel}</SongLine>
              <StatBadge $variant="current">
                <StatValue>🎶</StatValue>
                <StatLabel>{t('songRequest.queueYourTurn')}</StatLabel>
              </StatBadge>
              <ProgressTrack>
                <ProgressFill $pct={100} $isCurrent />
              </ProgressTrack>
            </QueueItemCard>
          );
        }

        const waitSec = item.estimatedWaitSeconds ?? 0;
        const songsCount = item.songsBefore ?? 0;

        return (
          <QueueItemCard key={item.id}>
            <SongLine>{songLabel}</SongLine>
            <StatsRow>
              <StatBadge $variant="primary">
                <StatValue>{songsCount}</StatValue>
                <StatLabel>
                  {t('songRequest.queueSongsBefore', { count: songsCount })}
                </StatLabel>
              </StatBadge>
              <StatBadge $variant="time">
                <StatValue style={{ fontSize: waitSec >= 3600 ? '1rem' : '1.35rem' }}>
                  {formatWaitMinutes(waitSec, t)}
                </StatValue>
                <StatLabel>{t('songRequest.queueEstimatedWait')}</StatLabel>
              </StatBadge>
            </StatsRow>
            <ProgressTrack>
              <ProgressFill $pct={progressPercent(item, maxWait)} />
            </ProgressTrack>
          </QueueItemCard>
        );
      })}
    </QueueSection>
  );
};

export default MyQueueStatus;
