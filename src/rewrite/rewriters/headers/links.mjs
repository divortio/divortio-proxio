/**
 * @file Link Header Rewriter
 * @description Rewrites URLs inside the HTTP Link header.
 * @version 2.0.0 (Strictly Typed)
 */

/**
 * Rewrites URLs inside the Link header (e.g., for preloading).
 * @param {string} headerValue - The original Link header value.
 * @param {URL} targetURL - The target URL (used as base for relative URLs).
 * @param {string} rootDomain - The root domain of the proxy.
 * @returns {string|null} The rewritten Link header, or null if empty.
 */
export function rewriteLinkHeader(headerValue, targetURL, rootDomain) {
    if (!headerValue) return null;

    return headerValue.split(',').map(part => {
        const relMatch = part.match(/rel\s*=\s*"?([^"]+)"?/);
        if (relMatch && (relMatch[1].includes('preconnect') || relMatch[1].includes('dns-prefetch'))) {
            return '';
        }

        // 1. Fix main <url>
        let newPart = part.replace(/<([^>]+)>/, (match, url) => {
            try {
                const absURL = new URL(url, targetURL);
                if (absURL.hostname.endsWith('.' + rootDomain)) return match;
                const newUrl = `https://${absURL.hostname}.${rootDomain}${absURL.pathname}${absURL.search}`;
                return `<${newUrl}>`;
            } catch(e) { return match; }
        });

        // 2. Fix imagesrcset
        if (newPart.includes('imagesrcset=')) {
            newPart = newPart.replace(/imagesrcset="([^"]+)"/g, (m, srcset) => {
                return `imagesrcset="${rewriteLinkSrcset(srcset, targetURL, rootDomain)}"`;
            });
        }

        return newPart;
    }).filter(Boolean).join(',');
}

/**
 * Helper to rewrite srcset values within Link headers.
 */
function rewriteLinkSrcset(srcset, targetURL, rootDomain) {
    return srcset.split(',').map(p => {
        const [url, desc] = p.trim().split(/\s+/);
        if (!url) return p;
        try {
            const absURL = new URL(url, targetURL);
            if (absURL.hostname.endsWith('.' + rootDomain)) return p;
            const proxyUrl = `https://${absURL.hostname}.${rootDomain}${absURL.pathname}${absURL.search}`;
            return desc ? `${proxyUrl} ${desc}` : proxyUrl;
        } catch { return p; }
    }).join(', ');
}