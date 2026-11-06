// Herdr smoke mod: runs real parser and reader paths inside Herdr's QuickJS (scripts/smoke.sh).
import { View } from "gpui-kit";
import { Issue } from "../../src/github/views/issue.ts";
import { imageLinks } from "../../src/github/core/markdown.ts";
import { parseIssueDetail } from "../../src/github/core/issue-detail.ts";
import { parseActivity } from "../../src/github/core/activity.ts";
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
    const timeline = events as { event: string }[];
    this.role.wide = true;
    this.role.ref = { repo: "lw396/herdr-plugin-github", number: 13 };
    this.role.entry = {
      loading: false, projectsLoading: false, activityLoading: false,
      projects: { ok: false, message: "Projects require read:project." },
      activity: { ok: true, activities: parseActivity(timeline) },
      issue: parseIssueDetail(issue, timeline.filter(e => e.event === "commented")),
    };
  }

  render(cx: Parameters<Issue["render"]>[0]) {
    return this.role.render(cx);
  }
}
