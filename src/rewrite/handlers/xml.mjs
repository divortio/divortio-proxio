/**
 * @file XML Response Handler
 * @description Handles the rewriting of XML, RSS, Atom, and Sitemap content.
 * @version 2.0.0 (Strictly Typed)
 */

import { rewriteXML } from '../rewriters/mimeType/index.mjs';

/**
 * Rewrites URLs within an XML response body.
 *
 * This handler buffers the response text and applies regex-based rewriting
 * for standard XML namespaces, XSLT stylesheets, and RSS/Atom feed tags.
 *
 * @param {Response} response - The original response object.
 * @param {URL} targetURL - The target URL (for resolving relative paths).
 * @param {string} rootDomain - The proxy's root domain.
 * @returns {Promise<Response>} A promise resolving to the rewritten XML response.
 */
export async function handleXml(response, targetURL, rootDomain) {
    // Buffer the text content.
    // XML parsing via regex is safe here because we are targeting specific, well-defined
    // URL-holding attributes rather than trying to parse the entire document structure.
    const xml = await response.text();

    // Apply the rewrite logic (Atom, RSS, Sitemaps, XSLT)
    const rewrittenXml = rewriteXML(xml, targetURL, rootDomain);

    // We do not need to explicitly set Content-Length here because we aren't modifying
    // the encoding in a way that breaks chunked transfer. Cloudflare Workers handles
    // Content-Length automatically for simple Response bodies.
    return new Response(rewrittenXml, {
        status: response.status,
        headers: response.headers
    });
}