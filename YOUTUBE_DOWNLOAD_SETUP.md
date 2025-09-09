# YouTube Download Setup

Für die YouTube-Download-Funktionalität wird yt-dlp benötigt.

## Installation

### Windows
```bash
# Mit pip installieren
pip install yt-dlp

# Oder mit chocolatey
choco install yt-dlp

# Oder mit winget
winget install yt-dlp
```

### Linux/macOS
```bash
# Mit pip installieren
pip install yt-dlp

# Oder mit brew (macOS)
brew install yt-dlp

# Oder mit apt (Ubuntu/Debian)
sudo apt install yt-dlp
```

## Alternative: youtube-dl
Falls yt-dlp nicht verfügbar ist, wird automatisch youtube-dl als Fallback verwendet:

```bash
pip install youtube-dl
```

## Testen
Nach der Installation kannst du testen:

```bash
yt-dlp --version
```

## Troubleshooting

### "yt-dlp not found" Fehler
- Stelle sicher, dass yt-dlp im PATH verfügbar ist
- Starte den Server neu nach der Installation
- Prüfe die Konsolen-Logs für detaillierte Fehlermeldungen

### Download-Probleme
- Überprüfe die YouTube-URL
- Stelle sicher, dass das Video öffentlich zugänglich ist
- Prüfe die Netzwerkverbindung
