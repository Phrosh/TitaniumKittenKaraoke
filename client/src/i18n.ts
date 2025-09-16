import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enTranslation from './translations/en-US/translation.json';
import deTranslation from './translations/de-DE/translation.json';
import esTranslation from './translations/es-ES/translation.json';
import frTranslation from './translations/fr-FR/translation.json';
import jaTranslation from './translations/ja-JP/translation.json';
import koTranslation from './translations/ko-KR/translation.json';
import nlTranslation from './translations/nl-NL/translation.json';
import plTranslation from './translations/pl-PL/translation.json';
import ruTranslation from './translations/ru-RU/translation.json';
import svTranslation from './translations/sv-SE/translation.json';
import fiTranslation from './translations/fi-FI/translation.json';
import zhTranslation from './translations/zh-CN/translation.json';

const resources = {
  'en-US': {
    translation: enTranslation
  },
  'de-DE': {
    translation: deTranslation
  },
  'es-ES': {
    translation: esTranslation
  },
  'fr-FR': {
    translation: frTranslation
  },
  'ja-JP': {
    translation: jaTranslation
  },
  'ko-KR': {
    translation: koTranslation
  },
  'nl-NL': {
    translation: nlTranslation
  },
  'pl-PL': {
    translation: plTranslation
  },
  'ru-RU': {
    translation: ruTranslation
  },
  'sv-SE': {
    translation: svTranslation
  },
  'fi-FI': {
    translation: fiTranslation
  },
  'zh-CN': {
    translation: zhTranslation
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en-US',
    defaultNS: 'translation',
    ns: ['translation'],
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
    
    interpolation: {
      escapeValue: false,
    },
    
    react: {
      useSuspense: false,
    },
  });

export default i18n;
