/**
 * @file A simple in-memory store for service agent API tokens.
 * @version 1.0.0
 */

/**
 * @namespace AgentStore
 * @description A hardcoded `Set` of valid, secret API tokens for service applications.
 */
export const AgentStore = new Set([
    "a_very_long_and_secret_string_for_my_first_service",
    "another_super_secret_token_for_the_data_pipeline",
]);