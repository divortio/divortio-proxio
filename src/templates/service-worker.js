/**
 * @file Service Worker Generator
 * @description Generates the Service Worker source code with the configuration baked in.
 * @version 4.0.0 (Functional Generator)
 */

/**
 * Generates the Service Worker script.
 * @param {string} rootDomain - The proxy root domain (e.g. "proxy.com")
 * @returns {string} The executable JavaScript code.
 */
export function getServiceWorkerCode(rootDomain) {
    return `
/**
 * Divortio Service Worker
 * Generated at runtime.
 */
const PROXY_ROOT_DOMAIN = '${rootDomain}';

// 1. Install: Skip waiting
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// 2. Activate: Claim clients
self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// 3. Fetch: Intercept and Proxy
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // A. Passthrough: If it's already on the proxy domain
    if (url.hostname.endsWith(PROXY_ROOT_DOMAIN)) {
        return;
    }

    // B. Passthrough: Localhost / Data / Blob
    if (url.hostname === 'localhost' || url.protocol === 'data:' || url.protocol === 'blob:') {
        return;
    }

    // C. Rewrite: Map target.com -> target.com.proxy.com
    const proxyHostname = url.hostname + '.' + PROXY_ROOT_DOMAIN;
    const newUrl = 'https://' + proxyHostname + url.pathname + url.search;

    const newRequest = new Request(newUrl, {
        method: request.method,
        headers: request.headers,
        mode: request.mode,
        credentials: request.credentials,
        redirect: 'manual',
        referrer: request.referrer,
        body: request.body
    });

    event.respondWith(fetch(newRequest));
});
`;
}