/**
 * @file WebSocket Proxy Handler
 * @description Manages WebSocket upgrades and long-lived tunnels.
 * @version 3.0.0 (Functional Export)
 */

/**
 * Handles the incoming Upgrade request.
 * Creates the WebSocket pair, starts the session, and returns the 101 Switching Protocols response.
 * @param {ExecutionContext} ctx - The worker execution context (for waitUntil).
 * @param {URL} targetURL - The target URL to proxy to.
 * @returns {Response} The 101 Switching Protocols response containing the client socket.
 */
export function handleWebSocket(ctx, targetURL) {
    // Create the client/server socket pair
    const { 0: client, 1: server } = new WebSocketPair();

    // Keep the worker alive while the session is active
    ctx.waitUntil(handleSession(server, targetURL));

    // Return the handshake response to the client immediately
    return new Response(null, {
        status: 101,
        webSocket: client
    });
}

/**
 * Establishes the tunnel between the server-side socket and the upstream origin.
 * (Internal Helper)
 */
async function handleSession(server, targetURL) {
    // 1. Accept the client connection
    server.accept();

    // 2. Connect to the upstream target
    let targetWebSocket;
    try {
        // Convert http(s) -> ws(s)
        const wsUrl = targetURL.href.replace(/^http/, 'ws');

        // Perform the upstream handshake
        const originResponse = await fetch(wsUrl, {
            headers: { "Upgrade": "websocket" }
        });

        // Validate upstream upgrade
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

    // 3. Pipe Data (Client -> Target)
    server.addEventListener('message', event => {
        try {
            targetWebSocket.send(event.data);
        } catch (e) {
            server.close(1011, "Upstream send failed");
        }
    });

    // 4. Pipe Data (Target -> Client)
    targetWebSocket.addEventListener('message', event => {
        try {
            server.send(event.data);
        } catch (e) {
            server.close(1011, "Downstream send failed");
        }
    });

    // 5. Handle Closure (Cleanup)
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