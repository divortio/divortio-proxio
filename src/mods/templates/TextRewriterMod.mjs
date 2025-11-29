/**
 * @file Text Rewriter Base Mod
 * @description Base class for regex-based text replacement. Supports single pattern or multi-pattern mapping.
 * @extends BaseMod
 */

import { BaseMod } from './BaseMod.mjs';

export class TextRewriterBaseMod extends BaseMod {
    /**
     * Initializes the Text Rewriter.
     * * Signatures:
     * 1. Multi-Rule: constructor(id, rulesObject, flags, domainPattern)
     * 2. Single-Rule: constructor(id, pattern, replacementString, flags, domainPattern)
     * * @param {string} id - Mod ID.
     * @param {string|RegExp|Object} patternOrRules - A Regex/String (Single Mode) or an Object { pattern: replacement } (Map Mode).
     * @param {string|null} [replacementOrFlags] - Replacement string (Single Mode) or Flags (Map Mode).
     * @param {string} [flagsOrDomain='gi'] - Flags (Single Mode) or Domain (Map Mode).
     * @param {string} [domainPattern='*'] - Domain scope (Single Mode).
     */
    constructor(id, patternOrRules, replacementOrFlags = null, flagsOrDomain = 'gi', domainPattern = '*') {
        // Local variables to hold resolved values before 'this' is available
        let regex;
        let rules = null;
        let replacement = null;
        let domain = '*';

        if (patternOrRules && typeof patternOrRules === 'object' && !(patternOrRules instanceof RegExp)) {
            // --- MODE 1: Map/Object Mode ---
            // usage: new Mod(id, { "bad": "good" }, 'gi', '*')
            rules = patternOrRules;

            // Argument Shifting
            const flags = replacementOrFlags || 'gi';
            domain = flagsOrDomain || '*';

            // Compile one giant regex from the keys
            const keys = Object.keys(rules).sort((a, b) => b.length - a.length);
            regex = new RegExp(`(${keys.join('|')})`, flags);
        } else {
            // --- MODE 2: Single Pattern Mode ---
            // usage: new Mod(id, "bad", "good", 'gi', '*')
            if (patternOrRules instanceof RegExp) {
                regex = patternOrRules;
            } else {
                regex = new RegExp(patternOrRules, flagsOrDomain);
            }
            replacement = replacementOrFlags;
            // In single mode, flagsOrDomain is the flags argument used in RegExp above
            domain = domainPattern;
        }

        // Initialize BaseMod (MUST happen before accessing 'this')
        super(id, domain);

        // Assign resolved properties
        this.regex = regex;
        this.rules = rules;
        this.replacement = replacement;
        this.currentTag = '';
    }

    /**
     * Context Tracking (Element Handler)
     */
    element(element) {
        this.currentTag = element.tagName.toLowerCase();
        element.onEndTag(() => { this.currentTag = ''; });
    }

    /**
     * Execution (Text Handler)
     */
    text(textChunk) {
        const text = textChunk.text;
        if (!text) return;

        const UNSAFE_TAGS = ['style', 'svg', 'noscript', 'textarea', 'pre', 'code'];
        if (UNSAFE_TAGS.includes(this.currentTag)) return;

        // Apply replacement based on context
        if (this.currentTag === 'script') {
            this.replaceSafe(textChunk, text);
        } else {
            this.replaceStandard(textChunk, text);
        }
    }

    /**
     * Resolves the replacement string for a given match.
     */
    getReplacement(match) {
        // 1. Single Mode
        if (this.replacement !== null) return this.replacement;

        // 2. Map Mode
        if (this.rules) {
            // Try exact match
            if (this.rules[match]) return this.rules[match];

            // Try case-insensitive lookup if flags include 'i'
            if (this.regex.flags.includes('i')) {
                const lowerKey = match.toLowerCase();
                for (const key in this.rules) {
                    if (key.toLowerCase() === lowerKey) return this.rules[key];
                }
            }
        }
        return match; // Fallback
    }

    replaceStandard(textChunk, text) {
        if (this.regex.test(text)) {
            this.regex.lastIndex = 0;
            const sanitized = text.replace(this.regex, (match) => this.getReplacement(match));
            if (sanitized !== text) textChunk.replace(sanitized);
        }
    }

    replaceSafe(textChunk, text) {
        if (!this.regex.test(text)) return;
        this.regex.lastIndex = 0;

        const sanitized = text.replace(this.regex, (match, ...args) => {
            const offset = args[args.length - 2];
            const fullString = args[args.length - 1];

            // Safety Heuristics (URL/JSON check)
            const prevChar = fullString[offset - 1];
            if (prevChar && /[\/\.@-]/.test(prevChar)) return match;

            const nextChar = fullString[offset + match.length];
            if (nextChar && /[:]/.test(nextChar)) return match;

            return this.getReplacement(match);
        });

        if (sanitized !== text) textChunk.replace(sanitized);
    }
}