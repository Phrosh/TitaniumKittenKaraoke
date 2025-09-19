# Internationalization (i18n) - Karaoke System

## Overview

The karaoke system has been fully internationalized and currently supports 12 languages:

- 🇺🇸 **English** (en-US) - Default language ✅
- 🇩🇪 **German** (de-DE) ✅
- 🇪🇸 **Spanish** (es-ES) ✅
- 🇫🇷 **French** (fr-FR) ✅
- 🇫🇮 **Finnish** (fi-FI) ✅
- 🇳🇱 **Dutch** (nl-NL) ✅
- 🇵🇱 **Polish** (pl-PL) ✅
- 🇸🇪 **Swedish** (sv-SE) ✅
- 🇷🇺 **Russian** (ru-RU) ✅
- 🇯🇵 **Japanese** (ja-JP) ✅
- 🇰🇷 **Korean** (ko-KR) ✅
- 🇨🇳 **Chinese** (zh-CN) ✅

## Folder Structure

```
translations/
├── en-US/
│   ├── language.json      # Language information
│   └── translation.json   # Translations
├── de-DE/
│   ├── language.json
│   └── translation.json
├── ... (additional languages)
└── README.md
```

## Language Information (language.json)

Each language has a `language.json` file with the following information:

```json
{
  "name": "Deutsch",           // Name of the language in its own language
  "nameEn": "German",          // Name of the language in English
  "author": "Phrosh"           // Author of the translation
}
```

## Translation Structure (translation.json)

The translations are divided into logical areas:

- `common` - General UI elements (buttons, labels, etc.)
- `songRequest` - Song request form
- `adminDashboard` - Admin dashboard
- `showView` - Karaoke show view
- `playlistView` - Playlist view
- `adminLogin` - Admin login
- `settings` - Settings

## Usage

### Frontend (React)

```typescript
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('common.title')}</h1>
      <button>{t('common.save')}</button>
    </div>
  );
};
```

### Language Selection

Language selection is available in the admin dashboard under settings. The selected language is stored in localStorage.

## Technical Details

- **Frontend**: react-i18next with i18next-browser-languagedetector
- **Backend**: i18next (for future backend internationalization)
- **Default Language**: English (en-US)
- **Fallback**: English for missing translations

## Notes for Developers

1. **Adding new strings**: All new UI strings must be added to all language files
2. **Logs**: All log messages remain in English
3. **Scripts**: All scripts and technical documentation remain in English
4. **Consistency**: Use consistent translations for similar terms

## Adding a New Language

1. Create a new folder with the language code (e.g. `it-IT` for Italian)
2. Create `language.json` with language information
3. Create `translation.json` with all translations
4. Add the language to the i18n configuration (`client/src/i18n.ts`)
5. Update the `LanguageSelector` component

## Quality Assurance

- All translations were created by "Phrosh"
- Consistent terminology within each language
- Complete coverage of all UI elements (over 200 translation keys per language)
- Fallback to English for missing translations
- All 12 languages are fully implemented and ready for use

## Translation Status

✅ **Fully translated**: All languages contain complete translation of all UI elements
- Admin Dashboard, Song Management, Playlist View, Show View
- Modals, Forms, Error Messages, Success Messages
- All buttons, labels, placeholders and tooltips
