import { describe, expect, it  } from "vitest";
import mdi from "markdown-it";
import collapse from "~/plugin";

describe("markdown-it-collapsible", () => {
	const md = new mdi().use(collapse);
	
	it("using +++ starts out OPEN", () => {
		const result = md.render(`
# Hello
+++ this is my section
- one
- two
- three
+++
		`);
		
		expect(/<details class="collapsible" open>/.test(result)).toBeTruthy();
	});

	
	it.only("using ++> starts out CLOSED", () => {
		const result = md.render(`
# Hello
>>> this is my section
- one
- >>> two
    - 2a
		- 2b
- three
>>>
`);
		expect(/<details class="collapsible">/.test(result)).toBeTruthy();
		console.log(result);
		
	});

	
		it("just a list", () => {
			const result = md.render(`
# Hello
- one
- two
- three
`);
		});
	
});
