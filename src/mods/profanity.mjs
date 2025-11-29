/**
 * @file Profanity Filter Mod
 * @description Scans text nodes for foul language and sanitizes them.
 * @extends TextRewriterBaseMod
 */

import { TextRewriterBaseMod } from './templates/TextRewriterBaseMod.mjs';

const PROFANITY_LIST = ['badword', 'profanity', 'curse', 'foul'];

export class ProfanityMod extends TextRewriterBaseMod {
    /**
     * @param {string} replacement - The replacement string.
     * @param {string} [domainPattern='*'] - Optional scope.
     */
    constructor(replacement = '[FOUL LANGUAGE]', domainPattern = '*') {
        // We compile the list into a single boundary-enforced regex pattern
        const pattern = `\\b(${PROFANITY_LIST.join('|')})\\b`;

        // Pass to Base: (id, pattern, replacement, flags, domain)
        super('profanity-filter', pattern, replacement, 'gi', domainPattern);
    }
}