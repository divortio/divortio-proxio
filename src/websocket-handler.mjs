/**
 * @file Handles the proxying of WebSocket connections.
 * @version 1.0.0
 * @see {@link ./worker.mjs} for the entry point where WebSocket upgrade requests are detected.
 *
 * @description
 * This module is responsible for transparently proxying WebSocket data streams between
 * the client and the target server. When the main worker router detects an `Upgrade: websocket`
 * header, it delegates the connection to this handler.
 *
 * The handler establishes a new WebSocket connection to the target origin and then creates
 * a direct pipe between the client's socket and the origin's socket, streaming messages
 * back and forth. This allows real-time features on proxied websites (like live chats,
 * data feeds, and collaborative tools) to function seamlessly.
 */

/**
 * @namespace WebSocketHandler
 * @description A dedicated module for handling the proxying of WebSocket connections.
 */
export const WebSocketHandler = {
    /**
     * Establishes a proxied WebSocket session. It creates a connection to the origin
     * and then transparently streams messages back and forth between the client and origin sockets.
     *
     * @param {WebSocket} server - The server-side WebSocket object from the `WebSocketPair`
     * created by the Cloudflare runtime. This represents the connection to the client.
     * @param {URL} targetURL - The target WebSocket URL (e.g., wss://...).
     * @returns {Promise<void>} A promise that resolves when the session handling is set up.
     */
    async handleSession(server, targetURL) {
        try {
            // Attempt to upgrade the connection to the origin server.
            // Cloudflare's `fetch` implementation handles the `Upgrade: websocket` header
            // and will return a `webSocket` property in the response if successful.
            const originSocketResponse = await fetch(targetURL.href, {
                headers: {"Upgrade": "websocket"}
            });

            const originWebSocket = originSocketResponse.webSocket;
            if (!originWebSocket) {
                // If the origin server did not respond with a WebSocket, close the client connection.
                server.close(1012, "Origin server did not upgrade to a WebSocket connection.");
                return;
            }

            // The connection to the origin is successful. We must now "accept" the client's
            // connection to begin the session.
            server.accept();

            // --- Create a direct data pipe between the two sockets ---

            // When the client sends a message, forward it to the origin.
            server.addEventListener("message", event => {
                originWebSocket.send(event.data);
            });

            // When the origin sends a message, forward it to the client.
            originWebSocket.addEventListener("message", event => {
                server.send(event.data);
            });

            // --- Handle connection closing and errors ---
            const closeHandler = (event) => {
                // Ensure both sockets are closed gracefully if either one closes.
                if (originWebSocket.readyState === WebSocket.OPEN) {
                    originWebSocket.close(event.code, event.reason);
                }
                if (server.readyState === WebSocket.OPEN) {
                    server.close(event.code, event.reason);
                }
            };

            server.addEventListener("close", closeHandler);
            server.addEventListener("error", closeHandler);
            originWebSocket.addEventListener("close", closeHandler);
            originWebSocket.addEventListener("error", closeHandler);

        } catch (e) {
            // If the initial fetch to the origin fails, close the client connection.
            server.close(1011, "Failed to connect to the origin WebSocket server.");
        }
    }
};