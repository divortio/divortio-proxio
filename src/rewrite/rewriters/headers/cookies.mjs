/**
 * @file Cookie Header Rewriter
 * @description Rewrites Set-Cookie headers toscope cookies to the proxy domain.
 * @version 1.0.0
 */

/**
 * Rewrites the Set-Cookie header.
 * @param {string} headerValue - The original Set-Cookie header value.
 * @param {string} proxyDomain - The domain of the proxy.
 * @returns {string} The modified Set-Cookie header value.
 */
export function rewriteSetCookieHeader(headerValue, proxyDomain) {
    let parts = headerValue.split(';');
    const cookieName = parts[0].split('=')[0].trim();
    const isHostCookie = cookieName.startsWith('__Host-');

    parts = parts.filter(p => {
        const key = p.split('=')[0].trim().toLowerCase();
        return key !== 'domain' && key !== 'secure' && key !== 'samesite';
    });

    if (!isHostCookie) {
        parts.push(`Domain=${proxyDomain}`);
    }

    parts.push('Secure');
    parts.push('SameSite=Lax');

    return parts.join('; ');
}