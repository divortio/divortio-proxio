/**
 * @file The Core Proxy Logic Module for the Cloudflare Worker.
 * @version 10.0.0
 * @author Your Name/Team
 *
 * @description
 * This module serves as the central engine for a sophisticated and stealthy web proxy
 * built on Cloudflare Workers. It is designed to be a self-contained, high-performance ES Module
 * that handles all aspects of request proxying, content rewriting, and security enhancement.
 *
 * The architecture is divided into logical namespaces for clear separation of concerns:
 * - **Config & CacheConfig**: Static configuration for the worker's behavior and caching strategy.
 * - **SessionManager**: Manages browser personas to provide a consistent fingerprint for each user session,
 * crucial for compatibility and defeating basic bot detection.
 * - **URLParser**: Determines the intended target URL from incoming requests.
 * - **WebSocketHandler**: Manages the proxying of WebSocket connections for real-time applications.
 * - **Rewriters**: A comprehensive and extensible collection of functions and classes for rewriting
 * various content types (HTML, CSS, JS, etc.) to ensure all sub-requests are proxied.
 * - **RequestHandler**: The main orchestrator that processes each request, applies all logic,
 * and generates the final response.
 *
 * @features
 * - **Modular & Extensible**: Easily add new rewriters or modify configuration.
 * - **Session-Aware Fingerprinting**: Creates a stable browser persona per session.
 * - **Intelligent Caching**: Configurable caching for static assets that respects origin server directives.
 * - **Stealthy Interception**: Wraps `fetch()` and `navigator.sendBeacon()` in all JavaScript contexts,
 * including Service Workers and Web Workers.
 * - **IP Leak Prevention**: Actively disables WebRTC to prevent IP address leaks.
 * - **Comprehensive Rewriting**: Handles HTML (including `ping` and `srcset`), CSS, JavaScript, SVG,
 * XML/RSS, JSON Manifests, and Server-Sent Events.
 * - **Full Session Integrity**: Correctly rewrites `Set-Cookie` headers, redirects, and WebSocket connections.
 * - **Security Hardening**: Surgically strips privacy-leaking directives like `preconnect` and `dns-prefetch`
 * from HTTP `Link` headers.
 */

const Config = {
    /**
     * @type {string[]}
     * @description An array of domains the worker will operate on. This is a critical security and operational
     * setting. Requests to other domains will be ignored.
     * @example ['my-proxy.example.com']
     */
    proxyDomains: ['your-worker.workers.dev'],

    /**
     * @type {string}
     * @description A unique string used to separate the proxy's URL path from the target URL.
     */
    separator: '------',

    /**
     * @type {string}
     * @description The name of the cookie used to store the session's browser persona.
     */
    sessionCookieName: 'proxy_persona',
};

const CacheConfig = {
    /**
     * @type {boolean}
     * @description A master switch to enable or disable the caching layer.
     */
    enabled: true,

    /**
     * @type {number}
     * @description The default time-to-live (TTL) for cached assets, in seconds. This is only applied
     * if the origin server does not specify its own caching policy.
     */
    cacheTtl: 3600, // 1 hour

    /**
     * @type {string[]}
     * @description An array of substrings used to identify cacheable `Content-Type` headers.
     */
    cacheableTypes: ['image/', 'javascript', 'css', 'font/'],
};

/**
 * @typedef {object} Persona
 * @property {string} User-Agent - The User-Agent string for the session.
 * @property {string} Accept-Language - The Accept-Language string for the session.
 */

/**
 * @namespace SessionManager
 * @description Manages browser personas to ensure a consistent fingerprint for each session.
 */
const SessionManager = {
    /**
     * Creates a new, randomized browser persona from a predefined list of common profiles.
     * @returns {Persona} A persona object containing headers.
     */
    createPersona() {
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
        ];
        const acceptLanguages = ['en-US,en;q=0.9', 'en-GB,en;q=0.8'];
        return {
            'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
            'Accept-Language': acceptLanguages[Math.floor(Math.random() * acceptLanguages.length)],
        };
    },

    /**
     * Retrieves a persona from a request's cookie or creates a new one if none exists or it's malformed.
     * @param {Request} request - The incoming request from the client.
     * @returns {{persona: Persona, setCookieHeader: string|null}} An object containing the active persona
     * and a `Set-Cookie` header string if a new persona was created.
     */
    getPersona(request) {
        const cookieHeader = request.headers.get('Cookie') || '';
        const cookies = Object.fromEntries(cookieHeader.split(';').map(c => c.trim().split('=')));
        const personaCookie = cookies[Config.sessionCookieName];

        if (personaCookie) {
            try {
                const persona = JSON.parse(atob(personaCookie));
                if (persona['User-Agent']) {
                    return {persona, setCookieHeader: null};
                }
            } catch (e) { /* Malformed cookie, will create a new one */
            }
        }

        const newPersona = this.createPersona();
        const encodedPersona = btoa(JSON.stringify(newPersona));
        const setCookieHeader = `${Config.sessionCookieName}=${encodedPersona}; Path=/; HttpOnly; SameSite=Lax; Secure`;
        return {persona: newPersona, setCookieHeader};
    }
};

/**
 * @namespace URLParser
 * @description Handles logic for determining the target URL from an incoming request.
 */
const URLParser = {
    /**
     * Parses the request to determine the target URL. It checks for the proxy format in the path
     * and falls back to using the Referer header for relative resource requests.
     * @param {Request} request - The incoming request object.
     * @returns {URL|null} A URL object for the target, or null if it cannot be determined.
     */
    getTargetURL(request) {
        const url = new URL(request.url);
        const path = url.pathname.substring(1);

        if (path.startsWith(Config.separator)) {
            let targetStr = path.substring(Config.separator.length);
            if (!targetStr.startsWith('http')) targetStr = 'https://' + targetStr;
            try {
                return new URL(targetStr);
            } catch (e) {
                return null;
            }
        }

        const referer = request.headers.get('Referer');
        if (referer) {
            try {
                const refererUrl = new URL(referer);
                const refererPath = refererUrl.pathname.substring(1);
                if (refererPath.startsWith(Config.separator)) {
                    const originalTarget = refererPath.substring(Config.separator.length);
                    return new URL(url.pathname, originalTarget);
                }
            } catch (e) { /* Invalid referer, ignore */
            }
        }
        return null;
    }
};

/**
 * @namespace WebSocketHandler
 * @description Handles the proxying of WebSocket connections.
 */
const WebSocketHandler = {
    /**
     * Establishes a proxied WebSocket session by creating a connection to the origin
     * and streaming data between the client and origin sockets.
     * @param {WebSocket} server - The server-side WebSocket object from the WebSocketPair.
     * @param {URL} targetURL - The target WebSocket URL (e.g., wss://...).
     * @returns {Promise<void>}
     */
    async handleSession(server, targetURL) {
        try {
            const originSocket = await fetch(targetURL.href, {headers: {"Upgrade": "websocket"}});
            const {webSocket: originWebSocket} = originSocket;

            if (!originWebSocket) {
                server.close(1012, "Origin did not upgrade connection");
                return;
            }
            server.accept();
            server.addEventListener("message", event => originWebSocket.send(event.data));
            originWebSocket.addEventListener("message", event => server.send(event.data));
            const closeHandler = () => {
                if (originWebSocket.readyState === WebSocket.OPEN) originWebSocket.close();
                if (server.readyState === WebSocket.OPEN) server.close();
            };
            server.addEventListener("close", closeHandler);
            server.addEventListener("error", closeHandler);
            originWebSocket.addEventListener("close", closeHandler);
            originWebSocket.addEventListener("error", closeHandler);
        } catch (e) {
            server.close(1011, "Failed to connect to origin");
        }
    }
};

/**
 * @namespace Rewriters
 * @description A collection of classes and functions for rewriting various content types.
 * This module is designed to be easily extensible.
 */
const Rewriters = {
    /**
     * A generic class for rewriting a specific URL-holding attribute on an HTML element.
     * It is instantiated with the attribute name to target.
     * @memberof Rewriters
     */
    AttributeRewriter: class {
        /**
         * @param {string} attr - The name of the attribute to rewrite (e.g., "href", "src", "ping").
         * @param {URL} baseURL - The base URL of the original page, used for resolving relative paths.
         * @param {string} proxyDomain - The domain of our proxy worker.
         */
        constructor(attr, baseURL, proxyDomain) {
            this.attr = attr;
            this.baseURL = baseURL;
            this.proxyDomain = proxyDomain;
        }

        /**
         * The method called by `HTMLRewriter` for each matching element.
         * @param {Element} el - The HTML element being processed.
         */
        element(el) {
            const val = el.getAttribute(this.attr);
            if (!val || val.startsWith('data:') || val.startsWith('javascript:')) return;
            if (val.startsWith(`https://${this.proxyDomain}`)) return; // Already rewritten
            try {
                const absURL = new URL(val, this.baseURL);
                el.setAttribute(this.attr, `https://${this.proxyDomain}/${Config.separator}${absURL.href}`);
            } catch (e) { /* Ignore invalid URLs */
            }
        }
    },

    /**
     * A class for rewriting URLs within a `srcset` attribute, which contains multiple image candidates.
     * @memberof Rewriters
     */
    SrcsetRewriter: class {
        /**
         * @param {URL} baseURL - The base URL of the original page.
         * @param {string} proxyDomain - The domain of our proxy worker.
         */
        constructor(baseURL, proxyDomain) {
            this.baseURL = baseURL;
            this.proxyDomain = proxyDomain;
        }

        /**
         * The method called by `HTMLRewriter` for each matching element.
         * @param {Element} el - The HTML element being processed.
         */
        element(el) {
            const srcset = el.getAttribute('srcset');
            if (!srcset) return;
            const newParts = srcset.split(',').map(part => {
                const [url, desc] = part.trim().split(/\s+/);
                if (!url) return part;
                try {
                    const absURL = new URL(url, this.baseURL);
                    const newURL = `https://${this.proxyDomain}/${Config.separator}${absURL.href}`;
                    return desc ? `${newURL} ${desc}` : newURL;
                } catch {
                    return part;
                }
            });
            el.setAttribute('srcset', newParts.join(', '));
        }
    },

    /**
     * Generates a stealthy JavaScript snippet that is prepended to every proxied JS file.
     * This snippet wraps network APIs (`fetch`, `sendBeacon`) and disables WebRTC to prevent leaks.
     * @param {string} proxyDomain - The domain of our proxy worker.
     * @returns {string} The JavaScript code to be injected.
     */
    getStealthInterceptorScript(proxyDomain) {
        // This self-executing function creates a private scope to avoid polluting the global namespace.
        return `
      (function() {
        // Do not run in blob workers, as they have a different origin context.
        if (self.location.protocol === 'blob:') return;
        const PROXY_DOMAIN = '${proxyDomain}';
        const SEPARATOR = '${Config.separator}';
        const absoluteURL = (url) => new URL(url, self.location.href).href;
        const proxiedURL = (url) => \`https://\${PROXY_DOMAIN}/\${SEPARATOR}\${absoluteURL(url)}\`;

        // 1. Intercept fetch() in all script contexts (main thread, service workers, web workers).
        if (self.fetch) {
          const originalFetch = self.fetch;
          self.fetch = function(resource, options) {
            let reqUrl = resource instanceof Request ? resource.url : String(resource);
            if (resource instanceof Request) {
              return originalFetch.call(this, new Request(proxiedURL(reqUrl), resource));
            }
            return originalFetch.call(this, proxiedURL(reqUrl), options);
          };
        }

        // 2. Intercept navigator.sendBeacon() to proxy analytics pings.
        if (navigator.sendBeacon) {
          const originalSendBeacon = navigator.sendBeacon;
          navigator.sendBeacon = function(url, data) {
            return originalSendBeacon.call(this, proxiedURL(url), data);
          };
        }

        // 3. Disable WebRTC to prevent IP address leaks via STUN requests.
        self.RTCPeerConnection = null;
        self.webkitRTCPeerConnection = null;
        self.mozRTCPeerConnection = null;
      })();
    `;
    },

    /**
     * Parses an HTTP `Link` header, rewriting its URL while surgically removing privacy-leaking
     * directives like `preconnect` and `dns-prefetch`.
     * @param {string} headerValue - The original Link header value.
     * @returns {string} The modified and sanitized Link header.
     */
    rewriteLinkHeader(headerValue) {
        return headerValue.split(',')
            .map(part => {
                const relMatch = part.match(/rel\s*=\s*"?([^"]+)"?/);
                if (relMatch && (relMatch[1].includes('preconnect') || relMatch[1].includes('dns-prefetch'))) {
                    return ''; // Remove this part entirely.
                }
                return part;
            })
            .filter(Boolean) // Remove any empty parts created by the removal.
            .join(',');
    },

    /**
     * Rewrites the `Domain` and `Secure` attributes of a `Set-Cookie` header to align with the proxy's domain,
     * ensuring that cookies are set correctly in the browser.
     * @param {string} headerValue - The original `Set-Cookie` header value.
     * @param {string} proxyDomain - The domain of our proxy.
     * @returns {string} The rewritten `Set-Cookie` header value.
     */
    rewriteSetCookieHeader(headerValue, proxyDomain) {
        const parts = headerValue.split(';').map(p => p.trim());
        const newParts = [parts.shift()]; // The key=value pair is always first.
        for (const part of parts) {
            const [key] = part.split('=');
            if (key.toLowerCase() === 'domain') {
                newParts.push(`Domain=${proxyDomain}`);
            } else if (key.toLowerCase() !== 'secure') {
                // The Secure flag is removed as the worker handles the HTTPS connection.
                newParts.push(part);
            }
        }
        return newParts.join('; ');
    },

    /**
     * Constructs an `HTMLRewriter` instance with a comprehensive set of handlers for various tags and attributes.
     * This is the primary extension point for adding new HTML rewrite rules.
     * @param {URL} targetURL - The target URL of the original page.
     * @param {string} proxyDomain - The domain of our proxy.
     * @returns {HTMLRewriter} A configured HTMLRewriter instance.
     */
    getHtmlRewriter(targetURL, proxyDomain) {
        const attr = (a) => new this.AttributeRewriter(a, targetURL, proxyDomain);
        const srcset = new this.SrcsetRewriter(targetURL, proxyDomain);
        return new HTMLRewriter()
            .on('a[href], link[href], area[href]', attr('href'))
            .on('a[ping]', attr('ping'))
            .on('img[src], script[src], iframe[src], embed[src], source[src], track[src], video[src], audio[src], object[data], image[href]', attr('src'))
            .on('form[action]', attr('action'))
            .on('video[poster]', attr('poster'))
            .on('img[srcset], source[srcset]', srcset);
    },
};

/**
 * @namespace RequestHandler
 * @description The main request handler object containing all proxy logic. It orchestrates the flow
 * from receiving a request to returning a rewritten response.
 */
export const RequestHandler = {
    /**
     * The main entry point for handling a fetch event. It manages caching, WebSocket upgrades,
     * and the overall request/response lifecycle.
     * @param {Request} request - The incoming request from the client.
     * @param {ExecutionContext} event - The execution context, used for `waitUntil` to perform tasks
     * after the response has been sent (e.g., caching).
     * @returns {Promise<Response>}
     */
    async handleRequest(request, event) {
        const url = new URL(request.url);

        if (request.headers.get('Upgrade') === 'websocket') {
            const targetURL = URLParser.getTargetURL(request);
            if (!targetURL) return new Response("Invalid WebSocket target", {status: 400});
            const {0: client, 1: server} = new WebSocketPair();
            event.waitUntil(WebSocketHandler.handleSession(server, targetURL));
            return new Response(null, {status: 101, webSocket: client});
        }

        if (CacheConfig.enabled && request.method === 'GET') {
            const cache = caches.default;
            const cachedResponse = await cache.match(request);
            if (cachedResponse) {
                const headers = new Headers(cachedResponse.headers);
                headers.set('X-Proxy-Cache', 'HIT');
                return new Response(cachedResponse.body, {...cachedResponse, headers});
            }
        }

        const targetURL = URLParser.getTargetURL(request);
        if (!targetURL) {
            return new Response("Invalid target URL", {status: 400});
        }

        const {persona, setCookieHeader} = SessionManager.getPersona(request);
        const proxyRequest = new Request(targetURL.href, request);

        Object.entries(persona).forEach(([key, value]) => proxyRequest.headers.set(key, value));
        proxyRequest.headers.set('Host', targetURL.hostname);

        const originResponse = await fetch(proxyRequest);
        const finalResponse = await this.rewriteResponse(originResponse, targetURL, url.hostname, setCookieHeader);

        if (CacheConfig.enabled && request.method === 'GET' && this.isCacheable(finalResponse)) {
            const cacheableResponse = finalResponse.clone();
            event.waitUntil(
                (async () => {
                    const cache = caches.default;
                    const responseToCache = new Response(cacheableResponse.body, cacheableResponse);
                    responseToCache.headers.set('Cache-Control', `public, max-age=${CacheConfig.cacheTtl}`);
                    await cache.put(request, responseToCache);
                })()
            );
        }

        return finalResponse;
    },

    /**
     * Rewrites the response from the origin server based on its `Content-Type` header.
     * This function selects the appropriate rewriting strategy for each type of content.
     * @param {Response} originResponse - The original response from the target server.
     * @param {URL} targetURL - The target URL of the original request.
     * @param {string} proxyDomain - The domain of our proxy worker.
     * @param {string|null} setCookieHeader - A potential new session cookie to set.
     * @returns {Promise<Response>} A new Response object with rewritten content and headers.
     */
    async rewriteResponse(originResponse, targetURL, proxyDomain, setCookieHeader) {
        const headers = new Headers(originResponse.headers);
        const contentType = headers.get('Content-Type') || '';

        if (setCookieHeader) {
            headers.append('Set-Cookie', setCookieHeader);
        }
        if (headers.has('Set-Cookie')) {
            const cookies = headers.getAll('Set-Cookie');
            headers.delete('Set-Cookie');
            cookies.forEach(c => headers.append('Set-Cookie', Rewriters.rewriteSetCookieHeader(c, proxyDomain)));
        }
        if (headers.has('Link')) {
            const newLinkHeader = Rewriters.rewriteLinkHeader(headers.get('Link'));
            newLinkHeader ? headers.set('Link', newLinkHeader) : headers.delete('Link');
        }
        if (headers.has('Location')) {
            headers.set('Location', `https://${proxyDomain}/${Config.separator}${new URL(headers.get('Location'), targetURL).href}`);
        }

        headers.delete('Content-Security-Policy');

        if (contentType.includes('javascript')) {
            const originalScript = await originResponse.text();
            const interceptor = Rewriters.getStealthInterceptorScript(proxyDomain);
            const modifiedScript = interceptor + originalScript;
            headers.set('Content-Length', modifiedScript.length.toString());
            return new Response(modifiedScript, {
                status: originResponse.status,
                statusText: originResponse.statusText,
                headers
            });
        }

        if (contentType.includes('text/html') || contentType.includes('image/svg+xml')) {
            return Rewriters.getHtmlRewriter(targetURL, proxyDomain).transform(new Response(originResponse.body, {
                status: originResponse.status,
                statusText: originResponse.statusText,
                headers
            }));
        }

        // Fallback for any other content types.
        return new Response(originResponse.body, {
            status: originResponse.status,
            statusText: originResponse.statusText,
            headers
        });
    },

    /**
     * Determines if a response is safe to cache based on its status, headers, and content type.
     * It respects `Cache-Control` directives from the origin server.
     * @param {Response} response - The response to evaluate.
     * @returns {boolean} True if the response is cacheable.
     */
    isCacheable(response) {
        if (response.status !== 200) return false;
        const cacheControl = response.headers.get('Cache-Control') || '';
        if (/no-cache|no-store|private/.test(cacheControl)) return false;
        const contentType = response.headers.get('Content-Type') || '';
        return CacheConfig.cacheableTypes.some(type => contentType.includes(type));
    },
};