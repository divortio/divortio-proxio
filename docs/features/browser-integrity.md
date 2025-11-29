# Browser Integrity & Stealth

High-fidelity proxying requires hiding the modifications we make. If a script detects our traps, it may flag the session as a bot.

## 1. Anti-Tamper Mechanisms
| Feature | Description | Risk Covered | Source |
| :--- | :--- | :--- | :--- |
| **Native Code Spoofing**| Overrides `Function.prototype.toString`. If a script inspects our trapped functions (e.g., `fetch.toString()`), it returns `function fetch() { [native code] }`. | `[Detection]` | [`interceptor.mjs`](../../src/templates/interceptor.mjs) |
| **Performance Masking**| Wraps `performance.getEntries()`. Reverts proxied URLs back to their original form in performance logs to hide the proxy domain from analytics. | `[Detection]` | [`interceptor.mjs`](../../src/templates/interceptor.mjs) |

## 2. Privacy Preservation
| Feature | Description | Risk Covered | Source |
| :--- | :--- | :--- | :--- |
| **Client Hint Stripping**| Removes `Accept-CH` headers to prevent the server from requesting high-entropy fingerprinting data (e.g., specific device model). | `[Fingerprinting]`| [`sanitize.mjs`](../../src/rewrite/rewriters/headers/sanitize.mjs) |
| **Report Blocking** | Strips `Report-To` and `CSP-Report-Only` headers to prevent the browser from sending violation reports that would reveal the proxy's existence or breakage. | `[Info Leak]` | [`sanitize.mjs`](../../src/rewrite/rewriters/headers/sanitize.mjs) |
| **Getter Spoofing** | While we trap setters to rewrite URLs (e.g., `img.src = proxy`), we trap getters to return the *original* URL. The script thinks it set the original URL, maintaining the illusion. | `[Detection]` | [`interceptor.mjs`](../../src/templates/interceptor.mjs) |