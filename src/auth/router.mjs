/**
 * @file The public router and handler factory for the pluggable authentication module.
 * @version 1.0.0
 *
 * @description
 * This module exports a single `createAuthHandler` function that constructs a complete,
 * authentication-aware fetch handler. It is the primary public interface for the auth system.
 *
 * It contains all the routing and UI logic for the auth system, such as:
 * - Handling API requests for login/logout.
 * - Serving a server-side templated login page from static assets.
 * - Providing a graceful, self-contained fallback login page if assets are missing.
 * - Managing redirects for authenticated and unauthenticated users.
 * - Applying the core middleware to protect the main application.
 */

import {createAuthMiddleware} from './core.mjs';
import {UserStore} from './users.mjs';
// The core JWT logic is imported for use in the API route handler.
import {_jwt as jwt} from './core.mjs';

/**
 * A simple, default HTML login page that is returned if the configured asset cannot be found.
 * It is self-contained with minimal inline CSS and JS.
 * @param {string} loginApiPath - The API path the form should submit to.
 * @returns {string} A complete, self-contained HTML document.
 */
const fallbackLoginPage = (loginApiPath) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: grid; place-content: center; min-height: 100vh; margin: 0; background: #1a1a1a; color: #f0f0f0; }
        .login-box { background: #2a2a2a; padding: 2rem; border-radius: 8px; border: 1px solid #444; text-align: center; }
        form { display: flex; flex-direction: column; gap: 1rem; }
        h2 { margin-top: 0; }
        input, button { padding: 0.75rem; border-radius: 4px; border: 1px solid #555; background: #333; color: #eee; font-size: 1rem; }
        button { background: #007bff; color: white; cursor: pointer; border: none; }
        #error { color: #ff8a8a; margin-top: 1rem; min-height: 1.2em; }
    </style>
</head>
<body>
<div class="login-box">
    <h2>Proxy Login</h2>
    <form id="login-form">
        <input type="text" name="username" placeholder="Username" required>
        <input type="password" name="password" placeholder="Password" required>
        <button type="submit">Log In</button>
        <div id="error"></div>
    </form>
</div>
<script>
    const form = document.getElementById('login-form');
    const errorDiv = document.getElementById('error');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorDiv.textContent = '';
        const username = form.username.value;
        const password = form.password.value;
        try {
            const res = await fetch('${loginApiPath}', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            if (res.ok) {
                window.location.href = '/';
            } else {
                const data = await res.json();
                errorDiv.textContent = data.error || 'Login failed.';
            }
        } catch (err) {
            errorDiv.textContent = 'A network error occurred.';
        }
    });
</script>
</body></html>`;

/**
 * Creates a complete fetch handler that wraps a core application with the authentication system.
 *
 * @param {function(Request, object, ExecutionContext): Promise<Response>} appFetchHandler - The main application logic to protect.
 * @param {object} params - All necessary configuration parameters, flattened.
 * @param {boolean} params.userEnabled - Whether to enable interactive user authentication.
 * @param {boolean} params.agentEnabled - Whether to enable service agent authentication.
 * @param {string} params.jwtSecret - The secret key for signing new JWTs.
 * @param {number} params.sessionTimeout - The session duration in seconds.
 * @param {string} params.loginApiPath - The path for the user login API endpoint.
 * @param {string} params.logoutApiPath - The path for the user logout API endpoint.
 * @param {string} params.loginUrlPath - The public-facing URL path for the login page.
 * @param {string} params.loginAssetPath - The internal path to the login.html file within static assets.
 * @param {string} params.authRedirectPath - The path to redirect to after a successful login.
 * @param {string} params.authTokenName - The name of the authentication cookie.
 * @param {string} params.agentHeaderName - The name of the HTTP header for agent API tokens.
 * @param {string} params.issuer - The "iss" (Issuer) claim for the JWT.
 * @param {string} params.audience - The "aud" (Audience) claim for the JWT.
 * @returns {function(Request, object, ExecutionContext): Promise<Response>} A new, complete fetch handler.
 */
export function createAuthHandler(appFetchHandler, {
    userEnabled, agentEnabled, jwtSecret, sessionTimeout,
    loginApiPath, logoutApiPath, loginUrlPath, loginAssetPath, authRedirectPath,
    authTokenName, agentHeaderName, issuer, audience
}) {
    // Create the protected version of the main application handler using the middleware from core.
    const protectedApp = createAuthMiddleware(appFetchHandler, {
        userEnabled, agentEnabled, jwtSecret, authTokenName, agentHeaderName, issuer, audience
    });

    // Return the final, complete fetch handler that contains all routing logic.
    return async (request, env, ctx) => {
        const url = new URL(request.url);

        // --- 1. Handle Auth API Routes ---
        if (userEnabled) {
            if (url.pathname === loginApiPath && request.method === 'POST') {
                try {
                    const {username, password} = await request.json();
                    if (UserStore[username] === password) {
                        const token = await jwt.createJwt({username, jwtSecret, sessionTimeout, issuer, audience});
                        const headers = new Headers({'Content-Type': 'application/json'});
                        headers.set('Set-Cookie', `${authTokenName}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${sessionTimeout}`);
                        return new Response(JSON.stringify({success: true}), {status: 200, headers});
                    }
                } catch {
                }
                return new Response(JSON.stringify({error: 'Invalid credentials'}), {
                    status: 401,
                    headers: {'Content-Type': 'application/json'}
                });
            }
            if (url.pathname === logoutApiPath && request.method === 'POST') {
                const headers = new Headers({'Content-Type': 'application/json'});
                headers.set('Set-Cookie', `${authTokenName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
                return new Response(JSON.stringify({success: true}), {status: 200, headers});
            }
        }

        // --- 2. Handle Login Page UI and Redirects ---
        if (userEnabled) {
            const payload = await jwt.validateJwt(request, jwtSecret, authTokenName, issuer, audience);
            const isLoginPageRoute = url.pathname === loginUrlPath;

            if (payload && isLoginPageRoute) {
                return Response.redirect(new URL(authRedirectPath, url).href, 302);
            }

            // Check for an agent token to prevent agents from being redirected to HTML login.
            const apiToken = request.headers.get(agentHeaderName);
            const isAgentRequest = agentEnabled && apiToken && AgentStore.has(apiToken);

            if (!payload && !isLoginPageRoute && !isAgentRequest) {
                const isBrowserRequest = request.headers.get('Accept')?.includes('text/html');
                if (isBrowserRequest) {
                    return Response.redirect(new URL(loginUrlPath, url).href, 302);
                }
            }

            if (isLoginPageRoute) {
                try {
                    // Attempt to fetch the custom login page from static assets.
                    const loginPageResponse = await env.ASSETS.fetch(new Request(new URL(loginAssetPath, url).href));
                    if (!loginPageResponse.ok) throw new Error("Asset not found");

                    // Simple server-side templating to inject the API path.
                    let html = await loginPageResponse.text();
                    html = html.replace(/"\/api\/auth\/login"/g, `"${loginApiPath}"`); // Use a regex to replace all occurrences
                    return new Response(html, {headers: {'Content-Type': 'text/html'}});
                } catch (e) {
                    // Graceful fallback to the simple, unstyled login page.
                    return new Response(fallbackLoginPage(loginApiPath), {
                        status: 500,
                        headers: {'Content-Type': 'text/html'}
                    });
                }
            }
        }

        // --- 3. Delegate to the Protected Application Handler ---
        return protectedApp(request, env, ctx);
    };
}