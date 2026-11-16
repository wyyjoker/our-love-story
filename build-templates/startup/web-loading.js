(function () {
  var overlay = document.getElementById('love-loading');
  var message = document.getElementById('love-loading-message');
  var timer = setTimeout(function () { if (overlay) message.textContent = '加载时间较长，请检查网络后稍候。'; }, 30000);
  window.__loveLoadingReady = function () { clearTimeout(timer); if (overlay) { overlay.remove(); overlay = null; } };
  window.__loveLoadingError = function () { clearTimeout(timer); if (message) message.textContent = '加载失败，请检查网络后刷新重试。'; };
  window.addEventListener('error', window.__loveLoadingError);
  window.addEventListener('unhandledrejection', window.__loveLoadingError);
})();
