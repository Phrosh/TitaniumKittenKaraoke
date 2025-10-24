/**
 * Zentrale Konstanten für Dateiendungen
 * Stellt einheitliche Listen für Audio- und Video-Extensions bereit
 */

// Audio-Extensions
const AUDIO_EXTENSIONS = [
    '.mp3',
    '.wav',
    '.flac',
    '.m4a',
    '.aac',
    '.ogg'
];

// Video-Extensions
const VIDEO_EXTENSIONS = [
    '.mp4',
    '.avi',
    '.mkv',
    '.mov',
    '.wmv',
    '.webm',
    '.mpg',
    '.mpeg',
    '.flv'
];

// Alle unterstützten Media-Extensions
const MEDIA_EXTENSIONS = [...AUDIO_EXTENSIONS, ...VIDEO_EXTENSIONS];

// Lyrics-Extensions
const LYRICS_EXTENSIONS = [
    '.txt',
    '.json'
];

// Cover-Extensions
const COVER_EXTENSIONS = [
    '.jpg',
    '.jpeg',
    '.png',
    '.gif'
];

// Hilfsfunktionen
function isAudioFile(filename) {
    return AUDIO_EXTENSIONS.some(ext => filename.toLowerCase().endsWith(ext));
}

function isVideoFile(filename) {
    return VIDEO_EXTENSIONS.some(ext => filename.toLowerCase().endsWith(ext));
}

function isMediaFile(filename) {
    return MEDIA_EXTENSIONS.some(ext => filename.toLowerCase().endsWith(ext));
}

function isLyricsFile(filename) {
    return LYRICS_EXTENSIONS.some(ext => filename.toLowerCase().endsWith(ext));
}

function isCoverFile(filename) {
    return COVER_EXTENSIONS.some(ext => filename.toLowerCase().endsWith(ext));
}

module.exports = {
    AUDIO_EXTENSIONS,
    VIDEO_EXTENSIONS,
    MEDIA_EXTENSIONS,
    LYRICS_EXTENSIONS,
    COVER_EXTENSIONS,
    isAudioFile,
    isVideoFile,
    isMediaFile,
    isLyricsFile,
    isCoverFile
};
