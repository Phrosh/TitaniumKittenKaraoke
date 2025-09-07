# AI Services

Dieser Python-Server bietet KI-Services und Video-Konvertierung für das Karaoke-System.

## Setup

1. **Virtual Environment aktivieren:**
   ```bash
   venv\Scripts\activate
   ```

2. **Dependencies installieren:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Server starten:**
   ```bash
   python app.py
   ```
   
   Oder mit den bereitgestellten Scripts:
   - `start_server.bat` (Windows Batch)
   - `start_server.ps1` (PowerShell)

## API Endpoints

### Health Check
- `GET /health` - Server-Status prüfen

### Video Konvertierung
- `POST /song/ultrastar/{folder_name}/convert_video` - Video zu WebM konvertieren
- `GET /song/ultrastar/{folder_name}/video_info` - Video-Informationen abrufen

## Video-Konvertierung

Der Server konvertiert Videos automatisch zu WebM-Format mit folgenden FFmpeg-Parametern:
- Video: libvpx-vp9 Codec, CRF 30, YUV420P Pixelformat
- Audio: libopus Codec, 128k Bitrate
- Optimiert für Web-Wiedergabe

## Integration

Das Node.js Backend ruft automatisch die Konvertierung auf, wenn:
1. Ein Ultrastar-Song hinzugefügt wird
2. Das Video nicht .mp4 oder .webm ist
3. Der Python-Server auf Port 6000 läuft

## Zukünftige Features

- KI-basierte Audio-Verbesserung
- Automatische Video-Optimierung
- Intelligente Thumbnail-Generierung
- Audio-Analyse für Karaoke-Features