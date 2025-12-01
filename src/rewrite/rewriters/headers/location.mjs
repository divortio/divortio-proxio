/**
 * @file Location Header Rewriter
 * @description Rewrites the Location header for redirects.
 * @version 2.0.0 (Strictly Typed)
 */

/**
 * Rewrites the Location header to keep redirects within the proxy.
 * @param {Headers} headers - The response headers object.
 * @param {URL} targetURL - The target URL.
 * @param {string} rootDomain - The root domain of the proxy.
 */
export function rewriteLocationHeader(headers, targetURL, rootDomain) {
    if (headers.has('Location')) {
        try {
            const loc = new URL(headers.get('Location'), targetURL);
            headers.set('Location', `https://${loc.hostname}.${rootDomain}${loc.pathname}${loc.search}`);
        } catch(e) {}
    }
}