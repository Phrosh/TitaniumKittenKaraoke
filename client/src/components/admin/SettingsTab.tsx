import React from 'react';
import styled from 'styled-components';
import LanguageSelector from '../LanguageSelector';

// Styled Components für SettingsTab
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

const HorizontalDivider = styled.div`
  height: 1px;
  background: #bee5eb;
  margin: 20px 0;
`;

const SpecialSection = styled.div`
  margin-top: 20px;
  padding: 15px;
  background: #e8f4fd;
  border-radius: 8px;
  border: 1px solid #bee5eb;
`;

const SpecialTitle = styled.div`
  font-weight: 600;
  margin-bottom: 15px;
  color: #0c5460;
`;

const SpecialDescription = styled.div`
  font-size: 14px;
  color: #0c5460;
  margin-bottom: 15px;
`;

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

const CheckboxText = styled.span`
  font-size: 16px;
  font-weight: 500;
  color: #333;
`;

const StatusContainer = styled.div`
  padding: 10px;
  background: #d4edda;
  border: 1px solid #c3e6cb;
  border-radius: 4px;
  margin-bottom: 10px;
`;

const StatusTitle = styled.div`
  font-weight: 600;
  color: #155724;
  margin-bottom: 5px;
`;

const StatusText = styled.div`
  color: #155724;
  font-size: 14px;
`;

const InputGroup = styled.div`
  display: flex;
  gap: 10px;
  alignItems: center;
  margin-bottom: 10px;
  flex-wrap: wrap;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 10px;
  alignItems: center;
  margin-bottom: 10px;
  flex-wrap: wrap;
`;

const TabButton = styled.button<{ $active: boolean }>`
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: ${props => props.$active ? '#007bff' : 'white'};
  color: ${props => props.$active ? 'white' : '#333'};
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
`;

const TabDescription = styled.div`
  font-size: 10px;
  opacity: 0.8;
`;

const CommandContainer = styled.div`
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 10px;
  margin-bottom: 10px;
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
`;

const PortInput = styled.input`
  width: 80px;
  padding: 5px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
`;

interface SettingsTabProps {
  // Language
  t: (key: string) => string;
  
  // Regression
  regressionValue: number;
  onRegressionValueChange: (value: number) => void;
  onUpdateRegressionValue: () => void;
  
  // Custom URL
  customUrl: string;
  onCustomUrlChange: (value: string) => void;
  onUpdateCustomUrl: () => void;
  onCopyUrlToClipboard: () => void;
  
  // Cloudflared
  cloudflaredInstalled: boolean;
  cloudflaredInstallLoading: boolean;
  cloudflaredStartLoading: boolean;
  cloudflaredStopLoading: boolean;
  onInstallCloudflared: () => void;
  onStartCloudflaredTunnel: () => void;
  onStopCloudflaredTunnel: () => void;
  
  // Overlay Title
  overlayTitle: string;
  onOverlayTitleChange: (value: string) => void;
  onUpdateOverlayTitle: () => void;
  
  // YouTube Enabled
  youtubeEnabled: boolean;
  onYoutubeEnabledChange: (checked: boolean) => void;
  onUpdateYouTubeEnabled: () => void;
  
  // Auto Approve Songs
  autoApproveSongs: boolean;
  onAutoApproveSongsChange: (checked: boolean) => void;
  onUpdateAutoApproveSongs: () => void;
  
  // USDB Credentials
  usdbCredentials: { username: string; password: string } | null;
  usdbUsername: string;
  usdbPassword: string;
  onUsdbUsernameChange: (value: string) => void;
  onUsdbPasswordChange: (value: string) => void;
  onSaveUSDBCredentials: () => void;
  onDeleteUSDBCredentials: () => void;
  
  // File Songs
  fileSongsFolder: string;
  onFileSongsFolderChange: (value: string) => void;
  onUpdateFileSongsFolder: () => void;
  onRescanFileSongs: () => void;
  onRemoveFileSongs: () => void;
  
  // Local Server
  localServerPort: number;
  localServerTab: 'node' | 'npx' | 'python';
  onLocalServerPortChange: (port: number) => void;
  onLocalServerTabChange: (tab: 'node' | 'npx' | 'python') => void;
  onCopyServerCommand: () => void;
  
  // Loading states
  settingsLoading: boolean;
  usdbLoading: boolean;
}

const SettingsTab: React.FC<SettingsTabProps> = ({
  t,
  regressionValue,
  onRegressionValueChange,
  onUpdateRegressionValue,
  customUrl,
  onCustomUrlChange,
  onUpdateCustomUrl,
  onCopyUrlToClipboard,
  cloudflaredInstalled,
  cloudflaredInstallLoading,
  cloudflaredStartLoading,
  cloudflaredStopLoading,
  onInstallCloudflared,
  onStartCloudflaredTunnel,
  onStopCloudflaredTunnel,
  overlayTitle,
  onOverlayTitleChange,
  onUpdateOverlayTitle,
  youtubeEnabled,
  onYoutubeEnabledChange,
  onUpdateYouTubeEnabled,
  autoApproveSongs,
  onAutoApproveSongsChange,
  onUpdateAutoApproveSongs,
  usdbCredentials,
  usdbUsername,
  usdbPassword,
  onUsdbUsernameChange,
  onUsdbPasswordChange,
  onSaveUSDBCredentials,
  onDeleteUSDBCredentials,
  fileSongsFolder,
  onFileSongsFolderChange,
  onUpdateFileSongsFolder,
  onRescanFileSongs,
  onRemoveFileSongs,
  localServerPort,
  localServerTab,
  onLocalServerPortChange,
  onLocalServerTabChange,
  onCopyServerCommand,
  settingsLoading,
  usdbLoading
}) => {
  const generateLocalServerCommand = () => {
    if (!fileSongsFolder) return '';
    
    const folderPath = fileSongsFolder.replace(/\\/g, '/');
    
    switch (localServerTab) {
      case 'node':
        return `node -e "const http=require('http'),fs=require('fs'),path=require('path');const port=${localServerPort},dir='${folderPath}';const server=http.createServer((req,res)=>{res.setHeader('Access-Control-Allow-Origin','*');const filePath=path.join(dir,req.url.slice(1));fs.stat(filePath,(err,stats)=>{if(err||!stats.isFile()){res.writeHead(404);res.end('Not found');return;}res.setHeader('Content-Type','video/mp4');fs.createReadStream(filePath).pipe(res);});});server.listen(port,()=>console.log('🌐 Server: http://localhost:'+port+'/'));"`;
      case 'npx':
        return `npx serve "${folderPath}" -p ${localServerPort} -s`;
      case 'python':
        return `python -m http.server ${localServerPort} --directory "${folderPath}"`;
      default:
        return '';
    }
  };

  return (
    <SettingsSection>
      <SettingsTitle>⚙️ Einstellungen</SettingsTitle>
      
      {/* Language Selection */}
      <SettingsCard>
        <SettingsLabel>{t('settings.language')}:</SettingsLabel>
        <LanguageSelector />
        <SettingsDescription>
          {t('settings.selectLanguage')}
        </SettingsDescription>
      </SettingsCard>
      
      <HorizontalDivider />

      {/* Regression Value */}
      <SettingsCard>
        <SettingsLabel>Regression-Wert:</SettingsLabel>
        <SettingsInput
          type="number"
          step="0.01"
          min="0"
          max="1"
          value={regressionValue}
          onChange={(e) => onRegressionValueChange(parseFloat(e.target.value))}
        />
        <SettingsButton 
          onClick={onUpdateRegressionValue}
          disabled={settingsLoading}
        >
          {settingsLoading ? 'Speichert...' : 'Speichern'}
        </SettingsButton>
        <SettingsDescription>
          Der Regression-Wert bestimmt, um wie viel die Priorität eines Songs reduziert wird, 
          wenn er nach unten rutscht (Standard: 0.1). Bei 10 Regressionen wird die Priorität um 1.0 reduziert.
        </SettingsDescription>
      </SettingsCard>
      
      <HorizontalDivider />
      
      {/* URL & Cloudflared Section */}
      <SpecialSection>
        <SpecialTitle>🌐 Eigene URL & Cloudflared Tunnel</SpecialTitle>
        
        {/* Custom URL */}
        <div style={{ marginBottom: '20px' }}>
          <SettingsLabel style={{ marginBottom: '10px', color: '#0c5460' }}>Eigene URL:</SettingsLabel>
          <InputGroup>
            <SettingsInput
              type="url"
              placeholder="https://meine-domain.com"
              value={customUrl}
              onChange={(e) => onCustomUrlChange(e.target.value)}
              style={{ minWidth: '300px' }}
            />
            <SettingsButton 
              onClick={onUpdateCustomUrl}
              disabled={settingsLoading}
            >
              {settingsLoading ? 'Speichert...' : 'Speichern'}
            </SettingsButton>
            <SettingsButton 
              onClick={onCopyUrlToClipboard}
              disabled={!customUrl}
              style={{ 
                backgroundColor: '#6c757d',
                color: 'white',
                opacity: !customUrl ? 0.6 : 1
              }}
            >
              📋 Kopieren
            </SettingsButton>
          </InputGroup>
          <SettingsDescription style={{ color: '#0c5460' }}>
            Wenn gesetzt, wird der QR-Code mit dieser URL + "/new" generiert. 
            Wenn leer, wird automatisch die aktuelle Domain verwendet.
          </SettingsDescription>
        </div>
        
        {/* Cloudflared Integration */}
        <div style={{ paddingTop: '15px', borderTop: '1px solid #bee5eb' }}>
          <SettingsLabel style={{ marginBottom: '15px', color: '#0c5460' }}>Cloudflared Tunnel:</SettingsLabel>
          <ButtonGroup>
            <SettingsButton 
              onClick={onInstallCloudflared}
              disabled={cloudflaredInstalled || cloudflaredInstallLoading}
              style={{ 
                backgroundColor: cloudflaredInstalled ? '#6c757d' : '#28a745',
                color: 'white',
                opacity: cloudflaredInstalled ? 0.6 : 1
              }}
            >
              {cloudflaredInstallLoading ? 'Installiert...' : 'Cloudflared Einrichten'}
            </SettingsButton>
            
            <SettingsButton 
              onClick={onStartCloudflaredTunnel}
              disabled={!cloudflaredInstalled || cloudflaredStartLoading}
              style={{ 
                backgroundColor: !cloudflaredInstalled ? '#6c757d' : '#007bff',
                color: 'white',
                opacity: !cloudflaredInstalled ? 0.6 : 1
              }}
            >
              {cloudflaredStartLoading ? 'Startet...' : 'Cloudflared Starten'}
            </SettingsButton>
            
            <SettingsButton 
              onClick={onStopCloudflaredTunnel}
              disabled={cloudflaredStopLoading}
              style={{ 
                backgroundColor: '#dc3545',
                color: 'white'
              }}
            >
              {cloudflaredStopLoading ? 'Stoppt...' : 'Tunnel Stoppen'}
            </SettingsButton>
          </ButtonGroup>
          <SettingsDescription style={{ color: '#0c5460' }}>
            Cloudflared erstellt einen sicheren Tunnel zu Ihrem lokalen Server. 
            Nach dem Starten wird automatisch eine öffentliche URL generiert und als "Eigene URL" gesetzt.
          </SettingsDescription>
        </div>
      </SpecialSection>
      
      <HorizontalDivider />
      
      {/* Overlay Title */}
      <SettingsCard>
        <SettingsLabel>Overlay-Überschrift:</SettingsLabel>
        <SettingsInput
          type="text"
          placeholder="Willkommen beim Karaoke"
          value={overlayTitle}
          onChange={(e) => onOverlayTitleChange(e.target.value)}
          style={{ minWidth: '300px' }}
        />
        <SettingsButton 
          onClick={onUpdateOverlayTitle}
          disabled={settingsLoading}
        >
          {settingsLoading ? 'Speichert...' : 'Speichern'}
        </SettingsButton>
        <SettingsDescription>
          Diese Überschrift wird im QR-Code Overlay im /show Endpoint angezeigt.
        </SettingsDescription>
      </SettingsCard>
      
      <HorizontalDivider />

      {/* YouTube Enabled */}
      <SettingsCard>
        <SettingsLabel>Erlaube YouTube-Links in Songwünschen:</SettingsLabel>
        <CheckboxContainer>
          <CheckboxLabel>
            <CheckboxInput
              type="checkbox"
              checked={youtubeEnabled}
              onChange={(e) => onYoutubeEnabledChange(e.target.checked)}
            />
            <CheckboxText>
              {youtubeEnabled ? 'Aktiviert' : 'Deaktiviert'}
            </CheckboxText>
          </CheckboxLabel>
          <SettingsButton 
            onClick={onUpdateYouTubeEnabled}
            disabled={settingsLoading}
            style={{ marginLeft: '10px' }}
          >
            {settingsLoading ? 'Speichert...' : 'Speichern'}
          </SettingsButton>
        </CheckboxContainer>
        <SettingsDescription>
          Wenn deaktiviert, können Benutzer nur Songs aus der lokalen Songliste auswählen. 
          YouTube-Links werden nicht akzeptiert.
        </SettingsDescription>
      </SettingsCard>
      
      <HorizontalDivider />
      
      {/* Auto-Approve Songs Setting */}
      <SettingsCard>
        <SettingsLabel>Songwünsche automatisch bestätigen:</SettingsLabel>
        <CheckboxContainer>
          <CheckboxLabel>
            <CheckboxInput
              type="checkbox"
              checked={autoApproveSongs}
              onChange={(e) => onAutoApproveSongsChange(e.target.checked)}
            />
            <CheckboxText>
              {autoApproveSongs ? 'Aktiviert' : 'Deaktiviert'}
            </CheckboxText>
          </CheckboxLabel>
          <SettingsButton 
            onClick={onUpdateAutoApproveSongs}
            disabled={settingsLoading}
            style={{ marginLeft: '10px' }}
          >
            {settingsLoading ? 'Speichert...' : 'Speichern'}
          </SettingsButton>
        </CheckboxContainer>
        <SettingsDescription>
          Wenn aktiviert, werden Songwünsche automatisch zur Playlist hinzugefügt. 
          Wenn deaktiviert, werden Songwünsche, die entweder YouTube-Songs sind (nicht im Cache) 
          oder auf der unsichtbaren Liste stehen, zur manuellen Bestätigung vorgelegt.
        </SettingsDescription>
      </SettingsCard>
      
      <HorizontalDivider />
      
      {/* USDB Credentials */}
      <SettingsCard>
        <SettingsLabel>USDB-Zugangsdaten:</SettingsLabel>
        {usdbCredentials ? (
          <div style={{ marginBottom: '15px' }}>
            <StatusContainer>
              <StatusTitle>✅ USDB-Zugangsdaten gespeichert</StatusTitle>
              <StatusText>Username: {usdbCredentials.username}</StatusText>
            </StatusContainer>
            <SettingsButton 
              onClick={onDeleteUSDBCredentials}
              disabled={usdbLoading}
              style={{ backgroundColor: '#dc3545' }}
            >
              {usdbLoading ? 'Löscht...' : 'Zugangsdaten löschen'}
            </SettingsButton>
          </div>
        ) : (
          <div style={{ marginBottom: '15px' }}>
            <InputGroup>
              <SettingsInput
                type="text"
                placeholder="USDB Username"
                value={usdbUsername}
                onChange={(e) => onUsdbUsernameChange(e.target.value)}
                style={{ minWidth: '200px' }}
              />
              <SettingsInput
                type="password"
                placeholder="USDB Passwort"
                value={usdbPassword}
                onChange={(e) => onUsdbPasswordChange(e.target.value)}
                style={{ minWidth: '200px' }}
              />
              <SettingsButton 
                onClick={onSaveUSDBCredentials}
                disabled={usdbLoading}
              >
                {usdbLoading ? 'Speichert...' : 'Speichern'}
              </SettingsButton>
            </InputGroup>
          </div>
        )}
        <SettingsDescription>
          Zugangsdaten für die UltraStar Database (usdb.animux.de). 
          Diese werden benötigt, um Songs von USDB herunterzuladen.
        </SettingsDescription>
      </SettingsCard>
      
      <HorizontalDivider />
      
      {/* File Songs */}
      <SettingsCard>
        <SettingsLabel>Lokaler Song-Ordner:</SettingsLabel>
        <SettingsInput
          type="text"
          placeholder="C:/songs"
          value={fileSongsFolder}
          onChange={(e) => onFileSongsFolderChange(e.target.value)}
          style={{ minWidth: '300px' }}
        />
        <ButtonGroup>
          <SettingsButton 
            onClick={onUpdateFileSongsFolder}
            disabled={settingsLoading}
          >
            {settingsLoading ? 'Speichert...' : 'Speichern'}
          </SettingsButton>
          <SettingsButton 
            onClick={onRescanFileSongs}
            disabled={settingsLoading}
            style={{ backgroundColor: '#17a2b8' }}
          >
            {settingsLoading ? 'Scannt...' : 'Neu scannen'}
          </SettingsButton>
          <SettingsButton 
            onClick={onRemoveFileSongs}
            disabled={settingsLoading}
            style={{ backgroundColor: '#dc3545' }}
          >
            {settingsLoading ? 'Entfernt...' : 'Songs aus der Liste entfernen'}
          </SettingsButton>
        </ButtonGroup>
        <SettingsDescription>
          Ordner mit lokalen Karaoke-Videos im Format "Interpret - Songtitel.erweiterung". 
          Diese Songs haben höchste Priorität bei der Erkennung.
        </SettingsDescription>
        
        {/* Local Server Section */}
        {fileSongsFolder && (
          <SpecialSection>
            <SpecialTitle>🌐 Lokaler Webserver für Videos</SpecialTitle>
            <SpecialDescription>
              Starte einen lokalen Webserver, damit Videos über HTTP abgespielt werden können:
            </SpecialDescription>
            
            {/* Port Selection */}
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#333' }}>
                Port:
              </label>
              <PortInput
                type="number"
                value={localServerPort}
                onChange={(e) => onLocalServerPortChange(parseInt(e.target.value) || 4000)}
                min="1000"
                max="65535"
              />
            </div>
            
            {/* Server Type Tabs */}
            <div style={{ marginBottom: '15px' }}>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                {[
                  { key: 'python', label: 'Python', desc: 'Built-in' },
                  { key: 'npx', label: 'NPX', desc: 'serve' },
                  { key: 'node', label: 'Node.js', desc: 'Native' }
                ].map(({ key, label, desc }) => (
                  <TabButton
                    key={key}
                    $active={localServerTab === key}
                    onClick={() => onLocalServerTabChange(key as any)}
                  >
                    {label}
                    <TabDescription>{desc}</TabDescription>
                  </TabButton>
                ))}
              </div>
            </div>
            
            {/* Command Display */}
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#333' }}>
                Befehl zum Kopieren:
              </label>
              <CommandContainer>
                {generateLocalServerCommand()}
              </CommandContainer>
            </div>
            
            {/* Copy Button */}
            <button
              onClick={onCopyServerCommand}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              📋 Befehl kopieren
            </button>
          </SpecialSection>
        )}
      </SettingsCard>
    </SettingsSection>
  );
};

export default SettingsTab;
