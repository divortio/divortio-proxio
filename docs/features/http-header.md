# HTTP Header Management

This module details how Divortio Proxio manipulates HTTP headers to maintain session state, enforce security, and prevent identity leaks. These operations occur on the Server-Side (Cloudflare Worker) before the response is sent to the client.

## 1. Session & State Management
**Source:** [`src/rewrite/rewriters/headers/cookies.mjs`]
* **Cookie Scoping**: Intercepts `Set-Cookie` headers from the origin.
* **Domain Rewrite**: Rewrites the `Domain` attribute to the proxy's subdomain (e.g., `.proxy.example.com`) to ensure cookies are stored and sent back only to the proxy, maintaining session isolation.
* **Security Enforcement**: Automatically appends `Secure` and `SameSite=Lax` to all cookies to prevent leakage over non-encrypted connections or cross-site request forgery.

## 2. Navigation Control
**Source:** [`src/rewrite/rewriters/headers/location.mjs`]
* **Redirect Rewriting**: Intercepts the `Location` header in 3xx responses.
* **Leak Prevention**: If the upstream server attempts to redirect the user to `https://target.com/login`, the proxy rewrites this to `https://target.proxy.example.com/login`. This prevents the user from "escaping" the proxy via a redirect.

## 3. Resource Preloading
**Source:** [`src/rewrite/rewriters/headers/links.mjs`]
* **Link Header Parsing**: Parses the complex HTTP `Link` header (used for `rel=preload` or `rel=stylesheet`).
* **Sanitization**: Specifically looks for and removes `preconnect` and `dns-prefetch` directives, which would otherwise cause the browser to perform a DNS lookup or TCP handshake with the origin server directly.
* **URL Rewriting**: Rewrites the `<url>` portion of the header to point to the proxy.

## 4. Security Policy Adaptation
**Source:** [`src/rewrite/rewriters/headers/csp.mjs`] & [`src/rewrite/rewriters/headers/cors.mjs`]
* **Content-Security-Policy (CSP)**: Relaxes strict CSPs.
    * Removes `upgrade-insecure-requests` to prevent mixed-content issues within the proxy tunnel.
    * Adds `'unsafe-inline'` to `script-src` and `style-src`. This is **required** to allow our "Stealth Interceptor" (which is injected inline) to execute.
* **CORS**: Rewrites `Access-Control-Allow-Origin`. If the origin allows the proxy IP, we rewrite this to allow the user's browser origin, preventing Cross-Origin Resource Sharing errors in the browser console.

## 5. Fingerprint Stripping
**Source:** [`src/rewrite/rewriters/headers/sanitize.mjs`]
* **Client Hints**: Deletes `Accept-CH`. This prevents the upstream server from asking the browser for "High Entropy" fingerprinting data (like exact model number or bitness).
* **Leak Headers**: Removes `Alt-Svc` (Alternative Services), `Report-To`, `NEL` (Network Error Logging), and `SourceMap` to prevent background browser chatter that bypasses the proxy.