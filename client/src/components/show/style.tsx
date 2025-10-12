import styled from 'styled-components';
import { 
    HIGHLIGHT_COLOR, 
    BLACK_BACKGROUND, 
    WHITE,
    PRIMARY_COLOR,
    TIMER_BACKGROUND,
    GRAY,
    OVERLAY_BACKGROUND,
    NEXT_SONG_INFO_BACKGROUND,
    UNSUNG_COLOR,
    SECONDARY_COLOR,
    AD_HEIGHT
} from './constants';

export const ShowContainer = styled.div<{ $cursorVisible: boolean }>`
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  cursor: ${props => props.$cursorVisible ? 'default' : 'none'};
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
`;

export const VideoWrapper = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
`;


export const VideoElement = styled.video`
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: black;
`;

export const VideoIframe = styled.iframe`
  width: 100%;
  height: 100%;
  border: none;
`;

export const AudioElement = styled.audio`
  position: absolute;
  top: 50px;
  left: 50%;
  transform: translateX(-50%);
  width: 80%;
  max-width: 600px;
  height: 60px;
  background: ${BLACK_BACKGROUND};
  border-radius: 10px;
  padding: 10px;
  z-index: 33;
`;

export const BackgroundVideo = styled.video`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 1;
`;

export const BackgroundImage = styled.div<{ $imageUrl: string }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: url(${props => props.$imageUrl});
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  filter: blur(8px);
  transform: scale(1.1);
  z-index: 1;
`;

export const PreviewLyric = styled.div`
  font-size: 3rem;
  color: ${WHITE};
  text-align: center;
  margin-bottom: 5px;
  text-shadow: 4px 4px 8px rgba(0, 0, 0, 1);
  min-height: 3.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const HighlightedSyllable = styled.span`
  background: linear-gradient(45deg, #ff6b6b, ${PRIMARY_COLOR});
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 900;
  text-shadow: 4px 4px px rgba(0, 0, 0, 1);
`;

export const CurrentSyllable = styled.span`
  color: ${WHITE};
  font-weight: bold;
  transform: scale(1.1);
  transition: transform 0.2s ease-in-out;
  display: inline-block;
`;


export const Header = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background: ${BLACK_BACKGROUND};
  backdrop-filter: blur(10px);
  padding: 20px 40px;
  z-index: 10;
`;

export const HeaderContent = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
`;

export const CurrentSongInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

export const SingerName = styled.div`
  font-size: 1.8rem;
  font-weight: 700;
  color: ${WHITE};
  text-shadow: 2px 2px 4px ${BLACK_BACKGROUND};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const SongTitle = styled.div`
  font-size: 1.2rem;
  color: ${PRIMARY_COLOR};
  font-weight: 500;
  text-shadow: 1px 1px 2px ${BLACK_BACKGROUND};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const TimerDisplay = styled.div`
  font-size: 1rem;
  color: ${WHITE};
  font-weight: 600;
  text-shadow: 1px 1px 2px ${BLACK_BACKGROUND};
  background: ${TIMER_BACKGROUND};
  padding: 5px 10px;
  border-radius: 15px;
  margin-left: 20px;
`;

export const Footer = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: ${BLACK_BACKGROUND};
  backdrop-filter: blur(10px);
  padding: 20px 80px;
  z-index: 10;
`;

export const FooterContent = styled.div`
  margin: 0 ${AD_HEIGHT};
`;

export const NextSongsTitle = styled.div`
  font-size: 1rem;
  color: ${GRAY};
  margin-bottom: 10px;
  font-weight: 600;
`;

export const NextSongsCounter = styled.div`
  color: ${PRIMARY_COLOR};
  font-weight: 600;
  width: 32px;
  font-size: 32px;
  text-align: right;
  padding-right: 10px;
`;

export const NextSongsList = styled.div`
  display: flex;
  gap: 32px;
  width: 100%;
`;

export const NextSongListContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
`;

export const NextSongItem = styled.div`
  display: flex;
  flex-direction: row;
  gap: 3px;
  flex: 1;
`;

export const NextSingerName = styled.div`
  font-size: 0.9rem;
  color: ${WHITE};
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const NextSongTitle = styled.div`
  font-size: 0.8rem;
  color: ${PRIMARY_COLOR};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const TransitionOverlay = styled.div<{ $isVisible: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: ${OVERLAY_BACKGROUND};
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
  opacity: ${props => props.$isVisible ? 1 : 0};
  visibility: ${props => props.$isVisible ? 'visible' : 'hidden'};
  transition: all 0.5s ease;
`;

export const TransitionContent = styled.div`
  text-align: center;
  max-width: 800px;
  padding: 40px;
`;

export const TransitionTitle = styled.h1`
  font-size: 3rem;
  font-weight: 700;
  color: ${WHITE};
  margin-bottom: 30px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
`;

export const NextSongInfo = styled.div`
  background: ${NEXT_SONG_INFO_BACKGROUND};
  border-radius: 20px;
  padding: 30px;
  margin-bottom: 40px;
  backdrop-filter: blur(10px);
`;

export const NextSinger = styled.div`
  font-size: 2.5rem;
  font-weight: 700;
  color: ${WHITE};
  margin-bottom: 15px;
  text-shadow: 2px 2px 4px ${BLACK_BACKGROUND};
`;

export const NextSong = styled.div`
  font-size: 1.8rem;
  color: ${WHITE};
  font-weight: 500;
  text-shadow: 1px 1px 2px ${BLACK_BACKGROUND};
`;

export const QRCodeContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
`;

export const QRCodeImage = styled.img`
  width: 200px;
  height: 200px;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
`;

export const QRCodeText = styled.div`
  font-size: 1.2rem;
  color: ${WHITE};
  text-align: center;
  max-width: 400px;
  line-height: 1.5;
`;

// QR Code Overlay Components
export const QRCodeOverlay = styled.div<{ $isVisible: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: ${OVERLAY_BACKGROUND};
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 200;
  padding: 40px;
  opacity: ${props => props.$isVisible ? 1 : 0};
  visibility: ${props => props.$isVisible ? 'visible' : 'hidden'};
  transition: opacity 0.5s ease-in-out, visibility 0.5s ease-in-out;
`;

export const QRCodeHeader = styled.h1`
  position: absolute;
  top: 40px;
  left: 50%;
  transform: translateX(-50%);
  color: ${WHITE};
  font-size: 3rem;
  margin: 0;
  font-weight: bold;
  text-shadow: 2px 2px 4px ${BLACK_BACKGROUND};
  text-align: center;
  z-index: 201;
`;

export const QRCodeContent = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 60px;
  max-width: 1200px;
  width: 100%;
`;

export const QRCodeLeftSide = styled.div`
  flex: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
`;

export const QRCodeTitle = styled.h1`
  color: ${WHITE};
  font-size: 4rem;
  margin: 0 0 40px 0;
  font-weight: bold;
  text-shadow: 2px 2px 4px ${BLACK_BACKGROUND};
`;

export const QRCodeNextSongInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: center;
`;

export const QRCodeNextSinger = styled.h2`
  font-size: 3rem;
  margin: 0;
  font-weight: 600;
  color: ${WHITE};
  text-shadow: 2px 2px 4px ${BLACK_BACKGROUND};
`;

export const QRCodeNextSongTitle = styled.h3`
  font-size: 2.5rem;
  margin: 0;
  font-weight: normal;
  color: ${PRIMARY_COLOR};
  text-shadow: 2px 2px 4px ${BLACK_BACKGROUND};
`;

export const QRCodeRightSide = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
`;

export const QRCodeImageLarge = styled.img`
  width: 300px;
  height: 300px;
  border-radius: 15px;
  border: 20px solid white;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
`;

export const QRCodeTextLarge = styled.p`
  color: ${WHITE};
  font-size: 1.4rem;
  margin: 0;
  text-align: center;
  text-shadow: 1px 1px 2px ${BLACK_BACKGROUND};
  max-width: 300px;
`;

export const QRCodeCloseButton = styled.button`
  background: #e74c3c;
  color: white;
  border: none;
  padding: 15px 30px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 1.2rem;
  font-weight: 600;
  margin-top: 30px;

  &:hover {
    background: #c0392b;
  }
`;

export const previewLyricStyle = {
  fontSize: '3rem',
  color: UNSUNG_COLOR,
  textAlign: 'center' as const,
  marginBottom: '5px',
  opacity: 0.7,
  textShadow: '4px 4px 8px rgba(0, 0, 0, 1)',
  minHeight: '3.5rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

export const ButtonsContainer = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  gap: 8px;
  z-index: 20;
`;

export const ProgressOverlay = styled.div<{ $isVisible: boolean; $isUltrastar: boolean; $isSecond: boolean; $isDuet: boolean }>`
  position: absolute;
  opacity: ${props => props.$isVisible ? 1 : 0};
  visibility: ${props => props.$isVisible ? 'visible' : 'hidden'};
  ${props => props.$isSecond ? 'bottom' : 'top'}: ${props => props.$isDuet ? '15vh' : '30vh'};
  left: 50%;
  transform: translateX(-50%);
  z-index: 50;
  transition: opacity 0.3s ease-in-out, visibility 0.3s ease-in-out;
`;

export const ProgressBarContainer = styled.div<{ $isUltrastar: boolean, $isSecond: boolean }>`
  width: 50vw;
  height: 40px;
  background: ${BLACK_BACKGROUND};
  border-radius: 4px;
  border: 5px solid ${props => props.$isSecond ? SECONDARY_COLOR : HIGHLIGHT_COLOR};
  overflow: hidden;
  box-shadow: 0 0 20px rgba(0, 0, 0, 1);
  transform: ${props => props.$isUltrastar ? 'scale(1)' : 'scale(0)'};
  transition: transform 0.3s ease-in-out;
`;

export const ProgressBarFill = styled.div<{ $progress: number, $isSecond: boolean }>`
  width: ${props => props.$progress}%;
  height: 100%;
  background: ${props => props.$isSecond ? SECONDARY_COLOR : HIGHLIGHT_COLOR};
  border-radius: 0px;
  transition: width 0.1s ease-out;
`;
// box-shadow: 0 0 10px ${HIGHLIGHT_COLOR};

export const NoVideoMessage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  font-size: 1.2rem;
  color: #666;
  background: #f8f9fa;
  border-radius: 15px;
  border: 2px dashed #dee2e6;
`;

export const LoadingMessage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  font-size: 1.2rem;
  color: #666;
  background: #f8f9fa;
  border-radius: 15px;
`;