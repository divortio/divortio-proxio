/**
 * @file Srcset Attribute Rewriter
 * @description Parses and rewrites the `srcset` attribute.
 * @version 2.0.0 (Strictly Typed)
 */

/**
 * @implements {HTMLRewriterElementContentHandler}
 */
export class SrcsetRewriter {
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
        const srcset = el.getAttribute('srcset');
        if (!srcset) return;

        const newParts = srcset.split(',').map(part => {
            const trimmed = part.trim();
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