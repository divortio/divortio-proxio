# Divortio Worker Proxy

![Proxy Banner](https://user-images.githubusercontent.com/810438/153383033-52474419-f5d6-4128-8692-126211504561.png)

A comprehensive, stealthy, and high-performance web proxy built on Cloudflare Workers. This project is designed for two
primary use cases:

* **🕵️‍♂️ High-Fidelity Testing**: Use the proxy to test websites from a clean IP address while faithfully preserving
  the real browser's fingerprint. Ideal for QA, development, and interacting with services that have advanced bot
  detection.
* **🛡️ Secure & Private Browsing**: Use the proxy in emulation mode to mask your real browser identity, prevent
  tracking, and disable privacy-leaking web features like WebRTC.

This is not just a simple proxy; it's a powerful transformation engine running at the edge.

***

## ✨ Features

This worker is built with a production-ready, modular architecture and includes a comprehensive set of features to
ensure it is both powerful and difficult to detect.

### Core Architecture

* **Modular & Extensible**: Logic is decoupled into separate modules for easy maintenance and
  extension (`request-handler`, `rewriters`, `browser-profiles`, etc.).
* **Configuration Driven**: All behavior is controlled via environment variables in `wrangler.toml`, keeping the code
  clean and portable.
* **High Performance**: Leverages Cloudflare's Cache API for static assets and streams content whenever possible to
  reduce latency and CPU usage.

### Identity & Fingerprinting

* **Two Identity Modes**: Supports both a high-fidelity "Passthrough" mode and a privacy-focused "Emulation" mode,
  configurable in `wrangler.toml`.
* **Session Persistence**: Emulated profiles are persisted for the duration of a session using a secure cookie, ensuring
  a consistent fingerprint.
* **Realistic Profile Library**: Includes a library of the latest, most realistic browser profiles, complete with "
  Client Hints" (`sec-ch-*`) and "Fetch Metadata" (`sec-fetch-*`) headers.

### Security & Leak Prevention

* **Stealthy JavaScript Interception**: Injects a script to wrap `fetch()` and `navigator.sendBeacon()` in all
  JavaScript contexts, including **Service Workers** and **Web Workers**.
* **WebRTC IP Leak Prevention**: Actively disables WebRTC APIs in the browser to prevent your real IP address from being
  exposed.
* **Comprehensive Content Rewriting**: Rewrites URLs in all relevant content types, including HTML (with `srcset`
  and `ping` attributes), CSS, JavaScript, SVG, and XML/RSS feeds.
* **Full Session Integrity**: Correctly rewrites `Set-Cookie` headers, `Location` redirects, and transparently
  proxies **WebSocket** connections.
* **Header Sanitization**: Surgically strips privacy-leaking directives like `preconnect` and `dns-prefetch` from
  HTTP `Link` headers.

***

## 🚀 Deployment Workflow

This project is designed to be deployed using **Cloudflare's Git integration**.

1. **Fork the Repository**: Start by forking the `divortio/divortio-proxio` repository on GitHub to your own
   account.
2. **Configure `wrangler.toml`**: Clone your forked repository and modify the `wrangler.toml` file. At a minimum, you
   must set your `account_id` and define your `[[routes]]` with a wildcard custom domain.
3. **Push to Your Repository**: Commit and push the changes to your repository.
4. **Connect to Cloudflare**: In the Cloudflare dashboard, create a new Worker and connect it to your forked GitHub
   repository. Cloudflare will automatically pull the code, run the `npm run deploy` script, and deploy your worker.

### Prerequisite: Custom Domain Setup in `wrangler.toml`

This proxy's secure, subdomain-based architecture requires a **wildcard custom domain**. The correct way to configure
this is by defining `routes` in your `wrangler.toml` file. When you deploy, Cloudflare will automatically create and
manage the necessary DNS records and SSL certificates for you.

You must add **two** `[[routes]]` entries: one for the root domain (to serve a potential homepage) and one for the
wildcard subdomain (to handle the proxy requests).

**Example `wrangler.toml` configuration:**

```toml
# ... (other wrangler.toml settings)

[[routes]]
pattern = "proxy.example.com"
custom_domain = true

[[routes]]
pattern = "*.proxy.example.com"
custom_domain = true
```

## ⚙️ Configuration

All configuration is managed in the `wrangler.toml` file within the `[vars]` section.

```toml
[vars]
# The root domain of the proxy. This MUST match the non-wildcard custom domain pattern.
ROOT_DOMAIN = "proxy.example.com"

# The browser fingerprinting strategy: "passthrough", "random", or a specific
# profile key from browser-profiles.mjs (e.g., "windows_chrome").
EMULATION_STRATEGY = "passthrough"

# ... (other configuration variables)
```

## Comprehensive Rewrite Coverage

The proxy employs a multi-layered rewriting and sanitization strategy to ensure no requests leak to the origin and the
client's privacy is protected. Here is a detailed breakdown of what is rewritten:

| Category | Case / Element | Description | Handled By |
| :--- | :--- | :--- | :--- |
| **HTML Content** | | | |
| | `a[href]`, `script[src]`, `iframe[src]`, etc. | Rewrites standard URL-holding attributes on most common HTML tags. | `Rewriters.AttributeRewriter` |
| | `img[srcset]`, `source[srcset]` | Parses and rewrites each individual URL within the complex `srcset` attribute. | `Rewriters.SrcsetRewriter` |
| | `a[ping]` | Rewrites the URL in the `ping` attribute to prevent tracking leaks. | `Rewriters.AttributeRewriter` |
| **Other Content** | | | |
| | CSS (`text/css`) | Rewrites `url()` paths and `@import` rules found in stylesheets. | `Rewriters.rewriteCSS` |
| | SVG (`image/svg+xml`) | Treats SVG files as documents, rewriting any embedded URLs, links, or styles. | `Rewriters.getHtmlRewriter` |
| | XML/RSS (`application/xml`, etc.) | Performs a best-effort rewrite of URLs in common tags within XML/RSS feeds. | `Rewriters.rewriteXML` |
| | JSON Manifests (`application/manifest+json`) | Recursively finds and rewrites any value that is a full or relative URL. | `Rewriters.rewriteUrlsInJson`|
| **HTTP Headers** | | | |
| | `Location` | Rewrites redirect URLs to keep the user within the proxied session. | `Rewriters.rewriteResponse` |
| | `Set-Cookie` | Rewrites the `Domain` of cookies to the unique proxied subdomain for perfect isolation. | `Rewriters.rewriteSetCookieHeader`|
| | `Link` | Parses the header and surgically strips privacy-leaking `preconnect` and `dns-prefetch` directives. | `Rewriters.rewriteLinkHeader` |
| | `Content-Security-Policy` | Deletes the CSP header to prevent it from blocking the proxy's own scripts and modifications. | `Rewriters.rewriteResponse` |
| **JavaScript Runtime**| | | |
| | `fetch()` | Wraps the global `fetch` API to intercept and proxy dynamic requests from any script context. | `Rewriters.getStealthInterceptorScript` |
| | `navigator.sendBeacon()` | Wraps the `sendBeacon` API to intercept and proxy analytics requests. | `Rewriters.getStealthInterceptorScript` |
| | `WebSocket()` | Wraps the `WebSocket` constructor to intercept and proxy dynamically created socket connections. | `Rewriters.getStealthInterceptorScript` |
| | WebRTC | Disables the `RTCPeerConnection` API to prevent IP address leaks. | `Rewriters.getStealthInterceptorScript` |

# How to Use the Divortio Proxio Auth Module

This document outlines three distinct patterns for integrating the self-contained authentication module into any
Cloudflare Worker project. Choose the pattern that best fits your application's complexity and routing needs.

***

## Pattern 1: The All-in-One Handler (Recommended)

This is the simplest and most convenient approach. You import a single "handler factory" function, give it your
application logic and configuration, and it returns a complete, protected `fetch` handler that manages all API routes,
UI redirects, and security.

**Best for**: New projects or any project where you want a complete, standard authentication flow without writing any
boilerplate.

### Example `worker.mjs`

```javascript
import { createAuthHandler } from './auth/router.mjs';
import { myAppLogic } from './app.mjs'; // This is your main application logic
import { createConfig } from './config.mjs';

/**
 * The final, complete fetch handler for the worker. It is constructed once by
 * passing the main application logic and config into the auth handler factory.
 */
async function getMasterHandler(env) {
    const config = createConfig(env);
    return createAuthHandler(myAppLogic, {
      // Pass in all the required configuration primitives.
      userEnabled: config.auth.userEnabled,
      agentEnabled: config.auth.agentEnabled,
      jwtSecret: config.auth.jwtSecret,
      sessionTimeout: config.auth.sessionTimeout,
      loginApiPath: config.auth.loginApiPath,
      logoutApiPath: config.auth.logoutApiPath,
      loginUrlPath: config.auth.loginUrlPath,
      loginAssetPath: config.auth.loginAssetPath,
      authRedirectPath: config.auth.authRedirectPath,
      authTokenName: config.auth.authTokenName,
      agentHeaderName: config.auth.agentHeaderName,
      issuer: config.auth.jwtIssuer,
      audience: config.auth.jwtAudience,
    });
}

export default {
  /**
   * The fetch handler for the worker.
   */
  async fetch(request, env, ctx) {
    const masterHandler = await getMasterHandler(env);
    return masterHandler(request, env, ctx).catch(err => new Response(err.stack, { status: 500 }));
  }
};
```

### Pattern 2: The "À La Carte" Middleware

This pattern gives a developer more control over the routing logic in their `worker.mjs`. You import the API route
handler and the security middleware separately, allowing you to build a custom routing flow.

**Best for**: Projects that already have a complex routing system and need to integrate authentication into it.

#### Example `worker.mjs`

```javascript
import { handleAuthRoutes } from './auth/router.mjs';
import { createAuthMiddleware } from './auth/core.mjs';
import { myAppLogic } from './app.mjs';
import { createConfig } from './config.mjs';

export default {
  /**
   * The fetch handler for the worker, with custom routing.
   */
  async fetch(request, env, ctx) {
    const config = createConfig(env);
    const url = new URL(request.url);

    // 1. You build your own router. Check for auth API routes first.
    if (config.auth.userEnabled) {
      const authApiResponse = await handleAuthRoutes(request, config.auth);
      if (authApiResponse) {
        return authApiResponse;
      }
    }

    // 2. Add your own custom routes.
    if (url.pathname.startsWith('/my-custom-api')) {
      return new Response("Custom API response");
    }
    
    // 3. You handle your own static asset logic for the login page.
    if (url.pathname === '/login') {
        // ... logic to serve login page ...
    }

    // 4. Protect your main application logic using the middleware.
    const protectedApp = createAuthMiddleware(myAppLogic, {
        userEnabled: config.auth.userEnabled,
        agentEnabled: config.auth.agentEnabled,
        jwtSecret: config.auth.jwtSecret,
        authTokenName: config.auth.authTokenName,
        agentHeaderName: config.auth.agentHeaderName,
        issuer: config.auth.jwtIssuer,
        audience: config.auth.jwtAudience,
    });

    // 5. Fallback to the protected application for all other requests.
    return protectedApp(request, env, ctx);
  }
};
```

### Pattern 3: Manual Validation (Advanced)

This pattern provides the absolute maximum level of control. It requires modifying the auth module to export its
internal validation functions, allowing you to manually protect specific routes.

**Best for**: Highly specialized applications that need to protect different routes with different rules or claims.

#### Example `worker.mjs`

```javascript
// Prerequisite: Modify `src/auth/core.mjs` to export the internal `_jwt.validateJwt` function.
// For example: export const { validateJwt } = _jwt;
import { validateJwt } from './auth/core.mjs';
import { createConfig } from './config.mjs';

export default {
  /**
   * The fetch handler for the worker, with manual validation.
   */
  async fetch(request, env, ctx) {
    const config = createConfig(env);
    const url = new URL(request.url);

    if (url.pathname.startsWith('/some/protected/path')) {
      // Manually call the validation function with the required parameters.
      const payload = await validateJwt(
        request,
        config.auth.jwtSecret,
        config.auth.authTokenName,
        config.auth.jwtIssuer,
        config.auth.jwtAudience
      );
      
      if (!payload) {
        return new Response("Access Denied to this specific path.", { status: 403 });
      }
      
      // User is authorized for this path, proceed with your logic.
      // You can even check claims: if (payload.custom_claim === 'special_access') { ... }
    }
    
    return new Response("Public content");
  }
};
```




