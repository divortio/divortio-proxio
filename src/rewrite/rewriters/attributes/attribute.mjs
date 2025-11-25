/**
 * @file Generic Attribute Rewriter
 * @description Rewrites standard URL-holding attributes (href, src, action, etc.).
 * @version 1.0.0
 */

/**
 * A generic rewriter for standard URL-holding attributes (href, src, action, etc.).
 *
 * @implements {HTMLRewriterElementContentHandler}
 */
export class AttributeRewriter {
    /**
     * @param {string} attr - The name of the attribute to rewrite (e.g., "href").
     * @param {URL} baseURL - The base URL of the current page.
     * @param {string} rootDomain - The root domain of the proxy.
     */
    constructor(attr, baseURL, rootDomain) {
        /** @type {string} */
        this.attr = attr;
        /** @type {URL} */
        this.baseURL = baseURL;
        /** @type {string} */
        this.rootDomain = rootDomain;
    }

    /**
     * Rewrites the specified attribute on the element.
     * @param {Element} el - The HTML element.
     */
    element(el) {
        const val = el.getAttribute(this.attr);
        if (!val || val.startsWith('data:') || val.startsWith('javascript:')) return;

        // Basic sanitization for javascript: URIs if they contain 'location='
        if (val.startsWith('javascript:')) {
            // Attempt to neutralize location assignment
            const rewritten = val.replace(/location\s*=\s*['"](http[^'"]+)['"]/g, (m, url) => `location='#'`);
            if (rewritten !== val) el.setAttribute(this.attr, rewritten);
            return;
        }

        try {
            const absURL = new URL(val, this.baseURL);
            // If it's already on the proxy domain, skip it to avoid double-rewriting
            if (absURL.hostname.endsWith(`.${this.rootDomain}`)) return;

            el.setAttribute(this.attr, `https://${absURL.hostname}.${this.rootDomain}${absURL.pathname}${absURL.search}`);
        } catch (e) {
            // Ignore invalid URLs
        }
    }
}