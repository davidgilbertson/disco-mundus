const CACHE_NAME = 'Disco Mundus V2';

self.addEventListener('install', e => {
  const populateCache = async () => {
    const cache = await caches.open(CACHE_NAME);

    return cache.addAll([
      // Misc
      '/',
      'favicon.ico',
      'manifest.webmanifest',
      'icons/favicon-32x32.png',
      'icons/android-chrome-192x192.png',
      'data/sydneySuburbs.json',

      // CSS
      'src/main.css',

      // Scripts
      'src/app.mjs',
      'src/cabService.mjs',
      'src/constants.mjs',
      'src/dom.mjs',
      'src/index.mjs',
      'src/mapboxManager.mjs',
      'src/questionManager.mjs',
      'src/utils/dataUtils.mjs',
      'src/utils/dateTimeUtils.mjs',
      'src/utils/geoUtils.mjs',
      'src/utils/logUtils.mjs',
      'src/utils/questionUtils.mjs',
      'src/utils/storageUtils.mjs',

      // Third party
      'https://api.tiles.mapbox.com/mapbox-gl-js/v1.6.0/mapbox-gl.css',
      'https://api.tiles.mapbox.com/mapbox-gl-js/v1.6.0/mapbox-gl.js',
    ]);
  };

  e.waitUntil(populateCache());
});

self.addEventListener('fetch', e => {
  // We want it to ignore the query params so it can fetch '/'
  const url = e.request.url.replace(/\?.*/, '');

  const handleRequest = async () => {
    // We'll cache satellite and streets data. Mapbox does this already,
    // but they're a bit stingy with their expires.
    if (url.startsWith('https://api.mapbox.com/v4/')) {
      // TODO (davidg): for mapbox tile requests, can I fetch them, but modify
      //  then Expires header before returning it? Simpler than storing it, right?
      // Mapbox has some level of service worker caching, I think for tiles.
      // Can I not just ask it to store tiles for longer?

      // TODO (davidg): prefer cache for navigation.connect.effectiveType !==
      //  '4g' and maybe saveData !== true

      const cacheResponse = await caches.match(url);

      if (cacheResponse) return cacheResponse;

      // console.info('> Caching Mapbox tile:', url);

      // Fetch the original request, with query parameters
      const fetchResponse = await fetch(e.request);

      if (fetchResponse.ok) {
        // The below happens asynchronously while the response is being returned
        const clonedResponse = fetchResponse.clone();

        caches.open(CACHE_NAME).then(cache => cache.put(url, clonedResponse));
      }

      return fetchResponse;
    }

    // For any other third party requests, fetch/return
    // (extensions, Mapbox fonts, Velantrix, etc)
    if (!url.includes(self.location.origin)) return fetch(e.request);

    // Otherwise, it's a site asset. Load it from cache, and refresh the cache
    // (ETags will prevent unnecessary downloads)
    const cacheResponse = await caches.match(url);

    // Refresh the cache (async) while returning the cached response
    fetch(e.request).then(fetchResponse => {
      caches.open(CACHE_NAME).then(cache => cache.put(url, fetchResponse));
    });

    if (cacheResponse) return cacheResponse;

    // If we get to this point, it's because I'm missing something
    // in the oninstall code
    console.warn('> This should be cached on install:', url);
    return fetch(e.request);
  };

  e.respondWith(handleRequest());
});
