/**
 * @file Configuration Entry Point
 * @description Singleton wrapper for environment parsing. Caches the config globally per isolate.
 * @version 11.0.0 (Refactored to use env.mjs)
 */

import { parseEnv } from './env.mjs';

/**
 * Global cache for the parsed configuration.
 * Since Worker environment variables are static per deployment, we parse once and reuse.
 * @type {import('./env.mjs').EnvConfig | null}
 */
let cachedConfig = null;

/**
 * Retrieves the application configuration.
 * Uses a singleton pattern to avoid re-parsing on every request.
 * @param {Record<string, any>} env - The Cloudflare environment object.
 * @returns {{rootDomain: string, cache: CacheConfig, features: FeatureConfig, mods: Record<string, boolean>, cookies: CookieConfig}} The strictly typed configuration.
 */
export function createConfig(env) {
    // 1. Check Cache (Hot Path)
    if (cachedConfig) {
        return cachedConfig;
    }

    // 2. Parse & Cache (Cold Start)
    // This happens only once per Worker Isolate
    cachedConfig = parseEnv(env);

    return cachedConfig;
}