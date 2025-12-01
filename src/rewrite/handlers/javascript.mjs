/**
 * @file JavaScript Response Handler
 * @description Rewrites JavaScript content to hook dynamic imports.
 * @version 2.0.0 (Cleaned & Typed)
 */

/**
 * Rewrites JavaScript content to fix dynamic imports and strip source maps.
 * @param {Response} response - The original response object.
 * @param {string} rootDomain - The proxy root domain.
 * @returns {Promise<Response>}
 */
export async function handleJavascript(response, rootDomain) {
    let js = await response.text();

    // 1. Strip Source Maps (Prevent browser DevTools 404s)
    js = js.replace(/\/\/# sourceMappingURL=.*/g, '');

    // 2. Rewrite Dynamic Imports
    // Transforms: import('./module.js') -> import(self.__d_rw('./module.js'))
    // This hook relies on __d_rw being exposed by the HTML interceptor.
    js = js.replace(/import\s*\(/g, 'import(self.__d_rw(');

    // 3. Update Content-Length
    const newSize = new TextEncoder().encode(js).length;
    const headers = new Headers(response.headers);
    headers.set('Content-Length', newSize.toString());

    return new Response(js, {
        status: response.status,
        headers: headers
    });
}