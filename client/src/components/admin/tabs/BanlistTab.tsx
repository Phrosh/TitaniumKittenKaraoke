import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { adminAPI } from '../../../services/api';
import Button from '../../shared/Button';
import { SettingsSection, SettingsTitle, SettingsCard, SettingsLabel, SettingsInput, SettingsDescription } from '../style';

interface BanlistItem {
  id: number;
  device_id: string;
  reason?: string;
  created_at: string;
  banned_by?: string;
}

interface BanlistTabProps {
  // Props für externe Interaktionen (z.B. von SongsTab)
  onDeviceIdClick?: (deviceId: string) => void;
}

const BanlistTab: React.FC<BanlistTabProps> = ({
  onDeviceIdClick
}) => {
  const { t } = useTranslation();
  
  // Banlist State
  const [banlist, setBanlist] = useState<BanlistItem[]>([]);
  const [newBanDeviceId, setNewBanDeviceId] = useState('');
  const [newBanReason, setNewBanReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Load banlist when component mounts
  useEffect(() => {
    fetchBanlist();
  }, []);

  // Banlist Management Functions
  const fetchBanlist = async () => {
    try {
      const response = await adminAPI.getBanlist();
      setBanlist(response.data.bannedDevices || []);
    } catch (error) {
      console.error('Error fetching banlist:', error);
    }
  };

  const handleAddToBanlist = async () => {
    if (!newBanDeviceId.trim() || newBanDeviceId.length !== 3) {
      toast.error(t('banlist.deviceIdLengthError'));
      return;
    }

    setActionLoading(true);
    try {
      await adminAPI.addToBanlist(newBanDeviceId.toUpperCase(), newBanReason.trim() || undefined);
      toast.success(t('banlist.deviceAddedSuccess', { deviceId: newBanDeviceId.toUpperCase() }));
      setNewBanDeviceId('');
      setNewBanReason('');
      await fetchBanlist();
    } catch (error: any) {
      console.error('Error adding to banlist:', error);
      toast.error(error.response?.data?.message || t('banlist.addError'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveFromBanlist = async (deviceId: string) => {
    if (!window.confirm(t('banlist.confirmRemove', { deviceId }))) {
      return;
    }

    setActionLoading(true);
    try {
      await adminAPI.removeFromBanlist(deviceId);
      toast.success(t('banlist.deviceRemovedSuccess', { deviceId }));
      await fetchBanlist();
    } catch (error: any) {
      console.error('Error removing from banlist:', error);
      toast.error(error.response?.data?.message || t('banlist.removeError'));
    } finally {
      setActionLoading(false);
    }
  };
  return (
    <SettingsSection>
      <SettingsTitle>🚫 {t('banlist.title')}</SettingsTitle>
      
      {/* Add device to banlist */}
      <SettingsCard>
        <SettingsLabel>{t('banlist.addDeviceId')}</SettingsLabel>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
          <SettingsInput
            type="text"
            placeholder="ABC (3 Zeichen)"
            value={newBanDeviceId}
            onChange={(e) => setNewBanDeviceId(e.target.value.toUpperCase())}
            style={{ minWidth: '120px', textTransform: 'uppercase' }}
            maxLength={3}
          />
          <SettingsInput
            type="text"
            placeholder="Grund (optional)"
            value={newBanReason}
            onChange={(e) => setNewBanReason(e.target.value)}
            style={{ minWidth: '200px' }}
          />
          <Button 
            onClick={handleAddToBanlist}
            disabled={actionLoading}
            size="small"
            style={{ marginRight: '10px' }}
          >
            {actionLoading ? t('banlist.adding') : t('banlist.add')}
          </Button>
        </div>
        <SettingsDescription>
          {t('banlist.description')}
        </SettingsDescription>
      </SettingsCard>
      
      {/* List banned devices */}
      <SettingsCard>
        <SettingsLabel>{t('banlist.bannedDevices', { count: banlist.length })}</SettingsLabel>
        {banlist.length === 0 ? (
          <div style={{ color: '#666', fontStyle: 'italic' }}>
            {t('banlist.noBannedDevices')}
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
                    {ban.reason ? t('banlist.reason', { reason: ban.reason }) : t('banlist.noReason')}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                    {t('banlist.bannedOn', { date: new Date(ban.created_at).toLocaleString('de-DE') })}
                    {ban.banned_by && t('banlist.bannedBy', { user: ban.banned_by })}
                  </div>
                </div>
                <Button 
                  variant="danger"
                  onClick={() => handleRemoveFromBanlist(ban.device_id)}
                  disabled={actionLoading}
                  style={{ padding: '5px 10px', fontSize: '0.9em' }}
                >
                  🗑️ {t('banlist.remove')}
                </Button>
              </div>
            ))}
          </div>
        )}
        <SettingsDescription>
          {t('banlist.managementDescription')}
        </SettingsDescription>
      </SettingsCard>
    </SettingsSection>
  );
};

export default BanlistTab;
