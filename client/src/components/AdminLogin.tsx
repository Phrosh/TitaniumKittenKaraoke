import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';
import { useTranslation } from 'react-i18next';
import Button from './shared/Button';

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
  max-width: 400px;
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


const Alert = styled.div<{ type: 'success' | 'error' }>`
  padding: 15px;
  border-radius: 8px;
  margin: 20px 0;
  background: ${props => props.type === 'success' ? '#d4edda' : '#f8d7da'};
  color: ${props => props.type === 'success' ? '#155724' : '#721c24'};
  border: 1px solid ${props => props.type === 'success' ? '#c3e6cb' : '#f5c6cb'};
`;

const InitAdminCard = styled.div`
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
  margin-top: 20px;
  border: 2px dashed #dee2e6;
`;

const InitTitle = styled.h3`
  color: #495057;
  margin-bottom: 15px;
  text-align: center;
`;

const AdminLogin: React.FC = () => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showInitAdmin, setShowInitAdmin] = useState(true);
  const [initLoading, setInitLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if already logged in
    const token = localStorage.getItem('adminToken');
    if (token) {
      navigate('/admin');
    }
    
    // Check if admin users already exist
    const checkAdminExists = async () => {
      try {
        const response = await adminAPI.checkAdminExists();
        console.log('Admin exists check:', response.data);
        console.log('Setting showInitAdmin to:', !response.data.adminExists);
        setShowInitAdmin(!response.data.adminExists); // Show init form only if no admins exist
      } catch (error) {
        // If we can't check, show init form
        console.log('Could not check admin users, showing init form');
        setShowInitAdmin(true);
      }
    };
    
    checkAdminExists();
  }, [navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await adminAPI.login(formData.username, formData.password);
      localStorage.setItem('adminToken', response.data.token);
      navigate('/admin');
    } catch (error: any) {
      if (error.response?.status === 401) {
        setMessage({
          type: 'error',
          text: t('adminLogin.invalidCredentials')
        });
      } else {
        setMessage({
          type: 'error',
          text: t('adminLogin.loginError')
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInitAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setInitLoading(true);
    setMessage(null);

    try {
      await adminAPI.initAdmin(formData.username, formData.password);
      setMessage({
        type: 'success',
        text: t('adminLogin.adminCreatedSuccessfully')
      });
      setShowInitAdmin(false);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || t('adminLogin.adminCreationError')
      });
    } finally {
      setInitLoading(false);
    }
  };

  return (
    <Container>
      <Card>
        <Title>🔐 {t('adminLogin.adminLogin')}</Title>

        <Form onSubmit={handleLogin}>
          <FormGroup>
            <Label htmlFor="username">{t('adminLogin.username')}:</Label>
            <Input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              required
              placeholder={t('adminLogin.usernamePlaceholder')}
            />
          </FormGroup>

          <FormGroup>
            <Label htmlFor="password">{t('adminLogin.password')}:</Label>
            <Input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              placeholder={t('adminLogin.passwordPlaceholder')}
            />
          </FormGroup>

          {message && (
            <Alert type={message.type}>
              {message.text}
            </Alert>
          )}

          <Button type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? t('adminLogin.loggingIn') : t('adminLogin.login')}
          </Button>
        </Form>

        {showInitAdmin && (
          <InitAdminCard>
            <InitTitle>{t('adminLogin.createFirstAdmin')}</InitTitle>
            <Form onSubmit={handleInitAdmin}>
              <FormGroup>
                <Label htmlFor="init-username">{t('adminLogin.username')}:</Label>
                <Input
                  type="text"
                  id="init-username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                  placeholder={t('adminLogin.usernamePlaceholder')}
                />
              </FormGroup>

              <FormGroup>
                <Label htmlFor="init-password">{t('adminLogin.password')}:</Label>
                <Input
                  type="password"
                  id="init-password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  placeholder={t('adminLogin.passwordMinLength')}
                />
              </FormGroup>

              <Button type="submit" disabled={initLoading}>
                {initLoading ? t('adminLogin.creating') : t('adminLogin.createAdmin')}
              </Button>
            </Form>
          </InitAdminCard>
        )}

      </Card>
    </Container>
  );
};

export default AdminLogin;