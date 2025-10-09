import React from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeLeftSide, QRCodeTitle, QRCodeContent, QRCodeHeader, QRCodeOverlay, QRCodeNextSongInfo, QRCodeNextSinger, QRCodeNextSongTitle, QRCodeRightSide, QRCodeImageLarge, QRCodeTextLarge } from './style';

interface OverlayProps {
  show: boolean;
  overlayTitle: string;
  currentSong: any;
  nextSongs: any[];
  qrCodeUrl: string;
}

const Overlay: React.FC<OverlayProps> = ({
  show,
  overlayTitle,
  currentSong,
  nextSongs,
  qrCodeUrl,
}) => {
  const { t } = useTranslation();

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

export default Overlay;


