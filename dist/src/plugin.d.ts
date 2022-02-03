import { PluginSimple } from "markdown-it";
import { RuleBlock } from "markdown-it/lib/parser_block";
/**
 * borrowed heavily from the core
 * [list rule](https://github.dev/markdown-it/markdown-it/blob/7edd820b57a7018a9886b6b2efacc9bdae20ca98/lib/rules_block/list.js)
 * implementation */
export declare const classyList: RuleBlock;
/**
 * **Collapsible Plugin**
 *
 * Allows markdown authors to create a block of content which can be toggled between
 * an open and closed state. Use `+++` for an open starting state and `>>>` for a
 * closed starting state.
 * ```md
 * +++ My Section (which starts OPEN)
 * - one
 * - two
 * +++
 * ```
 */
declare const collapsiblePlugin: PluginSimple;
export default collapsiblePlugin;
