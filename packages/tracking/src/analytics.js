(function () {
  // Respect Do Not Track (DNT) headers
  if (
    navigator.doNotTrack === '1' ||
    window.doNotTrack === '1' ||
    navigator.msDoNotTrack === '1'
  ) {
    return;
  }

  const currentScript = document.currentScript;
  if (!currentScript) return;

  const siteId = currentScript.getAttribute('data-site-id');
  if (!siteId) {
    console.warn('[Lumino] Missing data-site-id attribute.');
    return;
  }

  // Derive the target ingestion API URL from the script source URL itself
  const collectUrl = new URL(currentScript.src).origin + '/collect';

  // Lightweight, robust client-side device type classification
  function getDeviceType() {
    const ua = navigator.userAgent;
    if (/bot|googlebot|crawler|spider|robot|crawling/i.test(ua)) {
      return 'bot';
    }
    // Match common tablet user-agents or modern iPadOS devices
    const isTablet = /iPad|tablet|playbook|silk/i.test(ua) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isTablet) {
      return 'tablet';
    }
    if (/Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
      return 'mobile';
    }
    return 'desktop';
  }

  let lastPathname = null;

  function trackPageview() {
    const page = window.location.pathname;
    // Prevent double triggering on rapid history API invocation
    if (page === lastPathname) return;
    lastPathname = page;

    let referrer = null;
    if (document.referrer) {
      try {
        const referrerUrl = new URL(document.referrer);
        // Stripped to domain only to protect privacy
        referrer = referrerUrl.hostname;
        // Strip leading www. if present for cleaner dashboard reporting
        if (referrer.startsWith('www.')) {
          referrer = referrer.substring(4);
        }
      } catch (e) {
        // Fallback for non-standard referrers
      }
    }

    const payload = {
      siteId: siteId,
      page: page,
      referrer: referrer,
      device: getDeviceType(),
      ts: Date.now()
    };

    // Use fetch with keepalive: true to ensure fire-and-forget reliability without blocking
    // browser page destruction or navigation, with native JSON Content-Type handling.
    try {
      fetch(collectUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {});
    } catch (err) {
      // Fallback for old browsers
    }
  }

  // Track the initial page view when DOM is ready
  if (document.readyState === 'complete') {
    trackPageview();
  } else {
    window.addEventListener('load', trackPageview);
  }

  // Intercept Single Page Application (SPA) routing (History API)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function () {
    originalPushState.apply(this, arguments);
    trackPageview();
  };

  history.replaceState = function () {
    originalReplaceState.apply(this, arguments);
    trackPageview();
  };

  window.addEventListener('popstate', trackPageview);
})();
