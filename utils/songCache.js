const Song = require('../models/Song');
const { scanYouTubeSongs } = require('./youtubeSongs');
const { scanUltrastarSongs } = require('./ultrastarSongs');
const { scanMagicSongs } = require('./magicSongs');
const { scanMagicVideos } = require('./magicVideos');
const { scanMagicYouTube } = require('./magicYouTube');
const { scanLocalVideos } = require('./localVideos');
const { scanFileSongs } = require('./fileSongs');

class SongCache {
    constructor() {
        this.cache = {
            songs: null,
            youtubeSongs: null,
            ultrastarSongs: null,
            magicSongs: null,
            magicVideos: null,
            magicYouTube: null,
            localVideos: null,
            fileSongs: null,
            lastUpdated: null,
            isBuilding: false
        };
    }

    /**
     * Baut den kompletten Cache auf
     */
    async buildCache() {
        if (this.cache.isBuilding) {
            console.log('⏳ Cache wird bereits aufgebaut...');
            return;
        }

        console.log('🚀 Baue Song-Cache neu auf...');
        this.cache.isBuilding = true;

        try {
            const startTime = Date.now();

            // Lade alle Song-Typen parallel
            const [
                songs,
                youtubeSongs,
                ultrastarSongs,
                magicSongs,
                magicVideos,
                magicYouTube,
                localVideos,
                fileSongs
            ] = await Promise.all([
                Song.getAll(),
                this.scanWithErrorHandling(() => scanYouTubeSongs(), 'YouTube Songs'),
                this.scanWithErrorHandling(() => scanUltrastarSongs(), 'Ultrastar Songs'),
                this.scanWithErrorHandling(() => scanMagicSongs(), 'Magic Songs'),
                this.scanWithErrorHandling(() => scanMagicVideos(), 'Magic Videos'),
                this.scanWithErrorHandling(() => scanMagicYouTube(), 'Magic YouTube'),
                this.scanWithErrorHandling(() => scanLocalVideos(), 'Local Videos'),
                this.scanWithErrorHandling(() => scanFileSongs(), 'File Songs')
            ]);

            // Aktualisiere Cache
            this.cache = {
                songs,
                youtubeSongs,
                ultrastarSongs,
                magicSongs,
                magicVideos,
                magicYouTube,
                localVideos,
                fileSongs,
                lastUpdated: new Date().toISOString(),
                isBuilding: false
            };

            const duration = Date.now() - startTime;
            console.log(`✅ Song-Cache erfolgreich aufgebaut in ${duration}ms:`, {
                songs: songs.length,
                youtubeSongs: youtubeSongs.length,
                ultrastarSongs: ultrastarSongs.length,
                magicSongs: magicSongs.length,
                magicVideos: magicVideos.length,
                magicYouTube: magicYouTube.length,
                localVideos: localVideos.length,
                fileSongs: fileSongs.length
            });

        } catch (error) {
            console.error('❌ Fehler beim Aufbau des Song-Caches:', error);
            this.cache.isBuilding = false;
            throw error;
        }
    }

    /**
     * Hilfsfunktion für Fehlerbehandlung beim Scannen
     */
    async scanWithErrorHandling(scanFunction, type) {
        try {
            return await scanFunction();
        } catch (error) {
            console.warn(`⚠️ Fehler beim Scannen von ${type}:`, error.message);
            return [];
        }
    }

    /**
     * Gibt gecachte Songs zurück oder baut Cache auf
     */
    async getSongs() {
        if (!this.cache.songs) {
            await this.buildCache();
        }
        return this.cache.songs || [];
    }

    /**
     * Gibt gecachte YouTube Songs zurück
     */
    async getYouTubeSongs() {
        if (!this.cache.youtubeSongs) {
            await this.buildCache();
        }
        return this.cache.youtubeSongs || [];
    }

    /**
     * Gibt gecachte Ultrastar Songs zurück
     */
    async getUltrastarSongs() {
        if (!this.cache.ultrastarSongs) {
            await this.buildCache();
        }
        return this.cache.ultrastarSongs || [];
    }

    /**
     * Gibt gecachte Magic Songs zurück
     */
    async getMagicSongs() {
        if (!this.cache.magicSongs) {
            await this.buildCache();
        }
        return this.cache.magicSongs || [];
    }

    /**
     * Gibt gecachte Magic Videos zurück
     */
    async getMagicVideos() {
        if (!this.cache.magicVideos) {
            await this.buildCache();
        }
        return this.cache.magicVideos || [];
    }

    /**
     * Gibt gecachte Magic YouTube zurück
     */
    async getMagicYouTube() {
        if (!this.cache.magicYouTube) {
            await this.buildCache();
        }
        return this.cache.magicYouTube || [];
    }

    /**
     * Gibt gecachte Local Videos zurück
     */
    async getLocalVideos() {
        if (!this.cache.localVideos) {
            await this.buildCache();
        }
        return this.cache.localVideos || [];
    }

    /**
     * Gibt gecachte File Songs zurück
     */
    async getFileSongs() {
        if (!this.cache.fileSongs) {
            await this.buildCache();
        }
        return this.cache.fileSongs || [];
    }

    /**
     * Gibt Cache-Status zurück
     */
    getCacheStatus() {
        return {
            hasCache: !!this.cache.songs,
            lastUpdated: this.cache.lastUpdated,
            isBuilding: this.cache.isBuilding,
            songCount: this.cache.songs ? this.cache.songs.length : 0,
            youtubeSongCount: this.cache.youtubeSongs ? this.cache.youtubeSongs.length : 0,
            ultrastarSongCount: this.cache.ultrastarSongs ? this.cache.ultrastarSongs.length : 0,
            magicSongCount: this.cache.magicSongs ? this.cache.magicSongs.length : 0,
            magicVideoCount: this.cache.magicVideos ? this.cache.magicVideos.length : 0,
            magicYouTubeCount: this.cache.magicYouTube ? this.cache.magicYouTube.length : 0,
            localVideoCount: this.cache.localVideos ? this.cache.localVideos.length : 0,
            fileSongCount: this.cache.fileSongs ? this.cache.fileSongs.length : 0
        };
    }

    /**
     * Löscht den Cache
     */
    clearCache() {
        this.cache = {
            songs: null,
            youtubeSongs: null,
            ultrastarSongs: null,
            magicSongs: null,
            magicVideos: null,
            magicYouTube: null,
            localVideos: null,
            fileSongs: null,
            lastUpdated: null,
            isBuilding: false
        };
        
        console.log('🔄 Song-Cache zurückgesetzt');
    }

    /**
     * Aktualisiert einen einzelnen Song im Cache
     */
    updateSongInCache(songId, updatedSong) {
        if (!this.cache.songs) return;
        
        const index = this.cache.songs.findIndex(song => song.id === songId);
        if (index !== -1) {
            this.cache.songs[index] = updatedSong;
            this.cache.lastUpdated = new Date().toISOString();
            console.log(`🔄 Song im Cache aktualisiert: ${updatedSong.artist} - ${updatedSong.title}`);
        }
    }

    /**
     * Fügt einen neuen Song zum Cache hinzu
     */
    addSongToCache(newSong) {
        if (!this.cache.songs) {
            this.cache.songs = [];
        }
        
        this.cache.songs.push(newSong);
        this.cache.lastUpdated = new Date().toISOString();
        console.log(`➕ Song zum Cache hinzugefügt: ${newSong.artist} - ${newSong.title}`);
    }

    /**
     * Entfernt einen Song aus dem Cache
     */
    removeSongFromCache(songId) {
        if (!this.cache.songs) return;
        
        const index = this.cache.songs.findIndex(song => song.id === songId);
        if (index !== -1) {
            const removedSong = this.cache.songs.splice(index, 1)[0];
            this.cache.lastUpdated = new Date().toISOString();
            console.log(`➖ Song aus Cache entfernt: ${removedSong.artist} - ${removedSong.title}`);
        }
    }
}

// Globale Cache-Instanz
const songCache = new SongCache();

module.exports = songCache;