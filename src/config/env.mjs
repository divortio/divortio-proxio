/**
 * @file Environment Variable Parser
 * @description Robustly parses and validates Cloudflare Worker environment variables.
 * @version 2.1.0 (Added Strict Domain Validation)
 */

// --- TYPES ---

/**
 * @typedef {Object} CacheConfig
 * @property {boolean} enabled - Master switch for the Edge Cache.
 * @property {number} ttl - Cache Time-To-Live in seconds.
 * @property {string[]} cacheableTypes - List of MIME types allowed to be cached.
 */

/**
 * @typedef {Object} FeatureConfig
 * @property {boolean} stealthMode - Enables client-side interceptor injection.
 * @property {boolean} serviceWorker - Enables redundancy Service Worker registration.
 */

/**
 * @typedef {Object} CookieConfig
 * @property {RegExp|null} rootPassthrough - Regex for cookies allowed ONLY on the root domain.
 * @property {RegExp|null} proxyPassthrough - Regex for cookies allowed to be seen by the Worker but stripped from Upstream.
 */

/**
 * @typedef {Object} EnvConfig
 * @property {string} rootDomain - The base domain of the proxy (e.g. "proxy.example.com").
 * @property {CacheConfig} cache - Caching strategy configuration.
 * @property {FeatureConfig} features - Core feature flags.
 * @property {Record<string, boolean>} mods - Map of enabled Mod flags.
 * @property {CookieConfig} cookies - Cookie security rules.
 */


// --- HELPERS ---

/**
 * Parses boolean-like environment variables.
 * Handles 'true', '1', 'on', true, 1 (case-insensitive).
 * @param {string|boolean|number|undefined} val
 * @param {boolean} [defaultValue=false]
 * @returns {boolean}
 */
const parseBool = (val, defaultValue = false) => {
    if (val === undefined || val === null) return defaultValue;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val === 1;
    if (typeof val === 'string') {
        const lower = val.toLowerCase().trim();
        return lower === 'true' || lower === '1' || lower === 'on';
    }
    return defaultValue;
};

/**
 * Parses a JSON string array safely.
 * @param {string|undefined} val - JSON string.
 * @param {string[]} fallback - Default array to return on failure.
 * @returns {string[]}
 */
const parseJsonArray = (val, fallback) => {
    if (!val) return fallback;
    try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : fallback;
    } catch (e) {
        console.warn(`[Config] Failed to parse JSON array from env: ${val}`);
        return fallback;
    }
};

/**
 * Compiles an array of wildcard strings into a single RegExp.
 * @param {string|undefined} envVal
 * @returns {RegExp|null}
 */
const compileCookiePatterns = (envVal) => {
    if (!envVal) return null;

    const list = parseJsonArray(envVal, []);
    if (!list.length) return null;

    const regexParts = list.map(p => {
        let clean = p.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
        if (clean.startsWith('*')) clean = '.*' + clean.slice(1);
        else clean = '^' + clean;
        if (clean.endsWith('*')) clean = clean.slice(0, -1) + '.*';
        else clean = clean + '$';
        return clean;
    });

    return new RegExp(`(${regexParts.join('|')})`, 'i');
};


// --- CONFIGURATION FACTORIES ---

/**
 * Extracts and validates the Root Domain.
 * Performs strict syntax checking to prevent misconfiguration.
 * @param {Record<string, any>} env
 * @returns {string}
 * @throws {Error} If validation fails.
 */
function getRootDomain(env) {
    const domain = env.ROOT_DOMAIN;

    // 1. Type and Existence Check
    if (!domain || typeof domain !== 'string') {
        throw new Error("Configuration Error: ROOT_DOMAIN is missing from wrangler.toml or secrets.");
    }

    // 2. Length Check
    const cleanDomain = domain.trim();
    if (cleanDomain.length === 0) {
        throw new Error("Configuration Error: ROOT_DOMAIN cannot be an empty string.");
    }

    // 3. Syntax Check (RFC 1123 compliant hostname)
    // - No protocol (http://)
    // - No path (/)
    // - Allowed chars: a-z, 0-9, hyphen, dot
    // - Cannot start/end with hyphen
    // - Max 253 chars
    const domainRegex = /^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})*$/;

    if (!domainRegex.test(cleanDomain)) {
        throw new Error(`Configuration Error: ROOT_DOMAIN '${cleanDomain}' is not a valid hostname. Ensure you exclude 'https://' and trailing slashes.`);
    }

    return cleanDomain;
}

/**
 * Extracts and validates the Cache Configuration.
 * @param {Record<string, any>} env
 * @returns {CacheConfig}
 */
function getCacheConfig(env) {
    const defaultCacheTypes = [
        'image/', 'font/', 'audio/', 'video/',
        'text/css', 'text/plain',
        'application/javascript', 'application/x-javascript',
        'application/pdf',
        'image/x-icon', 'image/vnd.microsoft.icon'
    ];

    return {
        enabled: parseBool(env.CACHE_ENABLED, true),
        ttl: parseInt(env.CACHE_TTL) || 3600,
        cacheableTypes: parseJsonArray(env.CACHEABLE_TYPES, defaultCacheTypes)
    };
}

/**
 * Extracts Feature Flags.
 * @param {Record<string, any>} env
 * @returns {FeatureConfig}
 */
function getFeatureConfig(env) {
    return {
        stealthMode: parseBool(env.FEATURES_STEALTH_MODE, true),
        serviceWorker: parseBool(env.FEATURES_SERVICE_WORKER, true)
    };
}

/**
 * Scans environment for Mod definitions.
 * @param {Record<string, any>} env
 * @returns {Record<string, boolean>}
 */
function getModConfig(env) {
    /** @type {Record<string, boolean>} */
    const mods = {};
    for (const [key, val] of Object.entries(env)) {
        if (key.startsWith('MOD_')) {
            mods[key] = parseBool(val, false);
        }
    }
    return mods;
}

/**
 * Compiles Cookie Security Rules.
 * @param {Record<string, any>} env
 * @returns {CookieConfig}
 */
function getCookieConfig(env) {
    return {
        rootPassthrough: compileCookiePatterns(env.COOKIE_ROOT_PASSTHROUGH),
        proxyPassthrough: compileCookiePatterns(env.COOKIE_PROXY_PASSTHROUGH)
    };
}


// --- MAIN PARSER ---

/**
 * Parses the Cloudflare Worker 'env' object into a strictly typed configuration.
 * @param {Record<string, any>} env - The raw Cloudflare environment object.
 * @returns {{rootDomain: string, cache: CacheConfig, features: FeatureConfig, mods: Record<string, boolean>, cookies: CookieConfig}} The strictly typed configuration object.
 */
export function parseEnv(env) {
    return {
        // Validation now handled inside getRootDomain
        rootDomain: getRootDomain(env),
        cache: getCacheConfig(env),
        features: getFeatureConfig(env),
        mods: getModConfig(env),
        cookies: getCookieConfig(env)
    };
}