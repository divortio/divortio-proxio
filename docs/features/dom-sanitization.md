# DOM Sanitization & HTML Rewriting
This module ensures that the document structure itself is safe.

## 1. Operational Strategy
**Source:** [`src/rewrite/handlers/html.mjs`] & [`src/rewrite/handlers/xml.mjs`]

We employ two distinct strategies for processing document markup, optimized for the specific content type.

| Content Type | Strategy | Implementation Details |
| :--- | :--- | :--- |
| **HTML** | **Streaming** | Uses Cloudflare's `HTMLRewriter` to transform the response body chunk-by-chunk as it passes through the Worker. **Benefit:** Zero latency penalty; the first byte reaches the client immediately. |
| **XML / RSS** | **Buffered** | The entire response body is buffered into memory (`response.text()`) before processing. **Reason:** Regex-based rewriting requires the full context to be safe. **Note:** Large XML feeds may impact Worker memory limits. |

## 2. Interceptor Injection
**Source:** [`src/rewrite/rewriters/html.mjs`]

Before any content is rewritten, the proxy injects the necessary runtime configuration into the `<head>` of the document.
We use Cloudflare's `HTMLRewriter` to modify the HTML stream on the fly. This covers standard navigational attributes and resource loading.

| Category | Elements & Attributes |
| :--- | :--- |
| **Links & Navigation** | `a[href]`, `area[href]`, `link[href]`, `base[href]`. <br> **Privacy**: `a[ping]` is also rewritten to prevent tracking leaks. |
| **Resources** | `img`, `script`, `iframe`, `embed`, `source`, `track`, `video`, `audio`, `input[type="image"]`. <br> **Attributes**: `src` is rewritten. |
| **Forms** | `form[action]`, `button[formaction]`, `input[formaction]`. Ensures form submissions route through the proxy. |
| **Legacy & Plugins** | `object[data]`, `object[codebase]`, `object[archive]`, `applet[codebase]`, `applet[archive]`, `body[background]`. |
| **Metadata** | `blockquote[cite]`, `del[cite]`, `ins[cite]`, `q[cite]`. <br> `html[manifest]` (Application Cache). |
| **Frames** | `frame[src]`, `iframe[longdesc]`, `frame[longdesc]`. |
## 3. Standard Attribute Logic
**Source:** [`src/rewrite/rewriters/attributes/attribute.mjs`]

| Feature | Implementation Details |
| :--- | :--- |
| **URL Rewriting** | Attributes (`href`, `src`, etc.) are resolved against the base URL. If the resulting absolute URL is not on the proxy domain, it is rewritten. |
| **Exclusions** | `data:` URIs are ignored to preserve inline assets. |
| **JS Sanitization** | **Security Feature**: If an attribute starts with `javascript:`, the rewriter inspects the code. It uses a regex to neutralize `location=...` assignments (replacing them with `location='#'`) to prevent scripts from navigating the window away from the proxy. |

## 4. Specialized Attribute Parsing
| Feature | Description | Source |
| :--- | :--- | :--- |
| **Responsive Images** | Parses `srcset` (e.g., `img.jpg 400w, img2.jpg 2x`). Splits the string and rewrites each URL individually. | [`srcset.mjs`] |
| **Meta Refresh** | Detects `<meta http-equiv="refresh" content="0;url=...">` and rewrites the redirect URL. | [`metaURL.mjs`] |
| **Social Metadata** | Rewrites `og:image`, `og:url`, `twitter:image`, and `twitter:url`. Uses a heuristic (checks for `http`/`/` prefix) to identify URLs in opaque content strings. | [`metaURL.mjs`] |
| **Inline Styles** | Hooks `style="..."` attributes and passes the content to the CSS rewriter. | [`inlineStyle.mjs`] |
## 5. XML & Feed Transformation
**Source:** [`src/rewrite/rewriters/mimeType/xml.mjs`]

We use a regex-based replacement engine to handle non-HTML XML documents.

* **XSLT Stylesheets**: `<?xml-stylesheet ... href="...">`.
* **RSS / Atom**: `<link>`, `<enclosure>`, `<media:content>`.
* **Sitemaps**: `<loc>`, `<image:loc>`.

## 6. Client-Side DOM Traps
To catch dynamically created elements, we trap DOM mutations in the browser.

| Feature | Description | Source |
| :--- | :--- | :--- |
| **Attribute Trap** | Overrides `Element.prototype.setAttribute`. Captures 20+ unsafe attributes. | [`interceptor.mjs`](../../src/templates/interceptor.mjs) |
| **Property Trap** | Hooks setters for properties like `Image.src`, `Anchor.href`, `Form.action`. | [`interceptor.mjs`](../../src/templates/interceptor.mjs) |
| **HTML Injection** | Traps `innerHTML`, `outerHTML`, and `document.write`. | [`interceptor.mjs`](../../src/templates/interceptor.mjs) |