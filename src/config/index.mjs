/**
 * @file Configuration Loader
 * @description Validates and exports environment configuration.
 */

export function createConfig(env) {
    // 1. Validate Critical Env Vars
    if (!env.ROOT_DOMAIN) {
        throw new Error("Configuration Error: ROOT_DOMAIN is missing from wrangler.toml or secrets.");
    }

    return {
        rootDomain: env.ROOT_DOMAIN,

        cache: {
            enabled: env.CACHE_ENABLED === 'true' || true,
            ttl: parseInt(env.CACHE_TTL) || 3600, // Default 1 hour
            cacheableTypes: [
                'image/',
                'font/',
                'text/css',
                'application/javascript',
                'application/x-javascript'
            ]
        },

        // Feature Flags for debugging
        features: {
            stealthMode: true,
            serviceWorker: true
        }
    };
}