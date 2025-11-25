/**
 * @file Request Rewriting Logic
 * @description Sanitizes headers and prepares the upstream request object.
 * @version 2.0.0
 */

import { getTargetURL } from '../handle/handlers/url.mjs';

/**
 * Creates the clean Request object for the upstream fetch.
 * Rewrites headers, Host, Referer, and Origin.
 * @param {Request} originalRequest - The incoming Cloudflare request
 * @param {URL} targetURL - The resolved target URL
 * @param {object} config - The application configuration
 * @returns {Request} The sanitized request ready for fetch()
 */
export function rewriteRequest(originalRequest, targetURL, config) {
    const headers = sanitizeHeaders(originalRequest.headers);

    // Enforce Host
    headers.set('Host', targetURL.hostname);

    // Fix Referer & Origin
    fixIdentityHeaders(headers, config);

    return new Request(targetURL.href, {
        method: originalRequest.method,
        headers: headers,
        body: originalRequest.body,
        redirect: 'manual'
    });
}

/**
 * Internal Helper: Removes headers that leak identity.
 */
function sanitizeHeaders(originalHeaders) {
    const headers = new Headers(originalHeaders);
    const removeList = [
        'x-forwarded-for', 'x-forwarded-proto', 'x-real-ip', 'via',
        'cf-connecting-ip', 'cf-ipcountry', 'cf-ray', 'cf-visitor',
        'cf-access-jwt-assertion', 'cf-access-authenticated-user-email', 'cf-access-token'
    ];

    for (const key of headers.keys()) {
        if (removeList.includes(key) || key.startsWith('x-cf-')) {
            headers.delete(key);
        }
    }
    return headers;
}

/**
 * Internal Helper: Rewrites Referer/Origin to match the target.
 */
function fixIdentityHeaders(headers, config) {
    const fix = (name) => {
        const val = headers.get(name);
        if (!val) return;
        try {
            const u = new URL(val);
            // If coming from our proxy, map it to the target
            if (u.hostname.endsWith(config.rootDomain)) {
                const realTarget = getTargetURL(new Request(val), config);
                if (realTarget) headers.set(name, realTarget.href);
            }
        } catch (e) {
            headers.delete(name);
        }
    };
    fix('Referer');
    fix('Origin');
}