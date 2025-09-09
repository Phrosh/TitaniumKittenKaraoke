# YouTube Download Installation für AI Services

## Installation von yt-dlp

Führe die folgenden Befehle aus, um yt-dlp im AI-Services Environment zu installieren:

### Windows (PowerShell)
```powershell
# In das ai-services Verzeichnis wechseln
cd ai-services

# Virtuelles Environment aktivieren
.\venv\Scripts\activate

# yt-dlp installieren
pip install yt-dlp

# Oder mit der requirements.txt
pip install -r requirements.txt
```

### Linux/macOS
```bash
# In das ai-services Verzeichnis wechseln
cd ai-services

# Virtuelles Environment aktivieren
source venv/bin/activate

# yt-dlp installieren
pip install yt-dlp

# Oder mit der requirements.txt
pip install -r requirements.txt
```

## Testen der Installation

Nach der Installation kannst du testen:

```python
# In der Python-Konsole des AI-Services
import yt_dlp
print("yt-dlp erfolgreich installiert!")
```

## AI Services neu starten

Nach der Installation musst du die AI Services neu starten:

```bash
# Im ai-services Verzeichnis
python app.py
```

## Troubleshooting

### "yt-dlp not installed" Fehler
- Stelle sicher, dass das virtuelle Environment aktiviert ist
- Prüfe, ob yt-dlp in der requirements.txt steht
- Starte die AI Services neu

### Download-Probleme
- Überprüfe die YouTube-URL
- Stelle sicher, dass das Video öffentlich zugänglich ist
- Prüfe die Netzwerkverbindung
- Schaue in die AI Services Logs für detaillierte Fehlermeldungen
