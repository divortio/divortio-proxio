/**
 * @file Manages a library of realistic, up-to-date browser profiles for emulation.
 * @version 3.0.0
 * @see {@link ./request-handler.mjs} for usage.
 * @see {@link ../wrangler.toml} for configuration.
 *
 * @description
 * This module is responsible for creating and managing browser identities, known as "profiles."
 * A profile is a complete set of HTTP headers that realistically emulates a specific browser
 * on a specific operating system (e.g., Chrome on Windows).
 *
 * This module supports multiple strategies, configured in `wrangler.toml`:
 * 1.  **Passthrough**: The proxy uses the client's real headers. This module is not used.
 * 2.  **Forced Profile**: A single, consistent profile is used for all sessions.
 * 3.  **Random Profile**: A profile is randomly selected from the library for each new session.
 *
 * The selected profile is persisted for the duration of a user's session via a secure, HttpOnly cookie
 * to ensure a consistent experience and prevent site breakage.
 */

/**
 * @typedef {object} BrowserProfileHeaders
 * @description A complete set of HTTP headers required for a realistic browser fingerprint.
 * This includes standard headers, "Client Hints" (`sec-ch-*`), and "Fetch Metadata" (`sec-fetch-*`).
 *
 * @property {string} user-agent - The User-Agent string.
 * @property {string} accept - The `Accept` header, indicating supported content types.
 * @property {string} accept-language - The `Accept-Language` header.
 * @property {string} sec-ch-ua - Client Hint for browser brands and full versions.
 * @property {string} sec-ch-ua-mobile - Client Hint indicating if the browser is on a mobile device.
 * @property {string} sec-ch-ua-platform - Client Hint for the operating system platform.
 * @property {string} sec-fetch-dest - Fetch Metadata header indicating the request's destination.
 * @property {string} sec-fetch-mode - Fetch Metadata header indicating the request's mode.
 * @property {string} sec-fetch-site - Fetch Metadata header indicating the relationship between the initiator and the target origin.
 * @property {string} sec-fetch-user - Fetch Metadata header indicating if the request was triggered by user activation.
 * @property {string} upgrade-insecure-requests - Header used to signal a preference for encrypted responses.
 */

/**
 * @namespace BrowserProfileLibrary
 * @description A structured, in-memory library of the latest browser profiles, organized by OS and browser.
 * @property {object} windows - Profiles for the Windows operating system.
 * @property {object} macOS - Profiles for the macOS operating system.
 * @property {object} linux - Profiles for the Linux operating system.
 *
 * @note To maintain stealth and compatibility, the profiles in this library should be
 * updated periodically to reflect the latest stable browser versions.
 */
const BrowserProfileLibrary = {
    windows: {
        chrome: {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'accept-language': 'en-US,en;q=0.9',
            'sec-ch-ua': '"Chromium";v="128", "Not A;Brand";v="99", "Google Chrome";v="128"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'none',
            'sec-fetch-user': '?1',
            'upgrade-insecure-requests': '1',
        }
    },
    macOS: {
        chrome: {
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'accept-language': 'en-US,en;q=0.9',
            'priority': 'u=0, i',
            'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="128", "Chromium";v="128"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'cross-site',
            'sec-fetch-user': '?1',
            'upgrade-insecure-requests': '1',
        },
        safari: {
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'accept-language': 'en-US,en;q=0.9',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'none',
            'sec-fetch-user': '?1',
            'upgrade-insecure-requests': '1',
        }
    },
    linux: {
        firefox: {
            'user-agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'accept-language': 'en-US,en;q=0.5',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'none',
            'sec-fetch-user': '?1',
            'upgrade-insecure-requests': '1',
        }
    }
};

/**
 * @namespace BrowserProfiles
 * @description Creates and retrieves session-aware browser profiles.
 */
export const BrowserProfiles = {
    /**
     * Creates a new browser profile based on the configuration.
     * If a specific profile is requested in the config, it is used. Otherwise, a random
     * profile is selected from the entire library.
     *
     * @param {object} config - The application configuration object.
     * @returns {BrowserProfileHeaders} A profile object containing headers.
     */
    createProfile(config) {
        const allProfiles = [];
        Object.values(BrowserProfileLibrary).forEach(os => {
            Object.values(os).forEach(profile => allProfiles.push(profile));
        });

        const [os, browser] = (config.emulationStrategy || '').split('_');

        if (BrowserProfileLibrary[os] && BrowserProfileLibrary[os][browser]) {
            return BrowserProfileLibrary[os][browser];
        }

        // Fallback to a random profile if the specified profile is invalid or "random".
        return allProfiles[Math.floor(Math.random() * allProfiles.length)];
    },

    /**
     * Retrieves a profile from a request's cookie or creates a new one. This ensures that a single
     * browsing session uses a consistent browser fingerprint when in emulation mode.
     *
     * @param {Request} request - The incoming request from the client.
     * @param {object} config - The application configuration object.
     * @returns {{profile: BrowserProfileHeaders, setCookieHeader: string|null}} An object containing the
     * active profile for the session and a `Set-Cookie` header string if a new session was initiated.
     */
    getProfile(request, config) {
        const cookieHeader = request.headers.get('Cookie') || '';
        const cookies = Object.fromEntries(cookieHeader.split(';').map(c => c.trim().split('=')));
        const profileCookie = cookies[config.profileCookieName];

        if (profileCookie) {
            try {
                const profile = JSON.parse(atob(profileCookie));
                // Simple validation to ensure the profile object from the cookie is not malformed.
                if (profile['user-agent']) {
                    return {profile, setCookieHeader: null};
                }
            } catch (e) { /* Malformed cookie, will create a new one. */
            }
        }

        // No valid profile found in cookies, create a new one for this session.
        const newProfile = this.createProfile(config);
        const encodedProfile = btoa(JSON.stringify(newProfile));
        const setCookieHeader = `${config.profileCookieName}=${encodedProfile}; Path=/; HttpOnly; SameSite=Lax; Secure`;
        return {profile: newProfile, setCookieHeader};
    }
};