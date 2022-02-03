import { PluginSimple } from "markdown-it";
import { isSpace } from "markdown-it/lib/common/utils";
import { RuleBlock } from "markdown-it/lib/parser_block";
import { RenderRule } from "markdown-it/lib/renderer";
import StateBlock from "markdown-it/lib/rules_block/state_block";
import Token from "markdown-it/lib/token";

/**
 * Adds the `<summary>...</summary>` HTML block
 */
const renderSummary: RenderRule = (tokens, idx, options, env, slf) => {
	return (
		'<summary><span class="pre-summary">&nbsp;</span>' +
		slf.renderInline(tokens[idx].children as Token[], options, env) +
		"</summary>"
	);
};

function isWhitespace(state: StateBlock, start: number, end: number) {
	for (start; start < end; start++) {
		if (!state.md.utils.isWhiteSpace(state.src.charCodeAt(start))) return false;
	}
	return true;
}

const PLUS_MARKER = 43; // +
const RIGHT_CHEVRON_MARKER = 62; // >

/**
 * The core plugin which checks for the appropriate prefix content of
 * either `+++` (for collapsible block in OPEN state) or `>>>` (for 
 * collapsible block in CLOSED state).
 */
const coreRule: RuleBlock = (state, startLine, endLine, silent) => {

	let isOpen = true;
	let isClosed = true;

	/** does the block auto close?  */
	let autoClosedBlock = false;
	let start = state.bMarks[startLine] + state.tShift[startLine];
	let max = state.eMarks[startLine];

	if (state.src.charCodeAt(start) !== PLUS_MARKER) {
		isOpen = false;
	}
	if (state.src.charCodeAt(start) !== RIGHT_CHEVRON_MARKER) {
		isClosed = false;
	}
	// if block doesn't start with OPEN or CLOSED character than ignore
	if(!isOpen && !isClosed) return false;
	
	// Check out the rest of the marker string
	let pos = state.skipChars(start, isOpen ? PLUS_MARKER : RIGHT_CHEVRON_MARKER);

	const markerCount = pos - start;
	if (markerCount < 3) return false;

	/** 
	 * these are the characters indicating the beginning (and/or ending) of the
	 * block which will be collapsible.
	 */
	const markup = state.src.slice(start, pos);
	/** the characters of the **summary** section */
	const params = state.src.slice(pos, max).trim();

	// Title must not be empty
	if (isWhitespace(state, pos, max)) return false;

	// The title must not end with the marker (no inline)
	if (params.endsWith(String.fromCharCode(isOpen ? PLUS_MARKER : RIGHT_CHEVRON_MARKER).repeat(markerCount))) {return false;}

	// Since start is found, we can report success here in validation mode
	if (silent) return true;

	// Search the end of the block
	let nextLine = startLine;
	let isEmpty = true;

	for (;;) {
		nextLine++;

		// Unclosed block should be autoclosed by end of document.
		if (nextLine >= endLine) break;

		start = state.bMarks[nextLine] + state.tShift[nextLine];
		max = state.eMarks[nextLine];

		// Non-empty line with negative indent should stop the list:
		// - ```
		//  test
		if (start < max && state.sCount[nextLine] < state.blkIndent) break;

		if (state.src.charCodeAt(start) !== (isOpen ? PLUS_MARKER : RIGHT_CHEVRON_MARKER)) {
			if (isEmpty) isEmpty = isWhitespace(state, start, max);
			continue;
		}

		// Closing marker should be indented less than 4 spaces
		if (state.sCount[nextLine] - state.blkIndent >= 4) continue;

		pos = state.skipChars(start, isOpen ? PLUS_MARKER : RIGHT_CHEVRON_MARKER);

		// Closing marker must be at least as long as the opening one
		if (pos - start < markerCount) continue;

		// Make sure tail has spaces only
		pos = state.skipSpaces(pos);

		if (pos < max) continue;

		autoClosedBlock = true;
		break;
	}

	if (isEmpty) return false;

	const oldParent = state.parentType;
	const oldLineMax = state.lineMax;
	state.parentType = "reference";
	

	// This will prevent lazy continuations from ever going past our end marker
	state.lineMax = nextLine;

	const details = isOpen ? `details open` : `details`;

	/** the tokens which make up the  */
	let token = state.push("collapsible_open", details, 1);
	token.block = true;
	token.info = params;
	token.markup = markup;
	token.map = [startLine, nextLine];

	const tokens: Token[] = [];
	state.md.inline.parse(params, state.md, state.env, tokens);
	token = state.push("collapsible_summary", "summary", 0);
	
	token.content = params;
	token.children = tokens;

	state.md.block.tokenize(state, startLine + 1, nextLine);

	token = state.push("collapsible_close", "details", -1);
	token.markup = state.src.slice(start, pos);
	token.block = true;

	state.parentType = oldParent;
	state.lineMax = oldLineMax;
	state.line = nextLine + (autoClosedBlock ? 1 : 0);

	return true;
};

function skipOrderedListMarker(state: StateBlock, startLine: number) {
	let ch;
	const start = state.bMarks[startLine] + state.tShift[startLine];
	let pos = start;
	const max = state.eMarks[startLine];


  // List marker should have at least 2 chars (digit + dot)
  if (pos + 1 >= max) { return -1; }

  ch = state.src.charCodeAt(pos++);

  if (ch < 0x30/* 0 */ || ch > 0x39/* 9 */) { return -1; }

  for (;;) {
    // EOL -> fail
    if (pos >= max) { return -1; }

    ch = state.src.charCodeAt(pos++);

    if (ch >= 0x30/* 0 */ && ch <= 0x39/* 9 */) {

      // List marker should have no more than 9 digits
      // (prevents integer overflow in browsers)
      if (pos - start >= 10) { return -1; }

      continue;
    }

    // found valid marker
    if (ch === 0x29/* ) */ || ch === 0x2e/* . */) {
      break;
    }

    return -1;
  }


  if (pos < max) {
    ch = state.src.charCodeAt(pos);

    if (!isSpace(ch)) {
      // " 1.test " - is not a list item
      return -1;
    }
  }
  return pos;
}

/**
 * Search `[-+*][\n ]`, returns next pos after marker on success
 * or -1 on fail.
 */
function skipBulletListMarker(state: StateBlock, startLine: number) {
	let pos = state.bMarks[startLine] + state.tShift[startLine];
	const max = state.eMarks[startLine];

  const marker = state.src.charCodeAt(pos++);
  // Check bullet
  if (marker !== 0x2A/* * */ &&
      marker !== 0x2D/* - */ &&
      marker !== 0x2B/* + */) {
    return -1;
  }

  if (pos < max) {
    const ch = state.src.charCodeAt(pos);

    if (!isSpace(ch)) {
      // " -test " - is not a list item
      return -1;
    }
  }

  return pos;
}

function markTightParagraphs(state: StateBlock, idx: number) {
	let i;
	let l;
	const level = state.level + 2;

  for (i = idx + 2, l = state.tokens.length - 2; i < l; i++) {
    if (state.tokens[i].level === level && state.tokens[i].type === "paragraph_open") {
      state.tokens[i + 2].hidden = true;
      state.tokens[i].hidden = true;
      i += 2;
    }
  }
}

/** 
 * borrowed heavily from the core 
 * [list rule](https://github.dev/markdown-it/markdown-it/blob/7edd820b57a7018a9886b6b2efacc9bdae20ca98/lib/rules_block/list.js)
 * implementation */
export const classyList: RuleBlock = (state, startLine, endLine, silent) => {
	let start = state.bMarks[startLine] + state.tShift[startLine];
	let isTerminatingParagraph = false;
	// const max = state.eMarks[startLine];
	if (state.sCount[startLine] - state.blkIndent >= 4) { return false; }

	// Special case:
  //  - item 1
  //   - item 2
  //    - item 3
  //     - item 4
  //      - this one is a paragraph continuation
	if (state.listIndent >= 0 &&
		state.sCount[startLine] - state.listIndent >= 4 &&
		state.sCount[startLine] < state.blkIndent) {
		return false;
	}

	  // limit conditions when list can interrupt
  // a paragraph (validation mode only)
  if (silent && state.parentType === "paragraph") {
    // Next list item should still terminate previous list item;
    //
    // This code can fail if plugins use blkIndent as well as lists,
    // but I hope the spec gets fixed long before that happens.
    //
    if (state.sCount[startLine] >= state.blkIndent) {
      isTerminatingParagraph = true;
    }
  }

	let posAfterMarker;
	let isOrdered: boolean;
	let markerValue;

	// Detect list type and position after marker
	if ((posAfterMarker = skipOrderedListMarker(state, startLine)) >= 0) {
		isOrdered = true;
		start = state.bMarks[startLine] + state.tShift[startLine];
		markerValue = Number(state.src.slice(start, posAfterMarker - 1));

		// If we're starting a new ordered list right after
		// a paragraph, it should start with 1.
		if (isTerminatingParagraph && markerValue !== 1) return false;

	} else if ((posAfterMarker = skipBulletListMarker(state, startLine)) >= 0) {
		isOrdered = false;

	} else {
		return false;
	}


	// If we're starting a new unordered list right after
  // a paragraph, first line should not be empty.
  if (isTerminatingParagraph) {
    if (state.skipSpaces(posAfterMarker) >= state.eMarks[startLine]) return false;
  }

  /** 
	 * We should terminate list on style change. This variable remembers the first one to compare. 
	 */
  const markerCharCode = state.src.charCodeAt(posAfterMarker - 1);

  // For validation mode we can terminate immediately
  if (silent) { return true; }

  // Start list
  const listTokIdx = state.tokens.length;
	/**
	 * The token to capture the full list scope; either a `ol` or `ul`
	 */
	let ulOlToken: Token;

  if (isOrdered) {
    ulOlToken = state.push("ordered_list_open", "ol", 1);
    if (markerValue !== 1) {
      ulOlToken.attrs = [ [ "start", String(markerValue) ] ];
    }

  } else {
    ulOlToken = state.push("bullet_list_open", `ul class="lvl-${state.level}"`, 1);
  }
	let listLines: [number, number];

  ulOlToken.map = listLines = [ startLine, 0 ] as [number, number];
  ulOlToken.markup = String.fromCharCode(markerCharCode);

  //
  // Iterate list items
  //

  let prevEmptyEnd = false;
  const terminatorRules = state.md.block.ruler.getRules("list");
	
  const oldParentType = state.parentType;
  state.parentType = "list";
	let tight: boolean = state.tight;
	
	let nextLine = startLine;

  while (nextLine < endLine) {
    let pos = posAfterMarker;
    const max = state.eMarks[nextLine];
		let offset;
    const initial = offset = state.sCount[nextLine] + posAfterMarker - (state.bMarks[startLine] + state.tShift[startLine]);

    while (pos < max) {
      const ch = state.src.charCodeAt(pos);

      if (ch === 0x09) {
        offset += 4 - (offset + state.bsCount[nextLine]) % 4;
      } else if (ch === 0x20) {
        offset++;
      } else {
        break;
      }

      pos++;
    }

    let contentStart = pos;
		let indentAfterMarker: number;

    if (contentStart >= max) {
      // trimming space in "-    \n  3" case, indent is 1 here
      indentAfterMarker = 1;
    } else {
      indentAfterMarker = offset - initial;
    }

    // If we have more than 4 spaces, the indent is 1
    // (the rest is just indented code block)
    if (indentAfterMarker > 4) { indentAfterMarker = 1; }

    // "  -  test"
    //  ^^^^^ - calculating total length of this thing
    const indent = initial + indentAfterMarker;


		let liToken: Token;
    // Run subparser & write tokens

		/** 
		 * the text associated with the `<li>` line element; this would include the
		 * leading `-` dash mark and space following.
		 */
		const currentLineItem = state.getLines(startLine,startLine+1, state.listIndent, false);
		const isExpandable = /^\s*- [\+>]{3}/;
		
    liToken        = isExpandable.test(currentLineItem)
			? state.push("list_item_open", `li class="lvl-${indent} expandable"`, 1)
			: state.push("list_item_open", `li class="lvl-${indent}"`, 1);
    liToken.markup = String.fromCharCode(markerCharCode);
		

		let itemLines: [number, number];
    liToken.map    = itemLines = [ startLine, 0 ] as [number, number];
    if (isOrdered) {
      liToken.info = state.src.slice(start, posAfterMarker - 1);
    }

    // change current state, then restore it after parser subcall
    const oldTight = state.tight;
    const oldTShift = state.tShift[startLine];
    const oldSCount = state.sCount[startLine];

    //  - example list
    // ^ listIndent position will be here
    //   ^ blkIndent position will be here
    //
    const oldListIndent = state.listIndent;
    state.listIndent = state.blkIndent;
    state.blkIndent = indent;

    state.tight = true;
    state.tShift[startLine] = contentStart - state.bMarks[startLine];
    state.sCount[startLine] = offset;

    if (contentStart >= max && state.isEmpty(startLine + 1)) {
      // workaround for this case
      // (list item is empty, list terminates before "foo"):
      // ~~~~~~~~
      //   -
      //
      //     foo
      // ~~~~~~~~
      state.line = Math.min(state.line + 2, endLine);
    } else {
      state.md.block.tokenize(state, startLine, endLine);
			// return true?
    }

    // If any of list item is tight, mark list as tight
    if (!state.tight || prevEmptyEnd) {
      tight = false;
    }
    // Item become loose if finish with empty line,
    // but we should filter last element, because it means list finish
    prevEmptyEnd = (state.line - startLine) > 1 && state.isEmpty(state.line - 1);

    state.blkIndent = state.listIndent;
    state.listIndent = oldListIndent;
    state.tShift[startLine] = oldTShift;
    state.sCount[startLine] = oldSCount;
    state.tight = oldTight;

    liToken        = state.push("list_item_close", "li", -1);
    liToken.markup = String.fromCharCode(markerCharCode);

    nextLine = startLine = state.line;
    itemLines[1] = nextLine;
     contentStart = state.bMarks[startLine];

    if (nextLine >= endLine) { break; }

    //
    // Try to check if list is terminated or continued.
    //
    if (state.sCount[nextLine] < state.blkIndent) { break; }

    // if it's indented more than 3 spaces, it should be a code block
    if (state.sCount[startLine] - state.blkIndent >= 4) { break; }

    // fail if terminating block found
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) {
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true;
        break;
      }
    }
    if (terminate) { break; }

    // fail if list has another type
    if (isOrdered) {
      posAfterMarker = skipOrderedListMarker(state, nextLine);
      if (posAfterMarker < 0) { break; }
      start = state.bMarks[nextLine] + state.tShift[nextLine];
    } else {
      posAfterMarker = skipBulletListMarker(state, nextLine);
      if (posAfterMarker < 0) { break; }
    }

    if (markerCharCode !== state.src.charCodeAt(posAfterMarker - 1)) { break; }
  }

  // Finalize list
  if (isOrdered) {
    ulOlToken = state.push("ordered_list_close", "ol", -1);
  } else {
    ulOlToken = state.push("bullet_list_close", "ul", -1);
  }
  ulOlToken.markup = String.fromCharCode(markerCharCode);

  listLines[1] = nextLine;
  state.line = nextLine;

  state.parentType = oldParentType;

  // mark paragraphs tight if needed
  if (tight) {
    markTightParagraphs(state, listTokIdx);
  }

  return true;
};

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
const collapsiblePlugin: PluginSimple = (md) => {
	md.block.ruler.before("fence", "collapsible", coreRule, {
		alt: ["paragraph", "reference", "blockquote", "list"],
	});
	md.renderer.rules.collapsible_summary = renderSummary;
	md.block.ruler.before("list", "classy_li", classyList);
};

export default collapsiblePlugin;
