/**
 * @file Identity Header Rewriter
 * @description Rewrites Referer and Origin headers to match the upstream target.
 * @version 2.0.0 (Typed Config)
 */

import { getTargetURL } from '../../../handle/handlers/url.mjs';

/**
 * Rewrites Referer and Origin headers to match the target.
 * @param {Headers} headers
 * @param {import('../../../config/env.mjs').EnvConfig} config
 */
export function fixIdentityHeaders(headers, config) {
    const fix = (name) => {
        const val = headers.get(name);
        if (!val) return;
        try {
            const u = new URL(val);
            if (u.hostname.endsWith(config.rootDomain)) {
                // Pass config to getTargetURL for validation
                const realTarget = getTargetURL(new Request(val), config);
                if (realTarget) {
                    headers.set(name, realTarget.href);
                }
            }
        } catch (e) {
            headers.delete(name);
        }
    };
    fix('Referer');
    fix('Origin');
}