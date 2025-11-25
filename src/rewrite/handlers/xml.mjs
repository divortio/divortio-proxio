/**
 * @file XML Response Handler
 * @description Handles the rewriting of XML, RSS, Atom, and Sitemap content.
 * @version 1.0.0
 */

import { rewriteXML } from '../rewriters/mimeType/index.mjs';

/**
 * Rewrites URLs within an XML response body.
 *
 * This handler buffers the response text and applies regex-based rewriting
 * for standard XML namespaces, XSLT stylesheets, and RSS/Atom feed tags.
 * It is crucial for ensuring that feeds and sitemaps served through the proxy
 * point back to the proxy, not the original origin.
 *
 * @param {Response} response - The original response object (cloned or base).
 * @param {URL} targetURL - The target URL of the original request (used for resolving relative paths).
 * @param {string} rootDomain - The proxy's root domain (e.g., "proxy.com").
 * @returns {Promise<Response>} A promise resolving to the rewritten XML response.
 */
export async function handleXml(response, targetURL, rootDomain) {
    // Buffer the text content.
    // XML parsing via regex is safe here because we are targeting specific, well-defined
    // URL-holding attributes rather than trying to parse the entire document structure.
    const xml = await response.text();

    // Apply the rewrite logic
    const rewrittenXml = rewriteXML(xml, targetURL, rootDomain);

    // We do not need to explicitly set Content-Length here because we aren't modifying
    // the encoding in a way that breaks chunked transfer, but for correctness with
    // buffered responses, it's good practice if the platform doesn't handle it.
    // Cloudflare Workers usually handles Content-Length automatically for simple Response bodies.
    // However, to be consistent with our other handlers:
    const headers = new Headers(response.headers);
    // Note: TextEncoder handles UTF-8 byte length correctly.
    // rewrittenXml is a string, so we encode it to get the byte length.
    // This avoids truncation issues with multi-byte characters.
    // const newSize = new TextEncoder().encode(rewrittenXml).length;
    // headers.set('Content-Length', newSize.toString());

    return new Response(rewrittenXml, {
        status: response.status,
        headers: response.headers // Use original headers (Cloudflare recalculates length)
    });
}