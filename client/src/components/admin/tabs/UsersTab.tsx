import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { adminAPI } from '../../../services/api';
import { Button } from '../../shared';
import { AdminUser } from '../../../types';

// Styled Components für UsersTab
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

interface NewUserData {
  username: string;
  password: string;
}

interface UsersTabProps {
  // Keine Props nötig, da die Komponente ihre eigene Logik verwaltet
}

const UsersTab: React.FC<UsersTabProps> = () => {
  const { t } = useTranslation();
  
  // Users State
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [newUserData, setNewUserData] = useState<NewUserData>({ username: '', password: '' });
  const [userManagementLoading, setUserManagementLoading] = useState(false);

  // Load admin users when component mounts
  useEffect(() => {
    fetchAdminUsers();
  }, []);

  // Admin User Management Functions
  const fetchAdminUsers = async () => {
    try {
      const response = await adminAPI.getAdminUsers();
      console.log('Admin users response:', response.data);
      setAdminUsers(response.data.adminUsers || []);
    } catch (error) {
      console.error('Error fetching admin users:', error);
      toast.error(t('users.loadError'));
    }
  };

  const handleCreateAdminUser = async () => {
    if (!newUserData.username.trim() || !newUserData.password.trim()) {
      toast.error(t('users.fillAllFields'));
      return;
    }

    if (newUserData.password.length < 6) {
      toast.error(t('users.passwordMinLength'));
      return;
    }

    setUserManagementLoading(true);
    try {
      await adminAPI.createAdminUser(newUserData);
      toast.success(t('users.userCreatedSuccess'));
      setNewUserData({ username: '', password: '' });
      await fetchAdminUsers();
    } catch (error: any) {
      console.error('Error creating admin user:', error);
      const message = error.response?.data?.message || t('users.createError');
      toast.error(message);
    } finally {
      setUserManagementLoading(false);
    }
  };

  const handleDeleteAdminUser = async (userId: number, username: string) => {
    if (!window.confirm(t('users.confirmDelete', { username }))) {
      return;
    }

    setUserManagementLoading(true);
    try {
      await adminAPI.deleteAdminUser(userId);
      toast.success(t('users.userDeletedSuccess', { username }));
      await fetchAdminUsers();
    } catch (error: any) {
      console.error('Error deleting admin user:', error);
      const message = error.response?.data?.message || t('users.deleteError');
      toast.error(message);
    } finally {
      setUserManagementLoading(false);
    }
  };
  return (
    <SettingsSection>
      <SettingsTitle>👥 {t('users.title')}</SettingsTitle>
      
      {/* Create new admin user */}
      <SettingsCard>
        <SettingsLabel>{t('users.createNewUser')}</SettingsLabel>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
          <SettingsInput
            type="text"
            placeholder={t('users.username')}
            value={newUserData.username}
            onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
            style={{ minWidth: '200px' }}
          />
          <SettingsInput
            type="password"
            placeholder={t('users.password')}
            value={newUserData.password}
            onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
            style={{ minWidth: '200px' }}
          />
          <SettingsButton 
            onClick={handleCreateAdminUser}
            disabled={userManagementLoading}
          >
            {userManagementLoading ? t('users.creating') : t('users.create')}
          </SettingsButton>
        </div>
        <SettingsDescription>
          {t('users.createDescription')}
        </SettingsDescription>
      </SettingsCard>
      
      {/* List existing admin users */}
      <SettingsCard>
        <SettingsLabel>{t('users.existingUsers')}</SettingsLabel>
        {!adminUsers || adminUsers.length === 0 ? (
          <div style={{ color: '#666', fontStyle: 'italic' }}>
            {t('users.noUsers')}
          </div>
        ) : (
          <div style={{ marginTop: '10px' }}>
            {adminUsers.map((user) => (
              <div 
                key={user.id} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '5px',
                  marginBottom: '5px',
                  backgroundColor: '#f9f9f9'
                }}
              >
                <div>
                  <strong>{user.username}</strong>
                  <div style={{ fontSize: '0.9em', color: '#666' }}>
                    {t('users.created')}: {new Date(user.created_at).toLocaleDateString('de-DE')}
                  </div>
                </div>
                <Button 
                  variant="danger"
                  onClick={() => handleDeleteAdminUser(user.id, user.username)}
                  disabled={userManagementLoading}
                  style={{ padding: '5px 10px', fontSize: '0.9em' }}
                >
                  🗑️ {t('users.delete')}
                </Button>
              </div>
            ))}
          </div>
        )}
        <SettingsDescription>
          {t('users.managementDescription')}
        </SettingsDescription>
      </SettingsCard>
    </SettingsSection>
  );
};

export default UsersTab;
