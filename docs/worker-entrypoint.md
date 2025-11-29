
# Cloudflare Worker Entry Point

This module details the request lifecycle at the very edge of the network. `worker.mjs` serves as the primary entry point for the Cloudflare Worker runtime.

## 1. Request Lifecycle
**Source:** [`src/worker.mjs`]

The entry point is designed to be minimal, focusing on middleware composition rather than business logic.

1.  **Incoming Request**: The standard `fetch(request, env, ctx)` handler is triggered by Cloudflare.
2.  **Global Error Handling**: The entire execution chain is wrapped in `ErrorMiddleware.wrap()`. This ensures that *any* unhandled exception occurring during request processing (DNS errors, parsing failures, timeouts) is caught and transformed into a safe, generic JSON error response, preventing stack trace leaks.
3.  **Proxy Handoff**: Inside the error wrapper, the request is passed directly to `handleRequest` logic defined in `src/handle/request.mjs`.

### High-Level Architecture


```mermaid
flowchart TD
    User([User Request]) --> Access[Cloudflare Access<br>Zero Trust Auth]
    Access -->|Authenticated| Worker[worker.mjs]
    
    subgraph "Worker Runtime"
        Worker --> Middleware[ErrorMiddleware.wrap]
        
        subgraph "Safe Execution Context"
            Middleware --> Handler[handleRequest]
            Handler --> Asset{Asset Check}
            Asset -->|Yes| Static[Serve Asset]
            Asset -->|No| Cache{Cache Check}
            
            Cache -->|Hit| ReturnCache[Return Cached Response]
            Cache -->|Miss| Resolve[Target Resolution]
            
            Resolve -->|Success| Fetch[Fetch Upstream]
            Resolve -->|Fail| 404[Return 404]
            
            Fetch --> Rewrite[Rewrite Response]
        end
        
        Rewrite --> Output([Final Response])
        Static --> Output
        ReturnCache --> Output
        404 --> Output
        
        Middleware -.->|Exception Caught| Error500[JSON 500 Error]
    end
    
    Error500 --> Output
````

## 2\. Error Handling Wrapper

**Source:** [`src/middleware/error-handler.mjs`]

The `ErrorMiddleware` acts as a safety net. It intercepts exceptions thrown anywhere in the `Safe Execution Context` (see diagram above).

### Sequence of Events

```mermaid
sequenceDiagram
    participant Cloudflare
    participant Worker as worker.mjs
    participant Middleware as ErrorMiddleware
    participant Handler as handleRequest

    Cloudflare->>Worker: fetch(request)
    Worker->>Middleware: wrap(async () => ...)
    activate Middleware
    
    Middleware->>Handler: execute()
    activate Handler
    
    alt Successful Request
        Handler-->>Middleware: Response (200 OK)
        Middleware-->>Worker: Response (200 OK)
    else Runtime Exception (e.g. DNS Error)
        Handler--xMiddleware: Throw Error!
        deactivate Handler
        
        Middleware->>Middleware: Catch Error
        Middleware->>Middleware: Log to Console
        Middleware-->>Worker: Response (500 JSON)
    end
    
    deactivate Middleware
    Worker-->>Cloudflare: Final Response
```

<!-- end list -->

```
```