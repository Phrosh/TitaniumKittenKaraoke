const i18n = require('i18next');
const path = require('path');
const fs = require('fs');

// Load all translation files from client/src/translations
const loadTranslations = () => {
  const translationsDir = path.join(__dirname, 'client', 'src', 'translations');
  const resources = {};
  
  try {
    const languageDirs = fs.readdirSync(translationsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    languageDirs.forEach(langCode => {
      const translationFile = path.join(translationsDir, langCode, 'translation.json');
      const languageFile = path.join(translationsDir, langCode, 'language.json');
      
      if (fs.existsSync(translationFile)) {
        try {
          const translationData = JSON.parse(fs.readFileSync(translationFile, 'utf8'));
          const languageData = fs.existsSync(languageFile) 
            ? JSON.parse(fs.readFileSync(languageFile, 'utf8'))
            : { name: langCode, nameEn: langCode, author: 'Phrosh' };
          
          resources[langCode] = {
            translation: translationData,
            language: languageData
          };
        } catch (error) {
          console.warn(`Failed to load translations for ${langCode}:`, error.message);
        }
      }
    });
  } catch (error) {
    console.warn('Failed to load translations directory:', error.message);
  }
  
  return resources;
};

// Initialize i18n
i18n.init({
  resources: loadTranslations(),
  fallbackLng: 'en-US',
  defaultNS: 'translation',
  ns: ['translation', 'language'],
  
  interpolation: {
    escapeValue: false,
  },
  
  // Server-side specific options
  initImmediate: false,
});

module.exports = i18n;
