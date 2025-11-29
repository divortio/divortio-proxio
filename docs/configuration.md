

### 2. `docs/configuration.md`

```markdown
# Configuration & Environment

This module details how Divortio Proxio loads, validates, and normalizes configuration from the Cloudflare Worker environment.

## 1. Configuration Logic
**Source:** [`src/config/index.mjs`]

The configuration loader uses a resilient parsing strategy to handle environment variables that may be passed as strings, numbers, or JSON.

```mermaid
flowchart LR
    Start([Start Load]) --> ValidDomain{ROOT_DOMAIN<br>Exists?}
    
    ValidDomain -->|No| Error[Throw Config Error]
    ValidDomain -->|Yes| ParseCache[Parse Cache Config]
    
    ParseCache --> CacheTypes{CACHEABLE_TYPES<br>Valid JSON?}
    
    CacheTypes -->|Yes| UseJson[Use Parsed Array]
    CacheTypes -->|No| UseDefault[Use Default MIME List]
    
    UseJson --> ParseBool[Parse Boolean Flags]
    UseDefault --> ParseBool
    
    ParseBool --> FinalConfig[Return AppConfig]
````

## 2\. Environment Variables Logic

The loader processes the following variables with specific normalization rules:

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| **ROOT\_DOMAIN** | **Yes** | *None* | The root domain of the proxy. If missing, the worker throws a startup error. |
| **CACHE\_ENABLED** | No | `true` | Master switch for the Edge Cache. Defaults to enabled if omitted. |
| **CACHE\_TTL** | No | `3600` | Time-to-live for cached assets in seconds (1 hour). |
| **CACHEABLE\_TYPES**| No | *Defaults* | A JSON array of MIME types allowed to be cached. |
| **FEATURES\_**\* | No | `true` | Feature flags (Stealth Mode, Service Worker) default to true if undefined. |

### Boolean Normalization

To prevent configuration errors from the Cloudflare Dashboard (where variables are often strings), we use the `isTrue` helper:

* `"true"`, `"1"`, `"on"` $\rightarrow$ `true`
* `true` (boolean), `1` (number) $\rightarrow$ `true`
* Everything else $\rightarrow$ `false`.
