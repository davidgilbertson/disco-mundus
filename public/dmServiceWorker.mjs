const CACHE_NAME = 'Disco Mundus V2';

const filesToCache = [
  '/', // home page in a browser
  '/index.html', // home page for the installed PWA
  'favicon.ico',
  'manifest.webmanifest',
  'data/sydneySuburbs.json',

  // TODO (davidg): these is now broken with parcel. Fix during CRA move
  // 'icons/favicon-32x32.png',
  // 'icons/android-chrome-192x192.png',

  // // CSS
  // 'src/main.css',
  //
  // // Scripts
  // 'src/app.mjs',
  // 'src/cabService.mjs',
  // 'src/constants.mjs',
  // 'src/dom.mjs',
  // 'src/index.mjs',
  // 'src/mapboxManager.mjs',
  // 'src/questionManager.mjs',
  // 'src/utils/dataUtils.mjs',
  // 'src/utils/dateTimeUtils.mjs',
  // 'src/utils/geoUtils.mjs',
  // 'src/utils/logUtils.mjs',
  // 'src/utils/questionUtils.mjs',
  // 'src/utils/storageUtils.mjs',

  // Third party
  'https://api.tiles.mapbox.com/mapbox-gl-js/v1.6.0/mapbox-gl.css',
  'https://api.tiles.mapbox.com/mapbox-gl-js/v1.6.0/mapbox-gl.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      return cache.addAll(filesToCache);
    })()
  );
});

/**
 * @param {string} url
 * @return {string}
 */
const getCleanUrl = url => {
  const cleanUrl = new URL(url);
  cleanUrl.search = '';
  return cleanUrl.href;
};

/**
 * @param {string} href
 * @return {boolean}
 */
const isCachedUrl = href => {
  if (filesToCache.find(path => path.includes(href))) return true;
  return href.includes(self.location.origin);
};

self.addEventListener('fetch', e => {
  e.respondWith(
    (async () => {
      const href = getCleanUrl(e.request.url);

      if (href.startsWith('https://api.mapbox.com/v4/')) {
        const cacheResponse = await caches.match(href);

        if (cacheResponse) return cacheResponse;

        // console.info('> Caching Mapbox tile:', url);

        // Fetch the original request, with query parameters
        const fetchResponse = await fetch(e.request);

        if (fetchResponse.ok) {
          // The below happens asynchronously while the response is being returned
          const clonedResponse = fetchResponse.clone();

          caches
            .open(CACHE_NAME)
            .then(cache => cache.put(href, clonedResponse));
        }

        return fetchResponse;
      }

      // For any other third party requests, fetch/return
      // (extensions, Mapbox fonts, Velantrix, etc)
      if (!isCachedUrl(href)) return fetch(e.request);

      // Otherwise, it's a site asset. Load it from cache, and refresh the cache
      // (ETags will prevent unnecessary downloads)
      const cacheResponse = await caches.match(href);

      // Refresh the cache (async) while returning the cached response
      fetch(e.request).then(fetchResponse => {
        caches.open(CACHE_NAME).then(cache => cache.put(href, fetchResponse));
      });

      if (cacheResponse) return cacheResponse;

      // If we get to this point, it's because I'm missing something
      // in the oninstall code
      console.warn('> This should have been cached on install:', href);
      return fetch(e.request);
    })()
  );
});
