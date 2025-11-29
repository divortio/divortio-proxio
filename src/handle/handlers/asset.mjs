/**
 * @file Static Asset Handler
 * @description Serves internal generated scripts and public assets.
 * @version 3.1.0 (Added SW Injector)
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
    // This is OUR main proxy service worker
    if (url.pathname === '/__divortio_sw.js') {
        const content = getServiceWorkerCode(config.rootDomain);
        return new Response(content, {
            headers: {
                'Content-Type': 'application/javascript',
                'Cache-Control': 'public, max-age=43200',
                'Service-Worker-Allowed': '/'
            }
        });
    }

    // 2. Service Worker Injector (NEW GAP #2 SOLVER)
    // Wraps 3rd-party Service Workers to ensure they load our interceptor.
    // Usage: /__divortio_sw_injector.js?target=<encoded_target_sw_url>
    if (url.pathname === '/__divortio_sw_injector.js') {
        const target = url.searchParams.get('target');
        if (!target) return new Response("// Missing target", { status: 400 });

        const interceptorUrl = `/__divortio_interceptor.js`;

        // We create a wrapper that loads our tools, then the user's SW
        const wrapper = `
/** Divortio SW Injector **/
try {
  importScripts('${interceptorUrl}');
} catch(e) { console.error("[Proxio] SW Injection Failed", e); }

// Load the actual target Service Worker
importScripts('${target}');
`;
        return new Response(wrapper, {
            headers: {
                'Content-Type': 'application/javascript',
                // Important: Allow this script to control the root scope, just like the original SW would
                'Service-Worker-Allowed': '/'
            }
        });
    }

    // 3. Stealth Interceptor (Generated)
    if (url.pathname === '/__divortio_interceptor.js') {
        const content = getStealthInterceptorScript(config.rootDomain);
        return new Response(content, {
            headers: {
                'Content-Type': 'application/javascript',
                'Cache-Control': 'public, max-age=43200'
            }
        });
    }

    // 4. Public Directory Assets (Cloudflare Assets Binding)
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