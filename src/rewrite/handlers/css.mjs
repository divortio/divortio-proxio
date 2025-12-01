/**
 * @file CSS Content Rewriter
 * @description Parses and rewrites URLs in CSS strings.
 * @version 2.0.0 (Strictly Typed)
 */

/**
 * Rewrites URLs in CSS strings, handling @import, url(), and image-set().
 * @param {string} css - The raw CSS content.
 * @param {URL} baseURL - The base URL for resolving relative paths.
 * @param {string} rootDomain - The proxy root domain.
 * @returns {string} The rewritten CSS content.
 */
export function rewriteCSS(css, baseURL, rootDomain) {
    const proxify = (url) => {
        if (!url || url.startsWith('data:') || url.startsWith('chrome-extension:')) return url;
        try {
            const absURL = new URL(url, baseURL);
            if (absURL.hostname.endsWith(`.${rootDomain}`)) return url;
            return `https://${absURL.hostname}.${rootDomain}${absURL.pathname}${absURL.search}`;
        } catch { return url; }
    };

    // 1. Strip Source Maps
    css = css.replace(/\/\*# sourceMappingURL=.* \*\/$/gm, '');

    // 2. Rewrite @import "..."
    css = css.replace(/@import\s*(?:url\(\s*)?['"]?([^'"\)]+)['"]?(?:\s*\))?/gi, (match, url) => {
        return match.replace(url, proxify(url));
    });

    // 3. Rewrite image-set(...)
    css = css.replace(/image-set\(([^)]+)\)/gi, (match, content) => {
        return match.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (m, q, u) => `url(${q}${proxify(u)}${q})`);
    });

    // 4. Rewrite standard url(...)
    return css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (match, quote, url) => {
        return `url(${quote}${proxify(url)}${quote})`;
    });
}