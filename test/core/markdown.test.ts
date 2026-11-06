import { expect, test } from "bun:test";
import { imageLinks, browserUrl } from "../../src/github/core/markdown.ts";

test("relative image links open against the issue URL, while unsafe schemes never open", () => {
  const base = "https://github.com/lw396/herdr-plugin-github/issues/13";
  expect(browserUrl("docs/a.png", base)).toBe("https://github.com/lw396/herdr-plugin-github/issues/docs/a.png");
  expect(browserUrl("/user-attachments/assets/screenshot", base)).toBe("https://github.com/user-attachments/assets/screenshot");
  expect(browserUrl("//cdn.example.com/a.png", base)).toBe("https://cdn.example.com/a.png");
  expect(browserUrl("https://example.com/a.png", base)).toBe("https://example.com/a.png");
  expect(browserUrl("javascript:alert(1)", base)).toBeNull();
});

// Expected values from the WHATWG URL resolution examples (and Herdr's URL, checked in QuickJS).
test("relative links resolve dot segments and encode spaces before opening", () => {
  const base = "https://github.com/o/r/issues/13";
  expect(browserUrl("../../blob/main/x.md", base)).toBe("https://github.com/o/blob/main/x.md");
  expect(browserUrl("./a.png", base)).toBe("https://github.com/o/r/issues/a.png");
  expect(browserUrl("a b.png", base)).toBe("https://github.com/o/r/issues/a%20b.png");
  expect(browserUrl("HTTPS://Example.com/A", base)).toBe("https://example.com/A");
  expect(browserUrl("http://[::1", base)).toBeNull();
});

test("HTML comments stay literal and visible HTML image entities are decoded", () => {
  expect(imageLinks('<!-- ![example](hidden.png) <img src="hidden.png"> -->\n\n<img src="https://example.com/a&#38;b.png">'))
    .toBe('<!-- ![example](hidden.png) <img src="hidden.png"> -->\n\n[🖼 图片](<https://example.com/a&b.png>)');
});

test("source offsets preserve emoji, CRLF, blockquotes and repeated image-like code", () => {
  expect(imageLinks("🙂 `![a](a.png)`\r\n\r\n> ![a](a.png)\r\n"))
    .toBe("🙂 `![a](a.png)`\r\n\r\n> [🖼 图片](<a.png>)\r\n");
  expect(imageLinks('<div>\r\n  <img src="a&amp;b">\r\n</div>'))
    .toBe("<div>\r\n  [🖼 图片](<a&b>)\r\n</div>");
});

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
