/**
 * @file Cookie Header Rewriter
 * @description Manages both response (Set-Cookie) rewriting and request (Cookie) stripping.
 * @version 4.0.0 (Typed Config)
 */

/**
 * Rewrites the Set-Cookie header (Response).
 * @param {string} headerValue
 * @param {string} rootDomain
 * @returns {string}
 */
export function rewriteSetCookieHeader(headerValue, rootDomain) {
    let parts = headerValue.split(';');
    let newParts = [];
    newParts.push(parts[0].trim());

    for (let i = 1; i < parts.length; i++) {
        let part = parts[i].trim();
        let lowerPart = part.toLowerCase();

        if (lowerPart.startsWith('secure') || lowerPart.startsWith('samesite')) continue;

        if (lowerPart.startsWith('domain=')) {
            const originalDomain = part.split('=')[1].trim();
            const cleanOriginDomain = originalDomain.startsWith('.') ? originalDomain.slice(1) : originalDomain;
            newParts.push(`Domain=${cleanOriginDomain}.${rootDomain}`);
            continue;
        }
        newParts.push(part);
    }

    newParts.push('Secure');
    newParts.push('SameSite=Lax');

    return newParts.join('; ');
}

/**
 * Sanitizes the Cookie header (Request) based on configured whitelists.
 * @param {Headers} headers
 * @param {import('../../../config/env.mjs').EnvConfig} config
 * @param {URL} targetURL
 */
export function sanitizeRequestCookie(headers, config, targetURL) {
    const rawCookie = headers.get('Cookie');
    if (!rawCookie) return;

    // We assume we are proxying if we reached this function
    const isProxyRequest = true;

    const parts = rawCookie.split(';');
    const safeParts = [];

    for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        const separatorIdx = trimmed.indexOf('=');
        if (separatorIdx === -1) continue;

        const name = trimmed.substring(0, separatorIdx).trim();

        // 1. Root Passthrough Check
        if (config.cookies.rootPassthrough && config.cookies.rootPassthrough.test(name)) {
            if (isProxyRequest) continue;
        }

        // 2. Proxy Passthrough Check
        if (config.cookies.proxyPassthrough && config.cookies.proxyPassthrough.test(name)) {
            continue;
        }

        safeParts.push(trimmed);
    }

    if (safeParts.length > 0) {
        headers.set('Cookie', safeParts.join('; '));
    } else {
        headers.delete('Cookie');
    }
}