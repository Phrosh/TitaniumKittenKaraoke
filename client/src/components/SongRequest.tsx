import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useSearchParams } from 'react-router-dom';
import { songAPI, donationAPI } from '../services/api';
import { SongRequestData } from '../types';
import { useTranslation } from 'react-i18next';
import Button from './shared/Button';

const Container = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
`;

const Card = styled.div`
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  padding: 40px;
  max-width: 500px;
  width: 100%;
`;

const Title = styled.h1`
  text-align: center;
  color: #333;
  margin-bottom: 30px;
  font-size: 2rem;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
`;

const Label = styled.label`
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
`;

const Input = styled.input`
  padding: 12px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.3s ease;

  &:focus {
    outline: none;
    border-color: #667eea;
  }
`;

const TextArea = styled.textarea`
  padding: 12px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 16px;
  resize: vertical;
  min-height: 100px;
  transition: border-color 0.3s ease;

  &:focus {
    outline: none;
    border-color: #667eea;
  }
`;


const Alert = styled.div<{ type: 'success' | 'error' | 'info' }>`
  padding: 15px;
  border-radius: 8px;
  margin: 20px 0;
  background: ${props => 
    props.type === 'success' ? '#d4edda' : 
    props.type === 'error' ? '#f8d7da' : 
    '#d1ecf1'
  };
  color: ${props => 
    props.type === 'success' ? '#155724' : 
    props.type === 'error' ? '#721c24' : 
    '#0c5460'
  };
  border: 1px solid ${props => 
    props.type === 'success' ? '#c3e6cb' : 
    props.type === 'error' ? '#f5c6cb' : 
    '#bee5eb'
  };
`;

const DonateAmountPanel = styled.div`
  margin-top: 8px;
  padding: 18px;
  background: #f8f7ff;
  border-radius: 12px;
  border: 1px solid #e0d8ec;
`;

const DonateAmountField = styled.input`
  width: 100%;
  box-sizing: border-box;
  padding: 16px;
  font-size: 2rem;
  font-weight: 700;
  text-align: center;
  border: 2px solid #667eea;
  border-radius: 12px;
  margin-bottom: 14px;
  color: #222;

  &:focus {
    outline: none;
    border-color: #4c5fd5;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.25);
  }
`;

const DonateQuickRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-bottom: 4px;
`;

const DonateQuickChip = styled.button<{ $active?: boolean }>`
  padding: 10px 14px;
  border-radius: 999px;
  border: 2px solid ${(p) => (p.$active ? '#667eea' : '#e1e5e9')};
  background: ${(p) => (p.$active ? '#eef0ff' : '#fff')};
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  color: #333;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const DonateStickyBar = styled.div<{ $visible: boolean }>`
  display: ${(p) => (p.$visible ? 'flex' : 'none')};
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 2500;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  background: rgba(255, 255, 255, 0.98);
  border-top: 1px solid #e1e5e9;
  box-shadow: 0 -6px 24px rgba(0, 0, 0, 0.08);
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
  align-items: center;
`;

const QRCodeContainer = styled.div`
  text-align: center;
  margin: 30px 0;
`;

const LocalSongsSection = styled.div`
  margin-top: 15px;
`;


const SongListModal = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: ${props => props.$isOpen ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const SongListContent = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px;
  max-width: 600px;
  width: 90%;
  max-height: 100vh;
  overflow-y: auto;
`;

const SongListHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const SongListTitle = styled.h3`
  margin: 0;
  color: #333;
`;


const SearchInput = styled.input`
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
  margin-bottom: 15px;
`;

const SongItem = styled.div`
  padding: 10px;
  border: 1px solid #eee;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  
  &:hover {
    background: #f8f9fa;
    border-color: #667eea;
  }
`;

const SongArtist = styled.div`
  font-weight: 600;
  color: #333;
  flex: 1;
  padding-right: 10px;
`;

const SongTitle = styled.div`
  color: #666;
  font-size: 14px;
  flex: 1;
  padding-left: 10px;
  border-left: 1px solid #eee;
`;

const QRCodeImage = styled.img`
  max-width: 200px;
  border-radius: 8px;
`;

// Format-Modal styled components
const FormatModal = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: ${props => props.$isOpen ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  z-index: 1001;
`;

const FormatModalContent = styled.div`
  background: white;
  border-radius: 12px;
  padding: 30px;
  max-width: 500px;
  width: 90%;
`;

const FormatModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const FormatModalTitle = styled.h3`
  margin: 0;
  color: #333;
`;


const FormatModalBody = styled.div`
  margin-bottom: 20px;
`;

const FormatModalText = styled.p`
  color: #666;
  margin-bottom: 20px;
  line-height: 1.5;
`;

const FormatModalInputs = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

const FormatModalRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const FormatModalInput = styled.input`
  padding: 12px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.3s ease;

  &:focus {
    outline: none;
    border-color: #667eea;
  }
`;

const FormatModalButtons = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
`;



const SongRequest: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [formData, setFormData] = useState<SongRequestData>({
    name: '',
    songInput: '',
    deviceId: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [deviceId, setDeviceId] = useState<string>('');
  const [showSongList, setShowSongList] = useState(false);
  const [serverVideos, setServerVideos] = useState<any[]>([]);
  const [ultrastarSongs, setUltrastarSongs] = useState<any[]>([]);
  const [fileSongs, setFileSongs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [youtubeEnabled, setYoutubeEnabled] = useState(true);
  const [usdbSearchEnabled, setUsdbSearchEnabled] = useState(false);
  const [withBackgroundVocals, setWithBackgroundVocals] = useState(false);
  const [ultrastarAudioSettings, setUltrastarAudioSettings] = useState<Record<string, string>>({});
  
  // USDB Search State
  const [usdbResults, setUsdbResults] = useState<any[]>([]);
  const [usdbLoading, setUsdbLoading] = useState(false);
  const [usdbTimeout, setUsdbTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Modal states für Format-Korrektur
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [formatModalArtist, setFormatModalArtist] = useState('');
  const [formatModalTitle, setFormatModalTitle] = useState('');
  const [pendingSongInput, setPendingSongInput] = useState('');
  const [randomExampleSong, setRandomExampleSong] = useState({ artist: 'Queen', title: 'Bohemian Rhapsody' });

  const [donationsEnabled, setDonationsEnabled] = useState(false);
  const [donateAmount, setDonateAmount] = useState('5.00');
  const [donateLoading, setDonateLoading] = useState(false);
  const [donationQuickAmounts, setDonationQuickAmounts] = useState<number[]>([]);
  const [donationCurrency, setDonationCurrency] = useState('EUR');
  const [donateAmountStepOpen, setDonateAmountStepOpen] = useState(false);
  const [donorThanksBanner, setDonorThanksBanner] = useState(
    () => typeof window !== 'undefined' && sessionStorage.getItem('karaokeDonationThanks') === '1'
  );

  const donationMoneyFmt = useMemo(() => {
    try {
      return new Intl.NumberFormat(i18n.language, { style: 'currency', currency: donationCurrency });
    } catch {
      return {
        format: (v: number) => `${v} ${donationCurrency}`,
      };
    }
  }, [i18n.language, donationCurrency]);

  useEffect(() => {
    donationAPI
      .getConfig()
      .then((r) => {
        setDonationsEnabled(!!r.data?.enabled);
        if (r.data?.defaultAmount) setDonateAmount(String(r.data.defaultAmount));
        if (Array.isArray(r.data?.quickAmounts)) setDonationQuickAmounts(r.data.quickAmounts);
        if (r.data?.currency) setDonationCurrency(String(r.data.currency));
      })
      .catch(() => setDonationsEnabled(false));
  }, []);

  useEffect(() => {
    if (!donationsEnabled) setDonateAmountStepOpen(false);
  }, [donationsEnabled]);

  useEffect(() => {
    const d = searchParams.get('donation');
    if (d === 'cancel') {
      setMessage({ type: 'info', text: t('songRequest.donateCancelled') });
      searchParams.delete('donation');
      setSearchParams(searchParams, { replace: true });
    } else if (d === 'error') {
      setMessage({ type: 'error', text: t('songRequest.donateError') });
      searchParams.delete('donation');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, t]);

  useEffect(() => {
    if (searchParams.get('donation') !== 'ok') return undefined;
    const ref = searchParams.get('ref');
    if (!ref) return undefined;

    let cancelled = false;
    const tick = async () => {
      try {
        const { data } = await donationAPI.getStatus(ref);
        if (cancelled) return;
        if (data.status === 'completed') {
          sessionStorage.setItem('karaokeDonationThanks', '1');
          setDonorThanksBanner(true);
          searchParams.delete('donation');
          searchParams.delete('ref');
          setSearchParams(searchParams, { replace: true });
        }
      } catch {
        /* ignore */
      }
    };

    tick();
    const id = window.setInterval(tick, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [searchParams, setSearchParams]);

  const payPalClientLocale = () => {
    if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
    return i18n.language || 'en-US';
  };

  const refreshDonationConfig = () => {
    donationAPI
      .getConfig()
      .then((r) => {
        if (r.data?.defaultAmount) setDonateAmount(String(r.data.defaultAmount));
        if (Array.isArray(r.data?.quickAmounts)) setDonationQuickAmounts(r.data.quickAmounts);
        if (r.data?.currency) setDonationCurrency(String(r.data.currency));
      })
      .catch(() => {});
  };

  const handleOpenDonateStep = () => {
    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: t('songRequest.donateNeedName') });
      return;
    }
    refreshDonationConfig();
    setDonateAmountStepOpen(true);
  };

  const handleProceedToPayPal = async () => {
    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: t('songRequest.donateNeedName') });
      return;
    }
    const normalized = String(donateAmount).trim().replace(',', '.');
    const amt = parseFloat(normalized);
    if (!Number.isFinite(amt) || amt < 1 || amt > 500) {
      setMessage({ type: 'error', text: t('songRequest.donateAmountInvalid') });
      return;
    }
    setDonateLoading(true);
    try {
      const { data } = await donationAPI.createOrder({
        donorName: formData.name.trim(),
        amount: amt.toFixed(2),
        locale: payPalClientLocale(),
      });
      if (data?.approvalUrl) {
        window.location.assign(data.approvalUrl);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || t('songRequest.donateError');
      setMessage({ type: 'error', text: msg });
    } finally {
      setDonateLoading(false);
    }
  };

  useEffect(() => {
    // Generate or retrieve device ID
    const storedDeviceId = localStorage.getItem('karaokeDeviceId');
    if (storedDeviceId) {
      setDeviceId(storedDeviceId);
      setFormData(prev => ({ ...prev, deviceId: storedDeviceId }));
    } else {
      // Generate new device ID (3 random letters)
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let newDeviceId = '';
      for (let i = 0; i < 3; i++) {
        newDeviceId += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      setDeviceId(newDeviceId);
      setFormData(prev => ({ ...prev, deviceId: newDeviceId }));
      localStorage.setItem('karaokeDeviceId', newDeviceId);
    }

    // Generate QR code
    generateQRCode();
  }, []);

  useEffect(() => {
    // Load YouTube enabled setting and songs
    const loadInitialData = async () => {
      try {
        const response = await songAPI.getYouTubeEnabled();
        const youtubeEnabledValue = response.data.settings.youtube_enabled;
        setYoutubeEnabled(youtubeEnabledValue === 'true' || youtubeEnabledValue === undefined);
      } catch (error) {
        console.error('Error loading YouTube setting:', error);
        // Default to true if error
        setYoutubeEnabled(true);
      }

      // Load USDB search enabled setting
      try {
        const usdbResponse = await songAPI.getUSDBSearchEnabled();
        const usdbSearchEnabledValue = usdbResponse.data.settings.usdb_search_enabled;
        setUsdbSearchEnabled(usdbSearchEnabledValue === 'true');
      } catch (error) {
        console.error('Error loading USDB search setting:', error);
        // Default to false if error
        setUsdbSearchEnabled(false);
      }

      // Load songs for random examples
      try {
        const [localResponse, ultrastarResponse, fileResponse] = await Promise.all([
          songAPI.getServerVideos(),
          songAPI.getUltrastarSongs(),
          songAPI.getFileSongs()
        ]);
        
        const serverVideos = localResponse.data.videos || [];
        const ultrastarSongs = ultrastarResponse.data.songs || [];
        const fileSongs = fileResponse.data.fileSongs || [];
        
        // Try to get invisible songs, but don't fail if it doesn't work
        let invisibleSongs = [];
        try {
          const invisibleResponse = await songAPI.getInvisibleSongs();
          invisibleSongs = invisibleResponse.data.invisibleSongs || [];
        } catch (invisibleError) {
          console.warn('Could not load invisible songs, continuing without filter:', invisibleError);
        }
        
        // Combine and deduplicate songs
        const allSongs = [...fileSongs];
        
        // Add server videos
        serverVideos.forEach((serverVideo: any) => {
          const exists = allSongs.some(song => 
            song.artist.toLowerCase() === serverVideo.artist.toLowerCase() &&
            song.title.toLowerCase() === serverVideo.title.toLowerCase()
          );
          if (!exists) {
            allSongs.push(serverVideo);
          }
        });
        
        // Add ultrastar songs
        ultrastarSongs.forEach((ultrastarSong: any) => {
          const exists = allSongs.some(song => 
            song.artist.toLowerCase() === ultrastarSong.artist.toLowerCase() &&
            song.title.toLowerCase() === ultrastarSong.title.toLowerCase()
          );
          if (!exists) {
            allSongs.push(ultrastarSong);
          }
        });
        
        // Filter out invisible songs (if we have the list)
        const visibleSongs = allSongs.filter(song => {
          return !invisibleSongs.some((invisible: any) => 
            invisible.artist.toLowerCase() === song.artist.toLowerCase() &&
            invisible.title.toLowerCase() === song.title.toLowerCase()
          );
        });
        
        // Sort alphabetically by artist, then by title
        visibleSongs.sort((a, b) => {
          const artistA = a.artist.toLowerCase();
          const artistB = b.artist.toLowerCase();
          if (artistA !== artistB) {
            return artistA.localeCompare(artistB);
          }
          return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
        });
        
        setServerVideos(visibleSongs);
        setUltrastarSongs(ultrastarSongs);
        setFileSongs(fileSongs);
        
        // Set random example song
        if (visibleSongs.length > 0) {
          const randomIndex = Math.floor(Math.random() * visibleSongs.length);
          const randomSong = visibleSongs[randomIndex];
          setRandomExampleSong({ artist: randomSong.artist, title: randomSong.title });
        }
      } catch (error) {
        console.error('Error loading songs for examples:', error);
      }
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    // Load Ultrastar audio settings
    const loadUltrastarAudioSettings = async () => {
      try {
        const response = await songAPI.getUltrastarAudioSettings();
        const audioSettings = response.data.ultrastarAudioSettings || [];
        
        // Convert to lookup object
        const audioSettingsMap: Record<string, string> = {};
        audioSettings.forEach((setting: any) => {
          const key = `${setting.artist}-${setting.title}`;
          audioSettingsMap[key] = setting.audio_preference;
        });
        setUltrastarAudioSettings(audioSettingsMap);
      } catch (error) {
        console.error('Error loading ultrastar audio settings:', error);
      }
    };

    loadUltrastarAudioSettings();
  }, []);


  const generateQRCode = async () => {
    try {
      const qrData = await songAPI.getQRData();
      // Use the data URL generated by the backend
      if (qrData.data.qrCodeDataUrl) {
        setQrCodeDataUrl(qrData.data.qrCodeDataUrl);
      } else {
        // Fallback to external API
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData.data.url)}&format=png&ecc=M&margin=1`;
        setQrCodeDataUrl(qrCodeUrl);
      }
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  // YouTube-Link-Erkennung
  const isYouTubeLink = (input: string): boolean => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i;
    return youtubeRegex.test(input.trim());
  };

  // Validierung des Songtitel-Formats
  const isValidSongFormat = (input: string): boolean => {
    if (!input.trim()) return false;
    if (isYouTubeLink(input)) return true; // YouTube-Links sind immer gültig
    
    // Prüfe auf Format "Interpret - Songname"
    const parts = input.split(' - ');
    return parts.length >= 2 && parts[0].trim() !== '' && parts.slice(1).join(' - ').trim() !== '';
  };

  // Zufälligen Beispiel-Song aus verfügbaren Songs auswählen
  const getRandomExampleSong = () => {
    const allSongs = [...serverVideos, ...ultrastarSongs, ...fileSongs];
    if (allSongs.length > 0) {
      const randomIndex = Math.floor(Math.random() * allSongs.length);
      const randomSong = allSongs[randomIndex];
      return { artist: randomSong.artist, title: randomSong.title };
    }
    return { artist: 'Queen', title: 'Bohemian Rhapsody' }; // Fallback
  };

  // USDB Search Functions
  const triggerUSDBSearch = (searchTerm: string) => {
    if (!usdbSearchEnabled || !searchTerm.trim()) {
      setUsdbResults([]);
      return;
    }

    // Clear existing timeout
    if (usdbTimeout) {
      clearTimeout(usdbTimeout);
    }

    // Show loading state immediately
    setUsdbLoading(true);
    setUsdbResults([]);

    // Set new timeout
    const timeout = setTimeout(() => {
      performUSDBSearch(searchTerm);
    }, 1000); // 1 second delay

    setUsdbTimeout(timeout);
  };

  const performUSDBSearch = async (searchTerm: string) => {
    if (!usdbSearchEnabled || !searchTerm.trim()) {
      setUsdbResults([]);
      setUsdbLoading(false);
      return;
    }

    try {
      // Use public songAPI for USDB search instead of adminAPI
      console.log('🌐 Starting USDB search for artist and title:', searchTerm);
      
      // Perform two separate searches: one for artist, one for title
      const [artistResponse, titleResponse] = await Promise.all([
        songAPI.searchUSDB(
          searchTerm.trim(),
          undefined, // No specific title
          10 // Limit to 10 results per search
        ),
        songAPI.searchUSDB(
          undefined, // No specific artist
          searchTerm.trim(),
          10 // Limit to 10 results per search
        )
      ]);

      console.log('🎤 Artist search results:', artistResponse.data.songs?.length || 0);
      console.log('🎵 Title search results:', titleResponse.data.songs?.length || 0);

      // Combine results and remove duplicates
      const artistSongs = artistResponse.data.songs || [];
      const titleSongs = titleResponse.data.songs || [];
      
      // Create a map to track unique songs by artist-title combination
      const uniqueSongs = new Map();
      
      // Add artist search results
      artistSongs.forEach((song: any) => {
        const key = `${song.artist}-${song.title}`.toLowerCase();
        uniqueSongs.set(key, song);
      });
      
      // Add title search results (will overwrite duplicates)
      titleSongs.forEach((song: any) => {
        const key = `${song.artist}-${song.title}`.toLowerCase();
        uniqueSongs.set(key, song);
      });
      
      // Convert back to array and limit to 20 total results
      const combinedResults = Array.from(uniqueSongs.values()).slice(0, 20);
      
      console.log('🎯 Combined USDB results:', combinedResults.length);
      setUsdbResults(combinedResults);
    } catch (error) {
      console.error('💥 Error searching USDB:', error);
      setUsdbResults([]);
    } finally {
      setUsdbLoading(false);
    }
  };

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (usdbTimeout) {
        clearTimeout(usdbTimeout);
      }
    };
  }, [usdbTimeout]);

  // USDB search for song list
  useEffect(() => {
    if (usdbSearchEnabled && searchTerm.trim()) {
      triggerUSDBSearch(searchTerm);
    } else {
      setUsdbResults([]);
    }
  }, [searchTerm, usdbSearchEnabled]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validierung des Songtitel-Formats
    if (!isValidSongFormat(formData.songInput)) {
      // Öffne Modal für Format-Korrektur
      setPendingSongInput(formData.songInput);
      
      // Leere Felder - keine Vorausfüllung
      setFormatModalArtist('');
      setFormatModalTitle('');
      
      // Generiere neuen zufälligen Beispiel-Song
      const exampleSong = getRandomExampleSong();
      setRandomExampleSong(exampleSong);
      
      setShowFormatModal(true);
      return;
    }
    
    setLoading(true);
    setMessage(null);

    try {
      const requestData = {
        ...formData,
        withBackgroundVocals: isUltrastarSong() ? withBackgroundVocals : undefined
      };
      
      const response = await songAPI.requestSong(requestData);
      
      // Check if song requires approval
      if (response.data.requiresApproval) {
        setMessage({
          type: 'info',
          text: response.data.message || t('songRequest.submittedForApproval')
        });
      } else {
        setMessage({
          type: 'success',
          text: t('songRequest.songAddedSuccessfully', { songTitle: response.data.song.title })
        });
      }
      
      // Reset form - keep name, clear only song input and background vocals
      setFormData(prev => ({ ...prev, songInput: '' }));
      setWithBackgroundVocals(false);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || t('songRequest.errorAddingSong')
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSongList = async () => {
    // Songs sind bereits geladen, öffne einfach das Modal
    setShowSongList(true);
  };

  const handleCloseSongList = () => {
    setShowSongList(false);
    setSearchTerm('');
  };

  const handleSelectSong = (video: any) => {
    const songInput = `${video.artist} - ${video.title}`;
    setFormData(prev => ({ ...prev, songInput }));
    setWithBackgroundVocals(false); // Reset checkbox when selecting new song
    handleCloseSongList();
  };

  const handleSelectUSDBSong = (song: any) => {
    const songInput = `${song.artist} - ${song.title}`;
    setFormData(prev => ({ ...prev, songInput }));
    setWithBackgroundVocals(false); // Reset checkbox when selecting new song
    setUsdbResults([]); // Clear USDB results after selection
  };

  // Handler für Format-Modal
  const handleFormatModalConfirm = () => {
    if (formatModalArtist.trim() && formatModalTitle.trim()) {
      const correctedInput = `${formatModalArtist.trim()} - ${formatModalTitle.trim()}`;
      setFormData(prev => ({ ...prev, songInput: correctedInput }));
      setShowFormatModal(false);
      setFormatModalArtist('');
      setFormatModalTitle('');
      setPendingSongInput('');
    }
  };

  const handleFormatModalCancel = () => {
    setShowFormatModal(false);
    setFormatModalArtist('');
    setFormatModalTitle('');
    setPendingSongInput('');
  };

  // Check if the selected song is an Ultrastar song
  const isUltrastarSong = () => {
    if (!formData.songInput) return false;
    return ultrastarSongs.some(song => 
      `${song.artist} - ${song.title}` === formData.songInput
    );
  };

  // Combine all songs including USDB results (memoized – nicht von formData abhängig, damit Tippen nicht die ganze Liste neu berechnet)
  const allSongs = useMemo(
    () => [...serverVideos, ...ultrastarSongs, ...fileSongs],
    [serverVideos, ultrastarSongs, fileSongs]
  );

  const songsWithUSDB = useMemo(
    () => (searchTerm.trim() && usdbSearchEnabled ? [...allSongs, ...usdbResults] : allSongs),
    [allSongs, searchTerm, usdbSearchEnabled, usdbResults]
  );

  const filteredVideos = useMemo(() => {
    return songsWithUSDB.filter((video: any) => {
      const searchLower = searchTerm.toLowerCase();
      const fullSongName = `${video.artist} - ${video.title}`.toLowerCase();

      if (searchLower.includes(' - ')) {
        const [searchArtist, searchTitle] = searchLower.split(' - ').map((s: string) => s.trim());
        const videoArtist = video.artist.toLowerCase();
        const videoTitle = video.title.toLowerCase();
        return videoArtist.includes(searchArtist) && videoTitle.includes(searchTitle);
      }
      return (
        video.artist.toLowerCase().includes(searchLower) ||
        video.title.toLowerCase().includes(searchLower) ||
        fullSongName.includes(searchLower)
      );
    });
  }, [songsWithUSDB, searchTerm]);

  const uniqueFilteredVideos = useMemo(
    () =>
      filteredVideos.filter(
        (video: any, index: number, self: any[]) =>
          index ===
          self.findIndex(
            (v: any) =>
              v.artist.toLowerCase() === video.artist.toLowerCase() &&
              v.title.toLowerCase() === video.title.toLowerCase()
          )
      ),
    [filteredVideos]
  );

  const groupedSongs = useMemo(() => {
    const getFirstLetter = (artist: string) => {
      const firstChar = artist.charAt(0).toUpperCase();
      if (/[A-Z]/.test(firstChar)) return firstChar;
      if (/[0-9]/.test(firstChar)) return '#';
      return '#';
    };
    return uniqueFilteredVideos.reduce((groups: Record<string, any[]>, song: any) => {
      const letter = getFirstLetter(song.artist);
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(song);
      return groups;
    }, {});
  }, [uniqueFilteredVideos]);

  const sortedGroups = useMemo(() => Object.keys(groupedSongs).sort(), [groupedSongs]);

  const donateAmtNum = parseFloat(String(donateAmount).replace(',', '.'));
  const donateAmtValid = Number.isFinite(donateAmtNum) && donateAmtNum >= 1 && donateAmtNum <= 500;

  return (
    <>
    <Container style={{ paddingBottom: donateAmountStepOpen ? 96 : 20 }}>
      <Card>
        {donateAmountStepOpen && donationsEnabled ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div
                style={{
                  fontSize: '1.45rem',
                  fontWeight: 700,
                  color: '#3d2a5c',
                  marginBottom: '10px',
                  lineHeight: 1.3,
                }}
              >
                {t('songRequest.donateAmountTitle')}
              </div>
              <p style={{ margin: 0, fontSize: '15px', color: '#555', lineHeight: 1.4 }}>
                {t('songRequest.donateAsName', { name: formData.name.trim() })}
              </p>
            </div>
            {message && (
              <Alert type={message.type}>
                {message.text}
              </Alert>
            )}
            <DonateAmountPanel style={{ marginTop: message ? 12 : 0 }}>
              <Label htmlFor="donateAmountField" style={{ textAlign: 'center', display: 'block' }}>
                {t('songRequest.donateAmountLabel')}
              </Label>
              <DonateAmountField
                id="donateAmountField"
                inputMode="decimal"
                autoComplete="off"
                value={donateAmount}
                onChange={(e) => setDonateAmount(e.target.value)}
              />
              {donationQuickAmounts.length > 0 && (
                <>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px', textAlign: 'center' }}>
                    {t('songRequest.donateQuickPick')}
                  </div>
                  <DonateQuickRow>
                    {donationQuickAmounts.map((q, qi) => (
                      <DonateQuickChip
                        key={`${qi}-${q}`}
                        type="button"
                        $active={
                          Number.isFinite(donateAmtNum) && Math.abs(donateAmtNum - q) < 0.0001
                        }
                        onClick={() => setDonateAmount(Number.isInteger(q) ? String(q) : q.toFixed(2))}
                      >
                        {donationMoneyFmt.format(q)}
                      </DonateQuickChip>
                    ))}
                  </DonateQuickRow>
                </>
              )}
            </DonateAmountPanel>
          </>
        ) : (
          <>
            <Form onSubmit={handleSubmit}>
              <FormGroup>
                <Label htmlFor="name">{t('songRequest.yourName')}:</Label>
                <Input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder={t('songRequest.namePlaceholder')}
                />
              </FormGroup>

              <FormGroup style={{ marginBottom: '-10px' }}>
                <Label htmlFor="songInput">{t('songRequest.songRequest')}:</Label>
                {youtubeEnabled ? (
                  <Input
                    type="text"
                    id="songInput"
                    name="songInput"
                    value={formData.songInput}
                    onChange={handleInputChange}
                    required
                    placeholder={t('songRequest.songInputPlaceholder')}
                  />
                ) : (
                  <div
                    style={{
                      padding: '12px',
                      border: '2px solid #e1e5e9',
                      borderRadius: '8px',
                      background: '#f8f9fa',
                      fontSize: '16px',
                      color: formData.songInput ? '#333' : '#666',
                      fontWeight: formData.songInput ? '500' : 'normal',
                      fontStyle: formData.songInput ? 'normal' : 'italic',
                      minHeight: '48px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {formData.songInput || t('songRequest.selectFromSongList')}
                  </div>
                )}
              </FormGroup>

              <LocalSongsSection>
                {youtubeEnabled && (
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px', marginTop: '-10px' }}>
                    {t('songRequest.orSelectFromList')}
                  </div>
                )}
                <Button
                  onClick={handleOpenSongList}
                  variant="success"
                  size="small"
                  style={{ marginBottom: '15px' }}
                >
                  🎵 {t('songRequest.openSongList')}
                </Button>
              </LocalSongsSection>

              {/* Background Vocals Checkbox - only show for Ultrastar songs with "choice" setting */}
              {isUltrastarSong() &&
                (() => {
                  const songKey = `${formData.songInput.split(' - ')[0]}-${formData.songInput.split(' - ').slice(1).join(' - ')}`;
                  const audioPreference = ultrastarAudioSettings[songKey];
                  return !audioPreference || audioPreference === 'choice';
                })() && (
                  <FormGroup>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        id="withBackgroundVocals"
                        checked={withBackgroundVocals}
                        onChange={(e) => setWithBackgroundVocals(e.target.checked)}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <Label htmlFor="withBackgroundVocals" style={{ marginBottom: 0, cursor: 'pointer' }}>
                        {t('songRequest.withBackgroundVocals')}
                      </Label>
                    </div>
                  </FormGroup>
                )}

              {message && (
                <Alert type={message.type}>
                  {message.text}
                </Alert>
              )}

              <Button disabled={loading || !formData.name.trim() || !formData.songInput.trim()}>
                {loading ? t('songRequest.adding') : t('songRequest.addSong')}
              </Button>
            </Form>

            {donorThanksBanner && (
              <Alert type="success">
                {t('songRequest.donateThankYouSession')}
              </Alert>
            )}

            {donationsEnabled && (
              <>
                <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid #e1e5e9' }} />
                <div style={{ textAlign: 'center' }}>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={handleOpenDonateStep}
                    disabled={!formData.name.trim()}
                    style={{ width: '100%' }}
                  >
                    {`💜 ${t('songRequest.donateButton')}`}
                  </Button>
                  <p style={{ fontSize: '13px', color: '#666', marginTop: '10px', lineHeight: 1.4 }}>
                    {t('songRequest.donateHint')}
                  </p>
                </div>
              </>
            )}

            <QRCodeContainer>
              <h3>{t('songRequest.qrCodeForOtherDevices')}</h3>
              {qrCodeDataUrl && <QRCodeImage src={qrCodeDataUrl} alt="QR Code" />}
            </QRCodeContainer>
          </>
        )}
      </Card>
    </Container>

    <DonateStickyBar $visible={donateAmountStepOpen}>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          setDonateAmountStepOpen(false);
          refreshDonationConfig();
        }}
        disabled={donateLoading}
      >
        {t('songRequest.donateBack')}
      </Button>
      <Button
        type="button"
        onClick={handleProceedToPayPal}
        disabled={donateLoading || !donateAmtValid || !formData.name.trim()}
      >
        {donateLoading ? t('songRequest.donateRedirecting') : t('songRequest.donateContinuePayPal')}
      </Button>
    </DonateStickyBar>

      {/* Song List Modal */}
      <SongListModal $isOpen={showSongList}>
        <SongListContent>
          <SongListHeader>
            <SongListTitle>🎵 {t('songRequest.allSongs')}</SongListTitle>
            <Button 
              onClick={handleCloseSongList}
              type="default"
              size="small"
              style={{ background: 'none', border: 'none', fontSize: '24px', padding: '0', minWidth: 'auto' }}
            >
              ×
            </Button>
          </SongListHeader>
          
          <SearchInput
            type="text"
            placeholder={t('songRequest.searchSongs')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          
          {/* USDB Search Status */}
          {/* {usdbSearchEnabled && searchTerm.trim() && (
            <div style={{ 
              fontSize: '12px', 
              color: '#666', 
              marginBottom: '10px',
              padding: '8px',
              backgroundColor: '#f8f9fa',
              border: '1px solid #ddd',
              borderRadius: '4px',
              textAlign: 'center'
            }}>
              {usdbLoading ? (
                <>🔍 {t('songRequest.usdbSearching')}</>
              ) : usdbResults.length > 0 ? (
                <>✅ {t('songRequest.usdbResults', { count: usdbResults.length })}</>
              ) : (
                <>ℹ️ Keine USDB-Ergebnisse gefunden</>
              )}
            </div>
          )} */}
          
          <div style={{ display: 'flex', padding: '8px 10px', background: '#f8f9fa', borderRadius: '8px', marginBottom: '10px', fontSize: '12px', fontWeight: '600', color: '#666' }}>
            <div style={{ flex: 1, paddingRight: '10px' }}>{t('songRequest.artist').toUpperCase()}</div>
            <div style={{ flex: 1, paddingLeft: '10px', borderLeft: '1px solid #eee' }}>{t('songRequest.songTitle').toUpperCase()}</div>
          </div>
          
          <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {uniqueFilteredVideos.length > 0 ? (
              sortedGroups.map((letter) => (
                <div key={letter}>
                  <div style={{
                    position: 'sticky',
                    top: 0,
                    background: '#adb5bd',
                    color: 'white',
                    padding: '8px 15px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    zIndex: 10,
                    borderBottom: '2px solid #9ca3af'
                  }}>
                    {letter}
                  </div>
                  {groupedSongs[letter].map((video: any, index: number) => {
                    const isUSDBSong = usdbResults.some(usdbSong => 
                      usdbSong.artist === video.artist && usdbSong.title === video.title
                    );
                    return (
                      <SongItem 
                        key={`${letter}-${index}`} 
                        onClick={() => handleSelectSong(video)}
                        style={{
                          backgroundColor: isUSDBSong ? '#e3f2fd' : undefined,
                          borderLeft: isUSDBSong ? '4px solid #2196f3' : undefined
                        }}
                      >
                        <SongArtist>
                          {video.artist}
                          {isUSDBSong && <span style={{ fontSize: '10px', color: '#2196f3', marginLeft: '5px' }}>🌐</span>}
                        </SongArtist>
                        <SongTitle>{video.title}</SongTitle>
                      </SongItem>
                    );
                  })}
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                {searchTerm ? t('songRequest.noSongsFound') : t('songRequest.noSongsAvailable')}
              </div>
            )}
          </div>
        </SongListContent>
      </SongListModal>

      {/* Format-Korrektur Modal */}
      <FormatModal $isOpen={showFormatModal}>
        <FormatModalContent>
          <FormatModalHeader>
            <FormatModalTitle>🎵 {t('songRequest.correctSongTitleFormat')}</FormatModalTitle>
            <Button 
              onClick={handleFormatModalCancel}
              type="default"
              size="small"
              style={{ background: 'none', border: 'none', fontSize: '24px', padding: '0', minWidth: 'auto' }}
            >
              ×
            </Button>
          </FormatModalHeader>
          
          <FormatModalBody>
            <FormatModalText>
              {t('songRequest.songTitleFormatDescription')}
              {pendingSongInput && (
                <>
                  <br /><br />
                  <strong>{t('songRequest.entered')}:</strong> "{pendingSongInput}"
                </>
              )}
            </FormatModalText>
            
            <FormatModalInputs>
              <FormatModalRow>
                <Label htmlFor="formatModalArtist" style={{ marginBottom: 0, minWidth: '80px' }}>{t('songRequest.artist')}:</Label>
                <FormatModalInput
                  type="text"
                  id="formatModalArtist"
                  value={formatModalArtist}
                  onChange={(e) => setFormatModalArtist(e.target.value)}
                  placeholder={t('songRequest.exampleArtist', { artist: randomExampleSong.artist })}
                  autoFocus
                />
              </FormatModalRow>
              
              <FormatModalRow>
                <Label htmlFor="formatModalTitle" style={{ marginBottom: 0, minWidth: '80px' }}>{t('songRequest.songTitle')}:</Label>
                <FormatModalInput
                  type="text"
                  id="formatModalTitle"
                  value={formatModalTitle}
                  onChange={(e) => setFormatModalTitle(e.target.value)}
                  placeholder={t('songRequest.exampleTitle', { title: randomExampleSong.title })}
                />
              </FormatModalRow>
            </FormatModalInputs>
          </FormatModalBody>
          
          <FormatModalButtons>
            <Button 
              onClick={handleFormatModalCancel}
              type="default"
              size="small"
            >
              {t('songRequest.cancel')}
            </Button>
            <Button 
              onClick={handleFormatModalConfirm}
              disabled={!formatModalArtist.trim() || !formatModalTitle.trim()}
              size="small"
            >
              {t('songRequest.correct')}
            </Button>
          </FormatModalButtons>
        </FormatModalContent>
      </FormatModal>
    </>
  );
};

export default SongRequest;
