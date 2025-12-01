/**
 * @file Speculation Rules Rewriter
 * @description Rewrites Chrome's Speculation Rules API.
 * @version 2.0.0 (Strictly Typed)
 */

import { rewriteUrlsInJson } from '../mimeType/json.mjs';

/**
 * @implements {HTMLRewriterElementContentHandler}
 */
export class SpeculationRulesRewriter {
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
                text.replace(JSON.stringify(json));
            } catch (e) {}
        }
    }
}