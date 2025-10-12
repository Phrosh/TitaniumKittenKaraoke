import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Footer as StyledFooter,
  FooterContent,
  NextSongsTitle,
  NextSongsList,
  NextSongItem,
  NextSingerName,
  NextSongTitle,
  NextSongsCounter,
  NextSongListContainer,
} from './style';

interface FooterProps {
  nextSongs: any[];
}

const Footer: React.FC<FooterProps> = ({
  nextSongs,
}) => {
  const { t } = useTranslation();

  return (
    <StyledFooter>
        <FooterContent>
          <NextSongsTitle>🎤 {t('showView.nextSongs')}:</NextSongsTitle>
          <NextSongsList>
            {nextSongs.length > 0 ? (
              nextSongs.map((song, index) => (
                <NextSongItem key={song.id}>
                  <NextSongsCounter>{index + 1}</NextSongsCounter>  
                  <NextSongListContainer>
                    <NextSingerName>{song.user_name}</NextSingerName>
                    <NextSongTitle>
                      {song.artist ? `${song.artist} - ${song.title}` : song.title}
                    </NextSongTitle>
                  </NextSongListContainer>
                </NextSongItem>
              ))
            ) : (
              <NextSongItem>
                <NextSingerName>{t('showView.noMoreSongs')}</NextSingerName>
                <NextSongTitle>{t('showView.queueIsEmpty')}</NextSongTitle>
              </NextSongItem>
            )}
          </NextSongsList>
        </FooterContent>
      </StyledFooter>
  );
};

export default Footer;


