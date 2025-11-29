/**
 * @file Base Mod Template
 * @description The parent class for all Mods. Handles global context and execution scope.
 * @version 1.0.0
 */

export class BaseMod {
    /**
     * @param {string} id - A unique identifier for the mod instance (e.g. "profanity-filter").
     * @param {string} domainPattern - The domain scope.
     * - '*' : Matches all domains.
     * - 'example.com' : Strict match.
     * - '*.example.com' : Matches domain and all subdomains.
     */
    constructor(id, domainPattern = '*') {
        if (!id) throw new Error("Mod Error: 'id' is required for BaseMod.");
        this.id = id;
        this.domainPattern = domainPattern;
    }

    /**
     * Determines if the mod should run for the current request.
     * @param {URL} targetURL - The upstream URL being accessed.
     * @returns {boolean}
     */
    shouldRun(targetURL) {
        // 1. Global Wildcard
        if (this.domainPattern === '*') return true;

        const host = targetURL.hostname;

        // 2. Wildcard Subdomain Pattern (*.google.com)
        if (this.domainPattern.startsWith('*.')) {
            const root = this.domainPattern.slice(2); // Remove "*."
            // Match root (google.com) OR subdomain (.google.com)
            return host === root || host.endsWith('.' + root);
        }

        // 3. Strict Match
        return host === this.domainPattern;
    }
}