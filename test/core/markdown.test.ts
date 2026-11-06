import { expect, test } from "bun:test";
import { imageLinks } from "../../src/github/core/markdown.ts";

// CommonMark image examples, plus GitHub's pasted screenshot HTML.
test("an inline image becomes a browser link with the agreed label", () => {
  expect(imageLinks("Before ![screenshot](https://example.com/screen.png) after"))
    .toBe("Before [🖼 图片](<https://example.com/screen.png>) after");
});

test("code examples and escaped image syntax stay literal", () => {
  const source = [
    "`![example](https://example.com/a.png)`",
    "\\![escaped](https://example.com/b.png)",
    "```md", "![code](https://example.com/c.png)", "```",
    "~~~markdown", "![code](https://example.com/d.png)", "~~~",
    "    ![indented code](https://example.com/e.png)",
  ].join("\n");
  expect(imageLinks(source)).toBe(source);
});

test("image destinations may have titles, spaces in angle brackets and balanced parentheses", () => {
  expect(imageLinks('![a](https://example.com/a_(1).png "Title") ![b](<https://example.com/a b.png>)'))
    .toBe("[🖼 图片](<https://example.com/a_(1).png>) [🖼 图片](<https://example.com/a b.png>)");
});

test("GitHub pasted HTML images become links, not network image requests", () => {
  expect(imageLinks('<img width="500" alt="截图" src="https://github.com/user-attachments/assets/abc" />'))
    .toBe("[🖼 图片](<https://github.com/user-attachments/assets/abc>)");
});

test("nested brackets in image descriptions cannot bypass image preprocessing", () => {
  expect(imageLinks("![a [nested] description](https://example.com/s.png)"))
    .toBe("[🖼 图片](<https://example.com/s.png>)");
});

test("reference images keep their destinations without changing ordinary links", () => {
  expect(imageLinks("![shot][screen] ![screen][] ![screen] [docs][screen]\n\n[screen]: https://example.com/s.png \"Screenshot\""))
    .toBe("[🖼 图片](<https://example.com/s.png>) [🖼 图片](<https://example.com/s.png>) [🖼 图片](<https://example.com/s.png>) [docs][screen]\n\n[screen]: https://example.com/s.png \"Screenshot\"");
});
