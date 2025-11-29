/**
 * @file Mod Registry
 * @description Defines the static list of available mods and their configuration bindings.
 * @version 2.0.0 (Explicit Domain Pattern)
 */

import { ProfanityMod } from './profanity.mjs';

/**
 * @typedef {object} ModDefinition
 * @property {string} id - Internal identifier.
 * @property {string} envKey - The Wrangler environment variable (e.g., "MOD_PROFANITY_FILTER").
 * @property {string} selector - The CSS selector to attach to.
 * @property {string} domainPattern - The scope. ('*', 'google.com', '*.example.com').
 * @property {Class} className - The Mod class constructor.
 * @property {Array} [defaultArgs] - Arguments for the mod logic (e.g. replacement string).
 */

export const MOD_REGISTRY = [
    {
        id: 'profanity',
        envKey: 'MOD_PROFANITY_FILTER',
        selector: '*',
        domainPattern: '*', // <--- Explicitly defined here now
        className: ProfanityMod,
        defaultArgs: ['[FOUL LANGUAGE]'] // No longer contains the domain pattern
    }
];