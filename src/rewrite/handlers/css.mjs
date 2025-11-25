/**
 * @file CSS Response Handler
 * @description Handles the rewriting of CSS content responses.
 * @version 1.0.0
 */

import { rewriteCSS } from '../rewriters/mimeType/index.mjs';

/**
 * Rewrites URLs and imports within a CSS response body.
 *
 * It buffers the response text, applies the `rewriteCSS` parser logic,
 * updates the `Content-Length` header to reflect the modified size,
 * and returns a new Response object.
 *
 * @param {Response} response - The original response object (cloned or base).
 * @param {URL} targetURL - The target URL of the original request (used for resolving relative paths).
 * @param {string} rootDomain - The proxy's root domain (e.g., "proxy.com").
 * @returns {Promise<Response>} A promise resolving to the modified CSS response.
 */
export async function handleCss(response, targetURL, rootDomain) {
    // Buffer the entire CSS content to allow safe regex replacement across line breaks.
    const css = await response.text();

    // Perform the rewrite logic (url(), @import, image-set, etc.)
    const rewrittenCss = rewriteCSS(css, targetURL, rootDomain);

    // Calculate the new byte length (UTF-8).
    // This is critical because rewriting changes the file size, and an incorrect
    // Content-Length will cause the browser to truncate the file or hang.
    const newSize = new TextEncoder().encode(rewrittenCss).length;

    // Create a new headers object to avoid mutating the input response's headers unexpectedly.
    const headers = new Headers(response.headers);
    headers.set('Content-Length', newSize.toString());

    return new Response(rewrittenCss, {
        status: response.status,
        statusText: response.statusText,
        headers: headers
    });
}