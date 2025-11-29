# Divortio Proxio

> **A High-Fidelity, Stealth-Oriented Cloudflare Worker Proxy.**

Divortio Proxio is not just a request forwarder; it is a sophisticated **transformation engine** designed to browse the modern web while preserving the user's privacy and the browser's fingerprint.

Unlike standard proxies that simply pipe bytes, Proxio actively patches the browser runtime (JavaScript, CSS, DOM, and Workers) to ensure that all traffic—even from isolated threads or complex APIs—is routed securely through the proxy tunnel.

---

## 🌟 Key Features

### 🛡️ Runtime Stealth & Hardening
* **Native Code Spoofing**: Monkey-patches browser APIs (`fetch`, `WebSocket`) while overriding `.toString()` to lie about modifications, defeating anti-tamper checks.
* **Thread Isolation**: Uses a **"Blob Bootstrapper"** technique to inject proxy defenses into `WebWorker` and `SharedWorker` threads *before* they execute target code.
* **Service Worker Redundancy**: Dynamically generates a Service Worker to catch background requests. Includes an **Injector** to wrap third-party Service Workers with proxy defenses.
* **Advanced CSS Traps**: Intercepts modern vectors like the **CSS Typed OM** (`attributeStyleMap`) and the **Web Animations API** (`Element.animate`) to prevent leak-by-style.

### ⚡ High-Performance Core
* **Streaming HTML**: Uses Cloudflare's `HTMLRewriter` to sanitize standard attributes (`href`, `src`) with zero latency penalty.
* **Smart Caching**: Implements a secure Edge Cache that strips user sessions (Cookies) before caching static assets, reducing origin load without risking data leaks.
* **WebSocket Tunneling**: Full support for long-lived `wss://` connections via a compliant protocol handshake and raw pipelining.

### 🔒 Infrastructure Security
* **Session Scoping**: Automatically rewrites `Set-Cookie` domains to the proxy subdomain and enforces `Secure; SameSite=Lax`.
* **Leak Prevention**: Aggressively strips fingerprinting headers (`Accept-CH`), reporting channels (`Report-To`), and WebRTC capabilities.
* **Anti-Discovery**: All responses include `X-Robots-Tag: noindex` to prevent search engine indexing.

---

## 🚀 Deployment

This project is designed to run on **Cloudflare Workers**.

### Prerequisites
* A Cloudflare Account.
* [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed (`npm install -g wrangler`).
* A generic **Wildcard Domain** (e.g., `*.proxy.yourdomain.com`) pointed to your Worker.

### Quick Start

1.  **Clone the repository**
    ```bash
    git clone [https://github.com/divortio/divortio-proxio.git](https://github.com/divortio/divortio-proxio.git)
    cd divortio-proxio
    ```

2.  **Configure `wrangler.toml`**
    Update the `ROOT_DOMAIN` variable and route patterns to match your custom domain.
    ```toml
    # wrangler.toml
    [vars]
    ROOT_DOMAIN = "proxy.yourdomain.com"
    
    [[routes]]
    pattern = "*.proxy.yourdomain.com"
    custom_domain = true
    ```

3.  **Deploy**
    ```bash
    wrangler deploy
    ```

---

## ⚙️ Configuration

Configuration is managed via environment variables in `wrangler.toml`.

| Variable | Default | Description |
| :--- | :--- | :--- |
| `ROOT_DOMAIN` | *Required* | The base domain for the proxy. All rewritten URLs will be subdomains of this (e.g., `google-com.root.com`). |
| `CACHE_ENABLED` | `true` | Enables the secure Edge Cache for static assets. |
| `CACHE_TTL` | `3600` | Time-to-live (in seconds) for cached content. |
| `FEATURES_STEALTH_MODE` | `true` | Injects the client-side `interceptor.mjs` payload. |
| `FEATURES_SERVICE_WORKER` | `true` | Registers the redundancy Service Worker. |

For deep details on configuration logic, see [Configuration & Environment](./docs/configuration.md).

---

## 📚 Documentation

We maintain comprehensive documentation on the proxy's internal architecture and security model.

* **[Architecture & Entrypoint](./docs/worker-entrypoint.md)**: Request lifecycle and error handling.
* **[Feature Index](./docs/features/README.md)**: Detailed breakdown of all interception layers.
  * [Network Interception](./docs/features/network-interception.md) (Fetch, XHR, WebSocket)
  * [JavaScript Hardening](./docs/features/javascript-hardening.md) (Workers, Imports, JSON)
  * [DOM Sanitization](./docs/features/dom-sanitization.md) (HTML, XML, Attributes)
  * [CSS Transformation](./docs/features/css-transformation.md) (Stylesheets, Typed OM)
  * [Infrastructure Security](./docs/features/infrastructure-security.md) (Caching, headers)

---

## ⚠️ Disclaimer

This tool is intended for security research, high-fidelity testing, and privacy protection. It effectively bypasses many forms of censorship and surveillance. Users are responsible for complying with all applicable laws and regulations in their jurisdiction.