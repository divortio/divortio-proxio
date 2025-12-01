/**
 * @file Import Map Rewriter
 * @description Rewrites Import Maps.
 * @version 2.0.0 (Strictly Typed)
 */

import { rewriteUrlsInJson } from '../mimeType/json.mjs';

/**
 * @implements {HTMLRewriterElementContentHandler}
 */
export class ImportMapRewriter {
    /**
     * @param {URL} baseURL
     * @param {string} rootDomain
     */
    constructor(baseURL, rootDomain) {
        this.baseURL = baseURL;
        this.rootDomain = rootDomain;
    }

    /**
     * @param {Text} text
     */
    text(text) {
        if (text.lastInTextNode) {
            try {
                const json = JSON.parse(text.text);

                rewriteUrlsInJson(json, this.baseURL, this.rootDomain);

                if (json.scopes) {
                    const newScopes = {};
                    for (const [scopeKey, scopeVal] of Object.entries(json.scopes)) {
                        let newKey = scopeKey;
                        try {
                            const abs = new URL(scopeKey, this.baseURL);
                            if (!abs.hostname.endsWith('.' + this.rootDomain)) {
                                newKey = `https://${abs.hostname}.${this.rootDomain}${abs.pathname}${abs.search}`;
                            }
                        } catch(e) {}

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