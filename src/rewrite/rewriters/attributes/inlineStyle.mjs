/**
 * @file Inline Style Rewriter
 * @description Rewrites URLs found inside inline `style="..."` attributes.
 * @version 2.0.0 (Strictly Typed)
 */

import { rewriteCSS } from '../mimeType/index.mjs';

/**
 * @implements {HTMLRewriterElementContentHandler}
 */
export class InlineStyleRewriter {
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
        const style = el.getAttribute('style');
        if (style) {
            const newStyle = rewriteCSS(style, this.baseURL, this.rootDomain);
            if (newStyle !== style) {
                el.setAttribute('style', newStyle);
            }
        }
    }
}