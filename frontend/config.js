(() => {
  const { hostname, origin } = window.location;

  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isRenderHosted = hostname.endsWith('.onrender.com');
const apiOverride = window.BIRTHSENSE_API_URL;
  const hostedApiCandidates = [
    'https://birthsense-backend.onrender.com/api',
    'https://birthsense-final-year-project-1.onrender.com/api'
  ];
 
  // 1) Local dev uses local API
  // 2) Render-hosted frontend uses same-origin API (/api)
  // 3) Other static hosts keep explicit backend fallback (with optional manual override)
  const resolvedBase = isLocalhost
    ? 'http://localhost:5000/api'
    : isRenderHosted
      ? `${origin}/api`
      : (apiOverride || hostedApiCandidates[0]);

  window.API_BASE_URL = resolvedBase.replace(/\/$/, '');
  window.API_BACKUP_BASE_URLS = hostedApiCandidates.map((url) => url.replace(/\/$/, ''));
})();
