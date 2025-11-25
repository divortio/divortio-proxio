/**
 * @file Meta Url Rewriter
 * @description Handles <meta> tags that contain URLs, such as Refresh redirects and OpenGraph tags.
 * @version 1.0.0
 */

/**
 * Handles <meta> tags that contain URLs, such as Refresh redirects and OpenGraph tags.
 *
 * @implements {HTMLRewriterElementContentHandler}
 */
export class MetaUrlRewriter {
    /**
     * @param {URL} baseURL - The base URL of the current page.
     * @param {string} rootDomain - The root domain of the proxy.
     */
    constructor(baseURL, rootDomain) {
        /** @type {URL} */
        this.baseURL = baseURL;
        /** @type {string} */
        this.rootDomain = rootDomain;
    }

    /**
     * @param {Element} el - The meta element.
     */
    element(el) {
        const content = el.getAttribute('content');
        if (!content) return;

        // Case 1: Meta Refresh (e.g., <meta http-equiv="refresh" content="0;url=...">)
        if (el.getAttribute('http-equiv')?.toLowerCase() === 'refresh') {
            const match = content.match(/url\s*=\s*['"]?([^'"]+)['"]?/i);
            if (match && match[1]) {
                this.rewriteContent(el, content, match[1]);
            }
            return;
        }

        // Case 2: Standard URL Metadata (OpenGraph, Twitter Cards)
        try {
            // Heuristic: If the content starts with http/https/slash, assume it's a URL
            if (content.startsWith('http') || content.startsWith('/')) {
                this.rewriteContent(el, content, content);
            }
        } catch(e) {}
    }

    /**
     * Helper to replace the URL portion of the content string.
     * @param {Element} el
     * @param {string} fullContent
     * @param {string} urlPart
     */
    rewriteContent(el, fullContent, urlPart) {
        try {
            const absURL = new URL(urlPart, this.baseURL);
            if (!absURL.hostname.endsWith(`.${this.rootDomain}`)) {
                const newUrl = `https://${absURL.hostname}.${this.rootDomain}${absURL.pathname}${absURL.search}`;
                const newContent = fullContent.replace(urlPart, newUrl);
                el.setAttribute('content', newContent);
            }
        } catch(e) {}
    }
}