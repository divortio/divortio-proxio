/**
 * @file JavaScript Response Handler
 * @version 1.0.0
 */

import { getStealthInterceptorScript } from '../../templates/interceptor.mjs';

/**
 * Rewrites JavaScript content to inject the interceptor and fix dynamic imports.
 * @param {Response} response
 * @param {string} rootDomain
 * @returns {Promise<Response>}
 */
export async function handleJavascript(response, rootDomain) {
    let js = await response.text();

    // 1. Strip Source Maps (Prevent browser DevTools 404s)
    js = js.replace(/\/\/# sourceMappingURL=.*/g, '');

    // 2. Rewrite Dynamic Imports
    // Transforms: import('./module.js') -> import(self.__d_rw('./module.js'))
    // This hook relies on __d_rw being exposed by the interceptor.
    js = js.replace(/import\s*\(/g, 'import(self.__d_rw(');

    // 3. Update Content-Length
    // We modified the body size, so the old header is invalid.
    const newSize = new TextEncoder().encode(js).length;
    const headers = new Headers(response.headers);
    headers.set('Content-Length', newSize.toString());

    return new Response(js, {
        status: response.status,
        headers: headers
    });
}