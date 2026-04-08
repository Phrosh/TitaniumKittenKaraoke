import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Header as StyledHeader,
  HeaderContent,
  CurrentSongInfo,
  SingerName,
  SongTitle,
  TimerDisplay,
} from './style';

interface HeaderProps {
  currentSong: any;
  timeRemaining: number | null;
  withDonorMarquee?: boolean;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const Header: React.FC<HeaderProps> = ({
  currentSong,  
  timeRemaining,
  withDonorMarquee = false,
}) => {
  const { t } = useTranslation();

  return (
    <StyledHeader $withDonorMarquee={withDonorMarquee}>
      <HeaderContent>
        <CurrentSongInfo>
          <SingerName>
            {currentSong ? `🎵 ${currentSong.user_name}` : t('showView.waitingForSong')}
          </SingerName>
          <SongTitle>
            {currentSong ? (
              currentSong.artist ? `${currentSong.artist} - ${currentSong.title}` : currentSong.title
            ) : (
              t('showView.noSongInQueue')
            )}
          </SongTitle>
        </CurrentSongInfo>
        {timeRemaining !== null && (
          <TimerDisplay>
            ⏱️ {formatTime(timeRemaining)}
          </TimerDisplay>
        )}
      </HeaderContent>
    </StyledHeader>
  );
};

export default Header;


