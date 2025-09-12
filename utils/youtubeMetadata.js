const axios = require('axios');

class YouTubeMetadataService {
  /**
   * Extrahiert Video-ID aus verschiedenen YouTube-URL-Formaten
   */
  static extractVideoId(url) {
    if (!url) return null;
    
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  }

  /**
   * Holt Metadaten von YouTube über oEmbed API (kostenlos, keine API-Key nötig)
   */
  static async getMetadataFromOEmbed(videoId) {
    try {
      const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const response = await axios.get(oEmbedUrl, { 
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });
      
      if (response.data && response.data.title) {
        return {
          title: response.data.title,
          author: response.data.author_name || null,
          thumbnail: response.data.thumbnail_url || null
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching YouTube oEmbed data:', error.message);
      return null;
    }
  }

  /**
   * Alternative Methode: Web-Scraping der YouTube-Seite
   */
  static async getMetadataFromScraping(videoId) {
    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });

      const html = response.data;
      
      // Extrahiere Titel aus dem HTML
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : null;
      
      // Extrahiere Channel-Name
      const channelMatch = html.match(/"ownerText":\s*{\s*"runs":\s*\[\s*{\s*"text":\s*"([^"]+)"/i);
      const channel = channelMatch ? channelMatch[1] : null;
      
      // Extrahiere Thumbnail
      const thumbnailMatch = html.match(/"thumbnail":\s*{\s*"thumbnails":\s*\[\s*{\s*"url":\s*"([^"]+)"/i);
      const thumbnail = thumbnailMatch ? thumbnailMatch[1] : null;

      if (title) {
        return {
          title: title,
          author: channel,
          thumbnail: thumbnail
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error scraping YouTube page:', error.message);
      return null;
    }
  }

  /**
   * Holt Video-Dauer über YouTube's oEmbed API (kostenlos, aber ohne Dauer)
   * Alternative: Verwende eine andere Methode oder akzeptiere, dass Dauer nicht verfügbar ist
   */
  static async getVideoDuration(videoId) {
    try {
      // YouTube's oEmbed API liefert keine Dauer-Informationen
      // Für eine echte Dauer-Extraktion bräuchten wir die YouTube Data API v3 mit API-Key
      // Für jetzt geben wir null zurück und verwenden einen Standard-Wert
      console.log('Duration extraction not available for video:', videoId);
      return null;
    } catch (error) {
      console.error('Error fetching video duration:', error);
      return null;
    }
  }

  /**
   * Parst Titel und Interpret aus dem YouTube-Titel
   * Versucht verschiedene Formate zu erkennen
   */
  static parseTitleAndArtist(youtubeTitle) {
    if (!youtubeTitle) return { title: null, artist: null };

    // Entferne häufige YouTube-Suffixe und Zusätze
    let cleanTitle = youtubeTitle
      .replace(/\s*\(Official Video\)/gi, '')
      .replace(/\s*\(Official Music Video\)/gi, '')
      .replace(/\s*\(Official\)/gi, '')
      .replace(/\s*\(Music Video\)/gi, '')
      .replace(/\s*\(MV\)/gi, '')
      .replace(/\s*\(Lyrics\)/gi, '')
      .replace(/\s*\(Lyric Video\)/gi, '')
      .replace(/\s*\(Audio\)/gi, '')
      .replace(/\s*\(HD\)/gi, '')
      .replace(/\s*\(4K\)/gi, '')
      .replace(/\s*\(Live\)/gi, '')
      .replace(/\s*\(Studio Version\)/gi, '')
      .replace(/\s*\(Remastered\)/gi, '')
      .replace(/\s*\[Official Video\]/gi, '')
      .replace(/\s*\[Official Music Video\]/gi, '')
      .replace(/\s*\[Official\]/gi, '')
      .replace(/\s*\[Music Video\]/gi, '')
      .replace(/\s*\[MV\]/gi, '')
      .replace(/\s*\[Lyrics\]/gi, '')
      .replace(/\s*\[Lyric Video\]/gi, '')
      .replace(/\s*\[Audio\]/gi, '')
      .replace(/\s*\[HD\]/gi, '')
      .replace(/\s*\[4K\]/gi, '')
      .replace(/\s*\[Live\]/gi, '')
      .replace(/\s*\[Studio Version\]/gi, '')
      .replace(/\s*\[Remastered\]/gi, '')
      .replace(/\s*feat\.?\s*/gi, 'feat. ')
      .replace(/\s*ft\.?\s*/gi, 'feat. ')
      .trim();

    // Verschiedene Trennzeichen versuchen (erweitert)
    const separators = [
      ' - ', ' – ', ' — ', ' | ', ' :: ', ' : ', 
      ' • ', ' · ', ' ~ ', ' / ', ' \\ ', ' // ',
      ' feat. ', ' featuring ', ' ft. ', ' with '
    ];
    
    for (const separator of separators) {
      if (cleanTitle.includes(separator)) {
        const parts = cleanTitle.split(separator);
        if (parts.length >= 2) {
          const artist = parts[0].trim();
          const title = parts.slice(1).join(separator).trim();
          
          // Validiere dass beide Teile sinnvoll sind
          if (artist.length > 0 && title.length > 0 && 
              artist.length < 100 && title.length < 200 &&
              !artist.toLowerCase().includes('youtube') &&
              !title.toLowerCase().includes('youtube')) {
            return { artist, title };
          }
        }
      }
    }

    // Spezielle Patterns für häufige YouTube-Formate
    // Pattern 1: "Artist: Title"
    const colonMatch = cleanTitle.match(/^([^:]+):\s*(.+)$/);
    if (colonMatch) {
      const artist = colonMatch[1].trim();
      const title = colonMatch[2].trim();
      if (artist.length > 0 && title.length > 0 && 
          artist.length < 100 && title.length < 200 &&
          !artist.toLowerCase().includes('youtube') &&
          !title.toLowerCase().includes('youtube')) {
        return { artist, title };
      }
    }

    // Pattern 2: "Artist - Title (feat. Other Artist)"
    const featMatch = cleanTitle.match(/^([^-]+)\s*-\s*(.+?)(?:\s*\(feat\.?\s*[^)]+\))?$/i);
    if (featMatch) {
      const artist = featMatch[1].trim();
      const title = featMatch[2].trim();
      if (artist.length > 0 && title.length > 0 && 
          artist.length < 100 && title.length < 200 &&
          !artist.toLowerCase().includes('youtube') &&
          !title.toLowerCase().includes('youtube')) {
        return { artist, title };
      }
    }

    // Pattern 3: "Title by Artist" oder "Title - Artist"
    const byMatch = cleanTitle.match(/^(.+?)\s+(?:by|von)\s+(.+)$/i);
    if (byMatch) {
      const title = byMatch[1].trim();
      const artist = byMatch[2].trim();
      if (artist.length > 0 && title.length > 0 && 
          artist.length < 100 && title.length < 200 &&
          !artist.toLowerCase().includes('youtube') &&
          !title.toLowerCase().includes('youtube')) {
        return { artist, title };
      }
    }

    // Pattern 4: Versuche das erste Wort als Artist zu nehmen wenn es großgeschrieben ist
    const words = cleanTitle.split(/\s+/);
    if (words.length >= 2) {
      const firstWord = words[0];
      // Wenn das erste Wort wie ein Artist-Name aussieht (nicht zu lang, keine Zahlen)
      if (firstWord.length > 1 && firstWord.length < 30 && 
          !firstWord.match(/^\d+$/) && 
          !firstWord.toLowerCase().includes('youtube')) {
        const artist = firstWord;
        const title = words.slice(1).join(' ');
        if (title.length > 0 && title.length < 200) {
          return { artist, title };
        }
      }
    }

    // Falls nichts funktioniert, alles als Titel verwenden
    return { artist: null, title: cleanTitle };
  }

  /**
   * Hauptfunktion: Holt Metadaten für einen YouTube-Link
   */
  static async getMetadata(youtubeUrl) {
    try {
      const videoId = this.extractVideoId(youtubeUrl);
      if (!videoId) {
        throw new Error('Keine gültige YouTube-Video-ID gefunden');
      }

      console.log(`🎵 Attempting to get metadata for video ID: ${videoId}`);

      // Versuche zuerst oEmbed API
      let metadata = await this.getMetadataFromOEmbed(videoId);
      
      // Falls oEmbed fehlschlägt, versuche Web-Scraping
      if (!metadata) {
        console.log(`⚠️ oEmbed failed, trying web scraping...`);
        metadata = await this.getMetadataFromScraping(videoId);
      }

      if (!metadata) {
        throw new Error('Metadaten konnten nicht abgerufen werden - beide Methoden fehlgeschlagen');
      }

      console.log(`✅ Metadata retrieved: "${metadata.title}" by "${metadata.author}"`);

      const { artist, title } = this.parseTitleAndArtist(metadata.title);

      // Debugging: Logge das Parsing-Ergebnis
      console.log(`🎵 YouTube Parsing Debug:`);
      console.log(`   Original Title: "${metadata.title}"`);
      console.log(`   Parsed Artist: "${artist}"`);
      console.log(`   Parsed Title: "${title}"`);

      // Fallback: Wenn Parsing fehlschlägt, versuche bessere Fallbacks
      let finalArtist = artist;
      let finalTitle = title || metadata.title;

      if (!finalArtist) {
        // Versuche den Channel-Namen als Artist zu verwenden
        if (metadata.author) {
          finalArtist = metadata.author;
          console.log(`   Using channel name as artist: "${finalArtist}"`);
        } else {
          finalArtist = 'Unknown Artist';
          console.log(`   No artist found, using fallback: "${finalArtist}"`);
        }
      }

      return {
        title: finalTitle,
        artist: finalArtist,
        youtube_title: metadata.title,
        thumbnail: metadata.thumbnail,
        video_id: videoId,
        duration_seconds: null // Dauer ist mit diesen Methoden nicht verfügbar
      };

    } catch (error) {
      console.error('Error getting YouTube metadata:', error);
      throw error;
    }
  }
}

module.exports = YouTubeMetadataService;
