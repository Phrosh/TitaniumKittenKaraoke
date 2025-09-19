# Internationalisierung (i18n) - Karaoke System

## Übersicht

Das Karaoke-System wurde vollständig internationalisiert und unterstützt derzeit 12 Sprachen:

- 🇺🇸 **Englisch** (en-US) - Standardsprache ✅
- 🇩🇪 **Deutsch** (de-DE) ✅
- 🇪🇸 **Spanisch** (es-ES) ✅
- 🇫🇷 **Französisch** (fr-FR) ✅
- 🇫🇮 **Finnisch** (fi-FI) ✅
- 🇳🇱 **Niederländisch** (nl-NL) ✅
- 🇵🇱 **Polnisch** (pl-PL) ✅
- 🇸🇪 **Schwedisch** (sv-SE) ✅
- 🇷🇺 **Russisch** (ru-RU) ✅
- 🇯🇵 **Japanisch** (ja-JP) ✅
- 🇰🇷 **Koreanisch** (ko-KR) ✅
- 🇨🇳 **Chinesisch** (zh-CN) ✅

## Ordnerstruktur

```
translations/
├── en-US/
│   ├── language.json      # Sprachinformationen
│   └── translation.json   # Übersetzungen
├── de-DE/
│   ├── language.json
│   └── translation.json
├── ... (weitere Sprachen)
└── README.md
```

## Sprachinformationen (language.json)

Jede Sprache hat eine `language.json` Datei mit folgenden Informationen:

```json
{
  "name": "Deutsch",           // Name der Sprache in der eigenen Sprache
  "nameEn": "German",          // Name der Sprache auf Englisch
  "author": "Phrosh"           // Autor der Übersetzung
}
```

## Übersetzungsstruktur (translation.json)

Die Übersetzungen sind in logische Bereiche unterteilt:

- `common` - Allgemeine UI-Elemente (Buttons, Labels, etc.)
- `songRequest` - Song-Anfrage-Formular
- `adminDashboard` - Admin-Dashboard
- `showView` - Karaoke-Show-Ansicht
- `playlistView` - Playlist-Ansicht
- `adminLogin` - Admin-Login
- `settings` - Einstellungen

## Verwendung

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

### Sprachauswahl

Die Sprachauswahl ist im Admin-Dashboard unter Einstellungen verfügbar. Die ausgewählte Sprache wird im localStorage gespeichert.

## Technische Details

- **Frontend**: react-i18next mit i18next-browser-languagedetector
- **Backend**: i18next (für zukünftige Backend-Internationalisierung)
- **Standardsprache**: Englisch (en-US)
- **Fallback**: Englisch bei fehlenden Übersetzungen

## Hinweise für Entwickler

1. **Neue Strings hinzufügen**: Alle neuen UI-Strings müssen in allen Sprachdateien hinzugefügt werden
2. **Logs**: Alle Log-Nachrichten bleiben auf Englisch
3. **Skripte**: Alle Skripte und technische Dokumentation bleiben auf Englisch
4. **Konsistenz**: Verwende konsistente Übersetzungen für ähnliche Begriffe

## Neue Sprache hinzufügen

1. Erstelle einen neuen Ordner mit dem Sprachcode (z.B. `it-IT` für Italienisch)
2. Erstelle `language.json` mit Sprachinformationen
3. Erstelle `translation.json` mit allen Übersetzungen
4. Füge die Sprache zur i18n-Konfiguration hinzu (`client/src/i18n.ts`)
5. Aktualisiere die `LanguageSelector`-Komponente

## Qualitätssicherung

- Alle Übersetzungen wurden von "Phrosh" erstellt
- Konsistente Terminologie innerhalb jeder Sprache
- Vollständige Abdeckung aller UI-Elemente (über 200 Übersetzungskeys pro Sprache)
- Fallback auf Englisch bei fehlenden Übersetzungen
- Alle 12 Sprachen sind vollständig implementiert und einsatzbereit

## Status der Übersetzungen

✅ **Vollständig übersetzt**: Alle Sprachen enthalten die komplette Übersetzung aller UI-Elemente
- Admin Dashboard, Song Management, Playlist View, Show View
- Modals, Forms, Error Messages, Success Messages
- Alle Buttons, Labels, Placeholders und Tooltips
