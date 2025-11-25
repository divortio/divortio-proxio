/**
 * @file Content-Security-Policy Rewriter
 * @description Modifies CSP headers to allow the proxy's scripts and resources.
 * @version 1.0.0
 */

/**
 * Rewrites the Content-Security-Policy header to relax restrictions.
 * @param {string} headerValue - The original CSP header value.
 * @returns {string} The modified CSP header value.
 */
export function rewriteCSP(headerValue) {
    let newHeader = headerValue.replace(/upgrade-insecure-requests/gi, '');

    const relax = (header, directive, value) => {
        const regex = new RegExp(`(${directive}\\s+)([^;]+)`, 'i');
        if (regex.test(header)) {
            return header.replace(regex, `$1$2 ${value}`);
        }
        return `${header}; ${directive} ${value}`;
    };

    newHeader = relax(newHeader, 'script-src', "'unsafe-inline' 'unsafe-eval' * data:");
    newHeader = relax(newHeader, 'connect-src', "'self' *");
    newHeader = relax(newHeader, 'img-src', "'self' * data:");
    newHeader = relax(newHeader, 'style-src', "'unsafe-inline' *");

    return newHeader;
}