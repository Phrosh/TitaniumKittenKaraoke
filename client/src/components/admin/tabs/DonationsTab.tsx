import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { adminAPI } from '../../../services/api';
import websocketService from '../../../services/websocket';
import { SettingsSection, SettingsTitle, SettingsCard, SettingsDescription } from '../style';

const TableWrap = styled.div`
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid #e9ecef;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
`;

const Th = styled.th`
  text-align: left;
  padding: 12px 14px;
  background: #f1f3f5;
  color: #333;
  font-weight: 600;
  border-bottom: 2px solid #dee2e6;
`;

const Td = styled.td`
  padding: 11px 14px;
  border-bottom: 1px solid #eee;
  color: #333;
`;

const TfootTd = styled.td`
  padding: 14px;
  font-weight: 700;
  background: #f8f9fa;
  border-top: 2px solid #dee2e6;
  color: #212529;
`;

const EmptyHint = styled.div`
  padding: 24px;
  text-align: center;
  color: #666;
`;

export interface DonationsSessionRow {
  name: string;
  at: string;
  amount: string;
  currency: string;
}

export interface DonationsSessionReport {
  donations: DonationsSessionRow[];
  totals: Record<string, string>;
  count: number;
}

const DonationsTab: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [report, setReport] = useState<DonationsSessionReport | null>(null);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await adminAPI.getDonationsSession();
      setReport({
        donations: data.donations || [],
        totals: data.totals || {},
        count: data.count ?? 0,
      });
      setLoadError(false);
    } catch (e) {
      console.error('donations-session:', e);
      setLoadError(true);
      setReport({ donations: [], totals: {}, count: 0 });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handler = (data: DonationsSessionReport) => {
      setReport({
        donations: data.donations || [],
        totals: data.totals || {},
        count: data.count ?? 0,
      });
    };
    websocketService.on('donations-session-update', handler);
    return () => {
      websocketService.off('donations-session-update', handler);
    };
  }, []);

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleString(i18n.language, {
        dateStyle: 'short',
        timeStyle: 'medium',
      });
    } catch {
      return iso;
    }
  };

  const donations = report?.donations || [];
  const totals = report?.totals || {};
  const totalEntries = Object.entries(totals);

  return (
    <SettingsSection>
      <SettingsTitle>💜 {t('adminDashboard.donations.title')}</SettingsTitle>
      <SettingsDescription style={{ marginBottom: 16 }}>
        {t('adminDashboard.donations.sessionHint')}
      </SettingsDescription>

      <SettingsCard style={{ padding: 0 }}>
        {loadError && (
          <EmptyHint>{t('adminDashboard.loadError')}</EmptyHint>
        )}
        {!loadError && donations.length === 0 && (
          <EmptyHint>{t('adminDashboard.donations.empty')}</EmptyHint>
        )}
        {!loadError && donations.length > 0 && (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>{t('adminDashboard.donations.colTime')}</Th>
                  <Th>{t('adminDashboard.donations.colDonor')}</Th>
                  <Th style={{ textAlign: 'right' }}>{t('adminDashboard.donations.colAmount')}</Th>
                  <Th>{t('adminDashboard.donations.colCurrency')}</Th>
                </tr>
              </thead>
              <tbody>
                {donations.map((row, idx) => (
                  <tr key={`${row.at}-${row.name}-${idx}`}>
                    <Td>{formatTime(row.at)}</Td>
                    <Td>{row.name}</Td>
                    <Td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {row.amount}
                    </Td>
                    <Td>{row.currency}</Td>
                  </tr>
                ))}
              </tbody>
              {totalEntries.length > 0 && (
                <tfoot>
                  <tr>
                    <TfootTd colSpan={2}>{t('adminDashboard.donations.totalLabel')}</TfootTd>
                    <TfootTd colSpan={2}>
                      {totalEntries.map(([cur, sum], i) => (
                        <span key={cur}>
                          {i > 0 ? ' · ' : ''}
                          <strong>{sum}</strong> {cur}
                        </span>
                      ))}
                    </TfootTd>
                  </tr>
                </tfoot>
              )}
            </Table>
          </TableWrap>
        )}
      </SettingsCard>
    </SettingsSection>
  );
};

export default DonationsTab;
