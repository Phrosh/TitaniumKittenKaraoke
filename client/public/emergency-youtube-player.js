(function () {
  var params = new URLSearchParams(window.location.search);
  var videoId = params.get('v');

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    document.body.style.color = '#fff';
    document.body.style.display = 'flex';
    document.body.style.alignItems = 'center';
    document.body.style.justifyContent = 'center';
    document.body.style.fontFamily = 'system-ui, sans-serif';
    document.body.textContent = 'Ungültige Video-ID';
    return;
  }

  window.location.replace(
    'https://www.youtube.com/watch?v=' + encodeURIComponent(videoId) + '&autoplay=1'
  );
})();
