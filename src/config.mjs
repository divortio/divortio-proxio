/**
 * @file Manages and builds the application configuration from environment variables.
 * @version 7.0.0
 */

/**
 * @typedef {object} AuthConfig
 * @property {boolean} userEnabled
 * @property {boolean} agentEnabled
 * @property {string} loginApiPath
 * @property {string} logoutApiPath
 * @property {string} jwtSecret
 * @property {number} sessionTimeout
 * @property {string} authTokenName
 * @property {string} agentHeaderName
 * @property {string} jwtIssuer - The "iss" (Issuer) claim for the JWT.
 * @property {string} jwtAudience - The "aud" (Audience) claim for the JWT.
 */

// ... other typedefs

/**
 * Creates and returns a structured configuration object for the application.
 * @param {object} env - The worker's environment object.
 * @returns {AppConfig} A unified and type-safe configuration object.
 */
export function createConfig(env) {
    if (!env.JWT_SECRET || env.JWT_SECRET === 'default-secret-please-change') {
        console.warn("SECURITY WARNING: Using a default, insecure JWT_SECRET.");
    }

    return {
        rootDomain: env.ROOT_DOMAIN,
        profileCookieName: env.PROFILE_COOKIE_NAME || '_wkrPrx_brwsrPrfl',
        emulationStrategy: env.EMULATION_STRATEGY || 'passthrough',
        cache: { /* ... */},
        auth: {
            userEnabled: String(env.USER_AUTH_ENABLED).toLowerCase() === 'true',
            agentEnabled: String(env.AGENT_AUTH_ENABLED).toLowerCase() === 'true',
            loginApiPath: env.LOGIN_API_PATH || '/api/auth/login',
            logoutApiPath: env.LOGOUT_API_PATH || '/api/auth/logout',
            jwtSecret: env.JWT_SECRET || 'default-secret-please-change',
            sessionTimeout: Number(env.SESSION_TIMEOUT) || 3600,
            authTokenName: env.AUTH_COOKIE_NAME || '__ss_jwt',
            agentHeaderName: env.AGENT_HEADER_NAME || 'X-PROXIO-API',
            // Read new registered claims, falling back to the root domain.
            jwtIssuer: env.JWT_ISSUER || env.ROOT_DOMAIN,
            jwtAudience: env.JWT_AUDIENCE || env.ROOT_DOMAIN,
        },
    };
}