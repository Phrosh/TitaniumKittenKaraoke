import React from 'react';
import styled from 'styled-components';

interface ManualSongListModalProps {
  show: boolean;
  manualSongList: any[];
  manualSongSearchTerm: string;
  onClose: () => void;
  onSearchTermChange: (term: string) => void;
  onSongSelect: (song: any) => void;
  getFirstLetter: (text: string) => string;
}

const Backdrop = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const Card = styled.div`
  background-color: white;
  border-radius: 12px;
  padding: 20px;
  max-width: 600px;
  width: 90%;
  max-height: 95vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid #eee;
  padding-bottom: 15px;
`;

const Title = styled.h3`
  margin: 0;
  color: #333;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  margin-bottom: 15px;
  font-size: 14px;
`;

const HeaderRow = styled.div`
  display: flex;
  padding: 8px 10px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 600;
  color: #666;
`;

const Column = styled.div<{ left?: boolean }>`
  flex: 1;
  padding-left: ${({ left }) => (left ? '0' : '10px')};
  padding-right: ${({ left }) => (left ? '10px' : '0')};
  border-left: ${({ left }) => (left ? 'none' : '1px solid #eee')};
`;

const ListContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  max-height: 400px;
`;

const GroupHeader = styled.div`
  position: sticky;
  top: 0;
  background: #adb5bd;
  color: white;
  padding: 8px 15px;
  font-size: 16px;
  font-weight: bold;
  z-index: 10;
  border-bottom: 2px solid #9ca3af;
`;

const Row = styled.div`
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

const ManualSongListModal: React.FC<ManualSongListModalProps> = ({
  show,
  manualSongList,
  manualSongSearchTerm,
  onClose,
  onSearchTermChange,
  onSongSelect,
  getFirstLetter,
}) => {
  if (!show) return null;

  // Expect manualSongList already filtered; if not, do a light filter as fallback
  const list = manualSongList && manualSongList.length
    ? manualSongList
    : [];

  // Group by first letter of artist
  const grouped = list.reduce((groups: Record<string, any[]>, song: any) => {
    const letter = getFirstLetter(song.artist);
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(song);
    return groups;
  }, {});

  const sortedLetters = Object.keys(grouped).sort();

  return (
    <Backdrop>
      <Card>
        <Header>
          <Title>🎵 Server Songs</Title>
          <CloseButton onClick={onClose}>×</CloseButton>
        </Header>

        <SearchInput
          type="text"
          placeholder="Songs durchsuchen..."
          value={manualSongSearchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
        />

        <HeaderRow>
          <Column left>INTERPRET</Column>
          <Column>SONGTITEL</Column>
        </HeaderRow>

        <ListContainer>
          {sortedLetters.length > 0 ? (
            <>
              {sortedLetters.map((letter) => (
                <div key={letter}>
                  <GroupHeader>{letter}</GroupHeader>
                  {grouped[letter].map((song: any, index: number) => (
                    <Row key={`${letter}-${index}`} onClick={() => onSongSelect(song)}>
                      <Column left style={{ fontWeight: 600, color: '#333' }}>{song.artist}</Column>
                      <Column style={{ color: '#666', fontSize: 14 }}>{song.title}</Column>
                    </Row>
                  ))}
                </div>
              ))}
            </>
          ) : (
            <div style={{ textAlign: 'center', color: '#666', padding: 20 }}>
              {manualSongSearchTerm ? 'Keine Songs gefunden' : 'Keine Server Songs verfügbar'}
            </div>
          )}
        </ListContainer>
      </Card>
    </Backdrop>
  );
};

export default ManualSongListModal;


