/**
 * @file Global Error Middleware
 * @description Catches unhandled exceptions and returns a safe JSON response.
 * @version 2.0.0 (Standardized)
 */

export const ErrorMiddleware = {
    /**
     * Wraps the execution context in a try-catch block.
     * @param {function(): Promise<Response>} fn - The async worker logic.
     * @returns {Promise<Response>}
     */
    async wrap(fn) {
        try {
            return await fn();
        } catch (err) {
            console.error("[Proxio Error]", err);

            // Return a safe, generic error to the client to prevent stack trace leaks
            return new Response(JSON.stringify({
                error: "Proxy Error",
                message: "An internal error occurred while processing the request.",
                timestamp: new Date().toISOString()
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store'
                }
            });
        }
    }
};