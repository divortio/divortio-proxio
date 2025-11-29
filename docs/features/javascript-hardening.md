# JavaScript Hardening & Execution Control

Modern web applications load resources dynamically. This module ensures that executable code, imports, data structures, and isolated threads are sanitized to prevent IP leaks.

## 1. Dynamic Imports & Modules
**Source:** [`src/rewrite/handlers/javascript.mjs`] & [`src/rewrite/rewriters/attributes/importMap.mjs`]

We intercept mechanisms that load code at runtime to ensure all dependencies are fetched through the proxy.

| Feature | Description | Implementation Details |
| :--- | :--- | :--- |
| **Dynamic Import** | **Hook** | `import('./mod.js')` statements are rewritten server-side to `import(self.__d_rw('./mod.js'))`. The `__d_rw` function is a global helper exposed by our interceptor that rewrites the URL at runtime. |
| **Import Maps** | **Rewrite** | Parses JSON content inside `<script type="importmap">`. It recursively rewrites:<br>1. **Imports**: Value URLs in the `imports` map.<br>2. **Scopes**: Both the scope key (URL prefix) and the values inside it. |
| **Speculation Rules**| **Rewrite** | Parses `<script type="speculationrules">` (Chrome API) to rewrite prefetch/prerender URLs using our central JSON walker. |

## 2. Data Structure Sanitization
**Source:** [`src/rewrite/handlers/json.mjs`] & [`src/templates/interceptor.mjs`]

We sanitize data objects (JSON, History State) that might contain URLs used for future requests.

* **JSON Response Walker**: Recursively walks `application/json` responses. If a string value starts with `http` and points to an external domain, it is rewritten. Includes cycle detection (`WeakSet`) to prevent infinite recursion.
* **History API**: Traps `history.pushState` and `replaceState`. Recursively walks the state object to rewrite URLs, ensuring that if the application reloads from this state, it requests proxied URLs.
* **Messaging**: Traps `postMessage` on `BroadcastChannel` and `iframe.contentWindow`. Rewrites URLs in message payloads to prevent cross-origin contamination between the proxy frame and others.

## 3. Worker & Thread Isolation (Patched)
**Source:** [`src/templates/interceptor.mjs`] & [`src/handle/handlers/asset.mjs`]

Web Workers and Service Workers run in isolated threads with their own global scope. We employ aggressive trapping to ensure these contexts cannot bypass the proxy.

| Feature | Action | Implementation Details |
| :--- | :--- | :--- |
| **Worker Bootstrapper** | **Wrap** | **The "Blob" Technique**: When `new Worker(url)` is called, we intercept it. We create a dynamic `Blob` script that:<br>1. Imports our `interceptor.mjs` first.<br>2. Imports the original target script.<br>This forces the new thread to be "infected" with our traps before it executes a single line of code. |
| **Service Worker Injector** | **Redirect** | **The "Injector" Technique**: Traps `navigator.serviceWorker.register(url)`. Instead of registering the raw URL, we redirect the registration to `/__divortio_sw_injector.js?target=url`. This server-side endpoint generates a wrapper script that loads our interceptor before the target SW. |
| **Import Scripts** | **Trap** | Wraps `self.importScripts` (used inside workers) to rewrite all loaded dependencies. |

## 4. Execution Prevention
**Source:** [`src/templates/interceptor.mjs`] & [`src/rewrite/rewriters/html.mjs`]

We explicitly disable browser features that are inherently unsafe for proxying or that would break due to our modifications.

| Feature | Action | Rationale |
| :--- | :--- | :--- |
| **WebRTC Killswitch**| **Delete** | Explicitly sets `RTCPeerConnection`, `webkitRTCPeerConnection`, `mozRTCPeerConnection`, and `WebTransport` to `undefined`. This prevents STUN/TURN requests from leaking the real IP. |
| **Integrity Stripping**| **Remove** | **Server-Side**: Removes `integrity` attributes from `<script>` and `<link>` tags.<br>**Client-Side**: Traps the `integrity` property on DOM elements to prevent scripts from setting it.<br>**Why**: Our proxy modifies content (rewriting URLs), which invalidates the original SHA hash. |