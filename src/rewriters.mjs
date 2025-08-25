/**
 * @file A collection of classes and functions for rewriting response content and headers.
 * @version 5.0.0
 * @see {@link ./request-handler.mjs} for usage.
 *
 * @description
 * This module is the core of the proxy's transformation engine. It provides the logic
 * for safely and comprehensively rewriting various content types (HTML, CSS, JS, JSON, XML)
 * and HTTP headers to ensure that all requests are routed through the proxy and that
 * privacy-leaking information is stripped. A critical feature is the unconditional
 * injection of a "stealth" JavaScript interceptor to prevent dynamic, client-side data leaks.
 */

/**
 * @namespace Rewriters
 * @description A collection of all rewriting logic used by the proxy.
 */
export const Rewriters = {
    /**
     * A generic class for rewriting a specific URL-holding attribute on an HTML element.
     * @memberof Rewriters
     */
    AttributeRewriter: class {
        /**
         * @param {string} attr - The name of the attribute to rewrite (e.g., "href", "src").
         * @param {URL} baseURL - The base URL of the original page.
         * @param {string} rootDomain - The root domain of the proxy.
         */
        constructor(attr, baseURL, rootDomain) {
            this.attr = attr;
            this.baseURL = baseURL;
            this.rootDomain = rootDomain;
        }

        element(el) {
            const val = el.getAttribute(this.attr);
            if (!val || val.startsWith('data:') || val.startsWith('javascript:')) return;
            try {
                const absoluteURL = new URL(val, this.baseURL);
                const targetHost = absoluteURL.hostname;
                if (targetHost.endsWith(`.${this.rootDomain}`)) return;
                el.setAttribute(this.attr, `https://${targetHost}.${this.rootDomain}${absoluteURL.pathname}${absoluteURL.search}`);
            } catch (e) { /* Ignore invalid URLs */
            }
        }
    },

    /**
     * A class for rewriting URLs within a `srcset` attribute.
     * @memberof Rewriters
     */
    SrcsetRewriter: class {
        /**
         * @param {URL} baseURL - The base URL of the original page.
         * @param {string} rootDomain - The root domain of the proxy.
         */
        constructor(baseURL, rootDomain) {
            this.baseURL = baseURL;
            this.rootDomain = rootDomain;
        }

        element(el) {
            const srcset = el.getAttribute('srcset');
            if (!srcset) return;
            const newParts = srcset.split(',').map(part => {
                const [url, desc] = part.trim().split(/\s+/);
                if (!url) return part;
                try {
                    const absURL = new URL(url, this.baseURL);
                    const newURL = `https://${absURL.hostname}.${this.rootDomain}${absURL.pathname}${absURL.search}`;
                    return desc ? `${newURL} ${desc}` : newURL;
                } catch {
                    return part;
                }
            });
            el.setAttribute('srcset', newParts.join(', '));
        }
    },

    /**
     * Generates a stealthy JavaScript snippet to intercept network requests and disable leaks.
     * It now wraps fetch, sendBeacon, and the WebSocket constructor.
     * @param {string} rootDomain - The root domain of the proxy.
     * @returns {string} The JavaScript code to be injected.
     */
    getStealthInterceptorScript(rootDomain) {
        return `
      (function() {
        if (self.location.protocol === 'blob:') return;
        const PROXY_ROOT_DOMAIN = '${rootDomain}';
        const absoluteURL = (url) => new URL(url, self.location.href);
        const proxiedURL = (url) => {
          const absURL = absoluteURL(url);
          // Handle WebSocket protocols
          if (absURL.protocol === 'ws:' || absURL.protocol === 'wss:') {
            return \`wss://\${absURL.hostname}.\${PROXY_ROOT_DOMAIN}\${absURL.pathname}\${absURL.search}\`;
          }
          return \`https://\${absURL.hostname}.\${PROXY_ROOT_DOMAIN}\${absURL.pathname}\${absURL.search}\`;
        };

        // 1. Intercept fetch()
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

        // 2. Intercept navigator.sendBeacon()
        if (navigator.sendBeacon) {
          const originalSendBeacon = navigator.sendBeacon;
          navigator.sendBeacon = function(url, data) {
            return originalSendBeacon.call(this, proxiedURL(url), data);
          };
        }

        // 3. Intercept WebSocket constructor
        if (self.WebSocket) {
            const OriginalWebSocket = self.WebSocket;
            self.WebSocket = function(url, protocols) {
                return new OriginalWebSocket(proxiedURL(url), protocols);
            };
        }

        // 4. Disable WebRTC
        self.RTCPeerConnection = null;
        self.webkitRTCPeerConnection = null;
        self.mozRTCPeerConnection = null;
      })();
    `;
    },

    /**
     * Parses and rewrites URLs in CSS content.
     * @param {string} css - The CSS source code.
     * @param {URL} baseURL - The base URL for resolving relative paths.
     * @param {string} rootDomain - The root domain of the proxy.
     * @returns {string} The rewritten CSS.
     */
    rewriteCSS(css, baseURL, rootDomain) {
        return css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/g, (match, quote, url) => {
            if (!url || url.startsWith('data:')) return match;
            try {
                const absURL = new URL(url, baseURL);
                const newURL = `https://${absURL.hostname}.${rootDomain}${absURL.pathname}${absURL.search}`;
                return `url(${quote}${newURL}${quote})`;
            } catch {
                return match;
            }
        });
    },

    /**
     * Parses and rewrites URLs in XML content.
     * @param {string} xml - The XML source code.
     * @param {URL} baseURL - The base URL for resolving relative paths.
     * @param {string} rootDomain - The root domain of the proxy.
     * @returns {string} The rewritten XML.
     */
    rewriteXML(xml, baseURL, rootDomain) {
        const proxiedURL = (url) => `https://${new URL(url, baseURL).hostname}.${rootDomain}${new URL(url, baseURL).pathname}${new URL(url, baseURL).search}`;
        try {
            xml = xml.replace(/<link>([^<]+)<\/link>/g, (match, url) => `<link>${proxiedURL(url)}</link>`);
            xml = xml.replace(/(<enclosure[^>]+url=")([^"]+)(")/g, (match, prefix, url, suffix) => prefix + proxiedURL(url) + suffix);
            xml = xml.replace(/(<media:content[^>]+url=")([^"]+)(")/g, (match, prefix, url, suffix) => prefix + proxiedURL(url) + suffix);
        } catch (e) {
        }
        return xml;
    },

    /**
     * Recursively rewrites URL strings in a JSON object.
     * @param {object} jsonObj - The JSON object to traverse.
     * @param {URL} baseURL - The base URL for resolving relative paths.
     * @param {string} rootDomain - The root domain of the proxy.
     */
    rewriteUrlsInJson(jsonObj, baseURL, rootDomain) {
        for (const key in jsonObj) {
            if (typeof jsonObj[key] === 'string' && (jsonObj[key].startsWith('http:') || jsonObj[key].startsWith('https://') || jsonObj[key].startsWith('/'))) {
                try {
                    const absURL = new URL(jsonObj[key], baseURL);
                    jsonObj[key] = `https://${absURL.hostname}.${rootDomain}${absURL.pathname}${absURL.search}`;
                } catch {
                }
            } else if (typeof jsonObj[key] === 'object' && jsonObj[key] !== null) {
                this.rewriteUrlsInJson(jsonObj[key], baseURL, rootDomain);
            }
        }
    },

    /**
     * Constructs an `HTMLRewriter` instance with a comprehensive set of handlers.
     * @param {URL} targetURL - The target URL of the original page.
     * @param {string} rootDomain - The root domain of the proxy.
     * @returns {HTMLRewriter} A configured HTMLRewriter instance.
     */
    getHtmlRewriter(targetURL, rootDomain) {
        const rewriter = new HTMLRewriter();
        rewriter.on('head', {
            element(element) {
                const interceptorScript = `<script>${Rewriters.getStealthInterceptorScript(rootDomain)}</script>`;
                element.prepend(interceptorScript, {html: true});
            }
        });
        const attr = (a) => new this.AttributeRewriter(a, targetURL, rootDomain);
        const srcset = new this.SrcsetRewriter(targetURL, rootDomain);
        rewriter
            .on('a[href], link[href], area[href]', attr('href'))
            .on('a[ping]', attr('ping'))
            .on('img[src], script[src], iframe[src], embed[src], source[src], track[src], video[src], audio[src], object[data], image[href]', attr('src'))
            .on('form[action]', attr('action'))
            .on('video[poster]', attr('poster'))
            .on('img[srcset], source[srcset]', srcset);
        return rewriter;
    },

    /**
     * The main response rewriting function, which routes the response to the correct content-specific rewriter.
     * @param {Response} originResponse - The original response from the target server.
     * @param {URL} targetURL - The target URL of the original request.
     * @param {string} proxySubdomain - The full unique subdomain for this proxied site.
     * @param {object} config - The application configuration object.
     * @param {string|null} setCookieHeader - A potential new session cookie to set.
     * @returns {Promise<Response>} A new Response object with rewritten content and headers.
     */
    async rewriteResponse(originResponse, targetURL, proxySubdomain, config, setCookieHeader) {
        const headers = new Headers(originResponse.headers);
        const contentType = headers.get('Content-Type') || '';

        // Header Rewriting (Location, Set-Cookie, etc.)
        // ...

        if (contentType.includes('text/html') || contentType.includes('image/svg+xml')) {
            return this.getHtmlRewriter(targetURL, config.rootDomain).transform(new Response(originResponse.body, {headers}));
        }

        if (contentType.includes('javascript')) {
            const js = await originResponse.text();
            const interceptor = this.getStealthInterceptorScript(config.rootDomain);
            const modifiedScript = interceptor + js;
            headers.set('Content-Length', modifiedScript.length.toString());
            return new Response(modifiedScript, {status: originResponse.status, headers});
        }

        if (contentType.includes('text/css')) {
            const css = await originResponse.text();
            const rewrittenCss = this.rewriteCSS(css, targetURL, config.rootDomain);
            return new Response(rewrittenCss, {status: originResponse.status, headers});
        }

        if (contentType.includes('application/json') || contentType.includes('application/manifest+json')) {
            try {
                const json = await originResponse.json();
                this.rewriteUrlsInJson(json, targetURL, config.rootDomain);
                return new Response(JSON.stringify(json), {status: originResponse.status, headers});
            } catch (e) { /* Fallback for malformed JSON */
            }
        }

        if (contentType.includes('application/xml') || contentType.includes('application/rss+xml')) {
            const xml = await originResponse.text();
            const rewrittenXml = this.rewriteXML(xml, targetURL, config.rootDomain);
            return new Response(rewrittenXml, {status: originResponse.status, headers});
        }

        // Fallback for any other content types.
        return new Response(originResponse.body, {status: originResponse.status, headers});
    },
};