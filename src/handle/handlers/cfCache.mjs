/**
 * @file Edge Cache Service
 * @description Manages safe reading and writing to Cloudflare's Cache API.
 * @version 2.0.0 (Typed Config)
 */

export const CFCache = {
    getKey(request) {
        return new Request(request.url, { method: 'GET' });
    },

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
     * @param {Request} request
     * @param {Response} response
     * @param {import('../../config/env.mjs').EnvConfig} config
     */
    async save(request, response, config) {
        if (!this.isSafeToCache(response, config)) return;

        const key = this.getKey(request);
        const cache = caches.default;
        const cacheableResponse = response.clone();
        const headers = new Headers(cacheableResponse.headers);

        headers.delete('Set-Cookie');

        // Use typed config.cache.ttl
        headers.set('Cloudflare-CDN-Cache-Control', `max-age=${config.cache.ttl}`);
        headers.set('Cache-Control', `public, max-age=${config.cache.ttl}`);
        headers.append('Vary', 'Accept-Encoding');

        await cache.put(key, new Response(cacheableResponse.body, {
            status: cacheableResponse.status,
            statusText: cacheableResponse.statusText,
            headers: headers
        }));
    },

    isSafeToCache(response, config) {
        if (response.status !== 200) return false;

        const contentType = response.headers.get('Content-Type') || '';
        // Use typed config.cache.cacheableTypes
        const isAllowedType = config.cache.cacheableTypes.some(type => contentType.includes(type));
        if (!isAllowedType) return false;

        const cc = response.headers.get('Cache-Control') || '';
        if (/private|no-store|no-cache/i.test(cc)) {
            return false;
        }

        return true;
    }
};