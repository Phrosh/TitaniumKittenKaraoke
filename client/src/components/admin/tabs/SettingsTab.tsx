import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { adminAPI } from '../../../services/api';
import LanguageSelector from '../../LanguageSelector';
import Button from '../../shared/Button';
import { SettingsSection, SettingsTitle, SettingsCard, SettingsLabel, SettingsInput, SettingsDescription } from '../style';

// Custom hook für Debouncing
const useDebounce = (value: any, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

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

const SettingsSelect = styled.select`
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  min-width: 120px;
  background: #fff;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: #3498db;
    box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
  }
`;

const PayPalGuideBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(20, 12, 40, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  box-sizing: border-box;
`;

const PayPalGuidePanel = styled.div`
  background: #fff;
  border-radius: 12px;
  max-width: 720px;
  width: 100%;
  max-height: min(90vh, 880px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.25);
  border: 1px solid #d4c4f0;
`;

const PayPalGuideHeader = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid #e8e0f4;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
`;

const PayPalGuideTitle = styled.h2`
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  color: #2d1f4a;
`;

const PayPalGuideBody = styled.div`
  padding: 16px 20px;
  overflow-y: auto;
  font-size: 14px;
  line-height: 1.55;
  color: #333;
`;

const PayPalGuideSectionTitle = styled.h3`
  margin: 20px 0 10px;
  font-size: 1rem;
  font-weight: 600;
  color: #3d2a5c;
  &:first-of-type {
    margin-top: 0;
  }
`;

const PayPalGuideP = styled.p`
  margin: 0 0 12px;
`;

const PayPalGuideTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  th,
  td {
    border: 1px solid #e0d8ec;
    padding: 10px 12px;
    vertical-align: top;
    text-align: left;
  }
  th {
    background: #f5f0ff;
    font-weight: 600;
    color: #3d2a5c;
    width: 32%;
  }
`;

const PayPalGuideFooter = styled.div`
  padding: 12px 20px 16px;
  border-top: 1px solid #e8e0f4;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
`;

const PayPalGuideOpenButton = styled.button`
  background: none;
  border: none;
  padding: 0;
  margin: 0 0 12px;
  color: #5b3d9e;
  font-size: 14px;
  font-weight:600;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
  &:hover {
    color: #3d2a5c;
  }
`;

const PAYPAL_WEBHOOK_PATH = '/api/donations/paypal-webhook';

function buildPayPalWebhookUrl(publicBase: string): string | null {
  const base = publicBase.trim().replace(/\/+$/, '');
  if (!base) return null;
  return `${base}${PAYPAL_WEBHOOK_PATH}`;
}

const PAYPAL_GUIDE_ROWS: [string, string][] = [
  ['paypalPublicUrl', 'paypalGuideRowPublic'],
  ['paypalClientId', 'paypalGuideRowClientId'],
  ['paypalClientSecret', 'paypalGuideRowSecret'],
  ['paypalWebhookId', 'paypalGuideRowWebhook'],
  ['paypalCurrency', 'paypalGuideRowCurrency'],
  ['paypalDefaultAmount', 'paypalGuideRowAmount'],
  ['paypalBrandName', 'paypalGuideRowBrand'],
  ['paypalSandboxLabel', 'paypalGuideRowSandbox'],
];

const PAYPAL_CURRENCIES = [
  'EUR', 'USD', 'GBP', 'CHF', 'PLN', 'SEK', 'NOK', 'DKK', 'CZK', 'HUF',
  'RON', 'BGN', 'JPY', 'AUD', 'CAD', 'NZD', 'HKD', 'SGD', 'MXN', 'BRL', 'INR',
];

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
  
  // Debounced values für Auto-Save
  const debouncedRegressionValue = useDebounce(regressionValue, 2000);
  const debouncedCustomUrl = useDebounce(customUrl, 2000);
  const debouncedOverlayTitle = useDebounce(overlayTitle, 2000);
  
  // Flags um zu verhindern, dass Auto-Save beim ersten Laden ausgelöst wird
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Initiale Werte tracken um Änderungen zu erkennen
  const [initialValues, setInitialValues] = useState({
    regressionValue: 0.1,
    customUrl: '',
    overlayTitle: 'Willkommen beim Karaoke'
  });
  
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

  const [paypalPublicUrl, setPaypalPublicUrl] = useState('');
  const [paypalClientId, setPaypalClientId] = useState('');
  const [paypalClientSecret, setPaypalClientSecret] = useState('');
  const [paypalWebhookId, setPaypalWebhookId] = useState('');
  const [paypalCurrency, setPaypalCurrency] = useState('EUR');
  const [paypalDefaultAmount, setPaypalDefaultAmount] = useState<number>(5);
  const [paypalBrandName, setPaypalBrandName] = useState('');
  const [paypalSandboxEnabled, setPaypalSandboxEnabled] = useState(true);
  const [paypalSecretConfigured, setPaypalSecretConfigured] = useState(false);
  const [paypalSaveLoading, setPaypalSaveLoading] = useState(false);
  const [paypalGuideOpen, setPaypalGuideOpen] = useState(false);

  const paypalWebhookFullUrl = useMemo(() => buildPayPalWebhookUrl(paypalPublicUrl), [paypalPublicUrl]);

  // Load settings when component mounts
  useEffect(() => {
    loadSettings().then(() => {
      // Nach dem Laden der Settings Auto-Save aktivieren
      setTimeout(() => setIsInitialLoad(false), 1000);
    });
  }, []);

  // Auto-save für debounced Textfelder
  useEffect(() => {
    if (!isInitialLoad && debouncedRegressionValue !== initialValues.regressionValue) {
      handleUpdateRegressionValue(debouncedRegressionValue, true);
    }
  }, [debouncedRegressionValue, isInitialLoad, initialValues.regressionValue]);

  useEffect(() => {
    if (!isInitialLoad && debouncedCustomUrl !== initialValues.customUrl) {
      handleUpdateCustomUrl(debouncedCustomUrl, true);
    }
  }, [debouncedCustomUrl, isInitialLoad, initialValues.customUrl]);

  useEffect(() => {
    if (!isInitialLoad && debouncedOverlayTitle !== initialValues.overlayTitle) {
      handleUpdateOverlayTitle(debouncedOverlayTitle, true);
    }
  }, [debouncedOverlayTitle, isInitialLoad, initialValues.overlayTitle]);

  useEffect(() => {
    if (!paypalGuideOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPaypalGuideOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paypalGuideOpen]);

  // Auto-save für Checkboxen (sofort)
  const handleYouTubeEnabledChange = (checked: boolean) => {
    setYoutubeEnabled(checked);
    handleUpdateYouTubeEnabled(checked);
  };

  const handleAutoApproveSongsChange = (checked: boolean) => {
    setAutoApproveSongs(checked);
    handleUpdateAutoApproveSongs(checked);
  };

  const handleUsdbSearchEnabledChange = (checked: boolean) => {
    setUsdbSearchEnabled(checked);
    handleUpdateUSDBSearchEnabled(checked);
  };

  // Load all settings
  const loadSettings = useCallback(async () => {
    try {
      // Fetch settings including regression value and custom URL
      const settingsResponse = await adminAPI.getSettings();
      
      // Setze die geladenen Werte
      const loadedRegressionValue = settingsResponse.data.settings.regression_value ? 
        parseFloat(settingsResponse.data.settings.regression_value) : 0.1;
      const loadedCustomUrl = settingsResponse.data.settings.custom_url || '';
      const loadedOverlayTitle = settingsResponse.data.settings.overlay_title || 'Willkommen beim Karaoke';
      
      setRegressionValue(loadedRegressionValue);
      setCustomUrl(loadedCustomUrl);
      setOverlayTitle(loadedOverlayTitle);
      
      // Setze die initialen Werte für Vergleich
      setInitialValues({
        regressionValue: loadedRegressionValue,
        customUrl: loadedCustomUrl,
        overlayTitle: loadedOverlayTitle
      });
      if (settingsResponse.data.settings.youtube_enabled !== undefined) {
        setYoutubeEnabled(settingsResponse.data.settings.youtube_enabled === 'true');
      }
      if (settingsResponse.data.settings.auto_approve_songs !== undefined) {
        setAutoApproveSongs(settingsResponse.data.settings.auto_approve_songs === 'true');
      }
      if (settingsResponse.data.settings.usdb_search_enabled !== undefined) {
        setUsdbSearchEnabled(settingsResponse.data.settings.usdb_search_enabled === 'true');
      }

      const s = settingsResponse.data.settings;
      setPaypalPublicUrl(s.paypal_public_url || '');
      setPaypalClientId(s.paypal_client_id || '');
      setPaypalClientSecret('');
      setPaypalWebhookId(s.paypal_webhook_id || '');
      setPaypalCurrency((s.paypal_currency || 'EUR').toUpperCase());
      const pa = parseFloat(String(s.paypal_default_amount || '5'));
      setPaypalDefaultAmount(Number.isFinite(pa) ? pa : 5);
      setPaypalBrandName(s.paypal_brand_name || '');
      setPaypalSandboxEnabled(s.paypal_sandbox_enabled !== 'false');
      setPaypalSecretConfigured(s.paypal_client_secret_configured === 'true');
      
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
  const handleUpdateRegressionValue = async (value?: number, showToast: boolean = true) => {
    const valueToSave = value !== undefined ? value : regressionValue;
    setSettingsLoading(true);
    try {
      await adminAPI.updateRegressionValue(valueToSave);
      if (showToast) {
        toast.success(t('settings.regressionValueUpdated'));
      }
    } catch (error) {
      console.error('Error updating regression value:', error);
      toast.error(t('settings.regressionValueError'));
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleUpdateCustomUrl = async (value?: string, showToast: boolean = true) => {
    const valueToSave = value !== undefined ? value : customUrl;
    setSettingsLoading(true);
    try {
      await adminAPI.updateCustomUrl(valueToSave);
      if (showToast) {
        toast.success(t('settings.customUrlUpdated'));
      }
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

  const handleUpdateOverlayTitle = async (value?: string, showToast: boolean = true) => {
    const valueToSave = value !== undefined ? value : overlayTitle;
    setSettingsLoading(true);
    try {
      await adminAPI.updateOverlayTitle(valueToSave);
      if (showToast) {
        toast.success(t('settings.overlayTitleUpdated'));
      }
    } catch (error) {
      console.error('Error updating overlay title:', error);
      toast.error(t('settings.overlayTitleError'));
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleUpdateYouTubeEnabled = async (value?: boolean) => {
    const valueToSave = value !== undefined ? value : youtubeEnabled;
    setSettingsLoading(true);
    try {
      await adminAPI.updateYouTubeEnabled(valueToSave);
      toast.success(t('settings.youtubeEnabledUpdated'));
    } catch (error) {
      console.error('Error updating YouTube setting:', error);
      toast.error(t('settings.youtubeEnabledError'));
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleUpdateAutoApproveSongs = async (value?: boolean) => {
    const valueToSave = value !== undefined ? value : autoApproveSongs;
    setSettingsLoading(true);
    try {
      await adminAPI.updateAutoApproveSongs(valueToSave);
      toast.success(t('settings.autoApproveSongsUpdated'));
    } catch (error) {
      console.error('Error updating auto approve songs:', error);
      toast.error(t('settings.autoApproveSongsError'));
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleUpdateUSDBSearchEnabled = async (value?: boolean) => {
    const valueToSave = value !== undefined ? value : usdbSearchEnabled;
    setSettingsLoading(true);
    try {
      await adminAPI.updateUSDBSearchEnabled(valueToSave);
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

  const handleSavePayPalDonations = async () => {
    if (!paypalPublicUrl.trim() || !paypalClientId.trim()) {
      toast.error(t('settings.fillAllFields'));
      return;
    }
    setPaypalSaveLoading(true);
    try {
      const amt = Math.min(500, Math.max(1, Number(paypalDefaultAmount) || 5));
      await adminAPI.updatePayPalDonationSettings({
        paypalPublicUrl: paypalPublicUrl.trim(),
        paypalClientId: paypalClientId.trim(),
        paypalClientSecret: paypalClientSecret.trim() || undefined,
        paypalWebhookId: paypalWebhookId.trim(),
        paypalCurrency,
        paypalDefaultAmount: amt,
        paypalBrandName: paypalBrandName.trim(),
        paypalSandboxEnabled,
      });
      setPaypalClientSecret('');
      toast.success(t('settings.paypalSaved'));
      await loadSettings();
    } catch (error: any) {
      console.error('PayPal settings save:', error);
      toast.error(error.response?.data?.message || error.response?.data?.errors?.[0]?.msg || t('settings.paypalSaveError'));
    } finally {
      setPaypalSaveLoading(false);
    }
  };

  const handleCopyPayPalWebhookUrl = async () => {
    if (!paypalWebhookFullUrl) {
      toast.error(t('settings.paypalWebhookUrlEmpty'));
      return;
    }
    try {
      await navigator.clipboard.writeText(paypalWebhookFullUrl);
      toast.success(t('settings.paypalWebhookUrlCopied'));
    } catch (error) {
      console.error('Copy PayPal webhook URL:', error);
      toast.error(t('settings.commandCopyError'));
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
      
      {/* <HorizontalDivider /> */}
      
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
            {t('settings.customUrlDescription')} {settingsLoading && <span style={{color: '#007bff'}}>💾 Speichern...</span>}
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

      <SpecialSection style={{ background: '#f5f0ff', borderColor: '#d4c4f0' }}>
        <SpecialTitle style={{ color: '#3d2a5c' }}>💜 {t('settings.paypalDonationsTitle')}</SpecialTitle>
        <SpecialDescription style={{ color: '#3d2a5c' }}>
          {t('settings.paypalDonationsIntro')}
        </SpecialDescription>
        <PayPalGuideOpenButton type="button" onClick={() => setPaypalGuideOpen(true)}>
          {t('settings.paypalGuideOpenLink')}
        </PayPalGuideOpenButton>

        <div style={{ marginBottom: '16px' }}>
          <SettingsLabel style={{ color: '#3d2a5c' }}>{t('settings.paypalPublicUrl')}</SettingsLabel>
          <SettingsInput
            type="url"
            autoComplete="url"
            value={paypalPublicUrl}
            onChange={(e) => setPaypalPublicUrl(e.target.value)}
            placeholder="https://ihre-domain.de"
            style={{ minWidth: 'min(100%, 480px)', width: '100%', maxWidth: '560px' }}
          />
          <SettingsDescription style={{ color: '#5c4a78' }}>{t('settings.paypalPublicUrlHint')}</SettingsDescription>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <SettingsLabel style={{ color: '#3d2a5c' }}>{t('settings.paypalWebhookUrlLabel')}</SettingsLabel>
          <InputGroup>
            <SettingsInput
              type="text"
              readOnly
              aria-readonly="true"
              value={paypalWebhookFullUrl ?? ''}
              placeholder={t('settings.paypalWebhookUrlPlaceholder')}
              onFocus={(e) => e.target.select()}
              style={{
                flex: '1 1 280px',
                minWidth: '200px',
                maxWidth: '560px',
                background: '#faf8ff',
              }}
            />
            <Button
              type="button"
              onClick={handleCopyPayPalWebhookUrl}
              disabled={!paypalWebhookFullUrl}
              size="small"
              style={{
                backgroundColor: '#6c757d',
                color: 'white',
                opacity: !paypalWebhookFullUrl ? 0.6 : 1,
              }}
            >
              📋 {t('settings.copyUrl')}
            </Button>
          </InputGroup>
          <SettingsDescription style={{ color: '#5c4a78' }}>{t('settings.paypalWebhookUrlHint')}</SettingsDescription>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <SettingsLabel style={{ color: '#3d2a5c' }}>{t('settings.paypalClientId')}</SettingsLabel>
          <SettingsInput
            type="text"
            autoComplete="off"
            value={paypalClientId}
            onChange={(e) => setPaypalClientId(e.target.value)}
            style={{ minWidth: 'min(100%, 480px)', width: '100%', maxWidth: '560px' }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <SettingsLabel style={{ color: '#3d2a5c' }}>{t('settings.paypalClientSecret')}</SettingsLabel>
          <SettingsInput
            type="password"
            autoComplete="new-password"
            value={paypalClientSecret}
            onChange={(e) => setPaypalClientSecret(e.target.value)}
            placeholder={paypalSecretConfigured ? '••••••••' : ''}
            style={{ minWidth: 'min(100%, 480px)', width: '100%', maxWidth: '560px' }}
          />
          <SettingsDescription style={{ color: '#5c4a78' }}>
            {t('settings.paypalClientSecretHint')}
            {paypalSecretConfigured ? ` ${t('settings.paypalClientSecretConfigured')}` : ''}
          </SettingsDescription>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <SettingsLabel style={{ color: '#3d2a5c' }}>{t('settings.paypalWebhookId')}</SettingsLabel>
          <SettingsInput
            type="text"
            value={paypalWebhookId}
            onChange={(e) => setPaypalWebhookId(e.target.value)}
            style={{ minWidth: 'min(100%, 480px)', width: '100%', maxWidth: '560px' }}
          />
          <SettingsDescription style={{ color: '#5c4a78' }}>{t('settings.paypalWebhookHint')}</SettingsDescription>
        </div>

        <div style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-end' }}>
          <div>
            <SettingsLabel style={{ color: '#3d2a5c' }}>{t('settings.paypalCurrency')}</SettingsLabel>
            <SettingsSelect
              value={paypalCurrency}
              onChange={(e) => setPaypalCurrency(e.target.value)}
            >
              {!PAYPAL_CURRENCIES.includes(paypalCurrency) && paypalCurrency && (
                <option value={paypalCurrency}>{paypalCurrency}</option>
              )}
              {PAYPAL_CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </SettingsSelect>
          </div>
          <div>
            <SettingsLabel style={{ color: '#3d2a5c' }}>{t('settings.paypalDefaultAmount')}</SettingsLabel>
            <SettingsInput
              type="number"
              min={1}
              max={500}
              step="0.01"
              value={paypalDefaultAmount}
              onChange={(e) => setPaypalDefaultAmount(parseFloat(e.target.value) || 0)}
              style={{ width: '120px' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <SettingsLabel style={{ color: '#3d2a5c' }}>{t('settings.paypalBrandName')}</SettingsLabel>
          <SettingsInput
            type="text"
            value={paypalBrandName}
            onChange={(e) => setPaypalBrandName(e.target.value)}
            style={{ minWidth: 'min(100%, 400px)', width: '100%', maxWidth: '480px' }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <SettingsLabel style={{ color: '#3d2a5c' }}>{t('settings.paypalSandboxLabel')}</SettingsLabel>
          <CheckboxContainer>
            <CheckboxLabel>
              <CheckboxInput
                type="checkbox"
                checked={paypalSandboxEnabled}
                onChange={(e) => setPaypalSandboxEnabled(e.target.checked)}
              />
              <CheckboxText style={{ color: '#333' }}>
                {paypalSandboxEnabled ? t('settings.enabled') : t('settings.disabled')}
              </CheckboxText>
            </CheckboxLabel>
          </CheckboxContainer>
          <SettingsDescription style={{ color: '#5c4a78' }}>
            {paypalSandboxEnabled ? t('settings.paypalSandboxHint') : t('settings.paypalLiveHint')}
          </SettingsDescription>
        </div>

        <Button
          onClick={handleSavePayPalDonations}
          disabled={paypalSaveLoading}
          variant="success"
          size="small"
        >
          {paypalSaveLoading ? t('settings.saving') : t('settings.paypalSave')}
        </Button>
      </SpecialSection>

      {paypalGuideOpen && (
        <PayPalGuideBackdrop
          role="dialog"
          aria-modal="true"
          aria-labelledby="paypal-guide-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPaypalGuideOpen(false);
          }}
        >
          <PayPalGuidePanel onClick={(e) => e.stopPropagation()}>
            <PayPalGuideHeader>
              <PayPalGuideTitle id="paypal-guide-title">{t('settings.paypalGuideModalTitle')}</PayPalGuideTitle>
              <Button type="button" size="small" onClick={() => setPaypalGuideOpen(false)}>
                {t('settings.paypalGuideClose')}
              </Button>
            </PayPalGuideHeader>
            <PayPalGuideBody>
              <PayPalGuideSectionTitle>{t('settings.paypalGuideAccountTitle')}</PayPalGuideSectionTitle>
              <PayPalGuideP>{t('settings.paypalGuideAccountP1')}</PayPalGuideP>
              <PayPalGuideP>{t('settings.paypalGuideAccountP2')}</PayPalGuideP>
              <PayPalGuideP>{t('settings.paypalGuideAccountP3')}</PayPalGuideP>
              <PayPalGuideSectionTitle>{t('settings.paypalGuideMappingTitle')}</PayPalGuideSectionTitle>
              <PayPalGuideP>{t('settings.paypalGuideMappingIntro')}</PayPalGuideP>
              <PayPalGuideSectionTitle style={{ fontSize: '0.95rem', marginTop: '8px' }}>
                {t('settings.paypalWebhookUrlLabel')}
              </PayPalGuideSectionTitle>
              <InputGroup style={{ marginBottom: '12px' }}>
                <SettingsInput
                  type="text"
                  readOnly
                  aria-readonly="true"
                  value={paypalWebhookFullUrl ?? ''}
                  placeholder={t('settings.paypalWebhookUrlPlaceholder')}
                  onFocus={(e) => e.target.select()}
                  style={{
                    flex: '1 1 240px',
                    minWidth: '160px',
                    background: '#faf8ff',
                  }}
                />
                <Button
                  type="button"
                  onClick={handleCopyPayPalWebhookUrl}
                  disabled={!paypalWebhookFullUrl}
                  size="small"
                  style={{
                    backgroundColor: '#6c757d',
                    color: 'white',
                    opacity: !paypalWebhookFullUrl ? 0.6 : 1,
                  }}
                >
                  📋 {t('settings.copyUrl')}
                </Button>
              </InputGroup>
              <PayPalGuideP style={{ marginBottom: '16px', fontSize: '13px' }}>{t('settings.paypalWebhookUrlHint')}</PayPalGuideP>
              <PayPalGuideTable>
                <thead>
                  <tr>
                    <th scope="col">{t('settings.paypalGuideMappingColTkk')}</th>
                    <th scope="col">{t('settings.paypalGuideMappingColExplain')}</th>
                  </tr>
                </thead>
                <tbody>
                  {PAYPAL_GUIDE_ROWS.map(([labelKey, descKey]) => (
                    <tr key={labelKey}>
                      <td>{t(`settings.${labelKey}` as const)}</td>
                      <td>{t(`settings.${descKey}` as const)}</td>
                    </tr>
                  ))}
                </tbody>
              </PayPalGuideTable>
            </PayPalGuideBody>
            <PayPalGuideFooter>
              <a
                href="https://developer.paypal.com/dashboard/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginRight: 'auto', color: '#5b3d9e', fontWeight: 600 }}
              >
                {t('settings.paypalGuideDeveloperLink')} ↗
              </a>
              <Button type="button" variant="success" size="small" onClick={() => setPaypalGuideOpen(false)}>
                {t('settings.paypalGuideClose')}
              </Button>
            </PayPalGuideFooter>
          </PayPalGuidePanel>
        </PayPalGuideBackdrop>
      )}
      
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
        <SettingsDescription>
          {t('settings.overlayTitleDescription')} {settingsLoading && <span style={{color: '#007bff'}}>💾 Speichern...</span>}
        </SettingsDescription>
      </SettingsCard>
      
      {/* <HorizontalDivider /> */}

      {/* YouTube Enabled */}
      <SettingsCard>
        <SettingsLabel>{t('settings.youtubeEnabled')}</SettingsLabel>
        <CheckboxContainer>
          <CheckboxLabel>
            <CheckboxInput
              type="checkbox"
              checked={youtubeEnabled}
              onChange={(e) => handleYouTubeEnabledChange(e.target.checked)}
            />
            <CheckboxText>
              {youtubeEnabled ? t('settings.enabled') : t('settings.disabled')}
            </CheckboxText>
          </CheckboxLabel>
          {settingsLoading && <span style={{color: '#007bff', marginLeft: '10px'}}>💾 Speichern...</span>}
        </CheckboxContainer>
        <SettingsDescription>
          {t('settings.youtubeEnabledDescription')}
        </SettingsDescription>
      </SettingsCard>
      
      {/* <HorizontalDivider /> */}
      
      {/* Auto-Approve Songs Setting */}
      <SettingsCard>
        <SettingsLabel>{t('settings.autoApproveSongs')}</SettingsLabel>
        <CheckboxContainer>
          <CheckboxLabel>
            <CheckboxInput
              type="checkbox"
              checked={autoApproveSongs}
              onChange={(e) => handleAutoApproveSongsChange(e.target.checked)}
            />
            <CheckboxText>
              {autoApproveSongs ? t('settings.enabled') : t('settings.disabled')}
            </CheckboxText>
          </CheckboxLabel>
          {settingsLoading && <span style={{color: '#007bff', marginLeft: '10px'}}>💾 Speichern...</span>}
        </CheckboxContainer>
        <SettingsDescription>
          {t('settings.autoApproveSongsDescription')}
        </SettingsDescription>
      </SettingsCard>
      
      {/* <HorizontalDivider /> */}

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
        <SettingsDescription>
          {t('settings.regressionValueDescription')} {settingsLoading && <span style={{color: '#007bff'}}>💾 Speichern...</span>}
        </SettingsDescription>
      </SettingsCard>

      {/* <HorizontalDivider /> */}
      
      {/* USDB Search Enabled Setting */}
      <SettingsCard>
        <SettingsLabel>{t('settings.usdbSearchEnabled')}</SettingsLabel>
        <CheckboxContainer>
          <CheckboxLabel>
            <CheckboxInput
              type="checkbox"
              checked={usdbSearchEnabled}
              onChange={(e) => handleUsdbSearchEnabledChange(e.target.checked)}
            />
            <CheckboxText>
              {usdbSearchEnabled ? t('settings.enabled') : t('settings.disabled')}
            </CheckboxText>
          </CheckboxLabel>
          {settingsLoading && <span style={{color: '#007bff', marginLeft: '10px'}}>💾 Speichern...</span>}
        </CheckboxContainer>
        <SettingsDescription>
          {t('settings.usdbSearchEnabledDescription')}
        </SettingsDescription>
      </SettingsCard>
      
      {/* <HorizontalDivider /> */}
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
      
      {/* <HorizontalDivider /> */}
      
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
