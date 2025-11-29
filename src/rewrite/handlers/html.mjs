/**
 * @file HTML Response Handler
 * @description Handles the streaming and rewriting of HTML content using Cloudflare's HTMLRewriter API.
 * @version 3.0.0 (Updated for Mod Config)
 */

import { getHtmlRewriter } from '../rewriters/html.mjs';

/**
 * Processes an HTML response stream, applying all configured rewriting rules.
 *
 * This handler uses `HTMLRewriter`, which is a streaming API. This means it modifies
 * the response body chunk-by-chunk as it passes through the Worker, without buffering
 * the entire file into memory. This is critical for performance and TTFB (Time To First Byte).
 *
 * @param {Response} response - The original response object from the upstream server.
 * @param {URL} targetURL - The target URL of the original request (used for resolving relative paths).
 * @param {string} rootDomain - The proxy's root domain (e.g., "proxy.com").
 * @param {object} config - The application configuration object (containing active mods).
 * @returns {Response} A new Response object containing the transformed stream.
 */
export function handleHtml(response, targetURL, rootDomain, config) {
    // Create the rewriter instance configured with all our traps (attributes, scripts, meta, etc.)
    // UPDATED: Now passing 'config' so the rewriter knows which Mods to attach.
    const rewriter = getHtmlRewriter(targetURL, rootDomain, config);

    // Apply the transformations to the response stream.
    // .transform() returns a new Response object that streams the modified content.
    return rewriter.transform(response);
}