/**
 * @file Header Sanitizer
 * @description Removes headers that cause security leaks or technical issues.
 * @version 2.0.0 (Split Request/Response Logic)
 */

/**
 * Strips problematic headers from the RESPONSE.
 * @param {Headers} headers - The response headers object.
 */
export function sanitizeHeaders(headers) {
    // Technical Strips
    headers.delete('Content-Encoding');
    headers.delete('Content-Length');
    headers.delete('Transfer-Encoding');
    headers.delete('Connection');
    headers.delete('Keep-Alive');

    // Policy Strips
    headers.delete('Referrer-Policy');
    headers.delete('Content-Security-Policy-Report-Only');
    headers.delete('X-Frame-Options');
    headers.delete('Cross-Origin-Opener-Policy');
    headers.delete('Cross-Origin-Embedder-Policy');
    headers.delete('Permissions-Policy');

    // Leak Strips
    headers.delete('Report-To');
    headers.delete('NEL');
    headers.delete('Alt-Svc');
    headers.delete('Refresh');
    headers.delete('SourceMap');
    headers.delete('X-SourceMap');
    headers.delete('X-DNS-Prefetch-Control');
    headers.delete('Clear-Site-Data');
    headers.delete('Accept-CH');
}

/**
 * Strips identity-leaking headers from the REQUEST.
 * @param {Headers} headers - The outgoing request headers object.
 */
export function sanitizeRequestHeaders(headers) {
    const removeList = [
        'x-forwarded-for', 'x-forwarded-proto', 'x-real-ip', 'via',
        'cf-connecting-ip', 'cf-ipcountry', 'cf-ray', 'cf-visitor',
        'cf-access-jwt-assertion', 'cf-access-authenticated-user-email', 'cf-access-token'
    ];

    for (const key of headers.keys()) {
        if (removeList.includes(key) || key.startsWith('x-cf-')) {
            headers.delete(key);
        }
    }
}