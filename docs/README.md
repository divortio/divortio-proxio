# Divortio Proxio Documentation

Welcome to the technical documentation for **Divortio Proxio**, a high-fidelity, stealth-oriented web proxy built on Cloudflare Workers.

This documentation covers the architecture, security model, and configuration of the proxy engine.

## 1. Getting Started
*Core operational guides for deploying and running the worker.*

* **[Configuration & Environment](./configuration.md)**
    * Explains `wrangler.toml` settings, environment variables, and the config loader logic.
* **[Worker Entrypoint](./worker-entrypoint.md)**
    * Details the request lifecycle, middleware composition, and global error handling strategies.

## 2. Feature Specifications
*Detailed technical breakdowns of the proxy's interception capabilities.*

* **[Feature Index (Detailed)](./features/README.md)**
    * The master list of all rewriting capabilities, organized by layer:
    * **Network**: Request/Response headers, Service Workers, WebSocket tunneling.
    * **Content**: HTML/XML sanitization, CSS transformation, Pipeline orchestration.
    * **Runtime**: JavaScript hardening, Thread isolation (Workers), Anti-fingerprinting.
    * **Infrastructure**: Caching security, Error masking, Internal asset protection.

## 3. Security Model
*Understanding the threat model and current limitations.*

* **[Known Gaps & Mitigations](./known-gaps.md)**
    * A transparency log of known architectural limitations (e.g., specific browser APIs) and the status of their mitigations (e.g., "Blob Bootstrapper" for Workers).

---

### Quick Links
* [Project Source Code](../src/)
* [Deployment Guide](../README.md) (Root README)