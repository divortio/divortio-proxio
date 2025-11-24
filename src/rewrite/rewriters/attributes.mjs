import { rewriteUrlsInJson } from './parsers.mjs';

/**
 * NEW: Rewrites Import Maps (JSON inside <script type="importmap">).
 * Critical for modern ES modules.
 */
export class ImportMapRewriter {
    constructor(baseURL, rootDomain) {
        this.baseURL = baseURL;
        this.rootDomain = rootDomain;
    }

    text(text) {
        // Wait for the entire text content
        if (text.lastInTextNode) {
            try {
                const json = JSON.parse(text.text);
                // Recursively rewrite values that look like URLs
                rewriteUrlsInJson(json, this.baseURL, this.rootDomain);

                // Special handling for "scopes" keys which are URLs themselves
                if (json.scopes) {
                    const newScopes = {};
                    for (const [scopeKey, scopeVal] of Object.entries(json.scopes)) {
                        // Rewrite the scope key (URL)
                        let newKey = scopeKey;
                        try {
                            const abs = new URL(scopeKey, this.baseURL);
                            if (!abs.hostname.endsWith('.' + this.rootDomain)) {
                                newKey = `https://${abs.hostname}.${this.rootDomain}${abs.pathname}${abs.search}`;
                            }
                        } catch(e) {}

                        // Rewrite the values inside the scope
                        rewriteUrlsInJson(scopeVal, this.baseURL, this.rootDomain);
                        newScopes[newKey] = scopeVal;
                    }
                    json.scopes = newScopes;
                }

                text.replace(JSON.stringify(json));
            } catch (e) {}
        }
    }
}
export class AttributeRewriter {
    constructor(attr, baseURL, rootDomain) {
        this.attr = attr;
        this.baseURL = baseURL;
        this.rootDomain = rootDomain;
    }
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

export class SrcsetRewriter {
    constructor(baseURL, rootDomain) {
        this.baseURL = baseURL;
        this.rootDomain = rootDomain;
    }
    element(el) {
        const srcset = el.getAttribute('srcset');
        if (!srcset) return;
        const newParts = srcset.split(',').map(part => {
            const [url, desc] = part.trim().split(/\s+/);
            if (!url) return part;
            try {
                const absURL = new URL(url, this.baseURL);
                if (absURL.hostname.endsWith(`.${this.rootDomain}`)) return part;
                const newURL = `https://${absURL.hostname}.${this.rootDomain}${absURL.pathname}${absURL.search}`;
                return desc ? `${newURL} ${desc}` : newURL;
            } catch { return part; }
        });
        el.setAttribute('srcset', newParts.join(', '));
    }
}

export class InlineStyleRewriter {
    constructor(baseURL, rootDomain, cssRewriter) {
        this.baseURL = baseURL;
        this.rootDomain = rootDomain;
        this.cssRewriter = cssRewriter;
    }
    element(el) {
        const style = el.getAttribute('style');
        if (style) {
            // We invoke the imported/passed rewriter function
            const newStyle = this.cssRewriter(style, this.baseURL, this.rootDomain);
            if (newStyle !== style) {
                el.setAttribute('style', newStyle);
            }
        }
    }
}

export class MetaUrlRewriter {
    constructor(baseURL, rootDomain) {
        this.baseURL = baseURL;
        this.rootDomain = rootDomain;
    }
    element(el) {
        const content = el.getAttribute('content');
        if (!content) return;
        if (el.getAttribute('http-equiv')?.toLowerCase() === 'refresh') {
            const match = content.match(/url\s*=\s*['"]?([^'"]+)['"]?/i);
            if (match && match[1]) this.rewriteContent(el, content, match[1]);
            return;
        }
        try {
            if (content.startsWith('http') || content.startsWith('/')) this.rewriteContent(el, content, content);
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

/**
 * Rewrites Chrome's Speculation Rules API (JSON inside <script>).
 */
export class SpeculationRulesRewriter {
    constructor(baseURL, rootDomain) {
        this.baseURL = baseURL;
        this.rootDomain = rootDomain;
    }

    text(text) {
        if (text.lastInTextNode) {
            try {
                const json = JSON.parse(text.text);
                // Recursively rewrite URLs in the JSON object
                rewriteUrlsInJson(json, this.baseURL, this.rootDomain);
                text.replace(JSON.stringify(json));
            } catch (e) {
                // Ignore malformed JSON
            }
        }
    }
}