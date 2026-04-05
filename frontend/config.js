(() => {
 const { hostname, origin } = window.location;

  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isRenderHosted = hostname.endsWith('.onrender.com');

  // 1) Local dev uses local API
  // 2) Render-hosted frontend uses same-origin API (/api)
  // 3) Other static hosts keep explicit backend fallback
  window.API_BASE_URL = isLocalhost
    ? 'http://localhost:5000/api'
    : isRenderHosted
      ? `${origin}/api`
      : 'https://birthsense-final-year-project-1.onrender.com/api';
})();
