import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import styled from 'styled-components';
import SongRequest from './components/SongRequest';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import PlaylistView from './components/PlaylistView';
import ShowView from './components/show/ShowView';
import { useDocumentTitle } from './hooks/useDocumentTitle';

const AppContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
`;

// Komponente, die den Title basierend auf der Route setzt
const AppContent = () => {
  const location = useLocation();

  // Titel basierend auf der Route bestimmen
  const getTitleForRoute = (pathname: string): string => {
    switch (pathname) {
      case '/':
        return 'Playlist';
      case '/new':
        return 'Song Request';
      case '/show':
        return 'Live';
      case '/admin/login':
        return 'Admin Login';
      case '/admin':
        return 'Admin Dashboard';
      default:
        return '';
    }
  };

  const pageTitle = getTitleForRoute(location.pathname);
  useDocumentTitle(pageTitle);

  return (
    <>
      <Routes>
        <Route path="/" element={<PlaylistView />} />
        <Route path="/new" element={<SongRequest />} />
        <Route path="/show" element={<ShowView />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#333',
            color: '#fff',
          },
        }}
      />
    </>
  );
};

function App() {
  return (
    <AppContainer>
      <Router>
        <AppContent />
      </Router>
    </AppContainer>
  );
}

export default App;