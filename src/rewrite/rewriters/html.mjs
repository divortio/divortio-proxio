/**
 * @file HTML Rewriter Configuration
 * @description Configures the streaming HTML parser with all necessary traps.
 * @version 6.2.0
 */

import {
    AttributeRewriter,
    SrcsetRewriter,
    InlineStyleRewriter,
    MetaUrlRewriter,
    ImportMapRewriter,
    SpeculationRulesRewriter
} from './attributes/index.mjs';

/**
 * Configures and returns an HTMLRewriter instance to process the response body.
 *
 * This function acts as the central registry for all HTML-based transformations.
 * It binds specific handlers (AttributeRewriter, SrcsetRewriter, etc.) to CSS selectors
 * matching the elements we need to intercept.
 *
 * @param {URL} targetURL - The target URL of the original request (used for resolving relative paths).
 * @param {string} rootDomain - The proxy's root domain (e.g., "proxy.com").
 * @returns {HTMLRewriter} A configured rewriter ready to transform the response.
 */
export function getHtmlRewriter(targetURL, rootDomain) {
    const rewriter = new HTMLRewriter();

    // 1. Inject Configuration & Interceptor Script
    // We inject a global config object so the static interceptor file knows the root domain.
    rewriter.on('head', {
        element(element) {
            const configScript = `<script>self.__DIVORTIO_CONFIG__ = { rootDomain: '${rootDomain}' };</script>`;
            // We use 'async' to not block the parser, but the config script must run first (which is synchronous inline)
            const scriptTag = `<script src="/__divortio_interceptor.js" async></script>`;
            element.prepend(configScript + scriptTag, {html: true});
        }
    });

    // 2. Instantiate Handlers
    // We create instances of our specialized rewriter classes, injecting the context they need.
    const attr = (a) => new AttributeRewriter(a, targetURL, rootDomain);
    const srcset = new SrcsetRewriter(targetURL, rootDomain);

    // UPDATED: No longer requires rewriteCSS to be passed in.
    // The InlineStyleRewriter class now imports its dependencies directly.
    const style = new InlineStyleRewriter(targetURL, rootDomain);

    const metaUrl = new MetaUrlRewriter(targetURL, rootDomain);
    const importMap = new ImportMapRewriter(targetURL, rootDomain);
    const specRules = new SpeculationRulesRewriter(targetURL, rootDomain);

    // 3. Bind Handlers to Selectors
    rewriter
        // Standard Links & Resources
        .on('a[href], link[href], area[href]', attr('href'))
        .on('a[ping]', attr('ping'))
        .on('img[src], script[src], iframe[src], embed[src], source[src], track[src], video[src], audio[src], object[data], image[href]', attr('src'))
        .on('img[srcset], source[srcset]', srcset)

        // Forms & User Interaction
        .on('form[action]', attr('action'))
        .on('button[formaction], input[formaction]', attr('formaction'))
        .on('input[src]', attr('src')) // <input type="image">

        // Metadata & Legacy Attributes
        .on('base[href]', attr('href'))
        .on('html[manifest]', attr('manifest'))
        .on('body[background]', attr('background'))
        .on('video[poster]', attr('poster'))
        .on('object[codebase], applet[codebase]', attr('codebase'))
        .on('object[archive], applet[archive]', attr('archive'))
        .on('frame[src]', attr('src'))
        .on('frame[longdesc], iframe[longdesc], img[longdesc]', attr('longdesc'))
        .on('blockquote[cite], del[cite], ins[cite], q[cite]', attr('cite'))

        // Meta Tags (Redirects, OpenGraph, Twitter Cards)
        .on('meta[http-equiv="refresh"]', metaUrl)
        .on('meta[property^="og:image"]', metaUrl)
        .on('meta[property^="og:url"]', metaUrl)
        .on('meta[name^="twitter:image"]', metaUrl)
        .on('meta[name^="twitter:url"]', metaUrl)

        // SVG Presentation Attributes (Deep Traversal)
        .on('svg *[fill]', attr('fill'))
        .on('svg *[stroke]', attr('stroke'))
        .on('svg *[filter]', attr('filter'))
        .on('svg *[mask]', attr('mask'))
        .on('svg *[clip-path]', attr('clip-path'))
        .on('svg *[href]', attr('href'))
        .on('svg *[xlink:href]', attr('xlink:href'))

        // Inline Styles
        .on('*[style]', style)

        // Modern Script Structures
        .on('script[type="importmap"]', importMap)
        .on('script[type="speculationrules"]', specRules)

        // Security Stripping (Subresource Integrity)
        // We modify content, so original hashes will fail validation. We must strip them.
        .on('script[integrity], link[integrity]', {
            /** @param {Element} el */
            element(el) { el.removeAttribute('integrity'); }
        });

    return rewriter;
}