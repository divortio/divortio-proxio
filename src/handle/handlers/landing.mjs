/**
 * @file Landing Page & Redirect Handler
 * @description Handles requests to the root domain, providing quick redirects.
 * @version 2.0.0 (Typed Config)
 */

/**
 * Checks for a query-based redirect on the root domain.
 * Example: https://proxy.com/?google.com -> https://google.com.proxy.com/
 * @param {Request} request
 * @param {import('../../config/env.mjs').EnvConfig} config
 * @returns {Response|null} Redirect response or null if no action needed.
 */
export function handleRootRedirect(request, config) {
    const url = new URL(request.url);

    // 1. Only handle the root domain (no subdomain)
    if (url.hostname !== config.rootDomain) return null;

    // 2. Check for query input
    let input = url.search.slice(1);
    if (!input) return null;

    // 3. Normalize Input
    input = decodeURIComponent(input);
    if (input.startsWith('url=')) input = input.slice(4);

    if (!input.startsWith('http://') && !input.startsWith('https://')) {
        input = 'https://' + input;
    }

    try {
        const target = new URL(input);

        // 4. Construct the proxied URL
        const proxyHostname = `${target.hostname}.${config.rootDomain}`;
        const proxyUrl = `https://${proxyHostname}${target.pathname}${target.search}`;

        return Response.redirect(proxyUrl, 302);
    } catch (e) {
        return null;
    }
}