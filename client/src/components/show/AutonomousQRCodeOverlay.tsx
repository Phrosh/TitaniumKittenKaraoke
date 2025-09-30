import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { QRCodeLeftSide, QRCodeTitle, QRCodeContent, QRCodeHeader, QRCodeOverlay, QRCodeNextSongInfo, QRCodeNextSinger, QRCodeNextSongTitle, QRCodeRightSide, QRCodeImageLarge, QRCodeTextLarge } from './style';
import websocketService from '../../services/websocket';
import { showAPI } from '../../services/api';

interface AutonomousQRCodeOverlayProps {
  currentSong: any;
  nextSongs: any[];
}

const AutonomousQRCodeOverlay: React.FC<AutonomousQRCodeOverlayProps> = ({
  currentSong,
  nextSongs,
}) => {
  const { t } = useTranslation();
  
  // Local state for autonomous operation
  const [show, setShow] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [overlayTitle, setOverlayTitle] = useState('Willkommen beim Karaoke');

  // Fetch QR code data
  const fetchQRCodeData = useCallback(async () => {
    try {
      const response = await showAPI.getQRCode();
      setQrCodeUrl(response.data.qrCodeDataUrl);
    } catch (error) {
      console.error('Error fetching QR code data:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchQRCodeData();
  }, [fetchQRCodeData]);

  // WebSocket listeners for autonomous operation
  useEffect(() => {
    // Wait for WebSocket connection to be established
    const setupWebSocketListeners = () => {
      if (!websocketService.getConnectionStatus()) {
        setTimeout(setupWebSocketListeners, 100);
        return;
      }


      // Listen for QR overlay toggle events
      const handleQROverlayToggle = (data: { show: boolean }) => {
        setShow(data.show);
      };

      // Listen for QR code updates (when custom URL changes)
      const handleQRCodeUpdate = (data: { qrCodeDataUrl: string }) => {
        setQrCodeUrl(data.qrCodeDataUrl);
      };

      // Listen for overlay title updates
      const handleOverlayTitleUpdate = (data: { overlayTitle: string }) => {
        setOverlayTitle(data.overlayTitle);
      };

      // Listen for song start events (auto-hide overlay)
      const handleSongStart = (data: { action: string }) => {
        if (data.action === 'song-started' || data.action === 'song-restarted') {
          setShow(false);
        }
      };

      // Register WebSocket listeners
      websocketService.on('qr-overlay-toggle', handleQROverlayToggle);
      websocketService.on('qr-code-update', handleQRCodeUpdate);
      websocketService.on('overlay-title-update', handleOverlayTitleUpdate);
      websocketService.on('song-action', handleSongStart);
      

      // Store cleanup function
      return () => {
        websocketService.off('qr-overlay-toggle', handleQROverlayToggle);
        websocketService.off('qr-code-update', handleQRCodeUpdate);
        websocketService.off('overlay-title-update', handleOverlayTitleUpdate);
        websocketService.off('song-action', handleSongStart);
      };
    };

    const cleanup = setupWebSocketListeners();
    return cleanup;
  }, []);

  // Auto-show overlay when song ends (if no next song)
  useEffect(() => {
    if (currentSong && !nextSongs.length) {
      // Song ended and no next songs - show overlay
      setShow(true);
    }
  }, [currentSong, nextSongs]);

  return (
    <QRCodeOverlay $isVisible={show}>
      <QRCodeHeader>{overlayTitle}</QRCodeHeader>
      <QRCodeContent>
        <QRCodeLeftSide>
          <QRCodeTitle>🎤 {t('showView.nextSong')}</QRCodeTitle>
          
          {(() => {
            const nextSong = currentSong ? 
              nextSongs.find(song => song.position > currentSong.position) :
              nextSongs.find(song => song.position === 1);
            
            return nextSong ? (
              <QRCodeNextSongInfo>
                <QRCodeNextSinger>
                  {nextSong.user_name}
                </QRCodeNextSinger>
                <QRCodeNextSongTitle>
                  {nextSong.artist ? `${nextSong.artist} - ${nextSong.title}` : nextSong.title}
                </QRCodeNextSongTitle>
              </QRCodeNextSongInfo>
            ) : (
              <QRCodeNextSongInfo>
                <QRCodeNextSinger>{t('showView.noSongsInQueue')}</QRCodeNextSinger>
                <QRCodeNextSongTitle>{t('showView.addFirstSong')}</QRCodeNextSongTitle>
              </QRCodeNextSongInfo>
            );
          })()}
        </QRCodeLeftSide>
        
        <QRCodeRightSide>
          <QRCodeImageLarge 
            src={qrCodeUrl || ''}
            alt={t('showView.qrCodeForSongRequest')}
          />
          <QRCodeTextLarge>
            {t('showView.scanQrCodeForNewRequests')}
          </QRCodeTextLarge>
        </QRCodeRightSide>
      </QRCodeContent>
    </QRCodeOverlay>
  );
};

export default AutonomousQRCodeOverlay;
