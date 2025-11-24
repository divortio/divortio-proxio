export const ErrorMiddleware = {
    async wrap(fn) {
        try {
            return await fn();
        } catch (err) {
            console.error("[Worker Error]", err);
            return new Response(JSON.stringify({
                error: "Proxy Error",
                message: err.message,
                timestamp: new Date().toISOString()
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
};