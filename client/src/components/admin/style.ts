import styled from 'styled-components';

export const SettingsSection = styled.div`
  padding: 0 10px;
  margin-bottom: 20px;
`;

export const SettingsTitle = styled.h3`
  color: #333;
  margin: 0 0 20px 0;
  font-size: 1.3rem;
  font-weight: 600;
`;

export const SettingsCard = styled.div`
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid #e9ecef;
`;

export const SettingsLabel = styled.label`
  display: block;
  font-weight: 600;
  margin-bottom: 10px;
  color: #333;
  font-size: 1rem;
`;

export const SettingsRow = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 15px;
  gap: 15px;
`;

export const SettingsInput = styled.input`
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

export const SettingsDescription = styled.div`
  font-size: 0.9rem;
  color: #666;
  margin-top: 10px;
  line-height: 1.4;
`;

export const Container = styled.div`
  min-height: 100vh;
  padding: 20px;
`;


export const TabContainer = styled.div`
  background: white;
  border-radius: 12px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
`;

export const TabHeader = styled.div`
  display: flex;
  border-bottom: 1px solid #e9ecef;
`;

export const TabButton = styled.button<{ $active: boolean }>`
  background: ${props => props.$active ? '#e3f2fd' : 'transparent'};
  color: ${props => props.$active ? '#1976d2' : '#666'};
  border: none;
  padding: 15px 25px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  border-radius: ${props => props.$active ? '12px 12px 0 0' : '0'};
  
  &:hover {
    background: ${props => props.$active ? '#bbdefb' : '#f8f9fa'};
    color: ${props => props.$active ? '#1565c0' : '#333'};
  }
  
  &:first-child {
    border-radius: 12px 0 0 0;
  }
  
  &:last-child {
    border-radius: 0 12px 0 0;
  }
`;

export const TabContent = styled.div`
  padding: 20px;
`;


export const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  background: rgba(255, 255, 255, 0.1);
  padding: 20px;
  border-radius: 12px;
  backdrop-filter: blur(10px);
`;

export const Title = styled.h1`
  color: white;
  font-size: 2.5rem;
  margin: 0;
`;

export const LogoutButton = styled.button`
  background: #e74c3c;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;

  &:hover {
    background: #c0392b;
  }
`;

export const LoadingMessage = styled.div`
  text-align: center;
  padding: 40px;
  color: #666;
`;

export const CurrentNextSongContainer = styled.div`
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  padding: 20px;
`;

export const SongDisplayBox = styled.div<{ $isCurrent?: boolean }>`
  flex: 1;
  padding: 20px;
  border-radius: 8px;
  background: ${props => props.$isCurrent ? '#e3f2fd' : '#f8f9fa'};
  border: 2px solid ${props => props.$isCurrent ? '#1976d2' : '#e9ecef'};
  transition: all 0.3s ease;
  
  &:hover {
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
  }
`;

export const SongDisplayLabel = styled.div`
  font-size: 0.9rem;
  font-weight: 600;
  color: #666;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

export const SongDisplaySinger = styled.div`
  font-size: 2.4rem;
  font-weight: 700;
  color: #333;
`;

export const SongDisplayTitle = styled.div`
  font-size: 2.0rem;
  color: #555;
  font-style: italic;
  margin-bottom: 20px;
`;

export const SongTimeContainer = styled.div<{ $isCurrent?: boolean }>`
  margin-top: 20px;
  padding-top: 20px;
  border-top: 2px solid ${props => props.$isCurrent ? '#1976d2' : '#e9ecef'};
`;

export const SongTimeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 10px;
`;

export const SongTimeLabel = styled.div`
  font-size: 1.2rem;
  font-weight: 600;
  color: #666;
  min-width: 80px;
`;

export const SongProgressBar = styled.div`
  flex: 1;
  height: 12px;
  background: #e9ecef;
  border-radius: 6px;
  overflow: hidden;
  position: relative;
  margin-top: 2px;
`;

export const SongProgressFill = styled.div<{ $progress: number }>`
  height: 100%;
  width: ${props => Math.min(100, Math.max(0, props.$progress))}%;
  background: ${props => props.$progress >= 100 ? '#28a745' : '#1976d2'};
  transition: width 0.1s linear;
  border-radius: 6px;
`;

export const SongTimeValue = styled.div`
  font-size: 1.2rem;
  font-weight: 600;
  color: #333;
  min-width: 80px;
`;

export const SongTimeValueLeft = styled(SongTimeValue)`
  text-align: right;
`;

export const SongTimeValueRight = styled(SongTimeValue)`
  text-align: left;
`;