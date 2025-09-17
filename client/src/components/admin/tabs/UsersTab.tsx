import React from 'react';
import styled from 'styled-components';
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
  adminUsers: AdminUser[];
  newUserData: NewUserData;
  userManagementLoading: boolean;
  onNewUserDataChange: (data: NewUserData) => void;
  onCreateAdminUser: () => void;
  onDeleteAdminUser: (userId: number, username: string) => void;
}

const UsersTab: React.FC<UsersTabProps> = ({
  adminUsers,
  newUserData,
  userManagementLoading,
  onNewUserDataChange,
  onCreateAdminUser,
  onDeleteAdminUser
}) => {
  return (
    <SettingsSection>
      <SettingsTitle>👥 Nutzerverwaltung</SettingsTitle>
      
      {/* Create new admin user */}
      <SettingsCard>
        <SettingsLabel>Neuen Admin-Benutzer erstellen:</SettingsLabel>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
          <SettingsInput
            type="text"
            placeholder="Benutzername"
            value={newUserData.username}
            onChange={(e) => onNewUserDataChange({ ...newUserData, username: e.target.value })}
            style={{ minWidth: '200px' }}
          />
          <SettingsInput
            type="password"
            placeholder="Passwort (min. 6 Zeichen)"
            value={newUserData.password}
            onChange={(e) => onNewUserDataChange({ ...newUserData, password: e.target.value })}
            style={{ minWidth: '200px' }}
          />
          <SettingsButton 
            onClick={onCreateAdminUser}
            disabled={userManagementLoading}
          >
            {userManagementLoading ? 'Erstellt...' : 'Erstellen'}
          </SettingsButton>
        </div>
        <SettingsDescription>
          Erstelle neue Admin-Benutzer, die Zugriff auf das Admin-Dashboard haben.
        </SettingsDescription>
      </SettingsCard>
      
      {/* List existing admin users */}
      <SettingsCard>
        <SettingsLabel>Bestehende Admin-Benutzer:</SettingsLabel>
        {!adminUsers || adminUsers.length === 0 ? (
          <div style={{ color: '#666', fontStyle: 'italic' }}>
            Keine Admin-Benutzer vorhanden
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
                    Erstellt: {new Date(user.created_at).toLocaleDateString('de-DE')}
                  </div>
                </div>
                <Button 
                  variant="danger"
                  onClick={() => onDeleteAdminUser(user.id, user.username)}
                  disabled={userManagementLoading}
                  style={{ padding: '5px 10px', fontSize: '0.9em' }}
                >
                  🗑️ Löschen
                </Button>
              </div>
            ))}
          </div>
        )}
        <SettingsDescription>
          Verwaltung aller Admin-Benutzer. Du kannst deinen eigenen Account nicht löschen.
        </SettingsDescription>
      </SettingsCard>
    </SettingsSection>
  );
};

export default UsersTab;
