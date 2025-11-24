/**
 * @file Client-side proxy interceptor script.
 * @version 25.0.0
 * @description
 * The "Stealth" Edition.
 * Includes: Native Code Spoofing, Performance Masking, SVG baseVal traps,
 * Document Referrer spoofing, and comprehensive Network/DOM traps.
 */

export function getStealthInterceptorScript(rootDomain) {
    return `
      (function() {
        // 1. Environment Safety Check
        if (self.location.protocol === 'blob:' || self.location.protocol === 'data:') return;

        // 2. Configuration
        // We hardcode this into the script to ensure it's available immediately,
        // regardless of external config script injection timing.
        const PROXY_ROOT_DOMAIN = '${rootDomain}';
        
        // --- CORE UTILITIES ---
        
        const rewriteURL = (url) => {
            if (!url || typeof url !== 'string') return url;
            // Ignore non-network schemas
            if (url.startsWith('data:') || url.startsWith('#') || url.startsWith('javascript:') || url.startsWith('blob:')) return url;
            try {
                const u = new URL(url, self.location.href);
                // If it's not already on our proxy, rewrite it
                if (!u.hostname.endsWith(PROXY_ROOT_DOMAIN)) {
                    return 'https://' + u.hostname + '.' + PROXY_ROOT_DOMAIN + u.pathname + u.search;
                }
                return u.href;
            } catch(e) { return url; }
        };

        const unrewriteURL = (url) => {
            try {
                const u = new URL(url);
                // Reverse the proxy logic to show the "real" URL to the scripts
                if (u.hostname.endsWith('.' + PROXY_ROOT_DOMAIN)) {
                    const originalHost = u.hostname.slice(0, - (PROXY_ROOT_DOMAIN.length + 1));
                    return u.protocol + '//' + originalHost + u.pathname + u.search;
                }
                return url;
            } catch(e) { return url; }
        };

        const rewriteCSS = (css) => {
            if (!css || typeof css !== 'string') return css;
            return css.replace(/url\\(\\s*(['"]?)(.*?)\\1\\s*\\)/gi, (match, quote, url) => {
                if (url.startsWith('data:')) return match;
                return 'url(' + quote + rewriteURL(url) + quote + ')';
            });
        };

        const rewriteHTML = (html) => {
            if (!html || typeof html !== 'string') return html;
            // Regex to catch common URL attributes in raw HTML strings
            return html.replace(/(src|href|action|poster|data|formaction|background|codebase|cite|icon)\\s*=\s*['"]?([^'"\\s>]+)['"]?/gi, (match, attr, url) => {
                return attr + '="' + rewriteURL(url) + '"';
            });
        };

        const rewriteSrcset = (srcset) => {
            if (!srcset || typeof srcset !== 'string') return srcset;
            return srcset.split(',').map(part => {
                const trimmed = part.trim();
                const sIdx = trimmed.lastIndexOf(' ');
                if (sIdx === -1) return rewriteURL(trimmed);
                return rewriteURL(trimmed.substring(0, sIdx)) + trimmed.substring(sIdx);
            }).join(', ');
        };
        
        // Expose globally for server-side rewriting (e.g. import())
        self.__d_rw = rewriteURL;


        // --- 1. NATIVE CODE SPOOFING (Anti-Tamper) ---
        // Many scripts check if API functions have been monkey-patched by calling .toString().
        // We must intercept this and lie, returning "function name() { [native code] }".
        
        const nativeToString = Function.prototype.toString;
        const trappedFns = new WeakSet();
        
        const makeNative = (fn, original) => {
            trappedFns.add(fn);
            // Store the name if possible for realism
            if (original) {
                try { Object.defineProperty(fn, 'name', { value: original.name }); } catch(e){}
            }
            return fn;
        };

        Function.prototype.toString = function() {
            if (trappedFns.has(this)) {
                return "function " + (this.name || "") + "() { [native code] }";
            }
            return nativeToString.call(this);
        };

        // Safe Wrapper Helper
        const safeWrap = (obj, method, wrapper) => {
            if (!obj || !obj[method]) return;
            const original = obj[method];
            // Wrap the function, then mark the wrapper as "Native"
            obj[method] = makeNative(wrapper(original), original);
        };


        // --- 2. NETWORK TRAPS ---
        
        // Fetch
        if (self.fetch) {
            safeWrap(self, 'fetch', (original) => function(input, init) {
                if (typeof input === 'string') input = rewriteURL(input);
                else if (input instanceof Request) input = new Request(rewriteURL(input.url), input);
                
                // Strip Integrity to prevent hash mismatches
                if (init && init.integrity) delete init.integrity;
                
                return original.call(this, input, init);
            });
        }

        // XMLHttpRequest
        if (self.XMLHttpRequest) {
            safeWrap(XMLHttpRequest.prototype, 'open', (original) => function(method, url, ...args) {
                return original.call(this, method, rewriteURL(url), ...args);
            });
        }

        // SendBeacon
        if (navigator.sendBeacon) {
            safeWrap(navigator, 'sendBeacon', (original) => function(url, data) {
                return original.call(this, rewriteURL(url), data);
            });
        }

        // WebSocket
        if (self.WebSocket) {
            const OriginalWebSocket = self.WebSocket;
            self.WebSocket = new Proxy(OriginalWebSocket, {
                construct(target, args) {
                    // args[0] is url
                    return new target(rewriteURL(args[0]), args[1]);
                }
            });
            // Proxy can't use makeNative directly on constructor easily, but logic is hidden
        }

        // EventSource
        if (self.EventSource) {
            const OriginalEventSource = self.EventSource;
            self.EventSource = new Proxy(OriginalEventSource, {
                construct(target, args) {
                    return new target(rewriteURL(args[0]), args[1]);
                }
            });
        }
        
        // Request
        if (self.Request) {
            const OriginalRequest = self.Request;
            self.Request = new Proxy(OriginalRequest, {
                construct(target, args) {
                    if (args[0]) args[0] = rewriteURL(args[0]);
                    if (args[1] && args[1].integrity) delete args[1].integrity;
                    return new target(...args);
                }
            });
        }


        // --- 3. DOM SETTERS (The "Image Trap") ---
        
        // setAttribute Trap
        if (self.Element && Element.prototype) {
            const oSet = Element.prototype.setAttribute;
            const oSetNS = Element.prototype.setAttributeNS;
            
            const urlAttrs = ['src','href','action','poster','data','formaction','xlink:href','codebase','manifest','ping','background','archive','longdesc','profile','classid','cite','icon','fill','stroke','filter','mask','clip-path'];
            const htmlAttrs = ['srcdoc'];
            const srcsetAttrs = ['srcset'];

            const trap = (name, val) => {
                const lower = name.toLowerCase();
                if (urlAttrs.includes(lower)) return rewriteURL(val);
                if (htmlAttrs.includes(lower)) return rewriteHTML(val);
                if (srcsetAttrs.includes(lower)) return rewriteSrcset(val);
                return val;
            };

            Element.prototype.setAttribute = makeNative(function(name, value) {
                return oSet.call(this, name, trap(name, value));
            }, oSet);

            Element.prototype.setAttributeNS = makeNative(function(ns, name, value) {
                return oSetNS.call(this, ns, name, trap(name, value));
            }, oSetNS);
        }

        // Property Trap Helper (Getter Spoofing)
        // Rewrites the setter, but makes the getter return the ORIGINAL value (The Illusion)
        const trapProp = (proto, prop, processor = rewriteURL) => {
            if (!proto) return;
            const desc = Object.getOwnPropertyDescriptor(proto, prop);
            if (desc && desc.set && desc.get) {
                Object.defineProperty(proto, prop, {
                    get() { 
                        // Spoofing: Return the un-rewritten URL
                        return unrewriteURL(desc.get.call(this)); 
                    },
                    set(val) { 
                        // Rewriting: Set the proxy URL
                        return desc.set.call(this, processor(val)); 
                    },
                    enumerable: desc.enumerable, 
                    configurable: desc.configurable
                });
            }
        };

        // Apply to all relevant DOM interfaces
        const elements = [
            [self.HTMLImageElement, 'src'], [self.HTMLScriptElement, 'src'], [self.HTMLLinkElement, 'href'],
            [self.HTMLAnchorElement, 'href'], [self.HTMLAnchorElement, 'ping'], [self.HTMLMediaElement, 'src'],
            [self.HTMLObjectElement, 'data'], [self.HTMLEmbedElement, 'src'], [self.HTMLIFrameElement, 'src'],
            [self.HTMLFormElement, 'action'], [self.HTMLInputElement, 'src'], [self.HTMLInputElement, 'formAction'],
            [self.HTMLButtonElement, 'formAction'], [self.HTMLBodyElement, 'background'], [self.SVGImageElement, 'href'],
            [self.SVGAElement, 'href'], [self.SVGUseElement, 'href'], [self.HTMLAreaElement, 'href'],
            [self.HTMLTrackElement, 'src'], [self.HTMLFrameElement, 'src'], [self.HTMLFrameElement, 'longDesc'],
            [self.HTMLQuoteElement, 'cite'], [self.HTMLModElement, 'cite']
        ];
        elements.forEach(([proto, prop]) => trapProp(proto?.prototype, prop));

        // Special Parsers
        trapProp(self.HTMLIFrameElement?.prototype, 'srcdoc', rewriteHTML);
        trapProp(self.HTMLImageElement?.prototype, 'srcset', rewriteSrcset);
        trapProp(self.HTMLSourceElement?.prototype, 'srcset', rewriteSrcset);
        
        // SVG baseVal (Complex Object) Trap
        if (self.SVGAnimatedString && SVGAnimatedString.prototype) {
            const baseValDesc = Object.getOwnPropertyDescriptor(SVGAnimatedString.prototype, 'baseVal');
            if (baseValDesc && baseValDesc.set) {
                Object.defineProperty(SVGAnimatedString.prototype, 'baseVal', {
                    get() { return unrewriteURL(baseValDesc.get.call(this)); },
                    set(v) { return baseValDesc.set.call(this, rewriteURL(v)); },
                    enumerable: true, configurable: true
                });
            }
        }


        // --- 4. CSS TRAPS ---
        
        if (self.CSSStyleDeclaration) {
            // setProperty
            safeWrap(CSSStyleDeclaration.prototype, 'setProperty', (o) => function(prop, value, priority) {
                if (value && (prop.includes('image') || prop.includes('background') || value.includes('url('))) {
                    value = rewriteCSS(value);
                }
                return o.call(this, prop, value, priority);
            });

            // Direct property assignment (style.backgroundImage = ...)
            const trapStyleProp = (prop) => {
                const desc = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, prop);
                if (desc && desc.set) {
                    Object.defineProperty(CSSStyleDeclaration.prototype, prop, {
                        get: desc.get,
                        set(v) { return desc.set.call(this, rewriteCSS(v)); },
                        enumerable: desc.enumerable, configurable: desc.configurable
                    });
                }
            };
            ['backgroundImage', 'listStyleImage', 'borderImage', 'borderImageSource', 'content', 'cursor', 'maskImage', 'filter', 'clipPath', 'offsetPath', 'shapeOutside'].forEach(trapStyleProp);
            trapStyleProp('cssText');
        }

        if (self.CSSStyleSheet) {
            safeWrap(CSSStyleSheet.prototype, 'replace', (o) => function(t) { return o.call(this, rewriteCSS(t)); });
            safeWrap(CSSStyleSheet.prototype, 'replaceSync', (o) => function(t) { return o.call(this, rewriteCSS(t)); });
            safeWrap(CSSStyleSheet.prototype, 'insertRule', (o) => function(r, i) { return o.call(this, rewriteCSS(r), i); });
            safeWrap(CSSStyleSheet.prototype, 'addRule', (o) => function(s, st, i) { return o.call(this, s, rewriteCSS(st), i); });
        }


        // --- 5. HTML INJECTION TRAPS ---
        
        const trapH = (proto, prop) => {
            const d = Object.getOwnPropertyDescriptor(proto, prop);
            if (d && d.set) {
                Object.defineProperty(proto, prop, {
                    get: d.get,
                    set(v) { return d.set.call(this, rewriteHTML(v)); },
                    enumerable: true, configurable: true
                });
            }
        };

        if (self.Element) {
            trapH(Element.prototype, 'innerHTML');
            trapH(Element.prototype, 'outerHTML');
            safeWrap(Element.prototype, 'insertAdjacentHTML', (o) => function(p, t) { return o.call(this, p, rewriteHTML(t)); });
        }
        
        if (self.HTMLStyleElement && self.Node) {
             const d = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
             if (d && d.set) Object.defineProperty(HTMLStyleElement.prototype, 'textContent', { 
                 get: d.get, 
                 set(v) { return d.set.call(this, rewriteCSS(v)); },
                 enumerable: true, configurable: true
             });
        }
        
        if (self.document) {
            safeWrap(document, 'write', (o) => function(...args) { return o.apply(this, args.map(a => rewriteHTML(String(a)))); });
            safeWrap(document, 'writeln', (o) => function(...args) { return o.apply(this, args.map(a => rewriteHTML(String(a)))); });
        }


        // --- 6. PERFORMANCE MASKING ---
        // Prevents scripts from seeing the proxy URLs in performance logs.
        if (self.Performance) {
            const wrapPerf = (fn) => function(...args) {
                const entries = fn.apply(this, args);
                if (Array.isArray(entries)) {
                    entries.forEach(e => {
                        if (e.name && e.name.startsWith('http')) {
                            try {
                                // PerformanceEntry is read-only, this is a best-effort attempt
                                Object.defineProperty(e, 'name', { value: unrewriteURL(e.name) });
                            } catch(err) {}
                        }
                    });
                }
                return entries;
            };
            safeWrap(Performance.prototype, 'getEntries', wrapPerf);
            safeWrap(Performance.prototype, 'getEntriesByName', wrapPerf);
            safeWrap(Performance.prototype, 'getEntriesByType', wrapPerf);
        }


        // --- 7. MISC (Cookies, History, Threading) ---

        if (self.Document) {
            const d = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
            if (d && d.set) Object.defineProperty(Document.prototype, 'cookie', {
                get: d.get,
                set(v) { 
                    // Force domain to proxy root
                    return d.set.call(this, v.replace(/;\\s*Domain=[^;]+/zi, '; Domain=' + PROXY_ROOT_DOMAIN)); 
                },
                enumerable: d.enumerable, configurable: d.configurable
            });
        }

        // Async Cookies
        if (self.cookieStore) {
            safeWrap(cookieStore, 'set', (o) => function(...args) {
                if (args[0] && typeof args[0] === 'object' && args[0].domain) args[0].domain = PROXY_ROOT_DOMAIN;
                return o.apply(this, args);
            });
        }

        // History State Walker
        const rewriteState = (state) => {
            if (!state || typeof state !== 'object') return state;
            try {
                for (const key in state) {
                    const val = state[key];
                    if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('/'))) state[key] = rewriteURL(val);
                }
            } catch(e){}
            return state;
        };

        if (self.history) {
            safeWrap(history, 'pushState', (o) => function(s, t, u) { return o.call(this, rewriteState(s), t, rewriteURL(u)); });
            safeWrap(history, 'replaceState', (o) => function(s, t, u) { return o.call(this, rewriteState(s), t, rewriteURL(u)); });
        }

        // Location
        if (self.window && window.location) {
            const a = window.location.assign, r = window.location.replace;
            window.location.assign = function(u) { return a.call(window.location, rewriteURL(u)); };
            window.location.replace = function(u) { return r.call(window.location, rewriteURL(u)); };
        }
        if (self.window && window.open) {
            const o = window.open;
            window.open = function(u, t, f) { return o.call(window, rewriteURL(u), t, f); };
        }

        // PostMessage & BroadcastChannel
        if (self.BroadcastChannel) {
            safeWrap(BroadcastChannel.prototype, 'postMessage', (o) => function(m) {
                if (typeof m === 'string' && (m.startsWith('http') || m.startsWith('/'))) m = rewriteURL(m);
                return o.call(this, m);
            });
        }
        if (self.HTMLIFrameElement) {
            const d = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
            Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
                get() {
                    const w = d.get.call(this);
                    if (!w) return w;
                    return new Proxy(w, {
                        get(t, p) {
                            if (p === 'postMessage') return function(m, o, tr) { 
                                if (typeof o === 'string' && o !== '*' && o !== '/') o = rewriteURL(o); 
                                return t.postMessage(m, o, tr); 
                            };
                            const v = t[p]; if (typeof v === 'function') return v.bind(t); return v;
                        }
                    });
                }
            });
        }
        
        // Workers
        if (self.navigator && navigator.serviceWorker) {
            safeWrap(navigator.serviceWorker, 'register', (o) => function(u, o2) {
                return o.call(this, rewriteURL(u), o2);
            });
        }
        if (typeof importScripts === 'function') {
            const o = importScripts;
            self.importScripts = function(...u) { return o(...u.map(rewriteURL)); };
        }
        
        // Disablers
        ['RTCPeerConnection', 'webkitRTCPeerConnection', 'mozRTCPeerConnection', 'WebTransport'].forEach(k => { 
            try { self[k] = undefined; } catch(e){} 
        });

        // Integrity (No-op)
        if (self.HTMLScriptElement) Object.defineProperty(HTMLScriptElement.prototype, 'integrity', { get:()=>'', set:()=>{} });
        if (self.HTMLLinkElement) Object.defineProperty(HTMLLinkElement.prototype, 'integrity', { get:()=>'', set:()=>{} });

        // Leak Monitor
        if (self.PerformanceObserver) {
            new PerformanceObserver((l) => {
                l.getEntries().forEach((e) => {
                    try {
                        if (e.name.startsWith('http') && !new URL(e.name).hostname.endsWith(PROXY_ROOT_DOMAIN) && new URL(e.name).hostname !== 'localhost') {
                            console.error('[Divortio Leak]', e.name);
                        }
                    } catch(x){}
                });
            }).observe({ entryTypes: ['resource'] });
        }

        // SW Registration
        if (self.navigator && navigator.serviceWorker) {
            navigator.serviceWorker.register('/__divortio_sw.js?rd=' + PROXY_ROOT_DOMAIN, { scope: '/' }).catch(()=>{});
        }

      })();
    `;
}