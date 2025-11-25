/**
 * @file Import Map Rewriter
 * @description Rewrites Import Maps (JSON inside <script type="importmap">).
 * @version 1.0.0
 */

import { rewriteUrlsInJson } from '../mimeType/json.mjs';

/**
 * Rewrites Import Maps (JSON inside <script type="importmap">).
 * Critical for modern ES modules to ensure bare module specifiers point to the proxy.
 *
 * @implements {HTMLRewriterElementContentHandler}
 */
export class ImportMapRewriter {
    /**
     * @param {URL} baseURL - The base URL of the current page for resolving relative paths.
     * @param {string} rootDomain - The root domain of the proxy service (e.g. "proxy.com").
     */
    constructor(baseURL, rootDomain) {
        /** @type {URL} */
        this.baseURL = baseURL;
        /** @type {string} */
        this.rootDomain = rootDomain;
    }

    /**
     * Handles the text content of the script tag.
     * @param {Text} text - The text chunk from the HTMLRewriter.
     */
    text(text) {
        // Wait for the entire text content to be buffered
        if (text.lastInTextNode) {
            try {
                /** @type {object} */
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
            } catch (e) {
                // Ignore JSON parse errors in malformed pages
            }
        }
    }
}