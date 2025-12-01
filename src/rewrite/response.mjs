/**
 * @file Response Processing Logic
 * @description Orchestrates header sanitization and content type delegation.
 * @version 7.0.0 (Typed Config)
 */

import {
    rewriteCSP,
    rewriteCORS,
    rewriteSetCookieHeader,
    rewriteLinkHeader,
    rewriteLocationHeader,
    sanitizeHeaders
} from './rewriters/headers/index.mjs';

import { handleJavascript, handleHtml, handleCss, handleJson, handleXml } from './handlers/index.mjs';

/**
 * Main entry point for rewriting a response.
 * @param {Response} originResponse
 * @param {URL} targetURL
 * @param {string} rootDomain
 * @param {import('../config/env.mjs').EnvConfig} config
 * @param {string|null} setCookieHeader
 * @returns {Promise<Response>}
 */
export async function rewriteResponse(originResponse, targetURL, rootDomain, config, setCookieHeader) {
    // 1. Status Check: Passthrough for 304/204/Redirects (Empty Body)
    if (originResponse.status === 304 || originResponse.status === 204 || (originResponse.status >= 300 && originResponse.status < 400)) {
        const safeHeaders = new Headers(originResponse.headers);
        sanitizeHeaders(safeHeaders);
        rewriteLocationHeader(safeHeaders, targetURL, rootDomain);
        return new Response(originResponse.body, {
            status: originResponse.status,
            statusText: originResponse.statusText,
            headers: safeHeaders
        });
    }

    // 2. Prepare Response Headers
    const headers = new Headers(originResponse.headers);
    sanitizeHeaders(headers);

    // 3. Rewrite Security & Link Headers
    if (setCookieHeader) headers.append('Set-Cookie', setCookieHeader);

    if (headers.has('Set-Cookie')) {
        const cookies = headers.getAll('Set-Cookie');
        headers.delete('Set-Cookie');
        cookies.forEach(c => headers.append('Set-Cookie', rewriteSetCookieHeader(c, rootDomain)));
    }

    if (headers.has('Link')) {
        const newLink = rewriteLinkHeader(headers.get('Link'), targetURL, rootDomain);
        newLink ? headers.set('Link', newLink) : headers.delete('Link');
    }

    rewriteLocationHeader(headers, targetURL, rootDomain);
    rewriteCORS(headers, targetURL, rootDomain);

    if (headers.has('Content-Security-Policy')) {
        headers.set('Content-Security-Policy', rewriteCSP(headers.get('Content-Security-Policy')));
    }

    // 4. Create Response Base
    const responseBase = new Response(originResponse.body, {
        status: originResponse.status,
        statusText: originResponse.statusText,
        headers: headers
    });

    // 5. Delegate to Content Type Handlers
    const contentType = headers.get('Content-Type') || '';

    if (contentType.includes('text/html')) {
        // Pass Config to support Mods
        return handleHtml(responseBase, targetURL, rootDomain, config);
    }

    if (contentType.includes('javascript') || contentType.includes('application/x-javascript')) {
        return handleJavascript(responseBase, rootDomain);
    }

    if (contentType.includes('text/css')) {
        return handleCss(responseBase, targetURL, rootDomain);
    }

    if (contentType.includes('application/json') || contentType.includes('application/manifest+json')) {
        return handleJson(responseBase, targetURL, rootDomain);
    }

    if (contentType.includes('xml')) {
        return handleXml(responseBase, targetURL, rootDomain);
    }

    // Special Case: PDF (Force Download)
    if (contentType.includes('application/pdf')) {
        headers.set('Content-Disposition', 'attachment');
        return new Response(originResponse.body, {
            status: originResponse.status,
            statusText: originResponse.statusText,
            headers: headers
        });
    }

    // 6. Fallback Passthrough
    return responseBase;
}