# Infrastructure Security

This module details the security measures applied to the Cloudflare Worker runtime and the Edge Cache. These features prevent infrastructure-level leaks and abuse.

## 1. Secure Edge Caching
**Source:** [`src/handle/handlers/cfCache.mjs`]

We leverage Cloudflare's Cache API to reduce latency, but we apply strict filtering to prevent data leaks.

| Feature | Implementation Details |
| :--- | :--- |
| **Session Protection** | **Strip Set-Cookie**: The cache logic explicitly removes `Set-Cookie` headers before saving. This prevents one user's session ID from being served to another user. |
| **Content Allowlist** | **Strict Typing**: Only specific content types (images, fonts, css, js) defined in the configuration are cached. Dynamic HTML is rarely cached to avoid serving stale personalized content. |
| **Cache Keys** | **Normalization**: We construct a normalized `GET` request object for the cache key, ignoring client-specific headers that might fragment the cache unnecessarily. |
| **Observability** | **X-Proxy-Cache**: On cache hits, we inject this header with value `HIT` to allow debugging of cache behavior without exposing internal details. |
| **Vary Header** | **Accept-Encoding**: We append `Vary: Accept-Encoding` to ensure that clients supporting Brotli/Gzip receive the correct format. |

## 2. Access Control & Validation
**Source:** [`src/handle/handlers/url.mjs`]

| Feature | Description | Risk Covered |
| :--- | :--- | :--- |
| **Domain Locking** | The handler validates that the incoming request hostname ends with the configured `ROOT_DOMAIN`. If not, it returns `null` (404). | **Anti-Open Proxy**: Prevents the worker from being abused to proxy traffic for arbitrary domains. |
| **Target Extraction** | Parses the subdomain (e.g., `google-com`) to determine the upstream target. This logic enforces a strict mapping strategy, preventing "Server-Side Request Forgery" (SSRF) via the proxy. |

## 3. Internal Asset Protection
**Source:** [`src/handle/handlers/asset.mjs`]

The proxy serves internal logic files that are generated dynamically.
| Asset | Path | Security Controls |
| :--- | :--- | :--- |
| **SW Injector** | `/__divortio_sw_injector.js` | **Dynamic Wrapping**: Reads the `?target=` query parameter. Returns a generated script that `importScripts` our interceptor and then the target. Served with `Service-Worker-Allowed: /` to ensure it can control the scope. |
| **Service Worker** | `/__divortio_sw.js` | **Scope Relaxation**: Sends `Service-Worker-Allowed: /`. |
| **Interceptor** | `/__divortio_interceptor.js` | **Caching**: Served with `Cache-Control: public, max-age=43200` to prevent repeated fetches of the static JS payload. |
| **Robots** | All Assets | Injects `X-Robots-Tag: noindex, nofollow` to prevent search engines from indexing the proxy's internal scripts or public assets. |

## 4. Global Error Masking
**Source:** [`src/middleware/error-handler.mjs`]

* **Generic Output**: If an exception occurs (e.g., upstream connection failure), the worker returns a generic JSON error (`"error": "Proxy Error"`) instead of the standard Cloudflare error page.
* **Leak Prevention**: This prevents stack traces—which often contain internal file paths, configuration variables, or upstream IP addresses—from being returned to the client.