import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { machine, reset } from "../fake-herdr.ts";
import { readIssueActivity } from "../../src/github/io/issues.ts";

afterEach(reset);
const fixture = readFileSync(new URL("../fixtures/timeline-plugin-13.json", import.meta.url), "utf8");

// Actual gh api repos/lw396/herdr-plugin-github/issues/13/timeline?per_page=100 --paginate.
test("label and assignment activity comes from the issue machine without duplicating comments", async () => {
  machine("center", { "~$ gh api repos/lw396/herdr-plugin-github/issues/13/timeline?per_page=100 --paginate": { stdout: fixture } });
  expect(await readIssueActivity("lw396/herdr-plugin-github", 13, "center")).toEqual({ ok: true, activities: [
    { id: 35331262662, kind: "labeled", actor: "lw396", createdAt: "2026-11-06T09:01:24Z", labels: [{ name: "wayfinder:task", color: "#0e8a16" }] },
    { id: 35331263090, kind: "labeled", actor: "lw396", createdAt: "2026-11-06T09:01:24Z", labels: [{ name: "ready-for-agent", color: "#006b75" }] },
    { id: 35356295613, kind: "assigned", actor: "lw396", createdAt: "2026-11-06T14:23:16Z", assignee: "lw396" },
  ] });
});

test("paginated activity output is decoded without repeating timeline comments", async () => {
  const events = JSON.parse(fixture);
  // Split the captured records into two non-empty pages in gh's concatenated-array format.
  const pages = JSON.stringify(events.slice(0, 2)) + JSON.stringify(events.slice(2));
  machine(null, { "~$ gh api repos/lw396/herdr-plugin-github/issues/13/timeline?per_page=100 --paginate": { stdout: pages } });
  const result = await readIssueActivity("lw396/herdr-plugin-github", 13, null);
  expect(result.ok ? result.activities.map(a => a.id) : null).toEqual([35331262662, 35331263090, 35356295613]);
});

test("missing gh is an optional activity notice with no local fallback", async () => {
  machine("center", {});
  machine(null, { "~$ gh api repos/lw396/herdr-plugin-github/issues/13/timeline?per_page=100 --paginate": { stdout: fixture } });
  expect(await readIssueActivity("lw396/herdr-plugin-github", 13, "center")).toEqual({
    ok: false, message: "Activity unavailable on center. cannot start gh: No such file or directory (os error 2)",
  });
});
