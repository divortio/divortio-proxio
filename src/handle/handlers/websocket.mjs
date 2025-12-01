/**
 * @file WebSocket Proxy Handler
 * @description Manages WebSocket upgrades and long-lived tunnels.
 * @version 4.0.0 (Typed Config)
 */

/**
 * Handles the incoming Upgrade request.
 * Creates the WebSocket pair, starts the session, and returns the 101 Switching Protocols response.
 * @param {ExecutionContext} ctx - The worker execution context.
 * @param {URL} targetURL - The target URL to proxy to.
 * @param {import('../../config/env.mjs').EnvConfig} [config] - App config (reserved for future hooks).
 * @returns {Response} The 101 Switching Protocols response.
 */
export function handleWebSocket(ctx, targetURL, config) {
    // Create the client/server socket pair
    const { 0: client, 1: server } = new WebSocketPair();

    // Keep the worker alive while the session is active
    ctx.waitUntil(handleSession(server, targetURL));

    return new Response(null, {
        status: 101,
        webSocket: client
    });
}

/**
 * Establishes the tunnel between the server-side socket and the upstream origin.
 */
async function handleSession(server, targetURL) {
    server.accept();

    let targetWebSocket;
    try {
        const wsUrl = targetURL.href.replace(/^http/, 'ws');
        const originResponse = await fetch(wsUrl, {
            headers: { "Upgrade": "websocket" }
        });

        if (originResponse.status !== 101) {
            server.close(1002, "Upstream did not upgrade");
            return;
        }

        targetWebSocket = originResponse.webSocket;
        targetWebSocket.accept();
    } catch (e) {
        server.close(1011, "Failed to connect to upstream");
        return;
    }

    server.addEventListener('message', event => {
        try { targetWebSocket.send(event.data); } catch (e) { server.close(1011, "Upstream send failed"); }
    });

    targetWebSocket.addEventListener('message', event => {
        try { server.send(event.data); } catch (e) { server.close(1011, "Downstream send failed"); }
    });

    const close = (event) => {
        const { code, reason } = event || {};
        try { server.close(code || 1000, reason || "Normal Closure"); } catch(e){}
        try { targetWebSocket.close(code || 1000, reason || "Normal Closure"); } catch(e){}
    };

    server.addEventListener('close', close);
    server.addEventListener('error', close);
    targetWebSocket.addEventListener('close', close);
    targetWebSocket.addEventListener('error', close);
}