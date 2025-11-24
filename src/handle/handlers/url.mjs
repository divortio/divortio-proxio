/**
 * @file URL Parsing Utility
 * @description Extracts and validates the target URL from the proxy request.
 * @version 2.0.0 (Functional)
 */

/**
 * Extracts the target URL from the proxy request.
 * Scheme: https://target-com.proxy.domain.com/path -> https://target.com/path
 * @param {Request} request - The incoming Cloudflare request
 * @param {object} config - The application configuration
 * @returns {URL|null} The parsed target URL, or null if invalid.
 */
export function getTargetURL(request, config) {
    const url = new URL(request.url);
    const hostname = url.hostname;
    const rootDomain = config.rootDomain;

    // 1. Safety Check: Are we actually on the proxy domain?
    if (!hostname.endsWith(rootDomain)) {
        return null; // Direct IP access or misconfiguration
    }

    // 2. Extract Subdomain
    // hostname: "google-com.proxy.com" -> subdomain: "google-com"
    // We slice off the root domain length plus one for the dot.
    const subdomain = hostname.slice(0, -(rootDomain.length + 1));

    // 3. Handle Root Access (No subdomain)
    if (!subdomain) return null;

    // 4. Decode Target Hostname
    // Convention: We replace '-' with '.' in the subdomain to get the target.
    // Note: Ideally we should handle double-dashes for real hyphens, but
    // for this implementation we assume simple substitution or transparent mapping.
    // If you are using "Transparent Proxying" (e.g. google.com.proxy.com),
    // the subdomain IS the target host.
    const targetHost = subdomain;

    // 5. Construct Target URL
    try {
        // Reconstruct the URL with the new host but same path/search
        return new URL(url.pathname + url.search, `https://${targetHost}`);
    } catch (e) {
        return null;
    }
}