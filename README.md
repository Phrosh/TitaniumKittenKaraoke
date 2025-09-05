# 🎤 Karaoke Song Request System

Ein vollständiges Web-basiertes Karaoke-System mit automatischer Playlist-Verwaltung und Fairness-Algorithmus.

## ✨ Features

### Für Nutzer:
- **QR-Code Zugang**: Einfacher Zugang über QR-Code zu `/new`
- **Song-Wünsche**: Eingabe als "Interpret - Songtitel" oder YouTube-Link
- **Geräte-ID**: Automatische 3-stellige ID zur Identifikation
- **Live Playlist**: Echtzeit-Anzeige der aktuellen Playlist

### Für Admins:
- **Admin Dashboard**: Vollständige Playlist-Verwaltung
- **Fairness-Algorithmus**: Automatische faire Reihenfolge der Songs
- **YouTube Integration**: Links hinzufügen und verwalten
- **Song-Management**: Bearbeiten, löschen, neu anordnen
- **Live Controls**: Aktuellen Song setzen, "Weiter"-Button

### Technische Features:
- **Fairness-Algorithmus**: Verhindert, dass ein Nutzer mehrere Songs hintereinander singt
- **Einstellbare Verzögerung**: Max. Verschiebungen pro Song (Standard: 15)
- **Responsive Design**: Funktioniert auf allen Geräten
- **Real-time Updates**: Automatische Aktualisierung der Playlist

## 🚀 Installation

### Voraussetzungen
- Node.js (Version 16 oder höher)
- npm oder yarn

### Setup

1. **Repository klonen oder Dateien herunterladen**

2. **Dependencies installieren:**
```bash
npm install
cd client
npm install
cd ..
```

3. **Umgebungsvariablen konfigurieren:**
Erstelle eine `.env` Datei im Root-Verzeichnis:
```env
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:3000
JWT_SECRET=dein-super-geheimer-jwt-schluessel
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
MAX_SONG_DELAY=15
```

4. **System starten:**
```bash
# Entwicklung (Backend + Frontend)
npm run dev

# Oder separat:
npm run server  # Backend auf Port 5000
npm run client  # Frontend auf Port 3000
```

## 📱 Verwendung

### Für Nutzer:
1. QR-Code scannen oder zu `http://localhost:3000/new` gehen
2. Namen eingeben
3. Song-Wunsch eingeben (z.B. "Nickelback - How You Remind Me" oder YouTube-Link)
4. Absenden - Song wird automatisch in die Playlist eingefügt

### Für Admins:
1. Zu `http://localhost:3000/admin/login` gehen
2. Mit Standard-Credentials anmelden:
   - **Benutzername:** admin
   - **Passwort:** admin123
3. Playlist verwalten:
   - Songs bearbeiten
   - YouTube-Links hinzufügen
   - Reihenfolge ändern
   - Aktuellen Song setzen
   - Songs löschen

## 🎯 URLs

- **Hauptseite:** `http://localhost:3000/` - Live Playlist anzeigen
- **Song-Wunsch:** `http://localhost:3000/new` - Song hinzufügen
- **Admin Login:** `http://localhost:3000/admin/login` - Admin-Bereich
- **Admin Dashboard:** `http://localhost:3000/admin` - Playlist verwalten

## ⚙️ Konfiguration

### Fairness-Algorithmus
Der Algorithmus sorgt für eine faire Verteilung der Songs:
- Nutzer mit nur einem Song werden bevorzugt
- Songs werden automatisch eingefügt, um Stapelung zu vermeiden
- Max. Verschiebungen pro Song einstellbar (Standard: 15)

### Admin-Einstellungen
- **Max Song Delay:** Wie oft ein Song maximal nach hinten verschoben werden kann
- **Admin-Credentials:** Über `.env` Datei konfigurierbar

## 🛠️ Technische Details

### Backend (Node.js/Express):
- **Datenbank:** SQLite (automatisch erstellt)
- **Authentifizierung:** JWT-basiert
- **API:** RESTful API mit Express.js
- **Sicherheit:** Helmet, CORS, Rate Limiting

### Frontend (React/TypeScript):
- **Framework:** React 18 mit TypeScript
- **Styling:** Styled Components
- **Routing:** React Router DOM
- **HTTP Client:** Axios
- **QR-Codes:** QRCode.js

### Datenbank-Schema:
- **users:** Nutzer mit Geräte-IDs
- **songs:** Song-Wünsche mit Positionen
- **admin_users:** Admin-Benutzer
- **settings:** System-Einstellungen

## 🔧 Entwicklung

### Scripts:
```bash
npm start          # Produktions-Server
npm run dev        # Entwicklung (Backend + Frontend)
npm run server     # Nur Backend
npm run client     # Nur Frontend
npm run build      # Frontend für Produktion bauen
```

### API Endpoints:
- `POST /api/songs/request` - Song-Wunsch hinzufügen
- `GET /api/songs/playlist` - Playlist abrufen
- `GET /api/songs/qr-data` - QR-Code Daten
- `POST /api/auth/login` - Admin Login
- `GET /api/admin/dashboard` - Admin Dashboard
- `PUT /api/playlist/reorder` - Playlist neu anordnen
- `POST /api/playlist/next` - Zum nächsten Song

## 🚀 Deployment

### Produktion:
1. Frontend bauen: `npm run build`
2. Umgebungsvariablen für Produktion setzen
3. Server starten: `npm start`

### Docker (optional):
```dockerfile
# Dockerfile Beispiel
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN cd client && npm install && npm run build
EXPOSE 5000
CMD ["npm", "start"]
```

## 📝 Lizenz

MIT License - Siehe LICENSE Datei für Details.

## 🤝 Support

Bei Problemen oder Fragen:
1. Überprüfe die Konsole auf Fehlermeldungen
2. Stelle sicher, dass alle Dependencies installiert sind
3. Überprüfe die `.env` Konfiguration
4. Starte das System neu

---

**Viel Spaß beim Karaoke! 🎤🎵**