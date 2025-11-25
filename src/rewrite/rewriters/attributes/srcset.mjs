/**
 * @file Srcset Attribute Rewriter
 * @description Parses and rewrites the `srcset` attribute used in responsive images.
 * @version 1.0.0
 */

/**
 * Parses and rewrites the `srcset` attribute used in responsive images.
 * Example: "img.jpg 1x, img-2x.jpg 2x"
 *
 * @implements {HTMLRewriterElementContentHandler}
 */
export class SrcsetRewriter {
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
     * @param {Element} el - The HTML element (usually <img> or <source>).
     */
    element(el) {
        const srcset = el.getAttribute('srcset');
        if (!srcset) return;

        const newParts = srcset.split(',').map(part => {
            const trimmed = part.trim();
            // Split on the last space to separate URL from descriptor (e.g. "400w" or "2x")
            const spaceIndex = trimmed.lastIndexOf(' ');

            let url, desc;
            if (spaceIndex === -1) {
                url = trimmed;
                desc = '';
            } else {
                url = trimmed.substring(0, spaceIndex);
                desc = trimmed.substring(spaceIndex);
            }

            try {
                const absURL = new URL(url, this.baseURL);
                if (absURL.hostname.endsWith(`.${this.rootDomain}`)) return part;

                const newURL = `https://${absURL.hostname}.${this.rootDomain}${absURL.pathname}${absURL.search}`;
                return `${newURL}${desc}`;
            } catch {
                return part;
            }
        });

        el.setAttribute('srcset', newParts.join(', '));
    }
}