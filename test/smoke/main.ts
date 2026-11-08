// Herdr smoke mod: runs real parser and reader paths inside Herdr's QuickJS (scripts/smoke.sh).
import { HoverCard, h_flex, TextareaState } from "gpui-base";
import { type AsyncContext, type Context, div, View } from "gpui-kit";
import { parsePatch } from "../../src/github/core/diff.ts";
import { parseComment } from "../../src/github/core/discussion.ts";
import { parseFiles } from "../../src/github/core/files.ts";
import { parseIssueDetail } from "../../src/github/core/issue-detail.ts";
import { browserUrl, detailLink, readerMarkdown } from "../../src/github/core/markdown.ts";
import { PREVIEW_CLOSE_MS, PREVIEW_OPEN_MS, parsePreview } from "../../src/github/core/preview.ts";
import { PublishedComments } from "../../src/github/core/published-comments.ts";
import { parsePullDetail } from "../../src/github/core/pull-detail.ts";
import { pullTimeline } from "../../src/github/core/pull-timeline.ts";
import { parseThreads, threadRow } from "../../src/github/core/review-threads.ts";
import { DetailMetadata, labels, people } from "../../src/github/views/detail.ts";
import { FileDiff } from "../../src/github/views/diff.ts";
import { ChangedFiles } from "../../src/github/views/files.ts";
import { previewCard } from "../../src/github/views/preview.ts";
import { timelineItem } from "../../src/github/views/pull-timeline.ts";
import { Reader } from "../../src/github/views/reader.ts";
import { commentEditor, ReviewThreads } from "../../src/github/views/review-threads.ts";
import issue from "../fixtures/issue-plugin-13.json";
import pull from "../fixtures/pull-cli-14974.json";
import pullComments from "../fixtures/pull-cli-14974-comments.json";
import pullIssue from "../fixtures/pull-cli-14974-issue.json";
import pullReviews from "../fixtures/pull-cli-14974-reviews.json";
import publishedComment from "../fixtures/pull-plugin-35-comment-right.json";
import filePages from "../fixtures/pull-plugin-35-files.json";
import inlinePages from "../fixtures/pull-plugin-35-inline.json";
import threadPages from "../fixtures/pull-plugin-35-threads.json";
import inline36 from "../fixtures/pull-plugin-36-inline.json";
import review36 from "../fixtures/pull-plugin-36-reviews.json";
import events from "../fixtures/timeline-plugin-13.json";

function expectEqual(actual: string, expected: string, what: string): void {
	if (actual !== expected)
		throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

/** Images only: a page outside github.com has no repository for #123 references. */
const imageLinks = (markdown: string): string => readerMarkdown(markdown, "https://example.com/");

export default class Smoke extends View {
	readers: Reader[] = [];
	files: ChangedFiles | null = null;
	threadDiff = new FileDiff();
	discussions: ReviewThreads | null = null;
	replyDraft: TextareaState | null = null;

	init(_props: unknown, cx: AsyncContext): void {
		this.replyDraft = TextareaState.new({ placeholder: "Reply…" });
		// The readers' own init: the issue page's comment box (TextareaState) must be creatable in QuickJS.
		const pr = new Reader();
		const issues = new Reader();
		this.readers = [pr, issues];
		for (const reader of this.readers) {
			reader.init(cx);
			reader.layout = "wide";
		}

		const files = parseFiles(filePages.flat()).map((file, index) => ({ ...file, viewed: index === 0 }));
		const fileRef = { kind: "pr", repo: "lw396/herdr-plugin-github", number: 35 } as const;
		this.threadDiff.init();
		this.discussions = new ReviewThreads(fileRef, "center", {
			reader: "smoke-threads",
			active: () => true,
			previous: () => null,
			follow: () => {},
			back: () => {},
		});
		// Exercise the native state lifecycle: create in init, then render the real summary below.
		this.discussions.init();
		this.discussions.init(); // Re-initializing must retain the same editor and its draft.
		this.discussions.threads = parseThreads(
			threadPages.data.repository.pullRequest.reviewThreads
				.nodes as import("../../src/github/core/review-threads.ts").ThreadNode[],
			inlinePages.flat(),
			"https://github.com/lw396/herdr-plugin-github/pull/35",
		);
		const threadFile = files.find((file) => file.path === "docs/pr-fixture.md")!;
		expectEqual(
			String(threadRow(parsePatch(threadFile.patch ?? ""), this.discussions.threads[0]!)),
			"3",
			"thread RIGHT anchor in QuickJS",
		);
		const acknowledged = new PublishedComments();
		acknowledged.add(parseComment(publishedComment, "https://github.com/lw396/herdr-plugin-github/pull/35"), {
			path: "docs/pr-fixture.md",
			side: "RIGHT",
			line: 2,
			outdated: false,
		});
		expectEqual(
			String(acknowledged.threads([])[0]?.root),
			"4502971530",
			"published diff comment survives stale QuickJS read",
		);
		expectEqual(
			String(acknowledged.timeline([])[0]?.discussion[0]?.comment.id),
			"4502971530",
			"published timeline comment survives stale QuickJS read",
		);
		this.threadDiff.jump(4502780899);
		for (const path of ["src/github/core/time.ts", "docs/adr/0005-one-repository-renamed.md"]) {
			const reader = new Reader();
			reader.init(cx);
			reader.navigation.open(fileRef);
			reader.pull.ref = fileRef;
			reader.pull.files = new ChangedFiles(`smoke-${path}`, fileRef, "center", (cx, selected) =>
				reader.pull.select(cx, selected),
			);
			reader.pull.files.files = files;
			reader.pull.select(cx, path);
			this.readers.push(reader);
		}
		this.files = new ChangedFiles("smoke-file-tree", fileRef, "center", () => {});
		this.files.files = files;
		const ref = { kind: "pr", repo: "cli/cli", number: 14974 } as const;
		pr.navigation.open(ref);
		pr.pull.ref = ref;
		pr.pull.entry = {
			loading: false,
			projectsLoading: false,
			projects: { ok: true, projects: [] },
			pull: parsePullDetail({
				pull,
				issue: pullIssue,
				repository: {},
				comments: pullComments.flat(),
				reviews: pullReviews.flat(),
				events: [],
				inline: [],
				checkRuns: { check_runs: [] },
				statuses: [],
			}),
		};
		expectEqual(pr.pull.entry.pull?.state ?? "", "closed", "PR state");
		expectEqual(parsePreview(pull, "pr").summary, "probe", "hover summary in QuickJS");
		expectEqual(
			JSON.stringify(detailLink("https://github.com/cli/cli/pull/14976", pull.html_url)),
			'{"kind":"pr","repo":"cli/cli","number":14976}',
			"PR navigation",
		);

		expectEqual(
			imageLinks("![a](img.png) `![code](x.png)`"),
			"[🖼 图片](<img.png>) `![code](x.png)`",
			"Markdown images",
		);
		expectEqual(
			imageLinks('<!-- <img src="hidden"> -->\n\n<img src="a&#38;b">'),
			'<!-- <img src="hidden"> -->\n\n[🖼 图片](<a&b>)',
			"HTML images",
		);
		const base = "https://github.com/o/r/issues/13";
		expectEqual(
			String(browserUrl("../../blob/main/x.md", base)),
			"https://github.com/o/blob/main/x.md",
			"URL dot segments",
		);
		expectEqual(String(browserUrl("a b.png", base)), "https://github.com/o/r/issues/a%20b.png", "URL encoding");
		expectEqual(String(browserUrl("javascript:alert(1)", base)), "null", "URL scheme policy");
		expectEqual(String(browserUrl("http://[::1", base)), "null", "invalid URL");
		expectEqual(
			JSON.stringify(detailLink("https://www.github.com/O/R/issues/7#issuecomment-1", base)),
			'{"kind":"issue","repo":"o/r","number":7}',
			"issue link",
		);
		expectEqual(
			readerMarkdown("see #7, a#8 `#9`", base),
			"see [#7](<https://github.com/o/r/issues/7>), a#8 `#9`",
			"issue references",
		);

		const detail = parseIssueDetail(issue, events);
		expectEqual(
			`${detail.comments.length} comments, ${detail.activities.length} activities`,
			"2 comments, 3 activities",
			"timeline",
		);
		const issue13 = { kind: "issue", repo: "lw396/herdr-plugin-github", number: 13 } as const;
		issues.navigation.open({ ...issue13, number: 12 });
		issues.navigation.follow(issue13);
		issues.issue.ref = issue13;
		issues.issue.draft = "A comment";
		issues.issue.entry = {
			key: "lw396/herdr-plugin-github#13",
			loading: false,
			projectsLoading: false,
			projects: { ok: false, message: "Projects require read:project." },
			issue: detail,
		};
	}

	/** Exercise every metadata branch during a native snapshot, where callbacks may be registered. */
	private metadataSamples() {
		const detail = parseIssueDetail(issue, events);
		const metadata = new DetailMetadata();
		return [false, true].flatMap((expanded) => {
			metadata.expanded = expanded;
			return (["compact", "narrow", "wide"] as const).map((layout) => {
				const sample = metadata.render(layout, [
					["Assignees", people(detail.assignees, "None yet")],
					["Labels", labels(detail.labels), detail.labels.length],
				]);
				expectEqual(String(metadata.expanded), String(expanded), "resize keeps metadata disclosure");
				return sample;
			});
		});
	}

	render(cx: Context) {
		return h_flex()
			.size_full()
			.children(this.readers.map((reader) => div().flex_1().child(reader.render(cx))))
			.children(this.metadataSamples())
			.child(this.files?.render(cx) ?? div())
			.child(commentEditor(this.replyDraft!, 80))
			.child(this.discussions!.summary("63f52f1dddd87eecbe02a9013523124921ee4345"))
			.child(
				this.threadDiff.render(
					this.files!.files!.find((file) => file.path === "docs/pr-fixture.md")!,
					this.discussions ?? undefined,
					"63f52f1dddd87eecbe02a9013523124921ee4345",
				),
			)
			.child(
				this.discussions!.timeline(
					this.discussions!.threads[0]!,
					this.files!.files!.find((file) => file.path === "docs/pr-fixture.md")!.patch ?? "",
					() => {},
				),
			)
			.children(
				pullTimeline(
					[],
					[
						...events,
						{
							id: 90000001,
							event: "committed",
							sha: "abcdef1",
							message: "Fix #29 — [details](https://example.com/review)\n\nCo-authored-by: Valian <dev@example.com>",
							author: { name: "smoke", date: "2026-11-07T00:00:00Z" },
						},
						{
							id: 90000002,
							event: "committed",
							sha: "1234567",
							message: "Expanded commit\n\nDetails with #29 and [a link](https://example.com/review).",
							author: { name: "smoke", date: "2026-11-07T00:00:01Z" },
						},
					],
					review36.flat(),
					inline36.flat(),
					"https://github.com/lw396/herdr-plugin-github/pull/36",
				).map((item) =>
					timelineItem(
						item,
						null,
						() => {},
						() => {},
						{ expanded: item.id === 90000002, toggle: () => {} },
					),
				),
			)
			.child(
				HoverCard.new("smoke-hover")
					.open_delay(PREVIEW_OPEN_MS)
					.close_delay(PREVIEW_CLOSE_MS)
					.trigger(div().child("Hover preview"))
					.content(previewCard({ kind: "pr", repo: "cli/cli", number: 14974 }, parsePreview(pull, "pr"))),
			)
			.child(
				previewCard({ kind: "issue", repo: "lw396/herdr-plugin-github", number: 13 }, parsePreview(issue, "issue")),
			)
			.child(previewCard({ kind: "issue", repo: "o/r", number: 1 }, undefined))
			.child(previewCard({ kind: "pr", repo: "o/r", number: 2 }, undefined, "Not found"));
	}
}
