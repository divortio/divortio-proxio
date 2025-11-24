/**
 * @file Response Processing Logic
 * @description Handles content rewriting based on MIME type.
 */

import { rewriteCSS, rewriteXML, rewriteUrlsInJson } from './rewriters/parsers.mjs';
import {
    rewriteCSP,
    rewriteCORS,
    rewriteSetCookieHeader,
    rewriteLinkHeader,
    rewriteLocationHeader,
    sanitizeHeaders
} from './rewriters/headers.mjs';
import { getHtmlRewriter } from './rewriters/html.mjs';
import { getStealthInterceptorScript } from '../templates/interceptor.mjs';

export async function rewriteResponse(originResponse, targetURL, rootDomain, config, setCookieHeader) {
    // 1. Status Check
    if (originResponse.status === 304 || originResponse.status === 204 || (originResponse.status >= 300 && originResponse.status < 400)) {
        const safeHeaders = new Headers(originResponse.headers);
        sanitizeHeaders(safeHeaders);
        rewriteLocationHeader(safeHeaders, targetURL, rootDomain);
        return new Response(originResponse.body, {
            status: originResponse.status,
            statusText: originResponse.statusText,
            headers: safeHeaders
        });
    }

    // 2. Header Prep
    const headers = new Headers(originResponse.headers);
    sanitizeHeaders(headers);
    const contentType = headers.get('Content-Type') || '';

    // 3. Header Rewriting
    if (setCookieHeader) headers.append('Set-Cookie', setCookieHeader);
    if (headers.has('Set-Cookie')) {
        const cookies = headers.getAll('Set-Cookie');
        headers.delete('Set-Cookie');
        cookies.forEach(c => headers.append('Set-Cookie', rewriteSetCookieHeader(c, rootDomain)));
    }

    if (headers.has('Link')) {
        const newLink = rewriteLinkHeader(headers.get('Link'), targetURL, rootDomain);
        newLink ? headers.set('Link', newLink) : headers.delete('Link');
    }

    rewriteLocationHeader(headers, targetURL, rootDomain);
    rewriteCORS(headers, targetURL, rootDomain);
    if (headers.has('Content-Security-Policy')) {
        headers.set('Content-Security-Policy', rewriteCSP(headers.get('Content-Security-Policy')));
    }

    // 4. Content Rewriting

    // HTML
    if (contentType.includes('text/html')) {
        return getHtmlRewriter(targetURL, rootDomain)
            .transform(new Response(originResponse.body, { status: originResponse.status, statusText: originResponse.statusText, headers }));
    }

    // JavaScript
    if (contentType.includes('javascript') || contentType.includes('application/x-javascript')) {
        let js = await originResponse.text();
        js = js.replace(/\/\/# sourceMappingURL=.*/g, '');
        js = js.replace(/import\s*\(/g, 'import(self.__d_rw(');
        // Note: Interceptor is now injected via HTML <script src>, so we don't prepend it here.
        headers.set('Content-Length', new TextEncoder().encode(js).length);
        return new Response(js, { status: originResponse.status, headers });
    }

    // CSS
    if (contentType.includes('text/css')) {
        let css = await originResponse.text();
        const rewrittenCss = rewriteCSS(css, targetURL, rootDomain);
        headers.set('Content-Length', new TextEncoder().encode(rewrittenCss).length);
        return new Response(rewrittenCss, { status: originResponse.status, headers });
    }

    // JSON
    if (contentType.includes('application/json') || contentType.includes('application/manifest+json')) {
        try {
            const json = await originResponse.json();
            rewriteUrlsInJson(json, targetURL, rootDomain);
            return new Response(JSON.stringify(json), { status: originResponse.status, headers });
        } catch (e) {
            return new Response(originResponse.body, { status: originResponse.status, headers });
        }
    }

    // XML
    if (contentType.includes('xml')) {
        const xml = await originResponse.text();
        const rewrittenXml = rewriteXML(xml, targetURL, rootDomain);
        return new Response(rewrittenXml, { status: originResponse.status, headers });
    }

    // PDF
    if (contentType.includes('application/pdf')) {
        headers.set('Content-Disposition', 'attachment');
    }

    // Passthrough
    return new Response(originResponse.body, { status: originResponse.status, statusText: originResponse.statusText, headers });
}