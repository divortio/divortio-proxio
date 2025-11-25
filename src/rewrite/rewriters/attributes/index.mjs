/**
 * @file Attribute Handlers Public API
 * @description Exports all attribute rewriter classes.
 * @version 1.0.0
 */

import { AttributeRewriter } from './attribute.mjs';
import { SrcsetRewriter } from './srcset.mjs';
import { InlineStyleRewriter } from './inlineStyle.mjs';
import { MetaUrlRewriter } from './metaURL.mjs';
import { ImportMapRewriter } from './importMap.mjs';
import {SpeculationRulesRewriter} from './speculationRules.mjs';

export {
    AttributeRewriter,
    SrcsetRewriter,
    InlineStyleRewriter,
    MetaUrlRewriter,
    ImportMapRewriter,
    SpeculationRulesRewriter
};