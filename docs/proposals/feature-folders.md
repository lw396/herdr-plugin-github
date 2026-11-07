# 提议：`src/github/` 改为“先按功能、再按层”的文件夹结构

状态：**提议，未采纳**。采纳时把结论写成 ADR（`docs/adr/`），并按本文“执行步骤”一次做完。

## 现状

`src/github/` 按层分为三个文件夹，`test/layers.test.ts` 强制执行：

- `core/`：纯逻辑，不 import `herdr`，Bun 直接测（`test/core/`）。
- `io/`：调用 Herdr 和 gh/git，用 `test/fake-herdr.ts` 测（`test/io/`）。
- `views/`：gpui 界面，保持很薄，靠 Herdr 加载检查和在 Mac 上实际操作验证。

约 42 个源文件，同一功能在三层里基本用同名文件（`core/issues.ts`、`io/issues.ts`、`views/issues.ts`）。
**这个规模下现结构可行**，本提议不是为了修什么问题，而是为功能增长做准备。

## 为什么以后要改

- 按层分，同一个功能散在三个文件夹：改 issue 列表通常要同时动 `core/issues.ts`、`io/issues.ts`、`views/issues.ts`、`views/panel.ts`。
  git 历史里 `views/panel.ts`（23 次）、`views/issue.ts`、`io/known.ts`、`io/issues.ts` 改动最频繁，且常一起改。
- 路线图还要加 Actions、通知、PR diff 和 review。全部加进来后 `core/` 会到 30–40 个文件，
  一层平铺就看不出哪些文件属于同一个功能，也看不出功能之间谁依赖谁。
- 分层规则只管“core 不碰 Herdr、io 不碰界面”，不管功能之间的依赖方向；
  现在已经有通用代码依赖具体功能的苗头（如 `views/ui.ts` import `core/pulls.ts` 的 `PullState`）。

## 何时执行

满足任一条就做，不必提前：

- 开始做 Actions、通知或 PR diff/review 中的第一个；
- `core/` 超过约 30 个文件；
- 一次普通的功能改动经常要碰 3 个以上文件夹。

## 目标结构

每个功能文件夹内部仍分 `core/`、`io/`、`views/`，原有分层规则不变；另加一条**功能之间的依赖方向**。

```
src/github/
  main.ts  runtime.d.ts  mod.json  assets/
  shared/    gh 和 git 的调用、焦点文件夹、缓存、条件轮询、时间、主题等通用部件
  detail/    原生详情标签页：DetailRef、导航、页面公共部件、Projects、Markdown、评论
  sidebar/   侧边栏分组框架：可折叠分组、分页、列表提示、页脚文案、可见性
  issues/    Issues 标签页和 issue 页
  pulls/     Pull Requests 标签页和 PR 页
  roles/     组装各功能的三个角色：panel（侧边栏）、reader（详情标签页）、pane（窗格标题）
```

依赖方向（只能 import 同级或更低层；同级的 `issues/` 与 `pulls/` 互不 import）：

```
shared  <  detail  <  sidebar  <  issues = pulls  <  roles  <  main.ts
```

以后新功能（`actions/`、`notifications/`、PR 的 `review/`）与 `issues/`、`pulls/` 同级。

## 文件对应表

| 现在 | 以后 |
| --- | --- |
| `core/gh.ts` | `shared/core/gh.ts` |
| `core/account.ts` | `shared/core/account.ts` |
| `core/remote.ts` | `shared/core/remote.ts` |
| `core/location.ts` | `shared/core/location.ts` |
| `core/cache.ts` | `shared/core/cache.ts` |
| `core/polling.ts` | `shared/core/polling.ts` |
| `core/time.ts` | `shared/core/time.ts` |
| `io/gh.ts` | `shared/io/gh.ts` |
| `io/git.ts` | `shared/io/git.ts` |
| `io/context.ts` 的 `location()` | `shared/io/context.ts` |
| `io/known.ts` 的 `facts()` | `shared/io/facts.ts` |
| `io/known.ts` 的 account、remote | `shared/io/place.ts` |
| `views/ui.ts`（不含 `PULL_STATES`） | `shared/views/ui.ts` |
| `core/detail.ts` | `detail/core/detail.ts` |
| `core/markdown.ts` | `detail/core/markdown.ts`（仍是唯一允许 import 解析库的 core 模块） |
| `core/discussion.ts` | `detail/core/discussion.ts` |
| `core/labels.ts` | `detail/core/labels.ts` |
| `core/projects.ts` | `detail/core/projects.ts` |
| `io/detail-tabs.ts` | `detail/io/detail-tabs.ts` |
| `io/projects.ts` | `detail/io/projects.ts` |
| `views/detail.ts` | `detail/views/detail.ts` |
| `core/page.ts` | `sidebar/core/page.ts` |
| `core/sidebar.ts` | `sidebar/core/sidebar.ts` |
| `core/visibility.ts` | `sidebar/core/visibility.ts` |
| `io/context.ts` 的 `sidebarVisible()` | `sidebar/io/visible.ts` |
| `io/known.ts` 的 `pagedGroups()` 和 `Ready` | `sidebar/io/groups.ts` |
| `views/groups.ts` | `sidebar/views/groups.ts` |
| `core/issues.ts` | `issues/core/issues.ts` |
| `core/issue-detail.ts` | `issues/core/issue-detail.ts` |
| `core/activity.ts` | `issues/core/activity.ts` |
| `io/issues.ts` | `issues/io/issues.ts` |
| `io/changes.ts` | `issues/io/changes.ts`（只传 issue 的写入） |
| `io/known.ts` 的 issue 分组和 `issueChanged` | `issues/io/groups.ts` |
| `views/issues.ts` | `issues/views/issues.ts` |
| `views/issue.ts` | `issues/views/issue.ts` |
| `core/pulls.ts` | `pulls/core/pulls.ts` |
| `core/pull-detail.ts` | `pulls/core/pull-detail.ts` |
| `io/pulls.ts` | `pulls/io/pulls.ts` |
| `io/known.ts` 的 PR 分组和本地分支分组 | `pulls/io/groups.ts` |
| `views/pulls.ts` | `pulls/views/pulls.ts` |
| `views/pull.ts` | `pulls/views/pull.ts` |
| `views/ui.ts` 的 `PULL_STATES` | `pulls/views/state.ts` |
| `views/panel.ts` | `roles/panel.ts` |
| `views/reader.ts` | `roles/reader.ts` |
| `views/pane.ts` | `roles/pane.ts` |

需要顺手拆开的两个地方：

- **`io/known.ts`**：它同时缓存账号、remote、issue 分组和 PR 分组，正好横跨四个功能。
  拆成表中五处后，`issueChanged` 和 issue 分组的缓存键放在一起，本地分支分组的特殊分页留在 `pulls/`。
- **`views/ui.ts` 的 `PULL_STATES`**：移到 `pulls/views/state.ts`，`shared/` 就不再依赖 `pulls/`。

## 测试

- 测试文件跟着源码走：`test/<功能>/core/*.test.ts`、`test/<功能>/io/*.test.ts`，例如
  `test/core/issues.test.ts` → `test/issues/core/issues.test.ts`，`test/io/known.test.ts` 按上表拆到
  `test/shared/io/place.test.ts`、`test/issues/io/groups.test.ts`、`test/pulls/io/groups.test.ts`。
- `test/fake-herdr.ts`、`test/preload.ts`、`test/fixtures/`、`test/smoke/` 位置不变。
  测试文件变深一层，用 `join(import.meta.dir, "../fixtures", …)` 或 `new URL("../fixtures/…", import.meta.url)`
  读样本的地方都要改成 `../../fixtures`；最好加一个 `test/fixture.ts` 统一读样本，以后不受深度影响。
- `test/layers.test.ts` 改写成两条规则，都对每个功能文件夹执行：
  1. 分层（不变）：`*/core/` 只 import 其他 `*/core/`，且只有 `detail/core/markdown.ts` 能 import
     `mdast-util-from-markdown`、`htmlparser2`、`mdast`；`*/io/` 不 import `gpui-*`、`*/views/` 和 `roles/`。
  2. 方向（新增）：按上面的顺序，一个功能文件夹只能 import 同级或更低的文件夹，`issues/` 和 `pulls/` 互不 import。
     先写这条规则并让它在旧结构上失败，再搬文件让它通过。

## 要同步修改的文档

- `AGENTS.md`：第 9 行（分层）、第 11 行（`io/gh.ts`、`io/context.ts`）、第 15 行（`views/ui.ts`）。
- `docs/agents/build.md`：`core/markdown.ts` 白名单一段。
- `docs/agents/herdr.md`：`io/gh.ts`、`src/github/views/pane.ts` 两处路径。
- `docs/agents/testing.md`：`test/core/`、`test/io/` 两个测试接缝改为 `test/<功能>/core|io/`。
- `README.md` 不涉及内部路径，不用改。

构建不受影响：入口仍是 `src/github/main.ts`，素材路径仍是 `mods/github/assets/…`，`scripts/` 不用改。
`mods/github/main.js` 只有打包注释里的源文件路径会变。

## 执行步骤

1. 新建分支；先改 `test/layers.test.ts`，加上依赖方向规则，确认它在旧结构上失败。
2. 拆 `io/known.ts`，把 `PULL_STATES` 移出 `views/ui.ts`，都还在旧文件夹里做，跑 `bun test` 确认行为不变。
3. 用 `git mv` 按对应表搬源文件和测试文件（保留历史），批量改 import 路径和样本路径。
4. 更新上节列出的文档。
5. 跑 `bun run verify`，重新构建并提交 `mods/github/`，再跑 `bun run check:built`。
6. 用 `scripts/review-patch.sh <base>` 生成补丁给评审；最后在 Mac 上打开侧边栏和一个 issue、一个 PR 标签页确认没问题。

这次改动只搬文件和改路径，不改行为；第 2 步之外不要顺带做别的重构，评审时才看得清。

## 考虑过但不选的做法

- **层内再分功能**（`core/issues/…`、`io/issues/…`）：功能仍散在三个顶层文件夹，没解决主要问题。
- **功能文件夹里用后缀区分层**（`issues/issues.core.ts`）：文件夹少一层，但分层只能靠文件名约定，
  `layers.test.ts` 要按后缀判断，读目录时也不如子文件夹清楚。
- **保持现状**：在执行条件出现之前，这就是当前的选择。
