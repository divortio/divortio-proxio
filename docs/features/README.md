# Divortio Proxio Feature Index

This directory contains the technical specifications for the Divortio Proxio "High Fidelity" engine. Each document details a specific layer of interception, rewriting, or security enforcement.

## 1. Network & Traffic Control
*Controlling how data moves between the client, the proxy, and the upstream target.*

* **[Network Interception (Client-Side)](./network-interception.md)**
    * **Scope:** Browser Runtime (Fetch, XHR, WebSocket).
    * **Key Features:** Global `fetch` trap, `navigator.sendBeacon` interception, WebSocket constructor wrapping, and the WebRTC killswitch.
* **[Service Worker Redundancy](./service-worker.md)**
    * **Scope:** Background Network Layer.
    * **Key Features:** Dynamic generation, immediate claim (`skipWaiting`), and the "Injector" technique for wrapping third-party Service Workers.
* **[Request Headers](./request-headers.md)**
    * **Scope:** Outgoing HTTP Requests.
    * **Key Features:** Identity scrubbing (stripping `X-Forwarded-For`, `CF-Connecting-IP`), Origin/Referer spoofing, and Host header enforcement.
* **[Response Headers](./response-headers.md)**
    * **Scope:** Incoming HTTP Responses.
    * **Key Features:** Cookie scoping (`Set-Cookie` rewriting), Redirect handling (`Location`), CSP relaxation, and aggressive fingerprint stripping (`Accept-CH`, `Report-To`).

## 2. Content Transformation
*Modifying static and dynamic resources in transit to ensure they point back to the proxy.*

* **[Response Pipeline](./response-pipeline.md)**
    * **Scope:** Server-Side Orchestration.
    * **Key Features:** The central decision tree that delegates content to specific handlers based on MIME type (`text/html` vs `application/json`), handling buffering vs. streaming strategies.
* **[DOM Sanitization](./dom-sanitization.md)**
    * **Scope:** HTML & XML Structure.
    * **Key Features:** Streaming `HTMLRewriter` for standard attributes (`href`, `src`), complex `srcset` parsing, Meta refresh handling, and XML/RSS feed rewriting.
* **[CSS Transformation](./css-transformation.md)**
    * **Scope:** Stylesheets & Presentation.
    * **Key Features:** Rewriting `url()` and `@import` rules, stripping Source Maps, and trapping the modern CSS Typed Object Model (`attributeStyleMap`).

## 3. Runtime Hardening & Isolation
*Sanitizing executable code and state to prevent leaks from isolated threads or scripts.*

* **[JavaScript Hardening](./javascript-hardening.md)**
    * **Scope:** Script Execution & Data Structures.
    * **Key Features:** Dynamic `import()` hooks, JSON response walking, Worker thread isolation (Blob Bootstrapper), and Import Map scoping.
* **[Browser Integrity (Stealth)](./browser-integrity.md)**
    * **Scope:** Anti-Fingerprinting.
    * **Key Features:** Native code spoofing (`toString` overrides), Performance API masking, and "Getter Spoofing" to hide proxy URLs from client scripts.

## 4. Infrastructure & Security
*Protecting the proxy application itself from abuse and data leaks.*

* **[Infrastructure Security](./infrastructure-security.md)**
    * **Scope:** Cloudflare Worker Environment.
    * **Key Features:** Secure Edge Caching (cookie stripping), Global Error Masking, Anti-Open Proxy domain locking, and internal asset protection.

---

### Related Documentation
* **[Configuration & Environment](../configuration.md)**: How to configure the proxy via `wrangler.toml`.
* **[Worker Entrypoint](../worker-entrypoint.md)**: The request lifecycle and middleware composition.
* **[Known Gaps & Mitigations](../known-gaps.md)**: Current security status and resolved vectors.