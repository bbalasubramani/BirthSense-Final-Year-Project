(() => {
  const isLocalhost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  window.API_BASE_URL = isLocalhost
    ? 'http://localhost:5000/api'
    : 'https://birthsense-backend.onrender.com/api';
})();
