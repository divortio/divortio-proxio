/**
 * @file HTML Response Handler
 * @description Handles the streaming and rewriting of HTML content.
 * @version 4.0.0 (Typed Config)
 */

import { getHtmlRewriter } from '../rewriters/html.mjs';

/**
 * Processes an HTML response stream.
 * @param {Response} response
 * @param {URL} targetURL
 * @param {string} rootDomain
 * @param {import('../../config/env.mjs').EnvConfig} config
 * @returns {Response}
 */
export function handleHtml(response, targetURL, rootDomain, config) {
    // Inject the config so the rewriter knows which Mods (Profanity, AdBlock, etc.) to attach
    const rewriter = getHtmlRewriter(targetURL, rootDomain, config);

    return rewriter.transform(response);
}