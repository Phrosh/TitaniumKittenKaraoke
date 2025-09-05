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
      const response = await axios.get(oEmbedUrl, { timeout: 5000 });
      
      if (response.data && response.data.title) {
        return {
          title: response.data.title,
          author: response.data.author_name || null,
          thumbnail: response.data.thumbnail_url || null
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching YouTube oEmbed data:', error);
      return null;
    }
  }

  /**
   * Parst Titel und Interpret aus dem YouTube-Titel
   * Versucht verschiedene Formate zu erkennen
   */
  static parseTitleAndArtist(youtubeTitle) {
    if (!youtubeTitle) return { title: null, artist: null };

    // Entferne häufige YouTube-Suffixe
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
      .trim();

    // Verschiedene Trennzeichen versuchen
    const separators = [' - ', ' – ', ' — ', ' | ', ' :: ', ' : '];
    
    for (const separator of separators) {
      if (cleanTitle.includes(separator)) {
        const parts = cleanTitle.split(separator);
        if (parts.length >= 2) {
          const artist = parts[0].trim();
          const title = parts.slice(1).join(separator).trim();
          
          // Validiere dass beide Teile sinnvoll sind
          if (artist.length > 0 && title.length > 0 && 
              artist.length < 100 && title.length < 200) {
            return { artist, title };
          }
        }
      }
    }

    // Falls kein Trennzeichen gefunden wurde, versuche andere Patterns
    // Pattern: "Artist: Title" oder "Artist - Title"
    const colonMatch = cleanTitle.match(/^([^:]+):\s*(.+)$/);
    if (colonMatch) {
      const artist = colonMatch[1].trim();
      const title = colonMatch[2].trim();
      if (artist.length > 0 && title.length > 0 && 
          artist.length < 100 && title.length < 200) {
        return { artist, title };
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

      const metadata = await this.getMetadataFromOEmbed(videoId);
      if (!metadata) {
        throw new Error('Metadaten konnten nicht abgerufen werden');
      }

      const { artist, title } = this.parseTitleAndArtist(metadata.title);

      return {
        title: title || metadata.title,
        artist: artist,
        youtube_title: metadata.title,
        thumbnail: metadata.thumbnail,
        video_id: videoId
      };

    } catch (error) {
      console.error('Error getting YouTube metadata:', error);
      throw error;
    }
  }
}

module.exports = YouTubeMetadataService;
