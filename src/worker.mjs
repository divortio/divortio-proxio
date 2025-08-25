/**
 * @file Cloudflare Worker Entry Point
 * @version 7.0.0
 * @see {@link ./request-handler.mjs} for the core proxy application logic.
 * @see {@link ./auth/router.mjs} for the pluggable authentication handler.
 *
 * @description
 * This file serves as the main entry point for the Divortio Worker Proxy.
 * It follows a modern, declarative "middleware" pattern to construct the final application.
 *
 * Its responsibilities are:
 * 1.  Import the core application logic (`RequestHandler`).
 * 2.  Import the "handler factory" (`createAuthHandler`) from the self-contained auth module.
 * 3.  Create a configuration object from the environment variables.
 * 4.  Call `createAuthHandler`, passing in the core application logic and the configuration.
 * This returns a new, complete fetch handler that has the entire authentication system
 * already built-in.
 * 5.  Export the final, composed handler to be used by the Cloudflare runtime.
 *
 * This architecture makes the entry point extremely clean, readable, and easy to maintain.
 */

import {RequestHandler} from './request-handler.mjs';
import {createConfig} from './config.mjs';
import {createAuthHandler} from './auth/router.mjs';

/**
 * The final, complete fetch handler for the worker.
 *
 * It is constructed by passing our main application logic (the RequestHandler)
 * into the `createAuthHandler` factory. The factory wraps our application
 * with all necessary authentication, routing, and UI logic.
 *
 * @param {Request} request - The incoming request.
 * @param {object} env - The worker's environment.
 * @param {ExecutionContext} ctx - The execution context.
 * @returns {Promise<Response>}
 */
async function rootHandler(request, env, ctx) {
    const config = createConfig(env);

    // The createAuthHandler function is the single public interface of our auth module.
    // It takes our main app logic and all necessary config as parameters.
    const authAwareHandler = createAuthHandler(RequestHandler.handleRequest, {
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
    });

    // Execute the final, composed handler.
    return authAwareHandler(request, env, ctx);
}

export default {
    /**
     * The fetch handler for the worker.
     *
     * @param {Request} request - The incoming HTTP Request object.
     * @param {object} env - The worker's environment, including bindings and variables.
     * @param {ExecutionContext} ctx - The execution context for the request.
     * @returns {Promise<Response>}
     */
    async fetch(request, env, ctx) {
        try {
            return await rootHandler(request, env, ctx);
        } catch (err) {
            // Global error handler for any uncaught exceptions.
            console.error(err.stack);
            return new Response("An internal server error occurred.", {status: 500});
        }
    },
};