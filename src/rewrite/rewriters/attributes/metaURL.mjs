/**
 * @file Meta Url Rewriter
 * @description Handles <meta> tags that contain URLs.
 * @version 2.0.0 (Strictly Typed)
 */

/**
 * @implements {HTMLRewriterElementContentHandler}
 */
export class MetaUrlRewriter {
    /**
     * @param {URL} baseURL
     * @param {string} rootDomain
     */
    constructor(baseURL, rootDomain) {
        this.baseURL = baseURL;
        this.rootDomain = rootDomain;
    }

    /**
     * @param {Element} el
     */
    element(el) {
        const content = el.getAttribute('content');
        if (!content) return;

        // Case 1: Meta Refresh
        if (el.getAttribute('http-equiv')?.toLowerCase() === 'refresh') {
            const match = content.match(/url\s*=\s*['"]?([^'"]+)['"]?/i);
            if (match && match[1]) {
                this.rewriteContent(el, content, match[1]);
            }
            return;
        }

        // Case 2: OpenGraph / Twitter
        try {
            if (content.startsWith('http') || content.startsWith('/')) {
                this.rewriteContent(el, content, content);
            }
        } catch(e) {}
    }

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