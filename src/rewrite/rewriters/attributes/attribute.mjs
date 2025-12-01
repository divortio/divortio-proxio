/**
 * @file Generic Attribute Rewriter
 * @description Rewrites standard URL-holding attributes.
 * @version 2.0.0 (Strictly Typed)
 */

/**
 * @implements {HTMLRewriterElementContentHandler}
 */
export class AttributeRewriter {
    /**
     * @param {string} attr - The name of the attribute to rewrite (e.g., "href").
     * @param {URL} baseURL - The base URL of the current page.
     * @param {string} rootDomain - The root domain of the proxy.
     */
    constructor(attr, baseURL, rootDomain) {
        this.attr = attr;
        this.baseURL = baseURL;
        this.rootDomain = rootDomain;
    }

    /**
     * @param {Element} el
     */
    element(el) {
        const val = el.getAttribute(this.attr);
        if (!val || val.startsWith('data:') || val.startsWith('javascript:')) return;

        if (val.startsWith('javascript:')) {
            const rewritten = val.replace(/location\s*=\s*['"](http[^'"]+)['"]/g, (m, url) => `location='#'`);
            if (rewritten !== val) el.setAttribute(this.attr, rewritten);
            return;
        }

        try {
            const absURL = new URL(val, this.baseURL);
            if (absURL.hostname.endsWith(`.${this.rootDomain}`)) return;

            el.setAttribute(this.attr, `https://${absURL.hostname}.${this.rootDomain}${absURL.pathname}${absURL.search}`);
        } catch (e) {}
    }
}