/**
 * @file Request Rewriting Logic
 * @description Sanitizes headers and prepares the upstream request object.
 * @version 5.0.0 (Typed Config)
 */

import {
    sanitizeRequestHeaders,
    fixIdentityHeaders,
    sanitizeRequestCookie
} from './rewriters/headers/index.mjs';

/**
 * Creates the clean Request object for the upstream fetch.
 * @param {Request} originalRequest - The incoming Cloudflare request.
 * @param {URL} targetURL - The resolved target URL.
 * @param {import('../config/env.mjs').EnvConfig} config - The app config.
 * @returns {Request} The sanitized request ready for fetch().
 */
export function rewriteRequest(originalRequest, targetURL, config) {
    const headers = new Headers(originalRequest.headers);

    // 1. Sanitize Technical Headers
    sanitizeRequestHeaders(headers);

    // 2. Enforce Host Header
    headers.set('Host', targetURL.hostname);

    // 3. Spoof Identity (Referer / Origin)
    fixIdentityHeaders(headers, config);

    // 4. Sanitize Cookies (Strip Proxy Auth / Internal tokens)
    sanitizeRequestCookie(headers, config, targetURL);

    return new Request(targetURL.href, {
        method: originalRequest.method,
        headers: headers,
        body: originalRequest.body,
        redirect: 'manual'
    });
}