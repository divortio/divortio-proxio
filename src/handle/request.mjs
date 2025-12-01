/**
 * @file HTTP Proxy Handler
 * @description Coordinates Caching, Fetching, and Content Rewriting using modular services.
 * @version 4.0.0 (Strictly Typed Config Integration)
 */

import { createConfig } from '../config/index.mjs';
import { getTargetURL } from './handlers/url.mjs';
import { handleWebSocket } from './handlers/websocket.mjs';
import { handleRootRedirect } from './handlers/landing.mjs';

import { CFCache } from './handlers/cfCache.mjs';
import { handleAsset } from './handlers/asset.mjs';
import { rewriteRequest } from '../rewrite/request.mjs';
import { rewriteResponse } from '../rewrite/response.mjs';

import { MOD_REGISTRY } from '../mods/registry.mjs';

/**
 * Handles the incoming Fetch event.
 * @param {Request} request
 * @param {object} env
 * @param {ExecutionContext} ctx
 * @returns {Promise<Response>}
 */
export async function handleRequest(request, env, ctx) {
    // 1. Load Strictly Typed Config
    const config = createConfig(env);

    // --- 2. Serve Static Assets ---
    const assetResponse = await handleAsset(request, env, config);
    if (assetResponse) return assetResponse;

    // --- 3. Cache Lookup ---
    if (config.cache.enabled && request.method === 'GET') {
        const cached = await CFCache.get(request);
        if (cached) return cached;
    }

    // --- 4. Target Resolution ---
    const targetURL = getTargetURL(request, config);

    if (!targetURL) {
        const redirect = handleRootRedirect(request, config);
        if (redirect) return redirect;
        return new Response("Divortio Proxy: Invalid target. Try /?example.com", {status: 404});
    }

    // --- 5. Traffic Mods (Redirects/Blocking) ---
    for (const modDef of MOD_REGISTRY) {
        if (config.mods && config.mods[modDef.envKey]) {
            const args = modDef.defaultArgs || [];
            const instance = new modDef.Class(...args);

            if (modDef.domainPattern) {
                instance.domainPattern = modDef.domainPattern;
            }

            // Duck Typing: If it has an execute() method, it's a Traffic Mod
            if (typeof instance.execute === 'function') {
                const response = instance.execute(targetURL, config);
                if (response) return response;
            }
        }
    }

    // --- 6. WebSocket Upgrade ---
    if (request.headers.get('Upgrade') === 'websocket') {
        return handleWebSocket(ctx, targetURL);
    }

    // --- 7. Fetch Upstream ---
    // Pass config for cookie stripping and header spoofing
    const proxyRequest = rewriteRequest(request, targetURL, config);

    let originResponse;
    try {
        originResponse = await fetch(proxyRequest);
    } catch (e) {
        return new Response(`Proxy Error: ${e.message}`, {status: 502});
    }

    // --- 8. Rewrite Content ---
    const finalResponse = await rewriteResponse(
        originResponse,
        targetURL,
        config.rootDomain,
        config,
        null
    );

    finalResponse.headers.set('X-Robots-Tag', 'noindex, nofollow');

    // --- 9. Cache Storage ---
    if (config.cache.enabled && request.method === 'GET') {
        ctx.waitUntil(CFCache.save(request, finalResponse, config));
    }

    return finalResponse;
}