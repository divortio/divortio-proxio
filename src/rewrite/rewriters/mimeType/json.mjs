/**
 * @file JSON Content Rewriter
 * @description Recursively parses and rewrites URLs in JSON objects.
 * @version 2.0.0 (Strictly Typed)
 */

/**
 * Recursively rewrites URL strings in a JSON object.
 * @param {object} jsonObj - The JSON object to traverse.
 * @param {URL} baseURL - The base URL for resolving relative paths.
 * @param {string} rootDomain - The proxy root domain.
 * @param {WeakSet} [seen] - Internal set for cycle detection.
 */
export function rewriteUrlsInJson(jsonObj, baseURL, rootDomain, seen = new WeakSet()) {
    if (typeof jsonObj !== 'object' || jsonObj === null) return;

    if (seen.has(jsonObj)) return;
    seen.add(jsonObj);

    for (const key in jsonObj) {
        const val = jsonObj[key];
        if (typeof val === 'string') {
            if (val.startsWith('http:') || val.startsWith('https://')) {
                try {
                    const absURL = new URL(val, baseURL);
                    if (!absURL.hostname.endsWith(`.${rootDomain}`)) {
                        jsonObj[key] = `https://${absURL.hostname}.${rootDomain}${absURL.pathname}${absURL.search}`;
                    }
                } catch {}
            }
        } else if (typeof val === 'object' && val !== null) {
            rewriteUrlsInJson(val, baseURL, rootDomain, seen);
        }
    }
}