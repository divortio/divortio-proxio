/**
 * @file A simple in-memory user store for authentication.
 * @version 1.0.0
 * @note For production use, this should be replaced with a secure database or identity provider.
 */

/**
 * @namespace UserStore
 * @description A hardcoded list of valid users. The key is the username and the value is the password.
 */
export const UserStore = {
    "admin": "password123",
    "testuser": "testpass"
};