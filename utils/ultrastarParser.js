const fs = require('fs');
const path = require('path');

/**
 * Parst eine Ultrastar .txt Datei und extrahiert alle wichtigen Informationen
 * @param {string} filePath - Pfad zur .txt Datei
 * @returns {Object} Parsed Ultrastar Song Data
 */
function parseUltrastarFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Ultrastar file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    const songData = {
      title: '',
      artist: '',
      language: '',
      edition: '',
      genre: '',
      year: '',
      mp3: '',
      cover: '',
      video: '',
      videogap: 0,
      bpm: 0,
      gap: 0,
      background: '',
      notes: [],
      version: '1.0.0' // Default version
    };

    // Parse header attributes
    for (const line of lines) {
      if (line.startsWith('#')) {
        const [key, ...valueParts] = line.substring(1).split(':');
        const value = valueParts.join(':').trim();
        
        switch (key.toUpperCase()) {
          case 'TITLE':
            songData.title = value;
            break;
          case 'ARTIST':
            songData.artist = value;
            break;
          case 'LANGUAGE':
            songData.language = value;
            break;
          case 'EDITION':
            songData.edition = value;
            break;
          case 'GENRE':
            songData.genre = value;
            break;
          case 'YEAR':
            songData.year = value;
            break;
          case 'MP3':
            songData.mp3 = value;
            break;
          case 'COVER':
            songData.cover = value;
            break;
          case 'VIDEO':
            songData.video = value;
            break;
          case 'VIDEOGAP':
            songData.videogap = parseInt(value) || 0;
            break;
          case 'BPM':
            songData.bpm = parseFloat(value) || 0;
            break;
          case 'GAP':
            // GAP can be in format "19544,12" - we take the first part
            const gapValue = value.split(',')[0];
            songData.gap = parseFloat(gapValue) || 0;
            break;
          case 'BACKGROUND':
            songData.background = value;
            break;
          case 'VERSION':
            songData.version = value;
            break;
        }
      } else if (line.match(/^[:*\-FE]\s+\d+/)) {
        // Parse note lines - starts with note type followed by space and number
        const note = parseNoteLine(line);
        if (note) {
          songData.notes.push(note);
        }
      }
    }

    return songData;
  } catch (error) {
    console.error('Error parsing Ultrastar file:', error);
    return null;
  }
}

/**
 * Parst eine einzelne Note-Zeile aus der Ultrastar-Datei
 * @param {string} line - Die Note-Zeile
 * @returns {Object|null} Parsed Note Object
 */
function parseNoteLine(line) {
  try {
    const parts = line.split(' ');
    
    console.log('🔍 Parsing line:', line, 'Parts:', parts);
    
    const type = parts[0]; // :, *, -, F, E
    
    // Different validation for different note types
    if (type === '-') {
      // End of phrase: only needs type and startBeat (2 parts minimum)
      if (parts.length < 2) {
        console.log('❌ End-of-phrase line too short, skipping:', line);
        return null;
      }
    } else {
      // Normal notes: need type, startBeat, duration (3 parts minimum)
      if (parts.length < 3) {
        console.log('❌ Normal note line too short, skipping:', line);
        return null;
      }
    }

    const startBeat = parseInt(parts[1]) || 0;
    const duration = type === '-' ? 0 : (parseInt(parts[2]) || 0); // End-of-phrase has no duration
    
    console.log('📝 Basic parsing:', { type, startBeat, duration, partsLength: parts.length });
    
    // For "-" notes, ignore the second number if present (e.g., "- 100 101" -> use 100 as duration)
    let pitch = 0;
    let text = '';
    
    if (type === '-') {
      // End of phrase: ignore second number, no pitch, no text
      pitch = 0;
      text = '';
      console.log('➖ End of phrase note:', { startBeat, duration, ignoredParts: parts.slice(3) });
    } else {
      // Normal notes: parse pitch and text
      pitch = parts[3] ? parseInt(parts[3]) : 0;
      text = parts.slice(4).join(' ').trim();
      console.log('🎵 Normal note:', { startBeat, duration, pitch, text });
    }

    // Handle special note types
    let noteType = 'normal';
    let displayText = text;
    
    switch (type) {
      case ':':
        noteType = 'normal';
        break;
      case '*':
        noteType = 'golden';
        break;
      case '-':
        // - without text = end of phrase, - with text = freestyle
        if (text.trim()) {
          noteType = 'freestyle';
        } else {
          noteType = 'linebreak';
          displayText = '~'; // Line break symbol
        }
        break;
      case 'F':
        noteType = 'linebreak';
        displayText = text || '~'; // Line break symbol
        break;
      case 'E':
        noteType = 'end';
        displayText = text || 'END';
        break;
    }

    const note = {
      type: type,
      noteType: noteType,
      startBeat: startBeat,
      duration: duration,
      pitch: pitch,
      text: displayText,
      originalText: text,
      line: line
    };
    
    console.log('✅ Final note object:', note);
    return note;
  } catch (error) {
    console.error('Error parsing note line:', line, error);
    return null;
  }
}

/**
 * Berechnet die Zeit in Millisekunden für einen bestimmten Beat
 * @param {number} beat - Beat-Nummer
 * @param {number} bpm - Beats per Minute
 * @param {number} gap - Gap in Millisekunden
 * @returns {number} Zeit in Millisekunden
 */
function beatToMilliseconds(beat, bpm, gap) {
  if (bpm <= 0) return 0;
  
  // 1 Beat = 60.000 / BPM Millisekunden
  const beatDuration = 60000 / bpm;
  return gap + (beat * beatDuration);
}

/**
 * Findet alle Audio-Dateien in einem Ultrastar-Ordner
 * @param {string} folderPath - Pfad zum Ultrastar-Ordner
 * @returns {string|null} Pfad zur Audio-Datei oder null
 */
function findAudioFile(folderPath) {
  try {
    if (!fs.existsSync(folderPath)) {
      return null;
    }

    const files = fs.readdirSync(folderPath);
    const audioExtensions = ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac'];
    
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (audioExtensions.includes(ext)) {
        return path.join(folderPath, file);
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error finding audio file:', error);
    return null;
  }
}

module.exports = {
  parseUltrastarFile,
  parseNoteLine,
  beatToMilliseconds,
  findAudioFile
};
