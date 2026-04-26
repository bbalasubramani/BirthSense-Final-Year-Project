(() => {
  const { hostname, origin } = window.location;

  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isRenderHosted = hostname.endsWith('.onrender.com');
  const isNetlifyHosted = hostname.endsWith('.netlify.app');
  const apiOverride = window.BIRTHSENSE_API_URL;
  const hostedApiCandidates = [
    'https://birthsense-final-year-project-1.onrender.com/api',
    'https://birthsense-backend.onrender.com/api'
  ];

  // Netlify + cross-site cookie auth can trigger noisy CORS/preflight failures on fallback hosts.
  // Keep only the primary API by default, and allow manual override when needed.
  const fallbackCandidates = isNetlifyHosted
    ? [hostedApiCandidates[0]]
    : hostedApiCandidates;
  
  // 1) Local dev uses local API
  // 2) Render-hosted frontend uses same-origin API (/api)
  // 3) Other static hosts keep explicit backend fallback (with optional manual override)
  const resolvedBase = isLocalhost
    ? 'http://localhost:5000/api'
    : isRenderHosted
      ? `${origin}/api`
      : (apiOverride || fallbackCandidates[0]);

  window.API_BASE_URL = resolvedBase.replace(/\/$/, '');
  window.API_BACKUP_BASE_URLS = fallbackCandidates.map((url) => url.replace(/\/$/, ''));
  window.getApiBaseUrls = () => {
    const all = [window.API_BASE_URL, ...(window.API_BACKUP_BASE_URLS || [])]
      .map((url) => String(url || '').replace(/\/$/, ''))
      .filter(Boolean);
    return [...new Set(all)];
  };
})();
