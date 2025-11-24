/**
 * @file Header Rewriting & Sanitization Logic
 * @version 4.0.0
 */

export function rewriteCSP(headerValue) {
    let newHeader = headerValue.replace(/upgrade-insecure-requests/gi, '');
    const relax = (header, directive, value) => {
        const regex = new RegExp(`(${directive}\\s+)([^;]+)`, 'i');
        if (regex.test(header)) return header.replace(regex, `$1$2 ${value}`);
        return `${header}; ${directive} ${value}`;
    };
    newHeader = relax(newHeader, 'script-src', "'unsafe-inline' 'unsafe-eval' * data:");
    newHeader = relax(newHeader, 'connect-src', "'self' *");
    newHeader = relax(newHeader, 'img-src', "'self' * data:");
    newHeader = relax(newHeader, 'style-src', "'unsafe-inline' *");
    return newHeader;
}

export function rewriteCORS(headers, targetURL, rootDomain) {
    const allowOrigin = headers.get('Access-Control-Allow-Origin');
    if (allowOrigin && allowOrigin !== '*') {
        try {
            const originURL = new URL(allowOrigin);
            if (originURL.hostname.endsWith(targetURL.hostname)) {
                const newHostname = originURL.hostname + '.' + rootDomain;
                headers.set('Access-Control-Allow-Origin', allowOrigin.replace(originURL.hostname, newHostname));
            }
        } catch(e) {}
    }
}

export function rewriteSetCookieHeader(headerValue, proxyDomain) {
    let parts = headerValue.split(';');
    const cookieName = parts[0].split('=')[0].trim();
    const isHostCookie = cookieName.startsWith('__Host-');
    parts = parts.filter(p => {
        const key = p.split('=')[0].trim().toLowerCase();
        return key !== 'domain' && key !== 'secure' && key !== 'samesite';
    });
    if (!isHostCookie) parts.push(`Domain=${proxyDomain}`);
    parts.push('Secure');
    parts.push('SameSite=Lax');
    return parts.join('; ');
}

export function rewriteLinkHeader(headerValue, targetURL, rootDomain) {
    if (!headerValue) return null;
    return headerValue.split(',').map(part => {
        const relMatch = part.match(/rel\s*=\s*"?([^"]+)"?/);
        if (relMatch && (relMatch[1].includes('preconnect') || relMatch[1].includes('dns-prefetch'))) return '';

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
                const newSrcset = srcset.split(',').map(p => {
                    const [url, desc] = p.trim().split(/\s+/);
                    if (!url) return p;
                    try {
                        const absURL = new URL(url, targetURL);
                        if (absURL.hostname.endsWith('.' + rootDomain)) return p;
                        const proxyUrl = `https://${absURL.hostname}.${rootDomain}${absURL.pathname}${absURL.search}`;
                        return desc ? `${proxyUrl} ${desc}` : proxyUrl;
                    } catch { return p; }
                }).join(', ');
                return `imagesrcset="${newSrcset}"`;
            });
        }
        return newPart;
    }).filter(Boolean).join(',');
}

export function rewriteLocationHeader(headers, targetURL, rootDomain) {
    if (headers.has('Location')) {
        try {
            const loc = new URL(headers.get('Location'), targetURL);
            headers.set('Location', `https://${loc.hostname}.${rootDomain}${loc.pathname}${loc.search}`);
        } catch(e) {}
    }
}

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