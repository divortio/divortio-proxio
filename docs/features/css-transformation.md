# CSS Transformation

CSS is a common vector for background requests (images, fonts). We employ a dedicated parser to handle complex CSS syntax.

## 1. Handler Operations
**Source:** [`src/rewrite/handlers/css.mjs`]

* **Buffering**: CSS files are buffered entirely into memory (`response.text()`). This is required because regex replacements for `@import` or `url()` might span across chunk boundaries in a stream.
* **Recalculation**: The `Content-Length` header is updated to reflect the size of the rewritten CSS.

## 2. Stylesheet Rewriting
**Source:** [`src/rewrite/rewriters/mimeType/css.mjs`]


| API | Trap Strategy |
| :--- | :--- |
| **CSS Typed OM** | **`attributeStyleMap`**: We define a getter on `Element.prototype.attributeStyleMap`. When accessed, we wrap the `.set()` method of the returned map. If a script sets a value containing `url(...)`, it is rewritten before the browser engine processes it. |
| **Web Animations** | **`Element.animate()`**: We wrap the native animation API. The interceptor iterates through the keyframes (whether Array-based or Object-based), identifies properties with URL values (like `backgroundImage`), and rewrites them before passing the keyframes to the native renderer. | `url(...)` values. | **Exclusions:** `data:` URIs and `chrome-extension:` URLs are explicitly ignored and left untouched to prevent breakage. |
| **Import Handling** | Parses `@import` rules. | Supports both quoted strings (`@import "..."`) and functional notation (`@import url(...)`). |
| **Image Sets** | Parses `image-set(...)`. | Rewrites nested URLs used for high-DPI responsive images. |
| **Source Maps** | Strips comments. | Removes `/*# sourceMappingURL=... */` to prevent browser devtools from making direct requests to map files. |

## 2. Inline & Runtime CSS
| Feature | Description | Source |
| :--- | :--- | :--- |
| **Inline Styles** | Hooks elements with `style="..."`. | Passes the content through the central CSS rewriter. |
| **CSS OM Traps** | Traps `CSSStyleDeclaration.setProperty`. | Rewrites URLs before they are applied to the render tree. |
| **Style Properties**| Traps `div.style.backgroundImage`. | Intercepts direct property assignments in JS. |