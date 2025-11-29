# Network Interception (Client-Side)

This module details the "Stealth Interceptor" injected into the browser runtime to capture requests that bypass standard HTML attributes.

## 1. The Global Fetch Trap
**Source:** [`src/templates/interceptor.mjs`]
* **Mechanism:** Monkey-patches `window.fetch`.
* **Leak Prevention:**
    * Rewrites the input URL (string or Request object) to point to the proxy.
    * **Integrity Stripping**: Automatically deletes `integrity` checks from the init object to prevent Subresource Integrity (SRI) failures caused by our content rewriting.
## 2. Server-Side Request Handling
**Source:** [`src/handle/request.mjs`] & [`src/handle/handlers/websocket.mjs`]

Logic applied at the edge (Cloudflare Worker) to masquerade the request.

| Feature | Description | Prevention |
| :--- | :--- | :--- |
| **Identity Spoofing** | Rewrites `Referer` and `Origin` headers to match the upstream target. | `[Origin Leak]` |
| **Header Sanitization** | Strips `CF-Connecting-IP`, `X-Forwarded-For`, and other proxy-identifying headers. | `[IP Leak]` |
| **WebSocket Tunneling**| **Source:** [`src/handle/handlers/websocket.mjs`]<br>**1. Handshake**: The worker connects to the upstream target with `Upgrade: websocket`.<br>**2. Validation**: Strictly checks that the upstream responds with status `101 Switching Protocols`. If not, the connection is closed with code `1002` (Protocol Error).<br>**3. Pipelining**: Establishes a raw message pipe between the client and the target using `WebSocketPair`. | `[Functionality]` |


## 3. WebSocket Tunneling
**Source:** [`src/templates/interceptor.mjs`] & [`src/handle/handlers/websocket.mjs`]
* **Client Trap**: Wraps the `WebSocket` constructor to rewrite `ws://target` to `ws://proxy`.
* **Server Tunnel**: The Worker handles the `Upgrade` header, establishing a long-lived streaming tunnel between the client and the upstream target.

## 4. WebRTC Killswitch
**Source:** [`src/templates/interceptor.mjs`]
* **Feature**: Explicitly sets `RTCPeerConnection`, `webkitRTCPeerConnection`, and `mozRTCPeerConnection` to `undefined`.
* **Risk Covered**: **Critical IP Leak**. Prevents STUN/TURN requests from bypassing the proxy and revealing the user's real IP address.