/**
 * @file HTML Response Handler
 * @description Handles the streaming and rewriting of HTML content using Cloudflare's HTMLRewriter API.
 * @version 2.0.0 (Strictly Typed)
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
 * @returns {Response} A new Response object containing the transformed stream.
 */
export function handleHtml(response, targetURL, rootDomain) {
    // Create the rewriter instance configured with all our traps (attributes, scripts, meta, etc.)
    const rewriter = getHtmlRewriter(targetURL, rootDomain);

    // Apply the transformations to the response stream.
    // .transform() returns a new Response object that streams the modified content.
    return rewriter.transform(response);
}