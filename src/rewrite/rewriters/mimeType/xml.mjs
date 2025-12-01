/**
 * @file XML Content Rewriter
 * @description Parses and rewrites URLs in XML, RSS, Atom, and Sitemap documents.
 * @version 2.1.0 (Added Atom Support)
 */

/**
 * Rewrites URLs in XML/RSS/Sitemap documents.
 * @param {string} xml - The raw XML content.
 * @param {URL} baseURL - The base URL for resolving relative paths (passed from handler).
 * @param {string} rootDomain - The proxy root domain.
 * @returns {string} The rewritten XML content.
 */
export function rewriteXML(xml, baseURL, rootDomain) {
    /**
     * Helper to rewrite a single URL.
     * @param {string} url
     * @returns {string}
     */
    const proxiedURL = (url) => {
        try {
            // Check if already proxied to avoid double-rewriting
            const u = new URL(url, baseURL);
            if (u.hostname.endsWith(`.${rootDomain}`)) return url;

            return `https://${u.hostname}.${rootDomain}${u.pathname}${u.search}`;
        } catch { return url; }
    };

    try {
        // 1. XSLT Stylesheets (<?xml-stylesheet href="..." ?>)
        xml = xml.replace(/<\?xml-stylesheet\s+(.*?)href=["']([^"']+)["'](.*?)\?>/g, (match, pre, url, post) => {
            return `<?xml-stylesheet ${pre}href="${proxiedURL(url)}"${post}?>`;
        });

        // 2. RSS Standard Tags (<link>url</link>)
        xml = xml.replace(/<link>([^<]+)<\/link>/g, (match, url) => `<link>${proxiedURL(url)}</link>`);

        // 3. Atom / RSS Attributes (<link href="...">, <atom:link href="...">)
        // Matches any tag ending in 'link' with an href attribute
        xml = xml.replace(/(<[a-zA-Z0-9:]*link[^>]+href=["'])([^"']+)(")/g, (match, prefix, url, suffix) => {
            return prefix + proxiedURL(url) + suffix;
        });

        // 4. Enclosures & Media (<enclosure url="...">, <media:content url="...">)
        xml = xml.replace(/(<enclosure[^>]+url=["'])([^"']+)(")/g, (match, prefix, url, suffix) => prefix + proxiedURL(url) + suffix);
        xml = xml.replace(/(<media:content[^>]+url=["'])([^"']+)(")/g, (match, prefix, url, suffix) => prefix + proxiedURL(url) + suffix);

        // 5. Sitemaps (<loc>, <image:loc>)
        xml = xml.replace(/<loc>([^<]+)<\/loc>/g, (match, url) => `<loc>${proxiedURL(url)}</loc>`);
        xml = xml.replace(/<image:loc>([^<]+)<\/image:loc>/g, (match, url) => `<image:loc>${proxiedURL(url)}</image:loc>`);

    } catch (e) {
        // XML parsing involves loose regex; if something fails, return original
    }

    return xml;
}