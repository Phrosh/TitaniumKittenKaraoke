# Titanium Kitten Karaoke - Erste Schritte

Willkommen bei Titanium Kitten Karaoke! Diese Anleitung führt dich durch den kompletten Einrichtungsprozess, von der Installation der Abhängigkeiten bis zur Durchführung deiner ersten Karaoke-Session.

Die Installation ist nur für den Server erforderlich. Sobald dieser läuft, kannst du über deinen Browser auf alles zugreifen. Deshalb kannst du Titanium Kitten auch mit dem alten Holzlaptop deiner Großmutter nutzen, solange ein moderner Internetbrowser drauf läuft.

## 📋 Voraussetzungen (Server)

Bevor du beginnst, stelle sicher, dass folgende Software auf deinem System installiert ist:

### Erforderliche Software

#### 1. Node.js (Version 18 oder höher)
- **Download**: [Node.js Offizielle Website](https://nodejs.org/)
- **Überprüfung**: Führe `node --version` im Terminal aus
- **Hinweis**: npm wird mit Node.js mitgeliefert

#### 2. Python 3.10 oder höher
- **Download**: [Python Offizielle Website](https://www.python.org/downloads/)
- **Überprüfung**: Führe `python --version` im Terminal aus
- **Wichtig**: Stelle sicher, dass "Add Python to PATH" während der Installation aktiviert ist

#### 3. FFmpeg (Essentiell für Audio/Video-Verarbeitung)
- **Windows**: 
  - Download von [FFmpeg Downloads](https://ffmpeg.org/download.html)
  - Entpacken in einen Ordner (z.B. `C:\ffmpeg`)
  - `bin` Ordner zu deiner PATH-Umgebungsvariable hinzufügen
  - **Schritt-für-Schritt PATH-Einrichtung**:
    1. Drücke `Win + R`, tippe `sysdm.cpl`, drücke Enter
    2. Klicke auf "Umgebungsvariablen..."
    3. Unter "Systemvariablen" wähle `Path` aus und klicke "Bearbeiten"
    4. Klicke "Neu" und füge deinen FFmpeg bin Pfad hinzu (z.B. `C:\ffmpeg\bin`)
    5. Klicke "OK" in allen Dialogen
    6. Starte dein Terminal/IDE neu
- **macOS**: `brew install ffmpeg`
- **Linux**: `sudo apt-get install ffmpeg` (Ubuntu/Debian) oder verwende den Paketmanager deiner Distribution
- **Überprüfung**: Führe `ffmpeg -version` im Terminal aus

#### 4. CUDA (Optional aber empfohlen für KI-Features)
- **Download**: [NVIDIA CUDA Toolkit](https://developer.nvidia.com/cuda-downloads)
- **Hinweis**: Nur erforderlich, wenn du Hardware-Beschleunigung für KI-gestützte Features möchtest
- **Alternative**: CPU-only Modus funktioniert, ist aber langsamer

### Systemanforderungen

- **Netzwerk**: Stabile Internetverbindung
- **Ports**: Stelle sicher, dass die Ports 3000, 5000, 6000 und 4000 verfügbar sind

## 🚀 Installation

1. **Repository klonen oder Dateien herunterladen**
2. **Installationsskript ausführen**:
   ```bash
   # Windows
   install.bat
   
   # Linux/macOS
   chmod +x install.sh
   ./install.sh
   ```

Das Skript wird automatisch:
- Node.js Abhängigkeiten installieren
- Python Abhängigkeiten installieren
- Virtuelle Umgebung einrichten
- Projekt konfigurieren

## 🎮 Anwendung starten (Server)

### Komplettes System starten

```bash
# Windows
start.bat

# Linux/macOS
./start.sh
```

## Dateienverwaltung
Die größte Stärke von Titanium Kitten ist die nahtlose Verschmelzung von verschiedensten Quellen für deine Karaoke-Songs. Ob du Karaoke-Videos von deiner Festplatte abspielst oder YouTube Songs nimmst, spielt am Ende keine Rolle mehr.
Damit Titanium Kitten deine Dateien erkennt, musst du sie in die folgenden Ordner packen:

- `songs/videos`: Schon fertige Karaoke-Videos
- `songs/ultrastar`: Dateien für den Singstar-Klon "Ultrastar". Hierzu gehören üblicherweise eine Textdatei, eine Audiodatei und oftmals auch ein Video
- `songs/magic-songs`: Normale Audio-Dateien. TKK soll aus diesen eine Karaoke-Version erstellen. Videos oder Bilder können optional dazugepackt werden.
- `songs/magic-videos`: Normale Video-Dateien. TKK soll aus diesen eine Karaoke-Version erstellen.

Songs in dem Ordner `videos` müssen in dem Format `Interpret - Songtitel.mp4` sein. Songs in anderen Ordnern müssen in einem Unterordner mit dem Format `Interpret - Songtitel` sein. 

### Beispiel 1
Das Karaoke-Video für "The Quiet Place" von In Flames ist dann hier: 
- `songs/videos/In Flames - The Quiet Place.mp4`.

### Beispiel 2
Die Dateien für den Song "Mirror Mirror" von Blind Guardian sehen dann z.B. so aus:
- `songs/ultrastar/Blind Guardian - Mirror Mirror/Blind Guardian - Mirror Mirror.txt`
- `songs/ultrastar/Blind Guardian - Mirror Mirror/Blind Guardian - Mirror Mirror.mp4`
- `songs/ultrastar/Blind Guardian - Mirror Mirror/Blind Guardian - Mirror Mirror.mp3`

Die Benennung der einzelnen Dateien in den Unterordnern ist egal.

**Hinweis**: Die Dateien befinden sich dann auf dem **Server**, d.h. du nimmst sie in der Regel nicht mit zu deiner Karaoke-Session - es sei denn du nimmst den Server mit. Diese Dateien werden alle über das Internet geladen, wenn du eine Karaoke-Session veranstaltest.

Du kannst auch Videos von deinem Laptop (Client) in die Liste der Songs mit aufnehmen. Dazu aber später mehr.

## Was ist Ultrastar?
Ultrastar ist ein bekannter Singstar-Klon für den PC mit einer noch immer aktiven Community. Hier können findige Nutzer Songs mit Songtext-Timings und gesungenen Noten für bekannte Songs basteln und anderen Nutzern zur Verfügung stellen. Eine der bekanntesten Seiten, die diese Dateien anbietet ist [USDB](https://usdb.animux.de). Titanium Kitten kann diese Dateien lesen und entsprechend als Karaoke-Song interpretieren.

Ultrastar Dateien haben in der Regel die beste Karaoke-Qualität von allen. Der Text wurde durch Menschen erkannt und die Instrumental-Version erstellt Titanium Kitten selbst.

Titanium Kitten bietet aber auch die Möglichkeit, diese Ultrastar Dateien direkt zu suchen und als fertige Karaoke-Songs herunterzuladen. Dazu später mehr unter dem Abschnitt **USDB**. 

## Die erste Benutzung
Nachdem du den Server, wie oben beschrieben, mit `start.bat` hochgefahren hast, kannst du in das **Admin-Dashboard** gehen. Besuche dazu `localhost:5000/admin` in deinem Browser.

Nachdem du dir einen Admin-Nutzer erstellt hast, loggst du dich mit den Nutzerdaten ein und gelangst in das Admin-Menu. Mit diesem solltest du dich gut vertraut machen, denn es wird das sein, mit dem du während einer Karaoke-Session im Hintergrund alles bedienen wirst.

Natürlich solltest du dir einmal alle Tabs im Admin-Dashboard ansehen, aber gehen wir zunächst einmal in die **Einstellungen**. Neben diverser Möglichkeiten deiner Karaoke-Session einen persönlichen Anstrich zu verleihen, ist ein Abschnitt besonders wichtig: **Cloudflared**.

Cloudflared ist ein Service von Cloudflare, der es dir ermöglicht Titanium Kitten über das Internet von deinem PC, vor dem du gerade sitzt (Server), an deinen Laptop für die Karaoke-Session unterwegs weiterzuleiten.
Um diesen Service einmal einzurichten, drücke auf den `Cloudflared Einrichten`-Button. Dies musst du nur ein einziges Mal machen, danach ist der Service eingerichtet.

Drücke jedes mal, bevor du eine Karaoke-Session startest und Titanium Kitten außerhalb deiner vier Wände nutzen möchtest, auf den `Cloudflared Starten`Button. Notiere dir die Internet-Adresse, die unter "Eigene URL" erscheint. Diese gibst du später in deinem Browser-Fenster auf einem anderen Computer ein, um Titanium Kitten zu benutzen. So, wie du eben über `localhost:5000/admin` in das Admin-Dashboard gekommen bist, kannst du jetzt über das Internet mittels `https://[diese-eigene-url]/admin` darauf zugreifen. Ab jetzt kannst du dir also aussuchen, ob du weiter diesen PC (Server) oder einen anderen (Client) für Titanium Kitten benutzt. Diesen Schritt musst du **jedes mal** ausführen, bevor du eine Karaoke-Session startest, weil sich die "Eigene URL" mit der Zeit ändert.

Hast du Karaoke-Videos, die du mit zu deiner Karaoke-Session nehmen willst und nicht auf dem Server liegen? Dann scroll nach unten zu "Lokaler Song-Ordner". Hier gibst du den Ordnerpfad dieser Songs an. 
Dann musst du (dieses mal auf dem PC, den du mit zum Karaoke nimmst) einen lokalen Webserver für die Videos starten. Keine Sorge, das ist ganz einfach. Dazu kopierst du einfach den Befehl, der ganz unten steht, fügst ihn in ein Konsolenfenster ein und drückst Enter. Anschließend auf den Button `Neu scannen`. Dann werden auch Songs, die unter diesem Ordner liegen, in die Karaoke-Liste mit aufgenommen.

## Die erste Live-Session
Du hast also jetzt den Server zu Hause laufen, bist unterwegs und hast deinen Laptop aufgeschlagen. Hier hast du idealerweise zwei Bildschirme: Einmal einen für dich und dein Admin-Dashboard und einmal den für die Teilnehmer des Karaokes, auf dem die aktuellen Karaoke-Texte angezeigt werden. Üblicherweise ist der Admin-Bildschirm der deines Laptops und der Karaoke-Bildschirm ein großer Monitor oder direkt ein Beamer-Bild.

**Pro-Tipp**: Als Karaoke-Bildschirm sowohl einen großen Monitor **als auch** einen Beamer nehmen. Das Ausgabebild hier soll gedoppelt werden. So kannst du sowohl den aktuellen Sängern, als auch dem Publikum ein Karaoke-Bild liefern.

Auf deinem Admin-Bildschirm öffnest du dann das **Admin-Panel**, wie im Schritt davor über `https://[diese-eigene-url]/admin`. Auf dem Karaoke-Bildschirm öffnest du ein zweites Browserfenster mit der URL `https://[diese-eigene-url]/show`. Bevor du ihn benutzen kannst, musst du einmal auf den großen Start-Button klicken.

**Pro-Tipp**: Um das Beste aus deinem Bildschirm herauszuholen, empfielt es sich den Browser im Vollbild laufen zu lassen. Drücke dazu auf den kleinen Button ganz rechts oben.

Prima! Deine Karaoke-Session kann beginnen.

Wenn Leute den QR Code scannen, können sie Songwünsche abgeben, die im **Playlist**-Tab in deinem Admin-Dashboard erscheinen. Du hast oberhalb der Playlist mehrere Buttons, um die Songs zu steuern. Du kannst auch immer einen Song direkt auswählen und abspielen. Auch Songs neu anordnen geht, indem du ihn einfach mit der Maus verschiebst. Möchten Kandidaten ihren Songwunsch nicht selbst über den QR Code eintragen, kannst du dies auch manuell über den **Song hinzufügen**-Button machen.

## Ein typischer Ablauf
Fügen Kandidaten ihre Songwünsche hinzu, erscheint dieser Eintrag in der Playlist. Handelt es sich um einen Song, der nicht in deiner Songliste ist, musst du handeln. Der Songvorschlag erscheint in deiner Playlist mit einem riesigen Button und du kannst eine dieser Sachen machen:
1. Du gibst dem Song einen YouTube-Link zu einem Karaoke-Video auf YouTube. Gehe dazu in einem weiteren Tab auf YouTube und kopiere dir die Adresse des Videos.
2. Jemand hat schon eine Ultrastar-Datei zu diesem Song erstellt und sie auf USDB geladen. Wenn du deine USDB-Zugangsdaten unter **Einstellungen** eingetragen hast, kannst du auch nach dieser suchen. Das geht ebenfalls in dem Fenster für die YouTube Links.
3. Es gibt noch keine Karaoke-Version von dem Song. Dann suche dir bei YouTube den Song als Nicht-Karaoke-Version und Kopiere den Link. Gib in dem Fenster an, dass es sich nicht um einen Karaoke Song handelt und Titanium Kitten Karaoke einen Song daraus machen soll.

Alles weitere passiert im Hintergrund. Sobald ein Song fertig heruntergeladen und verarbeitet wurde, kann er wie jeder andere Song gesungen werden. 

**Tipp**: Halte deine Song-Einträge sauber. Nicht jeder Teilnehmer hält sich an die "Interpret - Songname" Regel. Oftmals werden auch Interpreten oder Songnamen falsch geschrieben. Ich empfehle dir, jeden falschgeschriebenen Song-Eintrag einmal zu überarbeiten. Das ergibt vor allem in Kombination mit dem Caching Sinn, welches ich im nächsten Abschnitt kurz erläutere.

## Caching
Titanium Kitten Karaoke verfügt über ein so genanntes Caching. Das bedeutet, dass YouTube Videos auf den Server gespeichert werden, anstatt direkt von YouTube abgespielt zu werden. Songs, die schon einmal gesungen wurden, musst du dadurch nicht neu suchen, wenn sie noch einmal gesungen werden. Damit diese aber richtig zugeordnet werden können, müssen Interpret und Songtitel übereinstimmen. Wenn du z.B. den Song "Abba - Mama Mia" im Cache hast (weil du den Karaoke-Video YouTube Link zuvor bei einem Songvorschlag mit Interpret "Abba" und Songname "Mama Mia" eingetragen hast) und später ein Teilnehmer den Song ebenfalls singen möchte, allerdings einen Tippfehler macht und "Aba" anstatt "Abba" eingibt, wird der Song nicht als schon einmal gesungen erkannt. Du musst den neuen Song in "Abba" ändern, dann funktioniert die Erkennung wieder automatisch.
Tricky wird es natürlich, wenn der erste Song schon falsch geschrieben wurde, da dann nach dem richtigen Songnamen gesucht wird, aber nur der falsche existiert. Daher: Vor dem Eintragen des YouTube Links prüfen, ob alles richtig geschrieben wurde.

Aber keine Sorge. Selbst, wenn du das einmal vergessen haben solltest, kannst du das im Nachhinein lösen, wie im folgenden Abschnitt beschrieben.

## Songverwaltung
Im Tab "Songverwaltung" hast du eine Übersicht über alle Songs im Cache. Dazu zählen YouTube Videos, aber auch Ultrastar-Dateien, Videodateien auf dem Server und alle weiteren.

Du kannst selbst entscheiden, welche Songs davon in der Songliste für die Teilnehmer auftauchen, oder ob sie nur im Cache für schnelleres Laden gespeichert werden sollen. Wurde ein Song unter falschem Namen gespeichert, kannst du ihn hier umbenennen. Ebenso kannst du hier die Verarbeitung für Magic-Songs und Ultrastar Songs starten, die du nicht über Titanium Kitten heruntergeladen hast.

Möchtest du also einen YouTube Song, der schon einmal gesungen wurden, in die Songliste für deine Teilnehmer mit aufnehmen, kannst du ihn hier suchen und mit einem Klick aktivieren. Das gilt ebenso für automatisch heruntergeladene Ultrastar-Dateien von USDB.

Du kannst Songs direkt testen. Testest du einen Song, wird er im Karaoke-Bildschirm als Testsong abgespielt. Bei Ultrastar Songs kannst du zusätzlich festlegen, ob Teilnehmer die Möglichkeit haben sollen Backing-Vocals für einzelne Songs zu aktivieren. Nicht jeder Song funktioniert mit Backing Vocals so gut wie ohne - daher ist es ratsam jede Version einmal anzutesten, wenn ein Song diese Option bietet.

Ultrastar-Songs, Magic-Songs und Magic-Videos müssen vorher verarbeitet werden, bevor du sie benutzen kannst. Dazu hat jeder Song, der eine Verarbeitung nötig hat einen Button. Ausnahme bilden hier Ultrastar-Songs, die Titanium Kitten selbst über USDB heruntergeladen hat. Diese werden nach dem Herunterladen automatisch verarbeitet und du musst sie nur noch aktivieren, damit sie in der Songliste auftauchen.

## USDB
Ein weiteres großes Kapitel in Titanium Kitten Karaoke ist die Integration von USDB. Wie eingangs schon erwähnt ist [USDB](https://usdb.animux.de) eine bekannte Seite für Ultrastar Dateien. Du hast die Möglichkeit direkt über die Songverwaltung diese Ultrastar-Datenbank zu durchsuchen und Songs daraus in deine Songliste mit aufzunehmen. Nachdem du dir ein kostenloses Konto auf der [USDB Website](https://usdb.animux.de) erstellt hast, gibst du zunächst in **Einstellungen** deine Zugangsdaten ein. Danach kannst du über den Button in der Songverwaltung ganz einfach nach Songs suchen und diese herunterladen. Nach dem Herunterladen erscheinen diese automatisch in der Songliste.

Sind deine USDB Zugangsdaten eingetragen, bietet Titanium Kitten Karaoke ein weiteres Feature, was im Hintergrund für dich arbeitet. Wird ein Songvorschlag abgegeben, aber der Song ist noch nicht im Cache vorhanden, wird nach dem Abgeben des Songvorschlags USDB im Hintergrund nach diesem Song durchsucht. Findet Titanium Kitten den Song, wird dieser im Hintergrund heruntergeladen und du kannst dir die manuelle Suche nach der Ultrastar-Datei oder einem YouTube-Link komplett sparen. Und: dadurch dass du jetzt mit der Ultrastar-Datei arbeitest, hast du automatisch die beste Qualität an Karaoke-Material.

## Nach der Karaoke-Session
Während einer Karaoke-Session ist viel passiert. Jeder Song, der gesungen wurde, ist im Cache gelandet. Ultrastar Songs wurden im Hintergrund über USDB heruntergeladen. Alle Songs, die du nicht manuell herunterlädst, sondrn automatisch im Hintergrund heruntergeladen werden, landen zwar im Cache, aber nicht automatisch in der Songliste.

Daher empfielt es sich, im Anschluss an eine Karaoke-Session einmal über die Songliste im Songmanagement drüberzugehen und zu gucken, ob auch weiterhin alles korrekt ist:
- Sind alle Interpreten und Songnamen korrekt geschrieben?
- Möchtest du für die nächste Karaoke-Session gecachte Songs in die Songliste für Teilnehmer mit aufnehmen?
- Funktionieren alle neuen Ultrastar-Songs sowohl mit als auch ohne Backing Vocals?

Da in Titanium Kitten viel automatisch passiert, ist eine Nachbereitung für ein professionelles Karaoke empfehlenswert.

## Schlusswort
Das war's! Die wichtigsten Schritte in Titanium Kitten Karaoke hast du nun raus und bist bereit für deine erste Karaoke-Session.

Es gibt natürlich noch viel zu entdecken. In den Einstellungen findest du weitere interessante Möglichkeiten, die Karaoke-Sessions mit Titanium Kitten anzupassen. Du kannst Teilnehmer, die dir auf die Nerven gehen bannen oder weitere Admin-Nutzer hinzufügen. Oder passe die Hintergrundmusik zwischen den Songs nach Belieben an. Klicke dich ein wenig durch Titanium Kitten und erkunde die Einstellungen.

Jetzt bleibt nur noch zu sagen: **Viel Spaß mit deiner eigenen Karaoke-Session in Titanium Kitten Karaoke**
