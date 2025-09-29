import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { adminAPI, showAPI } from '../../../services/api';
import LanguageSelector from '../../LanguageSelector';
import Button from '../../shared/Button';

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
  // Keine Props mehr benötigt, da useTranslation intern verwendet wird
}

const SettingsTab: React.FC<SettingsTabProps> = () => {
  const { t } = useTranslation();
  // Settings State
  const [regressionValue, setRegressionValue] = useState(0.1);
  const [customUrl, setCustomUrl] = useState('');
  const [overlayTitle, setOverlayTitle] = useState('Willkommen beim Karaoke');
  const [youtubeEnabled, setYoutubeEnabled] = useState(true);
  const [autoApproveSongs, setAutoApproveSongs] = useState(true);
  const [usdbSearchEnabled, setUsdbSearchEnabled] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  
  // Cloudflared State
  const [cloudflaredInstalled, setCloudflaredInstalled] = useState(false);
  const [cloudflaredInstallLoading, setCloudflaredInstallLoading] = useState(false);
  const [cloudflaredStartLoading, setCloudflaredStartLoading] = useState(false);
  const [cloudflaredStopLoading, setCloudflaredStopLoading] = useState(false);
  
  // USDB Management
  const [usdbCredentials, setUsdbCredentials] = useState<{username: string, password: string} | null>(null);
  const [usdbUsername, setUsdbUsername] = useState('');
  const [usdbPassword, setUsdbPassword] = useState('');
  const [usdbLoading, setUsdbLoading] = useState(false);
  
  // File Songs Management
  const [fileSongsFolder, setFileSongsFolder] = useState('');
  const [fileSongs, setFileSongs] = useState<any[]>([]);
  const [localServerPort, setLocalServerPort] = useState(4000);
  const [localServerTab, setLocalServerTab] = useState<'node' | 'npx' | 'python'>('python');

  // Load settings when component mounts
  useEffect(() => {
    loadSettings();
  }, []);

  // Load all settings
  const loadSettings = useCallback(async () => {
    try {
      // Fetch settings including regression value and custom URL
      const settingsResponse = await adminAPI.getSettings();
      if (settingsResponse.data.settings.regression_value) {
        setRegressionValue(parseFloat(settingsResponse.data.settings.regression_value));
      }
      if (settingsResponse.data.settings.custom_url) {
        setCustomUrl(settingsResponse.data.settings.custom_url);
      }
      if (settingsResponse.data.settings.overlay_title) {
        setOverlayTitle(settingsResponse.data.settings.overlay_title);
      }
      if (settingsResponse.data.settings.youtube_enabled !== undefined) {
        setYoutubeEnabled(settingsResponse.data.settings.youtube_enabled === 'true');
      }
      if (settingsResponse.data.settings.auto_approve_songs !== undefined) {
        setAutoApproveSongs(settingsResponse.data.settings.auto_approve_songs === 'true');
      }
      if (settingsResponse.data.settings.usdb_search_enabled !== undefined) {
        setUsdbSearchEnabled(settingsResponse.data.settings.usdb_search_enabled === 'true');
      }
      
      // Load file songs folder setting
      try {
        const fileSongsResponse = await adminAPI.getFileSongsFolder();
        setFileSongsFolder(fileSongsResponse.data.folderPath || '');
        setFileSongs(fileSongsResponse.data.fileSongs || []);
        setLocalServerPort(fileSongsResponse.data.port || 4000);
      } catch (error) {
        console.error('Error loading file songs folder:', error);
      }
      
      // Check cloudflared status
      await checkCloudflaredStatus();
      
      // Load USDB credentials
      await fetchUSDBCredentials();
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }, []);

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

  // Settings Management Functions
  const handleUpdateRegressionValue = async () => {
    setSettingsLoading(true);
    try {
      await adminAPI.updateRegressionValue(regressionValue);
      toast.success(t('settings.regressionValueUpdated'));
    } catch (error) {
      console.error('Error updating regression value:', error);
      toast.error(t('settings.regressionValueError'));
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleUpdateCustomUrl = async () => {
    setSettingsLoading(true);
    try {
      await adminAPI.updateCustomUrl(customUrl);
      toast.success(t('settings.customUrlUpdated'));
    } catch (error) {
      console.error('Error updating custom URL:', error);
      toast.error(t('settings.customUrlError'));
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleCopyUrlToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(customUrl);
      toast.success(t('settings.customUrlCopied'));
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = customUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast.success(t('settings.customUrlCopied'));
    }
  };

  // Cloudflared Handler Functions
  const checkCloudflaredStatus = async () => {
    try {
      const response = await adminAPI.getCloudflaredStatus();
      setCloudflaredInstalled(response.data.installed);
    } catch (error) {
      console.error('Error checking cloudflared status:', error);
      setCloudflaredInstalled(false);
    }
  };

  const handleInstallCloudflared = async () => {
    setCloudflaredInstallLoading(true);
    try {
      const response = await adminAPI.installCloudflared();
      if (response.data.success) {
        toast.success(t('settings.cloudflaredInstalledSuccess'));
        setCloudflaredInstalled(true);
      } else {
        toast.error(t('settings.cloudflaredInstallError'));
      }
    } catch (error) {
      console.error('Error installing cloudflared:', error);
      toast.error(t('settings.cloudflaredInstallError'));
    } finally {
      setCloudflaredInstallLoading(false);
    }
  };

  const handleStartCloudflaredTunnel = async () => {
    setCloudflaredStartLoading(true);
    try {
      const response = await adminAPI.startCloudflaredTunnel();
      if (response.data.success) {
        toast.success(t('settings.cloudflaredStartedSuccess', { url: response.data.tunnelUrl }));
        setCustomUrl(response.data.tunnelUrl);
        await loadSettings();
      } else {
        toast.error(t('settings.cloudflaredStartError'));
      }
    } catch (error) {
      console.error('Error starting cloudflared tunnel:', error);
      toast.error(t('settings.cloudflaredStartError'));
    } finally {
      setCloudflaredStartLoading(false);
    }
  };

  const handleStopCloudflaredTunnel = async () => {
    setCloudflaredStopLoading(true);
    try {
      const response = await adminAPI.stopCloudflaredTunnel();
      if (response.data.success) {
        toast.success(t('settings.cloudflaredStoppedSuccess'));
      } else {
        toast.error(t('settings.cloudflaredStopError'));
      }
    } catch (error) {
      console.error('Error stopping cloudflared tunnel:', error);
      toast.error(t('settings.cloudflaredStopError'));
    } finally {
      setCloudflaredStopLoading(false);
    }
  };

  const handleUpdateOverlayTitle = async () => {
    setSettingsLoading(true);
    try {
      await adminAPI.updateOverlayTitle(overlayTitle);
      toast.success(t('settings.overlayTitleUpdated'));
    } catch (error) {
      console.error('Error updating overlay title:', error);
      toast.error(t('settings.overlayTitleError'));
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleUpdateYouTubeEnabled = async () => {
    setSettingsLoading(true);
    try {
      await adminAPI.updateYouTubeEnabled(youtubeEnabled);
      toast.success(t('settings.youtubeEnabledUpdated'));
    } catch (error) {
      console.error('Error updating YouTube setting:', error);
      toast.error(t('settings.youtubeEnabledError'));
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleUpdateAutoApproveSongs = async () => {
    setSettingsLoading(true);
    try {
      await adminAPI.updateAutoApproveSongs(autoApproveSongs);
      toast.success(t('settings.autoApproveSongsUpdated'));
    } catch (error) {
      console.error('Error updating auto approve songs:', error);
      toast.error(t('settings.autoApproveSongsError'));
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleUpdateUSDBSearchEnabled = async () => {
    setSettingsLoading(true);
    try {
      await adminAPI.updateUSDBSearchEnabled(usdbSearchEnabled);
      toast.success(t('settings.usdbSearchEnabledUpdated'));
    } catch (error) {
      console.error('Error updating USDB search enabled:', error);
      toast.error(t('settings.usdbSearchEnabledError'));
    } finally {
      setSettingsLoading(false);
    }
  };

  // USDB Management Handlers
  const fetchUSDBCredentials = async () => {
    try {
      const response = await adminAPI.getUSDBCredentials();
      setUsdbCredentials(response.data.credentials);
    } catch (error) {
      console.error('Error fetching USDB credentials:', error);
    }
  };

  const handleSaveUSDBCredentials = async () => {
    if (!usdbUsername.trim() || !usdbPassword.trim()) {
      toast.error(t('settings.fillAllFields'));
      return;
    }

    setUsdbLoading(true);
    try {
      await adminAPI.saveUSDBCredentials({ username: usdbUsername, password: usdbPassword });
      toast.success(t('settings.usdbCredentialsSavedSuccess'));
      setUsdbUsername('');
      setUsdbPassword('');
      await fetchUSDBCredentials();
    } catch (error: any) {
      console.error('Error saving USDB credentials:', error);
      toast.error(error.response?.data?.message || t('settings.usdbCredentialsSaveError'));
    } finally {
      setUsdbLoading(false);
    }
  };

  const handleDeleteUSDBCredentials = async () => {
    if (!window.confirm(t('settings.confirmDeleteUsdbCredentials'))) {
      return;
    }

    setUsdbLoading(true);
    try {
      await adminAPI.deleteUSDBCredentials();
      toast.success(t('settings.usdbCredentialsDeletedSuccess'));
      setUsdbCredentials(null);
    } catch (error: any) {
      console.error('Error deleting USDB credentials:', error);
      toast.error(error.response?.data?.message || t('settings.usdbCredentialsDeleteError'));
    } finally {
      setUsdbLoading(false);
    }
  };

  // File Songs Management Functions
  const handleUpdateFileSongsFolder = async () => {
    setSettingsLoading(true);
    try {
      const response = await adminAPI.setFileSongsFolder(fileSongsFolder, localServerPort);
      setFileSongs(response.data.fileSongs);
      toast.success(t('settings.songFolderUpdatedSuccess'));
    } catch (error) {
      console.error('Error updating file songs folder:', error);
      toast.error(t('settings.songFolderUpdateError'));
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleRescanFileSongs = async () => {
    setSettingsLoading(true);
    try {
      const response = await adminAPI.rescanFileSongs();
      setFileSongs(response.data.fileSongs);
      toast.success(t('settings.songsRescannedSuccess'));
    } catch (error) {
      console.error('Error rescanning file songs:', error);
      toast.error(t('settings.songsRescanError'));
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleRemoveFileSongs = async () => {
    setSettingsLoading(true);
    try {
      const response = await adminAPI.removeFileSongs();
      setFileSongs(response.data.fileSongs);
      toast.success(t('settings.allSongsRemovedSuccess'));
    } catch (error) {
      console.error('Error removing file songs:', error);
      toast.error(t('settings.songsRemoveError'));
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleCopyServerCommand = async () => {
    const command = generateLocalServerCommand();
    if (!command) {
      toast.error(t('settings.pleaseSpecifySongFolder'));
      return;
    }
    
    try {
      await navigator.clipboard.writeText(command);
      toast.success(t('settings.commandCopiedSuccess'));
    } catch (error) {
      console.error('Error copying command:', error);
      toast.error(t('settings.commandCopyError'));
    }
  };

  return (
    <SettingsSection>
      <SettingsTitle>⚙️ {t('settings.title')}</SettingsTitle>
      
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
        <SettingsLabel>{t('settings.regressionValue')}</SettingsLabel>
        <SettingsInput
          type="number"
          step="0.01"
          min="0"
          max="1"
            value={regressionValue}
            onChange={(e) => setRegressionValue(parseFloat(e.target.value))}
        />
        <Button 
          onClick={handleUpdateRegressionValue}
          disabled={settingsLoading}
          size="small"
          style={{ marginRight: '10px' }}
        >
          {settingsLoading ? t('settings.saving') : t('settings.save')}
        </Button>
        <SettingsDescription>
          {t('settings.regressionValueDescription')}
        </SettingsDescription>
      </SettingsCard>
      
      <HorizontalDivider />
      
      {/* URL & Cloudflared Section */}
      <SpecialSection>
        <SpecialTitle>🌐 {t('settings.customUrlAndCloudflared')}</SpecialTitle>
        
        {/* Custom URL */}
        <div style={{ marginBottom: '20px' }}>
          <SettingsLabel style={{ marginBottom: '10px', color: '#0c5460' }}>{t('settings.customUrl')}</SettingsLabel>
          <InputGroup>
            <SettingsInput
              type="url"
              placeholder="https://meine-domain.com"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              style={{ minWidth: '300px' }}
            />
            <Button 
              onClick={handleUpdateCustomUrl}
              disabled={settingsLoading}
              size="small"
              style={{ marginRight: '10px' }}
            >
              {settingsLoading ? t('settings.saving') : t('settings.save')}
            </Button>
            <Button 
              onClick={handleCopyUrlToClipboard}
              disabled={!customUrl}
              size="small"
              style={{ 
                backgroundColor: '#6c757d',
                color: 'white',
                opacity: !customUrl ? 0.6 : 1
              }}
            >
              📋 {t('settings.copyUrl')}
            </Button>
          </InputGroup>
          <SettingsDescription style={{ color: '#0c5460' }}>
            {t('settings.customUrlDescription')}
          </SettingsDescription>
        </div>
        
        {/* Cloudflared Integration */}
        <div style={{ paddingTop: '15px', borderTop: '1px solid #bee5eb' }}>
          <SettingsLabel style={{ marginBottom: '15px', color: '#0c5460' }}>{t('settings.cloudflaredTunnel')}:</SettingsLabel>
          <ButtonGroup>
            <Button 
              onClick={handleInstallCloudflared}
              disabled={cloudflaredInstalled || cloudflaredInstallLoading}
              variant="success"
              size="small"
              style={{ 
                backgroundColor: cloudflaredInstalled ? '#6c757d' : '#28a745',
                color: 'white',
                opacity: cloudflaredInstalled ? 0.6 : 1,
                marginRight: '10px'
              }}
            >
              {cloudflaredInstallLoading ? t('settings.installing') : t('settings.setupCloudflared')}
            </Button>
            
            <Button 
              onClick={handleStartCloudflaredTunnel}
              disabled={!cloudflaredInstalled || cloudflaredStartLoading}
              size="small"
              style={{ 
                backgroundColor: !cloudflaredInstalled ? '#6c757d' : '#007bff',
                color: 'white',
                opacity: !cloudflaredInstalled ? 0.6 : 1,
                marginRight: '10px'
              }}
            >
              {cloudflaredStartLoading ? t('settings.starting') : t('settings.startCloudflared')}
            </Button>
            
            <Button 
              onClick={handleStopCloudflaredTunnel}
              disabled={cloudflaredStopLoading}
              style={{ 
                backgroundColor: '#dc3545',
                color: 'white'
              }}
            >
              {cloudflaredStopLoading ? t('settings.stopping') : t('settings.stopTunnel')}
            </Button>
          </ButtonGroup>
          <SettingsDescription style={{ color: '#0c5460' }}>
            {t('settings.cloudflaredDescription')}
          </SettingsDescription>
        </div>
      </SpecialSection>
      
      <HorizontalDivider />
      
      {/* Overlay Title */}
      <SettingsCard>
        <SettingsLabel>{t('settings.overlayTitle')}</SettingsLabel>
        <SettingsInput
          type="text"
          placeholder="Willkommen beim Karaoke"
          value={overlayTitle}
          onChange={(e) => setOverlayTitle(e.target.value)}
          style={{ minWidth: '300px' }}
        />
        <Button 
          onClick={handleUpdateOverlayTitle}
          disabled={settingsLoading}
          size="small"
        >
          {settingsLoading ? t('settings.saving') : t('settings.save')}
        </Button>
        <SettingsDescription>
          {t('settings.overlayTitleDescription')}
        </SettingsDescription>
      </SettingsCard>
      
      <HorizontalDivider />

      {/* YouTube Enabled */}
      <SettingsCard>
        <SettingsLabel>{t('settings.youtubeEnabled')}</SettingsLabel>
        <CheckboxContainer>
          <CheckboxLabel>
            <CheckboxInput
              type="checkbox"
              checked={youtubeEnabled}
              onChange={(e) => setYoutubeEnabled(e.target.checked)}
            />
            <CheckboxText>
              {youtubeEnabled ? t('settings.enabled') : t('settings.disabled')}
            </CheckboxText>
          </CheckboxLabel>
          <Button 
            onClick={handleUpdateYouTubeEnabled}
            disabled={settingsLoading}
            size="small"
            style={{ marginLeft: '10px' }}
          >
            {settingsLoading ? t('settings.saving') : t('settings.save')}
          </Button>
        </CheckboxContainer>
        <SettingsDescription>
          {t('settings.youtubeEnabledDescription')}
        </SettingsDescription>
      </SettingsCard>
      
      <HorizontalDivider />
      
      {/* Auto-Approve Songs Setting */}
      <SettingsCard>
        <SettingsLabel>{t('settings.autoApproveSongs')}</SettingsLabel>
        <CheckboxContainer>
          <CheckboxLabel>
            <CheckboxInput
              type="checkbox"
              checked={autoApproveSongs}
              onChange={(e) => setAutoApproveSongs(e.target.checked)}
            />
            <CheckboxText>
              {autoApproveSongs ? t('settings.enabled') : t('settings.disabled')}
            </CheckboxText>
          </CheckboxLabel>
          <Button 
            onClick={handleUpdateAutoApproveSongs}
            disabled={settingsLoading}
            size="small"
            style={{ marginLeft: '10px' }}
          >
            {settingsLoading ? t('settings.saving') : t('settings.save')}
          </Button>
        </CheckboxContainer>
        <SettingsDescription>
          {t('settings.autoApproveSongsDescription')}
        </SettingsDescription>
      </SettingsCard>
      
      <HorizontalDivider />
      
      {/* USDB Search Enabled Setting */}
      <SettingsCard>
        <SettingsLabel>{t('settings.usdbSearchEnabled')}</SettingsLabel>
        <CheckboxContainer>
          <CheckboxLabel>
            <CheckboxInput
              type="checkbox"
              checked={usdbSearchEnabled}
              onChange={(e) => setUsdbSearchEnabled(e.target.checked)}
            />
            <CheckboxText>
              {usdbSearchEnabled ? t('settings.enabled') : t('settings.disabled')}
            </CheckboxText>
          </CheckboxLabel>
          <Button 
            onClick={handleUpdateUSDBSearchEnabled}
            disabled={settingsLoading}
            size="small"
            style={{ marginLeft: '10px' }}
          >
            {settingsLoading ? t('settings.saving') : t('settings.save')}
          </Button>
        </CheckboxContainer>
        <SettingsDescription>
          {t('settings.usdbSearchEnabledDescription')}
        </SettingsDescription>
      </SettingsCard>
      
      <HorizontalDivider />
      <SettingsCard>
        <SettingsLabel>{t('settings.usdbCredentials')}:</SettingsLabel>
        {usdbCredentials ? (
          <div style={{ marginBottom: '15px' }}>
            <StatusContainer>
              <StatusTitle>✅ {t('settings.usdbCredentialsSaved')}</StatusTitle>
              <StatusText>{t('settings.username')}: {usdbCredentials.username}</StatusText>
            </StatusContainer>
            <Button 
              onClick={handleDeleteUSDBCredentials}
              disabled={usdbLoading}
              type="danger"
              size="small"
              style={{ marginRight: '10px' }}
            >
              {usdbLoading ? t('settings.deleting') : t('settings.deleteCredentials')}
            </Button>
          </div>
        ) : (
          <div style={{ marginBottom: '15px' }}>
            <InputGroup>
              <SettingsInput
                type="text"
                placeholder={t('settings.usdbUsernamePlaceholder')}
                value={usdbUsername}
                onChange={(e) => setUsdbUsername(e.target.value)}
                style={{ minWidth: '200px' }}
              />
              <SettingsInput
                type="password"
                placeholder={t('settings.usdbPasswordPlaceholder')}
                value={usdbPassword}
                onChange={(e) => setUsdbPassword(e.target.value)}
                style={{ minWidth: '200px' }}
              />
              <Button 
                onClick={handleSaveUSDBCredentials}
                disabled={usdbLoading}
                size="small"
                style={{ marginRight: '10px' }}
              >
                {usdbLoading ? t('settings.saving') : t('settings.save')}
              </Button>
            </InputGroup>
          </div>
        )}
        <SettingsDescription>
          {t('settings.usdbCredentialsDescription')}
        </SettingsDescription>
      </SettingsCard>
      
      <HorizontalDivider />
      
      {/* File Songs */}
      <SettingsCard>
        <SettingsLabel>{t('settings.localSongFolder')}:</SettingsLabel>
        <SettingsInput
          type="text"
          placeholder="C:/songs"
          value={fileSongsFolder}
          onChange={(e) => setFileSongsFolder(e.target.value)}
          style={{ minWidth: '300px' }}
        />
        <ButtonGroup>
          <Button 
            onClick={handleUpdateFileSongsFolder}
            disabled={settingsLoading}
            size="small"
            style={{ marginRight: '10px' }}
          >
            {settingsLoading ? t('settings.saving') : t('settings.save')}
          </Button>
          <Button 
            onClick={handleRescanFileSongs}
            disabled={settingsLoading}
            size="small"
            style={{ backgroundColor: '#17a2b8', marginRight: '10px' }}
          >
            {settingsLoading ? t('settings.scanning') : t('settings.rescan')}
          </Button>
          <Button 
            onClick={handleRemoveFileSongs}
            disabled={settingsLoading}
            type="danger"
            size="small"
            style={{ marginRight: '10px' }}
          >
            {settingsLoading ? t('settings.removing') : t('settings.removeSongsFromList')}
          </Button>
        </ButtonGroup>
        <SettingsDescription>
          {t('settings.localSongFolderDescription')}
        </SettingsDescription>
        
        {/* Local Server Section */}
        {fileSongsFolder && (
          <SpecialSection>
            <SpecialTitle>🌐 {t('settings.localWebServerForVideos')}</SpecialTitle>
            <SpecialDescription>
              {t('settings.localWebServerDescription')}:
            </SpecialDescription>
            
            {/* Port Selection */}
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#333' }}>
                {t('settings.port')}:
              </label>
              <PortInput
                type="number"
                value={localServerPort}
                onChange={(e) => setLocalServerPort(parseInt(e.target.value) || 4000)}
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
                  <Button
                    key={key}
                    onClick={() => setLocalServerTab(key as any)}
                    variant={localServerTab === key ? 'primary' : 'default'}
                    size="small"
                    style={{ 
                      marginRight: '8px',
                      marginBottom: '8px',
                      backgroundColor: localServerTab === key ? '#007bff' : 'white',
                      color: localServerTab === key ? 'white' : '#333',
                      border: '1px solid #ccc'
                    }}
                  >
                    {label}
                    <TabDescription>{desc}</TabDescription>
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Command Display */}
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#333' }}>
                {t('settings.commandToCopy')}:
              </label>
              <CommandContainer>
                {generateLocalServerCommand()}
              </CommandContainer>
            </div>
            
            {/* Copy Button */}
            <button
              onClick={handleCopyServerCommand}
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
              📋 {t('settings.copyCommand')}
            </button>
          </SpecialSection>
        )}
      </SettingsCard>
    </SettingsSection>
  );
};

export default SettingsTab;
