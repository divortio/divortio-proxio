/**
 * @file HTML Rewriter Configuration
 * @description Configures the streaming HTML parser with all necessary traps and mods.
 * @version 8.0.0 (Typed Config & Mod Registry)
 */

import {
    AttributeRewriter,
    SrcsetRewriter,
    InlineStyleRewriter,
    MetaUrlRewriter,
    ImportMapRewriter,
    SpeculationRulesRewriter
} from './attributes/index.mjs';

import { MOD_REGISTRY } from '../../../mods/registry.mjs';

/**
 * Configures and returns an HTMLRewriter instance.
 * @param {URL} targetURL
 * @param {string} rootDomain
 * @param {import('../../../config/env.mjs').EnvConfig} config
 * @returns {HTMLRewriter}
 */
export function getHtmlRewriter(targetURL, rootDomain, config) {
    const rewriter = new HTMLRewriter();

    // 1. Inject Configuration & Interceptor Script
    rewriter.on('head', {
        element(element) {
            const configScript = `<script>self.__DIVORTIO_CONFIG__ = { rootDomain: '${rootDomain}' };</script>`;
            const scriptTag = `<script src="/__divortio_interceptor.js" async></script>`;
            element.prepend(configScript + scriptTag, {html: true});
        }
    });

    // 2. Instantiate Handlers
    const attr = (a) => new AttributeRewriter(a, targetURL, rootDomain);
    const srcset = new SrcsetRewriter(targetURL, rootDomain);
    const style = new InlineStyleRewriter(targetURL, rootDomain);
    const metaUrl = new MetaUrlRewriter(targetURL, rootDomain);
    const importMap = new ImportMapRewriter(targetURL, rootDomain);
    const specRules = new SpeculationRulesRewriter(targetURL, rootDomain);

    // 3. Bind Core Handlers
    rewriter
        .on('a[href], link[href], area[href]', attr('href'))
        .on('a[ping]', attr('ping'))
        .on('img[src], script[src], iframe[src], embed[src], source[src], track[src], video[src], audio[src], object[data], image[href]', attr('src'))
        .on('img[srcset], source[srcset]', srcset)
        .on('form[action]', attr('action'))
        .on('button[formaction], input[formaction]', attr('formaction'))
        .on('input[src]', attr('src'))
        .on('base[href]', attr('href'))
        .on('html[manifest]', attr('manifest'))
        .on('body[background]', attr('background'))
        .on('video[poster]', attr('poster'))
        .on('object[codebase], applet[codebase]', attr('codebase'))
        .on('object[archive], applet[archive]', attr('archive'))
        .on('frame[src]', attr('src'))
        .on('frame[longdesc], iframe[longdesc], img[longdesc]', attr('longdesc'))
        .on('blockquote[cite], del[cite], ins[cite], q[cite]', attr('cite'))
        .on('meta[http-equiv="refresh"]', metaUrl)
        .on('meta[property^="og:image"]', metaUrl)
        .on('meta[property^="og:url"]', metaUrl)
        .on('meta[name^="twitter:image"]', metaUrl)
        .on('meta[name^="twitter:url"]', metaUrl)
        .on('svg *[fill]', attr('fill'))
        .on('svg *[stroke]', attr('stroke'))
        .on('svg *[filter]', attr('filter'))
        .on('svg *[mask]', attr('mask'))
        .on('svg *[clip-path]', attr('clip-path'))
        .on('svg *[href]', attr('href'))
        .on('svg *[xlink:href]', attr('xlink:href'))
        .on('*[style]', style)
        .on('script[type="importmap"]', importMap)
        .on('script[type="speculationrules"]', specRules)
        .on('script[integrity], link[integrity]', {
            element(el) { el.removeAttribute('integrity'); }
        });

    // 4. Dynamic Mod Injection
    // Iterate registry -> Check Config -> Check Domain -> Bind
    MOD_REGISTRY.forEach(modDef => {
        // A. Is it enabled in config?
        if (config.mods && config.mods[modDef.envKey]) {

            const args = modDef.defaultArgs || [];
            const instance = new modDef.Class(...args);

            // B. Registry Override
            if (modDef.domainPattern) {
                instance.domainPattern = modDef.domainPattern;
            }

            // C. Domain Scope Check
            if (instance.shouldRun(targetURL)) {
                rewriter.on(modDef.selector, instance);
            }
        }
    });

    return rewriter;
}