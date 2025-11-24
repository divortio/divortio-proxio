/**
 * @file Edge Cache Service
 * @description Manages safe reading and writing to Cloudflare's Cache API.
 */

export const CFCache = {
    /**
     * Generates a normalized cache key (strips cookies/auth for shared caching).
     */
    getKey(request) {
        return new Request(request.url, { method: 'GET' });
    },

    /**
     * Attempts to retrieve a cached response.
     */
    async get(request) {
        const key = this.getKey(request);
        const cache = caches.default;
        const response = await cache.match(key);

        if (!response) return null;

        const headers = new Headers(response.headers);
        headers.set('X-Proxy-Cache', 'HIT');

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers
        });
    },

    /**
     * Safely caches a response if it meets security criteria.
     */
    async save(request, response, config) {
        if (!this.isSafeToCache(response, config)) return;

        const key = this.getKey(request);
        const cache = caches.default;
        const cacheableResponse = response.clone();
        const headers = new Headers(cacheableResponse.headers);

        // Security Stripping
        headers.delete('Set-Cookie');

        // Cache Control
        headers.set('Cloudflare-CDN-Cache-Control', `max-age=${config.cache.ttl}`);
        headers.set('Cache-Control', `public, max-age=${config.cache.ttl}`);
        headers.append('Vary', 'Accept-Encoding');

        await cache.put(key, new Response(cacheableResponse.body, {
            status: cacheableResponse.status,
            statusText: cacheableResponse.statusText,
            headers: headers
        }));
    },

    /**
     * Validates if a response is safe to cache.
     */
    isSafeToCache(response, config) {
        if (response.status !== 200) return false;

        const contentType = response.headers.get('Content-Type') || '';
        const isAllowedType = config.cache.cacheableTypes.some(type => contentType.includes(type));
        if (!isAllowedType) return false;

        const cc = response.headers.get('Cache-Control') || '';
        if (/private|no-store|no-cache/i.test(cc)) {
            return false;
        }

        return true;
    }
};