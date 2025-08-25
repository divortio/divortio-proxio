/**
 * @file Handles parsing of incoming request hostnames to determine the intended target.
 * @version 2.0.0
 * @see {@link ./request-handler.mjs} for usage.
 *
 * @description
 * This module is a dedicated utility for interpreting the proxy's subdomain-based
 * URL structure. The primary URL format is `https://<target-domain>.<root-domain>/<path>`,
 * for example, `https://www.google.com.proxy.example.com/search`.
 *
 * This parser is responsible for correctly extracting the full target URL by analyzing the
 * hostname of the incoming request. It also provides a fallback mechanism for resolving
 * relative resource URLs (e.g., for images or CSS) by using the `Referer` header of the
 * request, ensuring that assets loaded by a proxied page are correctly routed back to their origin.
 */

/**
 * @namespace URLParser
 * @description A utility for parsing the proxy's specific subdomain URL format.
 */
export const URLParser = {
    /**
     * Parses the request's hostname to determine the target URL.
     *
     * It operates by taking the full request hostname (e.g., "www.google.com.proxy.example.com")
     * and removing the proxy's root domain suffix to isolate the target part.
     *
     * @param {Request} request - The incoming request from the client.
     * @param {object} config - The application configuration object, which must contain `rootDomain`.
     * @returns {URL|null} A URL object for the target, or `null` if the hostname does not end
     * with the proxy's root domain or if the target part is empty.
     */
    getTargetURL(request, config) {
        const url = new URL(request.url);
        const hostname = url.hostname;

        // Check if the request is to the root domain itself (e.g., for a homepage).
        if (hostname === config.rootDomain) {
            return null; // Indicates a request to the root, not a proxy request.
        }

        // Check if the hostname ends with the proxy's root domain. The dot is crucial.
        if (hostname.endsWith(`.${config.rootDomain}`)) {
            // Extract the target part by slicing off the root domain and the preceding dot.
            const targetHost = hostname.slice(0, -(config.rootDomain.length + 1));

            if (targetHost) {
                // Reconstruct the full target URL, preserving the path and query string.
                const targetURL = new URL(url.pathname + url.search, `https://${targetHost}`);
                return targetURL;
            }
        }

        // Fallback for relative paths on a proxied page. This is less common in the subdomain model
        // but is kept as a safeguard.
        const referer = request.headers.get('Referer');
        if (referer) {
            try {
                const refererUrl = new URL(referer);
                const refererHost = refererUrl.hostname;

                if (refererHost.endsWith(`.${config.rootDomain}`)) {
                    const originalTargetHost = refererHost.slice(0, -(config.rootDomain.length + 1));
                    if (originalTargetHost) {
                        // Resolve the current request's pathname relative to the original page's URL.
                        return new URL(url.pathname, `https://${originalTargetHost}`);
                    }
                }
            } catch (e) { /* Invalid Referer, ignore and return null below. */
            }
        }

        return null;
    },
};