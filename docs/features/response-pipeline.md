# Response Processing Pipeline

This module details the orchestration logic that determines how an upstream response is handled. It acts as the central traffic controller, delegating specific content types to their respective rewriters and enforcing global security rules.

## 1. Status Code Optimizations
**Source:** [`src/rewrite/response.mjs`]

Before processing the body, we check the HTTP status code to avoid unnecessary parsing overhead and potential errors with empty bodies.

* **304 (Not Modified) / 204 (No Content)**: These responses have no body. We immediately:
    1.  Sanitize Headers (Strip `Alt-Svc`, `Keep-Alive`, etc.).
    2.  Rewrite `Location` header (if present).
    3.  **Return Early**: The body is passed through untouched (as it is empty or irrelevant), skipping HTML/JS parsing.
* **3xx (Redirection)**: Handled similarly to 304/204 to ensure redirects are rewritten without attempting to parse a potential 0-byte body.

## 2. Global Header Standardization
**Source:** [`src/rewrite/response.mjs`]

Every response, regardless of content type, undergoes a mandatory header phase.

1.  **Sanitization**: `sanitizeHeaders()` is called to strip leak vectors.
2.  **Cookie Injection**: If the worker needs to set a session cookie (e.g., for auth), it is appended here.
3.  **Security Rewrites**: `Set-Cookie`, `Link`, `Location`, `CORS`, and `CSP` are rewritten.

## 3. Content-Type Delegation
**Source:** [`src/rewrite/response.mjs`]

The pipeline inspects the `Content-Type` header to determine which rewriter to use. This explicitly defines the scope of our deep content inspection.

| Priority | Content Type Match | Handler |
| :--- | :--- | :--- |
| **1** | `text/html` | **HTML Rewriter** (Streaming) |
| **2** | `javascript`, `application/x-javascript` | **JS Rewriter** (Regex & Import Hooks) |
| **3** | `text/css` | **CSS Rewriter** (Parser) |
| **4** | `application/json`, `application/manifest+json` | **JSON Walker** (Recursive) |
| **5** | `xml` | **XML Rewriter** (Regex) |

## 4. Special Case Handling
**Source:** [`src/rewrite/response.mjs`]

* **PDF Forcing**: If `Content-Type` is `application/pdf`, we force `Content-Disposition: attachment`.
    * **Why**: Rendering PDFs in the browser (via plugins like PDF.js or native viewers) often bypasses the proxy for internal links or resource fetching. Forcing a download eliminates this risk.

## 5. Fallback Behavior (Passthrough)
**Source:** [`src/rewrite/response.mjs`]

* **Default Action**: If the content type does not match any of the above (e.g., `image/png`, `application/zip`, `font/woff2`), the response body is returned **untouched**.
* **Risk Note**: This assumes that unknown content types do not contain executable code or absolute URLs that could leak the client's IP. Headers are still sanitized.