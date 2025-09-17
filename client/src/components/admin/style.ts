import styled from 'styled-components';

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