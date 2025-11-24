/**
 * @file Cloudflare Worker Entry Point
 * @description Composes middleware and routes traffic.
 */


import { handleRequest } from './handle/request.mjs';
import { ErrorMiddleware } from './middleware/error-handler.mjs';

export default {
    async fetch(request, env, ctx) {
        // 1. Global Error Handling
        return ErrorMiddleware.wrap(async () => {
            // 2. Hand off to the HTTP Proxy Handler directly
            // (Authentication is now handled by Cloudflare Access at the edge)
            return handleRequest(request, env, ctx);
        });
    }
};