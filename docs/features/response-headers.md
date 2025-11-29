# Response Header Manipulation

This module details how incoming response headers are processed. We modify these to ensure the session remains secure, features work within the proxy tunnel, and browser fingerprinting vectors are disabled.

## 1. Session & State
**Source:** [`src/rewrite/rewriters/headers/cookies.mjs`] & [`src/rewrite/rewriters/headers/location.mjs`]

| Header | Action | Implementation Details |
| :--- | :--- | :--- |
| **Set-Cookie** | **Rewrite** | **1. Strip:** Existing `Domain`, `Secure`, and `SameSite` attributes are removed to prevent conflicts.<br>**2. Scope:** If the cookie is not a `__Host-` cookie, `Domain` is set to the proxy subdomain.<br>**3. Harden:** `Secure` and `SameSite=Lax` are appended to every cookie. |
| **Location** | **Rewrite** | **1. Parse:** Resolves the redirect URL relative to the current Target URL (handling relative paths).<br>**2. Rewrite:** Constructs a new absolute URL pointing to the proxy: `https://${hostname}.${rootDomain}/${path}`. |
| **Refresh** | **Delete** | Legacy meta-refresh header. Deleted to prevent un-proxied redirects (handled via HTML Meta rewriter instead). |

## 2. Browser Security & Isolation Policies
**Source:** [`src/rewrite/rewriters/headers/sanitize.mjs`]

We remove strict isolation policies that would prevent the proxied site from loading inside an iframe or communicating with the proxy wrapper.

| Header | Action | Rationale |
| :--- | :--- | :--- |
| **Content-Security-Policy** | **Relax** | **Source:** [`src/rewrite/rewriters/headers/csp.mjs`]<br>We parse directives to allow proxy resources:<br>1. `upgrade-insecure-requests`: **Removed**.<br>2. `script-src`: Adds `'unsafe-inline' 'unsafe-eval' * data:`.<br>3. `style-src`: Adds `'unsafe-inline' *`.<br>4. `connect-src`: Adds `'self' *`.<br>5. `img-src`: Adds `'self' * data:`. |
| **Access-Control-Allow-Origin** | **Rewrite** | **Source:** [`src/rewrite/rewriters/headers/cors.mjs`]<br>If the upstream returns a specific origin (not `*`) that matches the target, we rewrite the hostname to include the proxy root domain (e.g., `api.target.com` -> `api.target.proxy.com`). |
| **CSP-Report-Only** | **Delete** | Prevents violation reports when we modify scripts/styles. |
| **Cross-Origin-Opener-Policy**| **Delete** | `COOP`. Removed to allow window interactions if the proxy is running in a popup/frame. |
| **Cross-Origin-Embedder-Policy**| **Delete**| `COEP`. Removed to prevent blocking cross-origin subresources. |
| **X-Frame-Options** | **Delete** | Prevents the page from blocking itself if displayed in a frame. |
| **Permissions-Policy** | **Delete** | Removes restrictions on browser features (camera, mic, etc.) that might break emulation. |
| **Referrer-Policy** | **Delete** | Removed to allow the proxy to control the Referer header via the interceptor. |

## 3. Privacy & Fingerprinting (Stripping)
**Source:** [`src/rewrite/rewriters/headers/sanitize.mjs`]

We aggressively remove headers that allow the server to query device capabilities or track the user via side-channels.

| Header | Why it is removed |
| :--- | :--- |
| **Accept-CH** | Client Hints request. Prevents server from asking for model, platform version, or bitness. |
| **Report-To** | Prevents browser from sending crash/violation reports to the origin. |
| **NEL** | Network Error Logging. Prevents tracking via network connectivity reports. |
| **Alt-Svc** | Alternative Services (HTTP/3, QUIC). Removed to force traffic through our controlled HTTP tunnel. |
| **Clear-Site-Data** | Prevents the origin from maliciously clearing proxy-managed storage. |
| **X-DNS-Prefetch-Control** | Prevents browser from performing DNS lookups bypassing the proxy. |
| **SourceMap / X-SourceMap** | Prevents DevTools from requesting map files directly from the origin. |

## 4. Technical & Operational
**Source:** [`src/rewrite/rewriters/headers/sanitize.mjs`]

These headers are removed to prevent conflicts with the Cloudflare Worker runtime or the HTTP proxying process.

| Header | Action | Rationale |
| :--- | :--- | :--- |
| **Link** | **Rewrite** | **Source:** [`src/rewrite/rewriters/headers/links.mjs`]<br>**1. Strip:** Removes `preconnect` and `dns-prefetch` to prevent IP leaks.<br>**2. Rewrite:** Rewrites the main `<url>` to the proxy domain.<br>**3. Responsive:** Parses `imagesrcset="..."` attributes within the header and rewrites nested URLs. |
| **Content-Disposition** | **Force** | For `application/pdf`, forced to `attachment` to trigger download instead of rendering. |
| **X-Robots-Tag** | **Inject** | Added with `noindex, nofollow` to prevent search engine indexing. |
| **Content-Encoding** | **Delete** | Removed so Cloudflare can handle compression/decompression automatically. |
| **Content-Length** | **Delete** | Recalculated by the platform because our content rewriting changes the body size. |
| **Transfer-Encoding** | **Delete** | Removed to allow the platform to manage chunked transfer. |
| **Keep-Alive / Connection** | **Delete** | Hop-by-hop headers that must not be proxied. |