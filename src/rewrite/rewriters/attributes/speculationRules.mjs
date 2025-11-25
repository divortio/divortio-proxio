/**
 * @file Speculation Rules Rewriter
 * @description Rewrites Chrome's Speculation Rules API (JSON inside <script type="speculationrules">).
 * @version 1.0.0
 */

import { rewriteUrlsInJson } from '../mimeType/json.mjs';

/**
 * Rewrites Chrome's Speculation Rules API (JSON inside <script type="speculationrules">).
 * @implements {HTMLRewriterElementContentHandler}
 */
export class SpeculationRulesRewriter {
    /**
     * @param {URL} baseURL
     * @param {string} rootDomain
     */
    constructor(baseURL, rootDomain) {
        /** @type {URL} */
        this.baseURL = baseURL;
        /** @type {string} */
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
            } catch (e) {
                // Ignore malformed JSON
            }
        }
    }
}