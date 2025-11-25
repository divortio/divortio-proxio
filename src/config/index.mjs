/**
 * @file Configuration Loader
 * @description Validates and exports environment configuration.
 * @version 8.0.0
 */

/**
 * @typedef {object} AppConfig
 * @property {string} rootDomain
 * @property {object} cache
 * @property {boolean} cache.enabled
 * @property {number} cache.ttl
 * @property {string[]} cache.cacheableTypes
 * @property {object} features
 * @property {boolean} features.stealthMode
 * @property {boolean} features.serviceWorker
 */

/**
 * Helper to parse boolean env vars safely.
 * Handles 'true', '1', 'on', true, 1 vs everything else.
 * @param {string|boolean|number} val
 * @returns {boolean}
 */
const isTrue = (val) => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
        val = val.toLowerCase().trim();
        return val === 'true' || val === '1' || val === 'on';
    }
    if (typeof val === 'number') return val === 1;
    return false;
};

/**
 * Creates and returns a structured configuration object for the application.
 * @param {object} env - The worker's environment object.
 * @returns {AppConfig} A unified and type-safe configuration object.
 */
export function createConfig(env) {
    // 1. Validate Critical Env Vars
    if (!env.ROOT_DOMAIN) {
        throw new Error("Configuration Error: ROOT_DOMAIN is missing from wrangler.toml or secrets.");
    }

    // 2. Parse Cacheable Types (JSON string from Wrangler)
    // Default fallback if env var is missing or malformed
    let cacheableTypes = [
        'image/',
        'font/',
        'text/css',
        'application/javascript',
        'application/x-javascript'
    ];

    if (env.CACHEABLE_TYPES) {
        try {
            // Wrangler/Cloudflare env vars are strings, so we parse the JSON array
            const parsed = typeof env.CACHEABLE_TYPES === 'string'
                ? JSON.parse(env.CACHEABLE_TYPES)
                : env.CACHEABLE_TYPES;

            if (Array.isArray(parsed)) {
                cacheableTypes = parsed;
            }
        } catch (e) {
            console.warn("Config Warning: Failed to parse CACHEABLE_TYPES from env, using defaults.");
        }
    }

    return {
        rootDomain: env.ROOT_DOMAIN,

        cache: {
            // Check for explicit configuration, default to TRUE if missing
            enabled: env.CACHE_ENABLED !== undefined ? isTrue(env.CACHE_ENABLED) : true,
            ttl: parseInt(env.CACHE_TTL) || 3600,
            cacheableTypes: cacheableTypes
        },

        features: {
            // Check for explicit configuration, default to TRUE if missing
            stealthMode: env.FEATURES_STEALTH_MODE !== undefined ? isTrue(env.FEATURES_STEALTH_MODE) : true,
            serviceWorker: env.FEATURES_SERVICE_WORKER !== undefined ? isTrue(env.FEATURES_SERVICE_WORKER) : true
        }
    };
}