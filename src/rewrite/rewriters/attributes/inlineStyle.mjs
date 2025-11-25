import {rewriteCSS} from "../mimeType/index.mjs";

/**
 * @file Inline Style Rewriter
 * @description Rewrites URLs found inside inline `style="..."` attributes.
 * @version 1.0.0
 */

/**
 * Rewrites URLs found inside inline `style="..."` attributes.
 *
 * @implements {HTMLRewriterElementContentHandler}
 */
export class InlineStyleRewriter {
    /**
     * @param {URL} baseURL - The base URL of the current page.
     * @param {string} rootDomain - The root domain of the proxy..
     */
    constructor(baseURL, rootDomain) {
        /** @type {URL} */
        this.baseURL = baseURL;
        /** @type {string} */
        this.rootDomain = rootDomain;

    }

    /**
     * @param {Element} el - The HTML element.
     */
    element(el) {
        const style = el.getAttribute('style');
        if (style) {
            // Delegate to the CSS parser/rewriter
            const newStyle =rewriteCSS(style, this.baseURL, this.rootDomain);
            if (newStyle !== style) {
                el.setAttribute('style', newStyle);
            }
        }
    }
}