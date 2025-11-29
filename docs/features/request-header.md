# Request Header Manipulation

This module details how outgoing request headers are sanitized and rewritten. The goal is to make the request appear as if it originated directly from the proxy server, hiding the end user's identity and network path.

## 1. Identity & Origin Spoofing
**Source:** [`src/rewrite/request.mjs`]

We explicitly rewrite headers that reveal the request's history or origin to ensure the upstream server accepts the connection as legitimate.

| Header | Action | Implementation Details |
| :--- | :--- | :--- |
| **Host** | **Rewrite** | Set to the target's hostname (e.g., `google.com`). This is mandatory for virtual hosting (SNI) to work on the upstream server. |
| **Referer** | **Rewrite** | **Logic:** If the `Referer` header points to a proxy URL (e.g., `https://google-com.proxy.com/foo`), we resolve the original target URL and rewrite the header to match the upstream (e.g., `https://google.com/foo`). This prevents the target from seeing the proxy domain in its analytics. |
| **Origin** | **Rewrite** | **Logic:** Similar to Referer, this is used for CORS checks. It is rewritten to match the upstream origin. If URL parsing fails, the header is deleted to prevent blocking. |

## 2. Infrastructure Header Stripping
**Source:** [`src/rewrite/request.mjs`]

We remove headers added by Cloudflare, load balancers, or the original client that could leak the user's real IP or the proxy's internal architecture.

| Header Pattern | Description |
| :--- | :--- |
| **X-Forwarded-*** | `X-Forwarded-For`, `X-Forwarded-Proto`. Standard proxy headers that reveal the original client IP chain. **Stripped.** |
| **X-Real-IP** | Often contains the user's direct ISP IP address. **Stripped.** |
| **CF-*** | Cloudflare specific headers (`cf-connecting-ip`, `cf-ipcountry`, `cf-ray`, `cf-visitor`). These reveal that the request passed through Cloudflare and often contain the user's precise geolocation. **Stripped.** |
| **Via** | Standard header indicating the presence of a proxy. **Stripped.** |
| **Access Tokens** | `cf-access-jwt-assertion`, `cf-access-token`. Internal Zero Trust tokens. **Stripped** to prevent leaking authentication credentials to the upstream server. |
| **Internal Headers** | Any header starting with `x-cf-` is wildcard matched and removed. |

## 3. Operational Behavior
**Source:** [`src/rewrite/request.mjs`]

* **Redirect Mode**: The outgoing request is set to `redirect: 'manual'`. This ensures that 3xx responses are returned to the Worker (so we can rewrite the `Location` header) rather than being followed automatically by the fetch runtime.