/** In-memory state for emergency YouTube (show overlay button). */
let pending = {
  videoId: null,
  youtubeUrl: null,
  embedUrl: null,
  artist: null,
  title: null,
  ts: 0,
};

function buildEmbedUrl(videoId) {
  return (
    `https://www.youtube.com/embed/${videoId}` +
    '?autoplay=1&controls=0&rel=0&modestbranding=1&playsinline=1&mute=0&iv_load_policy=3'
  );
}

function setEmergencyYouTubePending(youtubeUrl, videoId, meta = {}) {
  pending = {
    videoId,
    youtubeUrl,
    embedUrl: buildEmbedUrl(videoId),
    artist: meta.artist || null,
    title: meta.title || null,
    ts: Date.now(),
  };
  return pending;
}

function getEmergencyYouTubePending() {
  if (!pending.videoId) {
    return null;
  }
  return { ...pending };
}

function clearEmergencyYouTubePending() {
  pending = {
    videoId: null,
    youtubeUrl: null,
    embedUrl: null,
    artist: null,
    title: null,
    ts: 0,
  };
}

module.exports = {
  setEmergencyYouTubePending,
  getEmergencyYouTubePending,
  clearEmergencyYouTubePending,
  buildEmbedUrl,
};
