/**
 * @file HTTP Proxy Handler
 * @description Coordinates Caching, Fetching, and Content Rewriting using modular services.
 * @version 3.0.0
 */

import {createConfig} from '../config/index.mjs';
import {getTargetURL} from "./handlers/url.mjs";
import {handleWebSocket} from './handlers/websocket.mjs';

// New Modular Services
import {CFCache} from './handlers/cfCache.mjs';
import {handleAsset} from './handlers/asset.mjs';
import {rewriteRequest} from '../rewrite/request.mjs';
import {rewriteResponse} from "../rewrite/response.mjs";

export async function handleRequest(request, env, ctx) {
    const config = createConfig(env);

    // --- 1. Serve Static Assets ---
    // Functional call
    const assetResponse = await handleAsset(request, env, config);
    if (assetResponse) return assetResponse;

    // --- 2. Cache Lookup ---
    if (config.cache.enabled && request.method === 'GET') {
        const cached = await CFCache.get(request);
        if (cached) return cached;
    }

    // --- 3. Target Resolution ---
    const targetURL = getTargetURL(request, config);
    if (!targetURL) {
        return new Response("Divortio Proxy: Invalid target.", {status: 404});
    }

    // --- 4. WebSocket Upgrade ---
    if (request.headers.get('Upgrade') === 'websocket') {
        return handleWebSocket(ctx, targetURL);
    }

    // --- 5. Fetch Upstream ---
    const proxyRequest = rewriteRequest(request, targetURL, config);

    let originResponse;
    try {
        originResponse = await fetch(proxyRequest);
    } catch (e) {
        return new Response(`Proxy Error: ${e.message}`, {status: 502});
    }

    // --- 6. Rewrite Content ---
    const finalResponse = await rewriteResponse(
        originResponse,
        targetURL,
        config.rootDomain,
        config,
        null
    );

    // --- 7. Final Security ---
    finalResponse.headers.set('X-Robots-Tag', 'noindex, nofollow');

    // --- 8. Cache Storage ---
    if (config.cache.enabled && request.method === 'GET') {
        ctx.waitUntil(CFCache.save(request, finalResponse, config));
    }

    return finalResponse;
}