/**
 * @file XML Content Rewriter
 * @description Parses and rewrites URLs in XML, RSS, Atom, and Sitemap documents.
 * @version 1.0.0
 */

/**
 * Rewrites URLs in XML/RSS/Sitemap documents.
 * @param {string} xml - The raw XML content.
 * @param {URL} baseURL - The base URL for resolving relative paths.
 * @param {string} rootDomain - The proxy root domain.
 * @returns {string} The rewritten XML content.
 */
export function rewriteXML(xml, baseURL, rootDomain) {
    const proxiedURL = (url) => {
        try {
            return `https://${new URL(url, baseURL).hostname}.${rootDomain}${new URL(url, baseURL).pathname}${new URL(url, baseURL).search}`;
        } catch { return url; }
    };

    try {
        // XSLT Stylesheets
        xml = xml.replace(/<\?xml-stylesheet\s+(.*?)href=["']([^"']+)["'](.*?)\?>/g, (match, pre, url, post) => {
            return `<?xml-stylesheet ${pre}href="${proxiedURL(url)}"${post}?>`;
        });

        // RSS / Atom Standard Tags
        xml = xml.replace(/<link>([^<]+)<\/link>/g, (match, url) => `<link>${proxiedURL(url)}</link>`);
        xml = xml.replace(/(<enclosure[^>]+url=")([^"]+)(")/g, (match, prefix, url, suffix) => prefix + proxiedURL(url) + suffix);
        xml = xml.replace(/(<media:content[^>]+url=")([^"]+)(")/g, (match, prefix, url, suffix) => prefix + proxiedURL(url) + suffix);

        // Sitemaps
        xml = xml.replace(/<loc>([^<]+)<\/loc>/g, (match, url) => `<loc>${proxiedURL(url)}</loc>`);
        xml = xml.replace(/<image:loc>([^<]+)<\/image:loc>/g, (match, url) => `<image:loc>${proxiedURL(url)}</image:loc>`);

    } catch (e) {}
    return xml;
}