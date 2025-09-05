import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import QRCode from 'qrcode';
import { songAPI } from '../services/api';
import { SongRequestData, QRData } from '../types';

const Container = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
`;

const Card = styled.div`
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  padding: 40px;
  max-width: 500px;
  width: 100%;
`;

const Title = styled.h1`
  text-align: center;
  color: #333;
  margin-bottom: 30px;
  font-size: 2rem;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
`;

const Label = styled.label`
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
`;

const Input = styled.input`
  padding: 12px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.3s ease;

  &:focus {
    outline: none;
    border-color: #667eea;
  }
`;

const TextArea = styled.textarea`
  padding: 12px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 16px;
  resize: vertical;
  min-height: 100px;
  transition: border-color 0.3s ease;

  &:focus {
    outline: none;
    border-color: #667eea;
  }
`;

const Button = styled.button`
  background: #667eea;
  color: white;
  border: none;
  padding: 15px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: #5a6fd8;
    transform: translateY(-2px);
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
    transform: none;
  }
`;

const Alert = styled.div<{ type: 'success' | 'error' }>`
  padding: 15px;
  border-radius: 8px;
  margin: 20px 0;
  background: ${props => props.type === 'success' ? '#d4edda' : '#f8d7da'};
  color: ${props => props.type === 'success' ? '#155724' : '#721c24'};
  border: 1px solid ${props => props.type === 'success' ? '#c3e6cb' : '#f5c6cb'};
`;

const QRCodeContainer = styled.div`
  text-align: center;
  margin: 30px 0;
`;

const QRCodeImage = styled.img`
  max-width: 200px;
  border-radius: 8px;
`;

const DeviceIdDisplay = styled.div`
  background: #f8f9fa;
  padding: 10px;
  border-radius: 8px;
  text-align: center;
  margin: 20px 0;
  font-family: monospace;
  font-weight: bold;
  color: #667eea;
`;

const SongRequest: React.FC = () => {
  const [formData, setFormData] = useState<SongRequestData>({
    name: '',
    songInput: '',
    deviceId: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [deviceId, setDeviceId] = useState<string>('');

  useEffect(() => {
    // Generate or retrieve device ID
    const storedDeviceId = localStorage.getItem('karaokeDeviceId');
    if (storedDeviceId) {
      setDeviceId(storedDeviceId);
      setFormData(prev => ({ ...prev, deviceId: storedDeviceId }));
    } else {
      // Generate new device ID (3 random letters)
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let newDeviceId = '';
      for (let i = 0; i < 3; i++) {
        newDeviceId += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      setDeviceId(newDeviceId);
      setFormData(prev => ({ ...prev, deviceId: newDeviceId }));
      localStorage.setItem('karaokeDeviceId', newDeviceId);
    }

    // Generate QR code
    generateQRCode();
  }, []);

  const generateQRCode = async () => {
    try {
      const qrData = await songAPI.getQRData();
      const qrCodeUrl = await QRCode.toDataURL(qrData.data.url);
      setQrCodeDataUrl(qrCodeUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await songAPI.requestSong(formData);
      
      setMessage({
        type: 'success',
        text: `Song "${response.data.song.title}" wurde erfolgreich zur Playlist hinzugefügt!`
      });
      
      // Reset form - keep name, clear only song input
      setFormData(prev => ({ ...prev, songInput: '' }));
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Fehler beim Hinzufügen des Songs'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <Card>
        <Title>🎤 Karaoke Song Wunsch</Title>
        
        {deviceId && (
          <DeviceIdDisplay>
            Geräte-ID: {deviceId}
          </DeviceIdDisplay>
        )}

        <QRCodeContainer>
          <h3>QR Code für andere Geräte:</h3>
          {qrCodeDataUrl && <QRCodeImage src={qrCodeDataUrl} alt="QR Code" />}
        </QRCodeContainer>

        <Form onSubmit={handleSubmit}>
          <FormGroup>
            <Label htmlFor="name">Dein Name:</Label>
            <Input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              placeholder="Gib deinen Namen ein"
            />
          </FormGroup>

          <FormGroup>
            <Label htmlFor="songInput">Song Wunsch:</Label>
            <TextArea
              id="songInput"
              name="songInput"
              value={formData.songInput}
              onChange={handleInputChange}
              required
              placeholder="Interpret - Songtitel oder YouTube Link"
            />
          </FormGroup>

          {message && (
            <Alert type={message.type}>
              {message.text}
            </Alert>
          )}

          <Button type="submit" disabled={loading}>
            {loading ? 'Wird hinzugefügt...' : 'Song hinzufügen'}
          </Button>
        </Form>

        <div style={{ textAlign: 'center', marginTop: '20px', color: '#666' }}>
          <p>Du kannst mehrere Songs hinzufügen!</p>
          <p>Das System sorgt für eine faire Reihenfolge.</p>
        </div>
      </Card>
    </Container>
  );
};

export default SongRequest;
