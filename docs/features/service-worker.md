# Service Worker Redundancy

To ensure "High Fidelity" coverage, Divortio Proxio generates and installs a Service Worker on the client. This acts as a secondary network interception layer, sitting between the browser's network stack and the internet.


## 1. Runtime Generation
**Source:** [`src/templates/service-worker.js`]

Unlike standard static Service Workers, our worker script is generated dynamically by the Cloudflare Worker at runtime.

* **Dynamic Configuration**: The function `getServiceWorkerCode(rootDomain)` takes the current proxy root domain and "bakes" it directly into the JavaScript source as a constant (`const PROXY_ROOT_DOMAIN = ...`).
* **Security**: This prevents the need for the Service Worker to fetch a separate configuration file, which could be blocked or spoofed.

## 2. Immediate Activation
**Source:** [`src/templates/service-worker.js`]

The Service Worker is designed to take control of the page as fast as possible to prevent leaks during the initial load or navigation.

* **Install Phase**: Calls `self.skipWaiting()` immediately, forcing the waiting service worker to become the active service worker.
* **Activate Phase**: Calls `self.clients.claim()`. This allows the worker to control all open clients (tabs) immediately without requiring a page reload.

## 3. Network Interception Logic
**Source:** [`src/templates/service-worker.js`]

The worker listens for the `fetch` event and applies a specific routing decision tree to every request.

| Step | Logic | Implementation Details |
| :--- | :--- | :--- |
| **1. Check Domain** | **Passthrough** | If the request URL's hostname already ends with the `PROXY_ROOT_DOMAIN`, the request is allowed to proceed untouched. This prevents "double-proxying" loops. |
| **2. Check Protocol** | **Passthrough** | Requests to `localhost`, `data:` URIs (Base64), and `blob:` URIs are ignored. These are local resources that do not leak IP addresses to the network. |
| **3. Rewrite** | **Proxy** | If the request does not match the above, it is deemed an "escape attempt."<br>1. The target hostname is appended to the proxy root (e.g., `google.com` -> `google.com.proxy.com`).<br>2. A `new Request` object is created, cloning the original body, headers, credentials, and mode.<br>3. The `redirect` mode is set to `'manual'` to allow the proxy to handle 3xx responses. |

## 4. Why This Matters
Some modern browser APIs—such as `fetch()` called inside a Web Worker, third-party libraries using deeply nested iframes, or specific tag attributes—can sometimes bypass the main window's `Function.prototype` overrides (the "Interceptor"). The Service Worker guarantees that **all** traffic controlled by the scope is routed through the proxy, regardless of how the request was initiated.