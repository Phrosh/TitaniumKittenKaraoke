import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import styled from 'styled-components';
import SongRequest from './components/SongRequest';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import PlaylistView from './components/PlaylistView';
import ShowView from './components/ShowView';

const AppContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
`;

function App() {
  return (
    <AppContainer>
      <Router>
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
      </Router>
    </AppContainer>
  );
}

export default App;