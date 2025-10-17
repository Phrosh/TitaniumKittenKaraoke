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
    const lines = content.split('\n').map(line => line.replace(/^[\r\n]+|[\r\n]+$/g, "")).filter(line => line.length > 0);

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
      version: '1.0.0', // Default version
      isDuet: false,
      singers: [
        { notes: [], lines: [] }, // Singer 0 (P1)
        { notes: [], lines: [] }  // Singer 1 (P2)
      ]
    };

    // Parse header attributes and notes
    let currentSinger = null; // null = no singer specified yet, 'P1' = singer 1, 'P2' = singer 2
    
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
            const videogapValue = value.replace(',', '.');
            songData.videogap = parseFloat(videogapValue) || 0;
            break;
          case 'BPM':
            songData.bpm = parseFloat(value) || 0;
            break;
          case 'GAP':
            const gapValue = value.replace(',', '.');
            songData.gap = parseFloat(gapValue) || 0;
            break;
          case 'BACKGROUND':
            songData.background = value;
            break;
          case 'VERSION':
            songData.version = value;
            break;
        }
      } else if (line.trim() === 'P1') {
        // Player 1 delimiter - switch to singer 1
        currentSinger = 'P1';
        songData.isDuet = true;
      } else if (line.trim() === 'P2') {
        // Player 2 delimiter - switch to singer 2
        currentSinger = 'P2';
        songData.isDuet = true;
      } else if (line.match(/^[:*\-FERG]\s+\d+/)) {
        // Parse note lines - starts with note type followed by space and number
        const note = parseNoteLine(line);
        if (note) {
          // Add singer information to note
          note.singer = currentSinger;
          
          let merge = false;
          let lastNote = null;
          
          if (note.text.trim() === '~') {
            // Find the last note for the current singer
            let singerNotes;
            if (currentSinger === 'P1') {
              singerNotes = songData.singers[0].notes;
            } else if (currentSinger === 'P2') {
              singerNotes = songData.singers[1].notes;
            } else {
              singerNotes = songData.notes;
            }
            lastNote = singerNotes[singerNotes.length - 1];
            if (lastNote) {
              if (lastNote.type !== '-') {
                merge = true;
              }
            }
          }
          
          if (merge) {
            lastNote.duration = note.startBeat - (lastNote.startBeat + lastNote.duration) + note.duration;
          } else {
            // Add note to appropriate singer's collection
            if (currentSinger === 'P1') {
              songData.singers[0].notes.push(note);
            } else if (currentSinger === 'P2') {
              songData.singers[1].notes.push(note);
            } else {
              // No singer specified - add to general notes (for backward compatibility)
              songData.notes.push(note);
            }
          }
        }
      }
    }
    
    // Group notes into lines (separated by end-of-phrase notes)
    songData.lines = groupNotesIntoLines(songData.notes);
    
    // If it's a duett, create separate lines for each singer
    if (songData.isDuet) {
      songData.singers[0].lines = groupNotesIntoLines(songData.singers[0].notes);
      songData.singers[1].lines = groupNotesIntoLines(songData.singers[1].notes);
      
      console.log(`🎤 Duett erkannt: "${songData.title}" - Sänger 1: ${songData.singers[0].notes.length} Noten, Sänger 2: ${songData.singers[1].notes.length} Noten`);
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
    // Use regex to extract parameters while preserving spaces
    // console.log("line", "-" + line + "-");
    const matches = [...line.matchAll(/(?:^| )( *[^ ]+(?: (?=$))?)/gm)];
    const parts = matches.map(match => match[1]);
    
    if (parts.length === 0) {
      return null;
    }
    
    const type = parts[0]; // :, *, -, F, E, R, G
    
    // Different validation for different note types
    if (type === '-' || type === 'E') {
      // End of phrase or end of song: only needs type and startBeat (2 parts minimum)
      if (parts.length < 2) {
        return null;
      }
    } else {
      // Normal notes: need type, startBeat, duration (3 parts minimum)
      if (parts.length < 3) {
        return null;
      }
    }

    const startBeat = parseInt(parts[1]) || 0;
    const duration = (type === '-' || type === 'E') ? 0 : (parseInt(parts[2]) || 0); // End-of-phrase and end-of-song have no duration
    
    // For "-" notes, ignore the second number if present (e.g., "- 100 101" -> use 100 as duration)
    let pitch = 0;
    let text = '';
    
    if (type === '-' || type === 'E') {
      // End of phrase or end of song: ignore second number, no pitch, no text
      pitch = 0;
      text = '';
    } else {
      // Normal notes: parse pitch and text
      pitch = parts[3] ? parseInt(parts[3]) : 0;
      text = parts[4];
      if (text.length > 1) {
        text = text.replace("~", "");
      }
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
          displayText = ''; // Line break symbol
        }
        break;
      case 'F':
        noteType = 'freestyle';
        displayText = text || ''; // Freestyle note with text
        break;
      case 'E':
        noteType = 'end';
        displayText = text || 'END';
        break;
      case 'R':
        noteType = 'rap';
        displayText = text || ''; // Rap note with text
        break;
      case 'G':
        noteType = 'golden_rap';
        displayText = text || ''; // Golden rap note with text
        break;
    }

    return {
      type: type,
      noteType: noteType,
      startBeat: startBeat,
      duration: duration,
      pitch: pitch,
      text: displayText,
      originalText: text,
      line: line
    };
  } catch (error) {
    console.error('Error parsing note line:', line, error);
    return null;
  }
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
    const audioExtensions = ['.mp3', '.ogg', '.flac', '.wav', '.m4a', '.aac'];
    
    // Sammle alle Audio-Dateien
    const audioFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return audioExtensions.includes(ext);
    });

    if (audioFiles.length === 0) {
      return null;
    }

    // Priorität: .mp3 > .ogg > .flac > andere
    const mp3Files = audioFiles.filter(file => file.toLowerCase().endsWith('.mp3'));
    const oggFiles = audioFiles.filter(file => file.toLowerCase().endsWith('.ogg'));
    const flacFiles = audioFiles.filter(file => file.toLowerCase().endsWith('.flac'));
    const otherFiles = audioFiles.filter(file => 
      !file.toLowerCase().endsWith('.mp3') && 
      !file.toLowerCase().endsWith('.ogg') && 
      !file.toLowerCase().endsWith('.flac')
    );

    // Prioritätslogik
    if (mp3Files.length > 0) {
      return path.join(folderPath, mp3Files[0]); // Erste .mp3 Datei
    } else if (oggFiles.length > 0) {
      return path.join(folderPath, oggFiles[0]); // Erste .ogg Datei
    } else if (flacFiles.length > 0) {
      return path.join(folderPath, flacFiles[0]); // Erste .flac Datei
    } else if (otherFiles.length > 0) {
      return path.join(folderPath, otherFiles[0]); // Erste andere Audio-Datei
    }
    
    return null;
  } catch (error) {
    console.error('Error finding audio file:', error);
    return null;
  }
}

/**
 * Groups notes into lines separated by end-of-phrase notes
 * @param {Array} notes - Array of parsed notes
 * @returns {Array} Array of lines, each containing notes for that line
 */
function groupNotesIntoLines(notes) {
  const lines = [];
  let currentLine = [];
  
  for (const note of notes) {
    if (note.type === '-' && !note.text.trim()) {
      // End of phrase (dash without text) - finish current line
      if (currentLine.length > 0) {
        lines.push({
          notes: currentLine,
          startBeat: currentLine[0].startBeat,
          endBeat: currentLine[currentLine.length - 1].startBeat + currentLine[currentLine.length - 1].duration
        });
        currentLine = [];
      }
    } else if (note.type === 'E') {
      // End of song - finish current line without adding the E note
      if (currentLine.length > 0) {
        lines.push({
          notes: currentLine,
          startBeat: currentLine[0].startBeat,
          endBeat: currentLine[currentLine.length - 1].startBeat + currentLine[currentLine.length - 1].duration
        });
        currentLine = [];
      }
      // Don't add E note to any line - it's just a marker
    } else {
      // Regular note (including F, R, G, and - with text) - add to current line
      currentLine.push(note);
    }
  }
  
  // Add remaining notes as last line if any
  if (currentLine.length > 0) {
    lines.push({
      notes: currentLine,
      startBeat: currentLine[0].startBeat,
      endBeat: currentLine[currentLine.length - 1].startBeat + currentLine[currentLine.length - 1].duration
    });
  }
  
  return lines;
}

module.exports = {
  parseUltrastarFile,
  parseNoteLine,
  findAudioFile,
  groupNotesIntoLines
};
