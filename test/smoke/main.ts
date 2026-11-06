// Herdr smoke mod: runs real parser and reader paths inside Herdr's QuickJS (scripts/smoke.sh).
import { View } from "gpui-kit";
import { Issue } from "../../src/github/views/issue.ts";
import { imageLinks, browserUrl, issueLink, readerMarkdown } from "../../src/github/core/markdown.ts";
import { parseIssueDetail } from "../../src/github/core/issue-detail.ts";
import issue from "../fixtures/issue-plugin-13.json";
import events from "../fixtures/timeline-plugin-13.json";

function expectEqual(actual: string, expected: string, what: string): void {
  if (actual !== expected) throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

export default class Smoke extends View {
  role = new Issue();

  init(): void {
    expectEqual(imageLinks("![a](img.png) `![code](x.png)`"), "[🖼 图片](<img.png>) `![code](x.png)`", "Markdown images");
    expectEqual(imageLinks('<!-- <img src="hidden"> -->\n\n<img src="a&#38;b">'),
      '<!-- <img src="hidden"> -->\n\n[🖼 图片](<a&b>)', "HTML images");
    const base = "https://github.com/o/r/issues/13";
    expectEqual(String(browserUrl("../../blob/main/x.md", base)), "https://github.com/o/blob/main/x.md", "URL dot segments");
    expectEqual(String(browserUrl("a b.png", base)), "https://github.com/o/r/issues/a%20b.png", "URL encoding");
    expectEqual(String(browserUrl("javascript:alert(1)", base)), "null", "URL scheme policy");
    expectEqual(String(browserUrl("http://[::1", base)), "null", "invalid URL");
    expectEqual(JSON.stringify(issueLink("https://www.github.com/O/R/issues/7#issuecomment-1", base)), '{"repo":"o/r","number":7}', "issue link");
    expectEqual(String(issueLink("https://github.com/o/r/pull/7", base)), "null", "PR link");
    expectEqual(readerMarkdown("see #7, a#8 `#9`", base), "see [#7](<https://github.com/o/r/issues/7>), a#8 `#9`", "issue references");
    const detail = parseIssueDetail(issue, events);
    expectEqual(`${detail.comments.length} comments, ${detail.activities.length} activities`, "2 comments, 3 activities", "timeline");
    this.role.wide = true;
    this.role.ref = { repo: "lw396/herdr-plugin-github", number: 13 };
    this.role.history = [{ repo: "lw396/herdr-plugin-github", number: 12 }];
    this.role.entry = {
      key: "lw396/herdr-plugin-github#13", loading: false, projectsLoading: false,
      projects: { ok: false, message: "Projects require read:project." },
      issue: detail,
    };
  }

  render(cx: Parameters<Issue["render"]>[0]) {
    return this.role.render(cx);
  }
}
