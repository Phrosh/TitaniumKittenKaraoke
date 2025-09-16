import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';

const SelectorContainer = styled.div`
  position: relative;
  display: inline-block;
`;

const Select = styled.select`
  padding: 8px 12px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  background: white;
  color: #333;
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.3s ease;
  min-width: 150px;

  &:focus {
    outline: none;
    border-color: #667eea;
  }

  &:hover {
    border-color: #667eea;
  }
`;

const Option = styled.option`
  padding: 8px;
`;

interface LanguageInfo {
  code: string;
  name: string;
  nameEn: string;
  author: string;
}

const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();
  const [languages, setLanguages] = useState<LanguageInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLanguages = async () => {
      try {
        const response = await fetch('/api/i18n/languages');
        if (response.ok) {
          const languages = await response.json();
          setLanguages(languages);
        } else {
          console.warn('Failed to load languages from server');
        }
      } catch (error) {
        console.error('Failed to load languages:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLanguages();
  }, []);

  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedLanguage = event.target.value;
    i18n.changeLanguage(selectedLanguage);
    localStorage.setItem('karaokeLanguage', selectedLanguage);
  };

  if (loading) {
    return <Select disabled><Option>Loading...</Option></Select>;
  }

  return (
    <SelectorContainer>
      <Select
        value={i18n.language}
        onChange={handleLanguageChange}
      >
        {languages.map((lang) => (
          <Option key={lang.code} value={lang.code}>
            {lang.name}
          </Option>
        ))}
      </Select>
    </SelectorContainer>
  );
};

export default LanguageSelector;
