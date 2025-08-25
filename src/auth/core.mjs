/**
 * @file The internal, core logic for the authentication module.
 * @version 2.0.0
 * @see {@link ./router.mjs} for the public interface that uses this module.
 *
 * @description
 * This file contains the "engine" of the authentication system, including all JWT
 * cryptography and the middleware gatekeeper function. It is designed to be
 * entirely self-contained, have no knowledge of the parent application, and to be
 * called only by the auth module's own router.
 */

import {AgentStore} from './agents.mjs';

/**
 * @typedef {import('../config.mjs').AppConfig} AppConfig
 */

/**
 * @typedef {object} JwtClaims
 * @property {string} [iss] - Issuer
 * @property {string} [sub] - Subject
 * @property {string} [aud] - Audience
 * @property {number} [exp] - Expiration Time
 * @property {number} [nbf] - Not Before
 * @property {number} [iat] - Issued At
 * @property {string} [jti] - JWT ID
 */

/**
 * @namespace _jwt
 * @private
 * @description An internal, private namespace containing all logic for creating and validating JSON Web Tokens.
 */
const _jwt = {
    /**
     * Caches the HMAC CryptoKey for performance.
     * @type {CryptoKey|null}
     */
    _cryptoKey: null,

    /**
     * Gets or creates the HMAC CryptoKey from the configured secret.
     * @param {string} jwtSecret - The secret key for signing JWTs.
     * @returns {Promise<CryptoKey>} A promise that resolves to a CryptoKey object.
     */
    async getCryptoKey(jwtSecret) {
        if (!jwtSecret || jwtSecret === 'default-secret-please-change') {
            throw new Error("A strong, non-default JWT_SECRET must be provided for authentication.");
        }
        // Simple caching; in a multi-secret scenario, this would be a Map.
        if (this._cryptoKey) return this._cryptoKey;

        const encoder = new TextEncoder();
        this._cryptoKey = await crypto.subtle.importKey(
            "raw",
            encoder.encode(jwtSecret),
            {name: "HMAC", hash: "SHA-256"},
            false, // not extractable
            ["sign", "verify"]
        );
        return this._cryptoKey;
    },

    /**
     * Creates a new, spec-compliant JSON Web Token (JWT).
     * @param {object} params - The parameters for creating the JWT.
     * @param {string} params.username - The subject of the token.
     * @param {string} params.jwtSecret - The secret key for signing.
     * @param {number} params.sessionTimeout - The session duration in seconds.
     * @param {string} params.issuer - The "iss" (Issuer) claim.
     * @param {string} params.audience - The "aud" (Audience) claim.
     * @param {object} [params.publicClaims={}] - An object of public claims to include.
     * @param {object} [params.privateClaims={}] - An object of private claims to include.
     * @returns {Promise<string>} A promise that resolves to the signed JWT string.
     */
    async createJwt({username, jwtSecret, sessionTimeout, issuer, audience, publicClaims = {}, privateClaims = {}}) {
        const key = await this.getCryptoKey(jwtSecret);
        const now = Math.floor(Date.now() / 1000);

        /** @type {JwtClaims} */
        const payload = {
            // Standard Registered Claims
            iss: issuer,
            aud: audience,
            sub: username,
            jti: crypto.randomUUID(),
            iat: now,
            nbf: now,
            exp: now + sessionTimeout,
            // Merge custom claims
            ...publicClaims,
            ...privateClaims,
        };

        const header = {alg: "HS256", typ: "JWT"};
        const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
        const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
        const dataToSign = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
        const signature = await crypto.subtle.sign("HMAC", key, dataToSign);
        return `${encodedHeader}.${encodedPayload}.${this.base64UrlEncode(signature)}`;
    },

    /**
     * Validates a JWT from a request. It also checks issuer and audience.
     * @param {Request} request - The incoming request.
     * @param {string} jwtSecret - The secret key for verification.
     * @param {string} authTokenName - The name of the authentication cookie.
     * @param {string} issuer - The expected issuer.
     * @param {string} audience - The expected audience.
     * @returns {Promise<JwtClaims|null>} The token's payload if valid, otherwise null.
     */
    async validateJwt(request, jwtSecret, authTokenName, issuer, audience) {
        const cookieHeader = request.headers.get('Cookie') || '';
        const cookies = Object.fromEntries(cookieHeader.split(';').map(c => c.trim().split('=')));
        const token = cookies[authTokenName];

        if (!token) return null;

        try {
            const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
            if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

            const key = await this.getCryptoKey(jwtSecret);
            const dataToVerify = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
            const signature = this.base64UrlDecode(encodedSignature);

            const isValid = await crypto.subtle.verify("HMAC", key, signature, dataToVerify);
            if (!isValid) return null;

            const payload = JSON.parse(new TextDecoder().decode(this.base64UrlDecode(encodedPayload)));
            if (payload.exp < Math.floor(Date.now() / 1000)) return null; // Expired
            if (payload.nbf > Math.floor(Date.now() / 1000)) return null; // Not yet valid
            if (payload.iss !== issuer) return null; // Invalid issuer
            if (payload.aud !== audience) return null; // Invalid audience

            return payload;
        } catch (e) {
            return null;
        }
    },

    /**
     * Helper function to Base64URL encode data.
     * @param {string|ArrayBuffer} data - The data to encode.
     * @returns {string} The Base64URL encoded string.
     */
    base64UrlEncode(data) {
        const str = typeof data === 'string' ? data : String.fromCharCode(...new Uint8Array(data));
        return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    },

    /**
     * Helper function to decode Base64URL strings into an ArrayBuffer.
     * @param {string} str - The Base64URL encoded string.
     * @returns {ArrayBuffer}
     */
    base64UrlDecode(str) {
        const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
        const binaryStr = atob(base64);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }
        return bytes.buffer;
    }
};

/**
 * A middleware factory that creates a protected version of a fetch handler. It acts as a
 * gatekeeper, checking for agent tokens or user sessions before allowing a request
 * to proceed to the main application logic.
 *
 * @param {function(Request, object, ExecutionContext): Promise<Response>} fetchHandler - The main application logic to protect.
 * @param {object} params - The configuration parameters for the middleware.
 * @param {boolean} [params.userEnabled=false] - Whether to enable interactive user authentication.
 * @param {boolean} [params.agentEnabled=false] - Whether to enable service agent authentication.
 * @param {string} params.jwtSecret - The secret key for validating JWTs.
 * @param {string} [params.authTokenName='__ss_jwt'] - The name of the authentication cookie.
 * @param {string} [params.agentHeaderName='X-PROXIO-API'] - The name of the HTTP header for agent API tokens.
 * @param {string} params.issuer - The expected issuer for JWT validation.
 * @param {string} params.audience - The expected audience for JWT validation.
 * @returns {function(Request, object, ExecutionContext): Promise<Response>} A new, wrapped fetch handler.
 */
export function createAuthMiddleware(fetchHandler, {
    userEnabled = false,
    agentEnabled = false,
    jwtSecret,
    authTokenName = '__ss_jwt',
    agentHeaderName = 'X-PROXIO-API',
    issuer,
    audience
}) {
    return async (request, env, ctx) => {
        // If all authentication is disabled, bypass the gatekeeper entirely.
        if (!userEnabled && !agentEnabled) {
            return fetchHandler(request, env, ctx);
        }

        let isAuthorized = false;

        // 1. Check for a valid agent token first.
        if (agentEnabled) {
            const apiToken = request.headers.get(agentHeaderName);
            if (apiToken && AgentStore.has(apiToken)) {
                isAuthorized = true;
            }
        }

        // 2. If not authorized as an agent, check for a valid user session.
        if (!isAuthorized && userEnabled) {
            const payload = await _jwt.validateJwt(request, jwtSecret, authTokenName, issuer, audience);
            if (payload) {
                // Attach user identity and full claims to the request for downstream use.
                request.user = {id: payload.sub, claims: payload};
                isAuthorized = true;
            }
        }

        // 3. If authorized, proceed to the main application logic.
        if (isAuthorized) {
            return fetchHandler(request, env, ctx);
        }

        // 4. If not authorized, deny access. The parent router is responsible for the redirect UI.
        return new Response("Unauthorized", {status: 401});
    };
}