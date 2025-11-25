/**
 * @file CORS Header Rewriter
 * @description Adjusts Access-Control-Allow-Origin to match the proxy domain.
 * @version 1.0.0
 */

/**
 * Rewrites the Access-Control-Allow-Origin header.
 * @param {Headers} headers - The response headers object.
 * @param {URL} targetURL - The target URL of the request.
 * @param {string} rootDomain - The root domain of the proxy.
 */
export function rewriteCORS(headers, targetURL, rootDomain) {
    const allowOrigin = headers.get('Access-Control-Allow-Origin');
    if (allowOrigin && allowOrigin !== '*') {
        try {
            const originURL = new URL(allowOrigin);
            if (originURL.hostname.endsWith(targetURL.hostname)) {
                const newHostname = originURL.hostname + '.' + rootDomain;
                headers.set('Access-Control-Allow-Origin', allowOrigin.replace(originURL.hostname, newHostname));
            }
        } catch(e) {}
    }
}