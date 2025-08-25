/**
 * @file The Core Request Orchestrator for the Proxy Worker.
 * @version 8.0.0
 * @see {@link ./worker.mjs} for the worker entry point and routing.
 * @see {@link ./auth/router.mjs} for the authentication middleware that protects this handler.
 *
 * @description
 * This module is the central engine for all **authorized** proxied requests. The `createAuthHandler`
 * in `worker.mjs` acts as a gatekeeper, and only requests that have passed the
 * authentication and authorization checks are delegated to this handler.
 *
 * As such, this module is significantly simplified and can focus entirely on its core
 * responsibilities without needing to re-check authentication status. Its workflow is:
 *
 * 1.  **Caching (Read)**: Checks for a valid cached response.
 * 2.  **URL Parsing**: Determines the request's intended destination.
 * 3.  **Identity Management**: Applies the configured header strategy (passthrough or emulation).
 * 4.  **Proxying**: Constructs and sends the modified request to the origin server.
 * 5.  **Rewriting**: Passes the origin's response to the Rewriters module.
 * 6.  **Caching (Write)**: Stores the final response in the cache.
 */

import {createConfig} from './config.mjs';
import {BrowserProfiles} from './browser-profiles.mjs';
import {Rewriters} from './rewriters.mjs';
import {URLParser} from './url-parser.mjs';
import {WebSocketHandler} from './websocket-handler.mjs';

/**
 * @namespace RequestHandler
 * @description The main request handler object for all authorized proxied requests.
 */
export const RequestHandler = {
    /**
     * The main entry point for handling an authorized proxy fetch event.
     *
     * @param {Request} request - The incoming request from the client.
     * @param {object} env - The worker's environment containing variables from `wrangler.toml`.
     * @param {ExecutionContext} ctx - The execution context, used for `waitUntil`.
     * @returns {Promise<Response>} A Promise that resolves to the final Response object.
     */
    async handleRequest(request, env, ctx) {
        const config = createConfig(env);
        const url = new URL(request.url);

        // NOTE: All authentication checks are now handled by the middleware in `worker.mjs`.
        // This function only executes for authorized requests.

        // --- 1. Caching (Read) ---
        if (config.cache.enabled && request.method === 'GET') {
            const cache = caches.default;
            const cachedResponse = await cache.match(request);
            if (cachedResponse) {
                const headers = new Headers(cachedResponse.headers);
                headers.set('X-Proxy-Cache', 'HIT');
                return new Response(cachedResponse.body, {...cachedResponse, headers});
            }
        }

        // --- 2. WebSocket Routing ---
        if (request.headers.get('Upgrade') === 'websocket') {
            const targetURL = URLParser.getTargetURL(request, config);
            if (!targetURL) {
                return new Response("Invalid WebSocket target URL.", {status: 400});
            }
            const {0: client, 1: server} = new WebSocketPair();
            ctx.waitUntil(WebSocketHandler.handleSession(server, targetURL));
            return new Response(null, {status: 101, webSocket: client});
        }

        // --- 3. URL Parsing ---
        const targetURL = URLParser.getTargetURL(request, config);
        if (!targetURL) {
            return new Response("This request could not be proxied as the target URL could not be determined.", {status: 400});
        }

        // --- 4. Identity Management ---
        let finalHeaders;
        let setCookieHeader = null;

        if (config.emulationStrategy === 'passthrough') {
            finalHeaders = this.sanitizeRequestHeaders(request.headers);
        } else {
            const {profile, setCookieHeader: newCookie} = BrowserProfiles.getProfile(request, config);
            setCookieHeader = newCookie;
            finalHeaders = new Headers();
            for (const [key, value] of Object.entries(profile)) {
                finalHeaders.set(key, value);
            }
        }

        // --- 5. Proxy Request Construction ---
        finalHeaders.set('Host', targetURL.hostname);

        const proxyRequest = new Request(targetURL.href, {
            method: request.method,
            headers: finalHeaders,
            body: request.body,
            redirect: 'manual',
        });

        // --- 6. Fetch from Origin ---
        const originResponse = await fetch(proxyRequest);

        // --- 7. Response Rewriting ---
        const finalResponse = await Rewriters.rewriteResponse(originResponse, targetURL, url.hostname, config, setCookieHeader);

        // --- 8. Caching (Write) ---
        if (config.cache.enabled && request.method === 'GET' && this.isCacheable(finalResponse, config)) {
            const cacheableResponse = finalResponse.clone();
            ctx.waitUntil(
                (async () => {
                    const cache = caches.default;
                    const responseToCache = new Response(cacheableResponse.body, cacheableResponse);
                    responseToCache.headers.set('Cache-Control', `public, max-age=${config.cache.ttl}`);
                    await cache.put(request, responseToCache);
                })()
            );
        }

        return finalResponse;
    },

    /**
     * Creates a new Headers object for "passthrough" mode.
     * @param {Headers} originalHeaders - The incoming request's original headers.
     * @returns {Headers} A new, sanitized Headers object.
     */
    sanitizeRequestHeaders(originalHeaders) {
        const headers = new Headers(originalHeaders);
        const headersToRemove = [
            'x-forwarded-for', 'x-forwarded-proto', 'x-real-ip', 'via', 'content-security-policy-report-only'
        ];
        const prefixesToRemove = ['cf-', 'x-cf-'];

        for (const key of headers.keys()) {
            const lowerKey = key.toLowerCase();
            if (headersToRemove.includes(lowerKey) || prefixesToRemove.some(prefix => lowerKey.startsWith(prefix))) {
                headers.delete(key);
            }
        }
        return headers;
    },

    /**
     * Determines if a response is safe to cache.
     * @param {Response} response - The final, rewritten response to evaluate.
     * @param {object} config - The application configuration object.
     * @returns {boolean} `true` if the response is deemed cacheable.
     */
    isCacheable(response, config) {
        if (response.status !== 200) return false;
        const cacheControl = response.headers.get('Cache-Control') || '';
        if (/no-cache|no-store|private/.test(cacheControl)) return false;
        const contentType = response.headers.get('Content-Type') || '';
        return config.cache.cacheableTypes.some(type => contentType.includes(type));
    },
};