import React from 'react';
import styled from 'styled-components';
import { Button } from '../shared';

// Styled Components für BanlistTab
const SettingsSection = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
`;

const SettingsTitle = styled.h3`
  color: #333;
  margin: 0 0 20px 0;
  font-size: 1.3rem;
  font-weight: 600;
`;

const SettingsCard = styled.div`
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid #e9ecef;
`;

const SettingsLabel = styled.label`
  display: block;
  font-weight: 600;
  margin-bottom: 10px;
  color: #333;
  font-size: 1rem;
`;

const SettingsInput = styled.input`
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: #3498db;
    box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
  }
`;

const SettingsButton = styled.button`
  background: #3498db;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: #2980b9;
    transform: translateY(-1px);
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
    transform: none;
  }
`;

const SettingsDescription = styled.div`
  font-size: 0.9rem;
  color: #666;
  margin-top: 10px;
  line-height: 1.4;
`;

interface BanlistItem {
  id: number;
  device_id: string;
  reason?: string;
  created_at: string;
  banned_by?: string;
}

interface BanlistTabProps {
  banlist: BanlistItem[];
  newBanDeviceId: string;
  newBanReason: string;
  actionLoading: boolean;
  onNewBanDeviceIdChange: (value: string) => void;
  onNewBanReasonChange: (value: string) => void;
  onAddToBanlist: () => void;
  onRemoveFromBanlist: (deviceId: string) => void;
}

const BanlistTab: React.FC<BanlistTabProps> = ({
  banlist,
  newBanDeviceId,
  newBanReason,
  actionLoading,
  onNewBanDeviceIdChange,
  onNewBanReasonChange,
  onAddToBanlist,
  onRemoveFromBanlist
}) => {
  return (
    <SettingsSection>
      <SettingsTitle>🚫 Banlist-Verwaltung</SettingsTitle>
      
      {/* Add device to banlist */}
      <SettingsCard>
        <SettingsLabel>Device ID zur Banlist hinzufügen:</SettingsLabel>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
          <SettingsInput
            type="text"
            placeholder="ABC (3 Zeichen)"
            value={newBanDeviceId}
            onChange={(e) => onNewBanDeviceIdChange(e.target.value.toUpperCase())}
            style={{ minWidth: '120px', textTransform: 'uppercase' }}
            maxLength={3}
          />
          <SettingsInput
            type="text"
            placeholder="Grund (optional)"
            value={newBanReason}
            onChange={(e) => onNewBanReasonChange(e.target.value)}
            style={{ minWidth: '200px' }}
          />
          <SettingsButton 
            onClick={onAddToBanlist}
            disabled={actionLoading}
          >
            {actionLoading ? 'Hinzufügen...' : 'Hinzufügen'}
          </SettingsButton>
        </div>
        <SettingsDescription>
          Device IDs auf der Banlist können keine Songs hinzufügen. Sie erhalten trotzdem eine Erfolgsmeldung.
        </SettingsDescription>
      </SettingsCard>
      
      {/* List banned devices */}
      <SettingsCard>
        <SettingsLabel>Gesperrte Device IDs ({banlist.length}):</SettingsLabel>
        {banlist.length === 0 ? (
          <div style={{ color: '#666', fontStyle: 'italic' }}>
            Keine Device IDs gesperrt
          </div>
        ) : (
          <div style={{ marginTop: '10px' }}>
            {banlist.map((ban) => (
              <div 
                key={ban.id} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '10px',
                  border: '1px solid #eee',
                  borderRadius: '6px',
                  marginBottom: '8px',
                  background: '#fff'
                }}
              >
                <div>
                  <div style={{ fontWeight: '600', fontSize: '16px', color: '#333' }}>
                    🚫 {ban.device_id}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666', marginTop: '2px' }}>
                    {ban.reason ? `Grund: ${ban.reason}` : 'Kein Grund angegeben'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                    Gesperrt am: {new Date(ban.created_at).toLocaleString('de-DE')}
                    {ban.banned_by && ` • von ${ban.banned_by}`}
                  </div>
                </div>
                <Button 
                  variant="danger"
                  onClick={() => onRemoveFromBanlist(ban.device_id)}
                  disabled={actionLoading}
                  style={{ padding: '5px 10px', fontSize: '0.9em' }}
                >
                  🗑️ Entfernen
                </Button>
              </div>
            ))}
          </div>
        )}
        <SettingsDescription>
          Verwaltung der gesperrten Device IDs. Gesperrte Geräte können keine Songs hinzufügen.
        </SettingsDescription>
      </SettingsCard>
    </SettingsSection>
  );
};

export default BanlistTab;
