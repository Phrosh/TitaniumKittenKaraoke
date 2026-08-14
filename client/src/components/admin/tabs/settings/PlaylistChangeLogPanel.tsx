import React, { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { adminAPI } from '../../../../services/api';
import Button from '../../../shared/Button';
import {
  SettingsCard,
  SettingsDescription,
  SettingsLabel,
} from '../../style';

interface PlaylistLogEntry {
  id: number;
  action: string;
  song_id: number | null;
  artist: string | null;
  title: string | null;
  singer_name: string | null;
  device_id: string | null;
  actor_type: string | null;
  start_position: number | null;
  end_position: number | null;
  positions_climbed: number | null;
  mode: string | null;
  details: any;
  created_at: string;
}

const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 10px;
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
`;

const CheckboxInput = styled.input`
  transform: scale(1.2);
`;

const LogList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
  max-height: 65vh;
  overflow-y: auto;
`;

const LogEntryCard = styled.div`
  border: 1px solid #dee2e6;
  border-radius: 8px;
  background: #fff;
  padding: 12px 14px;
`;

const LogHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
`;

const LogTitle = styled.div`
  font-weight: 600;
  color: #212529;
  font-size: 15px;
`;

const LogMeta = styled.div`
  font-size: 13px;
  color: #6c757d;
  margin-top: 4px;
  line-height: 1.45;
`;

const Badge = styled.span<{ $tone?: string }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: ${(p) => p.$tone || '#e9ecef'};
  color: #212529;
  margin-right: 6px;
`;

const DetailBlock = styled.div`
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
  font-size: 13px;
  color: #343a40;
  line-height: 1.5;
`;

const FollowUpList = styled.ul`
  margin: 6px 0 0;
  padding-left: 18px;
`;

const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-top: 10px;
`;

function actionBadgeTone(action: string) {
  switch (action) {
    case 'insert':
      return '#d4edda';
    case 'reorder':
      return '#cce5ff';
    case 'delete':
      return '#f8d7da';
    case 'clear_all':
      return '#fff3cd';
    default:
      return '#e9ecef';
  }
}

function formatSongNeighbor(n: any) {
  if (!n) return '—';
  const who = [n.user_name, n.device_id].filter(Boolean).join(' / ');
  return `${n.artist || '?'} – ${n.title || '?'}${who ? ` (${who})` : ''} @${n.position ?? '?'}`;
}

const PlaylistChangeLogPanel: React.FC = () => {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(true);
  const [entries, setEntries] = useState<PlaylistLogEntry[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadLog = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getPlaylistChangeLog({ limit: 200 });
      setEntries(response.data.entries || []);
      setCount(response.data.count || 0);
      setEnabled(response.data.enabled !== false);
    } catch (error) {
      console.error('Error loading playlist change log:', error);
      toast.error(t('settings.playlistLogLoadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadLog();
  }, [loadLog]);

  const handleToggleEnabled = async (next: boolean) => {
    setEnabled(next);
    try {
      await adminAPI.setPlaylistChangeLogEnabled(next);
      toast.success(
        next ? t('settings.playlistLogEnabledSuccess') : t('settings.playlistLogDisabledSuccess')
      );
    } catch (error) {
      console.error('Error toggling playlist change log:', error);
      setEnabled(!next);
      toast.error(t('settings.playlistLogToggleError'));
    }
  };

  const handleClear = async () => {
    if (!window.confirm(t('settings.playlistLogConfirmClear'))) return;
    setLoading(true);
    try {
      await adminAPI.clearPlaylistChangeLog();
      toast.success(t('settings.playlistLogClearedSuccess'));
      setExpandedId(null);
      await loadLog();
    } catch (error) {
      console.error('Error clearing playlist change log:', error);
      toast.error(t('settings.playlistLogClearError'));
      setLoading(false);
    }
  };

  const actionLabel = (action: string) => {
    switch (action) {
      case 'insert':
        return t('settings.playlistLogActionInsert');
      case 'reorder':
        return t('settings.playlistLogActionReorder');
      case 'delete':
        return t('settings.playlistLogActionDelete');
      case 'clear_all':
        return t('settings.playlistLogActionClearAll');
      case 'follow_up':
        return t('settings.playlistLogActionFollowUp');
      default:
        return action;
    }
  };

  const actorLabel = (entry: PlaylistLogEntry) => {
    if (entry.actor_type === 'admin') {
      return t('settings.playlistLogActorAdmin', {
        deviceId: entry.device_id || 'ADM',
      });
    }
    if (entry.actor_type === 'system') return t('settings.playlistLogActorSystem');
    return t('settings.playlistLogActorGuest', {
      name: entry.singer_name || '?',
      deviceId: entry.device_id || '—',
    });
  };

  return (
    <>
      <SettingsCard>
        <SettingsLabel>{t('settings.playlistLogTitle')}</SettingsLabel>
        <SettingsDescription>{t('settings.playlistLogDescription')}</SettingsDescription>

        <CheckboxContainer>
          <CheckboxLabel>
            <CheckboxInput
              type="checkbox"
              checked={enabled}
              onChange={(e) => handleToggleEnabled(e.target.checked)}
            />
            <span>
              {enabled ? t('settings.enabled') : t('settings.disabled')} —{' '}
              {t('settings.playlistLogToggleLabel')}
            </span>
          </CheckboxLabel>
        </CheckboxContainer>

        <Toolbar>
          <Button onClick={loadLog} disabled={loading} size="small">
            {loading ? t('settings.playlistLogRefreshing') : t('settings.playlistLogRefresh')}
          </Button>
          <Button
            onClick={handleClear}
            disabled={loading || count === 0}
            size="small"
            style={{ backgroundColor: '#dc3545', color: 'white' }}
          >
            {t('settings.playlistLogClear')}
          </Button>
          <span style={{ fontSize: 13, color: '#666' }}>
            {t('settings.playlistLogCount', { count })}
          </span>
        </Toolbar>
      </SettingsCard>

      <SettingsCard>
        <SettingsLabel>{t('settings.playlistLogEntries')}</SettingsLabel>
        {entries.length === 0 ? (
          <div style={{ color: '#666', fontStyle: 'italic', marginTop: 8 }}>
            {t('settings.playlistLogEmpty')}
          </div>
        ) : (
          <LogList>
            {entries.map((entry) => {
              const open = expandedId === entry.id;
              const details = entry.details || {};
              return (
                <LogEntryCard key={entry.id}>
                  <LogHeader onClick={() => setExpandedId(open ? null : entry.id)}>
                    <div>
                      <LogTitle>
                        <Badge $tone={actionBadgeTone(entry.action)}>
                          {actionLabel(entry.action)}
                        </Badge>
                        {entry.artist || entry.title
                          ? `${entry.artist || '?'} – ${entry.title || '?'}`
                          : t('settings.playlistLogNoSong')}
                      </LogTitle>
                      <LogMeta>
                        {new Date(entry.created_at).toLocaleString()} · {actorLabel(entry)}
                        {entry.mode ? ` · ${entry.mode}` : ''}
                        {entry.action === 'insert' && entry.positions_climbed != null && (
                          <>
                            {' '}
                            ·{' '}
                            {t('settings.playlistLogClimbed', {
                              count: entry.positions_climbed,
                              from: entry.start_position ?? '?',
                              to: entry.end_position ?? '?',
                            })}
                          </>
                        )}
                        {entry.action === 'reorder' && (
                          <>
                            {' '}
                            · {entry.start_position} → {entry.end_position}
                          </>
                        )}
                      </LogMeta>
                    </div>
                    <Button size="small" variant="default">
                      {open ? t('settings.playlistLogHideDetails') : t('settings.playlistLogShowDetails')}
                    </Button>
                  </LogHeader>

                  {open && (
                    <DetailBlock>
                      {details.stopReasonText && (
                        <div>
                          <strong>{t('settings.playlistLogStopReason')}:</strong>{' '}
                          {details.stopReasonText}
                        </div>
                      )}
                      {(details.aboveSong || details.belowSong) && (
                        <div style={{ marginTop: 6 }}>
                          <div>
                            <strong>{t('settings.playlistLogAbove')}:</strong>{' '}
                            {formatSongNeighbor(details.aboveSong)}
                          </div>
                          <div>
                            <strong>{t('settings.playlistLogBelow')}:</strong>{' '}
                            {formatSongNeighbor(details.belowSong)}
                          </div>
                        </div>
                      )}
                      {Array.isArray(details.swaps) && details.swaps.length > 0 && (
                        <div style={{ marginTop: 6 }}>
                          <strong>{t('settings.playlistLogSwaps')}:</strong>
                          <FollowUpList>
                            {details.swaps.map((swap: any, idx: number) => (
                              <li key={idx}>
                                {swap.fromPosition} → {swap.toPosition} (
                                {t('settings.playlistLogSwapCounts', {
                                  above: swap.countAbove,
                                  moving: swap.countMoving,
                                })}
                                ): {formatSongNeighbor(swap.swappedWith)}
                              </li>
                            ))}
                          </FollowUpList>
                        </div>
                      )}
                      {Array.isArray(details.sourceNotes) && details.sourceNotes.length > 0 && (
                        <div style={{ marginTop: 6 }}>
                          <strong>{t('settings.playlistLogSource')}:</strong>{' '}
                          {details.sourceNotes.join(' · ')}
                        </div>
                      )}
                      {details.reason && (
                        <div style={{ marginTop: 6 }}>
                          <strong>{t('settings.playlistLogReason')}:</strong> {details.reason}
                        </div>
                      )}
                      {Array.isArray(details.followUps) && details.followUps.length > 0 && (
                        <div style={{ marginTop: 6 }}>
                          <strong>{t('settings.playlistLogFollowUps')}:</strong>
                          <FollowUpList>
                            {details.followUps.map((fu: any, idx: number) => (
                              <li key={idx}>
                                {fu.at ? `${new Date(fu.at).toLocaleString()} — ` : ''}
                                {fu.message || fu.type}
                              </li>
                            ))}
                          </FollowUpList>
                        </div>
                      )}
                      {details.songsRemoved != null && (
                        <div style={{ marginTop: 6 }}>
                          {t('settings.playlistLogSongsRemoved', {
                            count: details.songsRemoved,
                          })}
                        </div>
                      )}
                    </DetailBlock>
                  )}
                </LogEntryCard>
              );
            })}
          </LogList>
        )}
      </SettingsCard>
    </>
  );
};

export default PlaylistChangeLogPanel;
