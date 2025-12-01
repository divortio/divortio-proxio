/**
 * @file URL Parsing Utility
 * @description Extracts and validates the target URL from the proxy request.
 * @version 3.0.0 (Typed Config)
 */

/**
 * Extracts the target URL from the proxy request.
 * Scheme: https://target-com.proxy.domain.com/path -> https://target.com/path
 * @param {Request} request - The incoming Cloudflare request.
 * @param {import('../../config/env.mjs').EnvConfig} config - The app config.
 * @returns {URL|null} The parsed target URL, or null if invalid.
 */
export function getTargetURL(request, config) {
    const url = new URL(request.url);
    const hostname = url.hostname;
    const rootDomain = config.rootDomain;

    // 1. Safety Check: Are we actually on the proxy domain?
    if (!hostname.endsWith(rootDomain)) {
        return null;
    }

    // 2. Extract Subdomain
    // hostname: "google-com.proxy.com" -> subdomain: "google-com"
    const subdomain = hostname.slice(0, -(rootDomain.length + 1));

    // 3. Handle Root Access (No subdomain)
    if (!subdomain) return null;

    // 4. Decode Target Hostname
    // Convention: We replace '-' with '.' in the subdomain to get the target.
    const targetHost = subdomain;

    // 5. Construct Target URL
    try {
        return new URL(url.pathname + url.search, `https://${targetHost}`);
    } catch (e) {
        return null;
    }
}