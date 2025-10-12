const express = require('express');
const router = express.Router();
const i18n = require('../../i18n');
const path = require('path');
const fs = require('fs');

// Get available languages
router.get('/languages', (req, res) => {
  try {
    const translationsDir = path.join(__dirname, '..', '..', 'client', 'src', 'translations');
    const languages = [];
    
    const languageDirs = fs.readdirSync(translationsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    languageDirs.forEach(langCode => {
      const languageFile = path.join(translationsDir, langCode, 'language.json');
      
      if (fs.existsSync(languageFile)) {
        try {
          const languageData = JSON.parse(fs.readFileSync(languageFile, 'utf8'));
          languages.push({
            code: langCode,
            ...languageData
          });
        } catch (error) {
          console.warn(`Failed to load language info for ${langCode}:`, error.message);
        }
      }
    });
    
    res.json(languages);
  } catch (error) {
    console.error('Error loading languages:', error);
    res.status(500).json({ error: 'Failed to load languages' });
  }
});

// Get translations for a specific language
router.get('/translations/:lang', (req, res) => {
  try {
    const { lang } = req.params;
    const translation = i18n.getResourceBundle(lang, 'translation');
    
    if (!translation) {
      return res.status(404).json({ error: 'Language not found' });
    }
    
    res.json(translation);
  } catch (error) {
    console.error('Error loading translations:', error);
    res.status(500).json({ error: 'Failed to load translations' });
  }
});

// Translate a key
router.post('/translate', (req, res) => {
  try {
    const { key, lang, options } = req.body;
    
    if (!key || !lang) {
      return res.status(400).json({ error: 'Key and language are required' });
    }
    
    const translation = i18n.t(key, { 
      lng: lang, 
      ...options 
    });
    
    res.json({ translation });
  } catch (error) {
    console.error('Error translating:', error);
    res.status(500).json({ error: 'Failed to translate' });
  }
});

module.exports = router;
