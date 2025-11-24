/**
 * @file Static Asset Handler
 * @description Serves internal generated scripts and public assets.
 * @version 3.0.0 (Functional)
 */

import { getStealthInterceptorScript } from '../../templates/interceptor.mjs';
import { getServiceWorkerCode } from '../../templates/service-worker.js';


/**
 * Checks if the request is for a known asset (internal or public) and returns the response.
 * @param {Request} request
 * @param {object} env
 * @param {object} config
 * @returns {Promise<Response|null>}
 */
export async function handleAsset(request, env, config) {
    const url = new URL(request.url);

    // 1. Service Worker (Generated)
    if (url.pathname === '/__divortio_sw.js') {
        const content = getServiceWorkerCode(config.rootDomain);
        return new Response(content, {
            headers: {
                'Content-Type': 'application/javascript',
                'Cache-Control': 'public, max-age=43200', // 12h
                'Service-Worker-Allowed': '/'
            }
        });
    }

    // 2. Stealth Interceptor (Generated)
    if (url.pathname === '/__divortio_interceptor.js') {
        const content = getStealthInterceptorScript(config.rootDomain);
        return new Response(content, {
            headers: {
                'Content-Type': 'application/javascript',
                'Cache-Control': 'public, max-age=43200' // 12h
            }
        });
    }

    // 3. Public Directory Assets (Cloudflare Assets Binding)
    if (env.ASSETS) {
        try {
            const asset = await env.ASSETS.fetch(request);
            if (asset.status < 400) {
                const headers = new Headers(asset.headers);
                headers.set('X-Robots-Tag', 'noindex, nofollow');
                return new Response(asset.body, {
                    status: asset.status,
                    statusText: asset.statusText,
                    headers
                });
            }
        } catch (e) {}
    }

    return null; // Not an asset request
}