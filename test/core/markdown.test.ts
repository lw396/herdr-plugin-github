import { expect, test } from "bun:test";
import { imageLinks, browserUrl, issueLink, readerMarkdown } from "../../src/github/core/markdown.ts";

// GitHub autolinks #<number> to the issue's own repository, but not inside code, links or words.
test("plain #123 references become links to the issue's own repository, which open in the reader", () => {
  const base = "https://github.com/lw396/herdr-plugin-github/issues/14";
  const to = (n: number) => `[#${n}](<https://github.com/lw396/herdr-plugin-github/issues/${n}>)`;
  const prepared = readerMarkdown("Fixes #13, see (#12).\n\n#11 first", base);
  expect(prepared).toBe(`Fixes ${to(13)}, see (${to(12)}).\n\n${to(11)} first`);
  expect(issueLink("https://github.com/lw396/herdr-plugin-github/issues/13", base)).toEqual({ repo: "lw396/herdr-plugin-github", number: 13 });
});

test("#123 inside code, links, HTML, words, URLs and escapes stays as written", () => {
  const base = "https://github.com/o/r/issues/1";
  const source = [
    "`#1` [#2](https://example.com) [see #3](https://example.com) a#4 #5b x/#6 https://example.com/page#7 \\#8",
    "```", "#9", "```", "", "<div>#10</div>", "", "&#35;11 # 12",
  ].join("\n");
  expect(readerMarkdown(source, base)).toBe(source);
});

test("reader Markdown turns images and #123 into links together and marks an empty body", () => {
  const base = "https://github.com/o/r/issues/1";
  expect(readerMarkdown("![a](a.png) #2", base)).toBe("[🖼 图片](<a.png>) [#2](<https://github.com/o/r/issues/2>)");
  expect(readerMarkdown("", base)).toBe("_No text._");
  expect(readerMarkdown("[![#3](b.png)](https://ci.example.com)", base)).toBe("[[🖼 图片](<b.png>)](https://ci.example.com)");
});

// GitHub issue URLs: https://github.com/<owner>/<repo>/issues/<number>; pull requests use /pull/<number>.
test("links to the current repository's issues open in the reader; other repositories, PRs and pages do not", () => {
  const base = "https://github.com/lw396/herdr-plugin-github/issues/14";
  const issue13 = { repo: "lw396/herdr-plugin-github", number: 13 };
  expect(issueLink("https://github.com/lw396/herdr-plugin-github/issues/13", base)).toEqual(issue13);
  expect(issueLink("https://github.com/LW396/Herdr-Plugin-GitHub/issues/13#issuecomment-1", base)).toEqual(issue13);
  expect(issueLink("https://www.github.com/lw396/herdr-plugin-github/issues/13/", base)).toEqual(issue13);
  expect(issueLink("../issues/13", base)).toEqual(issue13);
  expect(issueLink("https://github.com/cli/cli/issues/13", base)).toBeNull();
  expect(issueLink("https://github.com/lw396/herdr-plugin-github/pull/19", base)).toBeNull();
  expect(issueLink("https://github.com/lw396/herdr-plugin-github/issues/new", base)).toBeNull();
  expect(issueLink("https://github.com/lw396/herdr-plugin-github/issues", base)).toBeNull();
  expect(issueLink("https://github.com/lw396/herdr-plugin-github/issues/0", base)).toBeNull();
  expect(issueLink("https://example.com/lw396/herdr-plugin-github/issues/13", base)).toBeNull();
  expect(issueLink("https://example.com/", base)).toBeNull();
  expect(issueLink("javascript:alert(1)", base)).toBeNull();
});

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
