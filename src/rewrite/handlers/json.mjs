/**
 * @file JSON Response Handler
 * @description Handles the rewriting of JSON content responses.
 * @version 2.0.0 (Strictly Typed)
 */

import { rewriteUrlsInJson } from '../rewriters/mimeType/index.mjs';

/**
 * Rewrites URLs found within a JSON response body.
 * @param {Response} response
 * @param {URL} targetURL
 * @param {string} rootDomain
 * @returns {Promise<Response>}
 */
export async function handleJson(response, targetURL, rootDomain) {
    try {
        const json = await response.json();

        // Mutates the object in place
        rewriteUrlsInJson(json, targetURL, rootDomain);

        return new Response(JSON.stringify(json), {
            status: response.status,
            headers: response.headers
        });
    } catch (e) {
        // Fallback: Return original body if parsing fails
        return new Response(response.body, {
            status: response.status,
            headers: response.headers
        });
    }
}