// src/mods/translation.mjs
import { TextRewriterBaseMod } from './templates/TextRewriterBaseMod.mjs';

const DICTIONARY = {
    "colour": "color",
    "theatre": "theater",
    "lift": "elevator"
};

export class BritishToAmericanMod extends TextRewriterBaseMod {
    constructor() {
        // Pass the object map directly.
        // The BaseMod automatically compiles regex: (colour|theatre|lift)
        super('en-us-localize', DICTIONARY, 'gi', '*');
    }
}