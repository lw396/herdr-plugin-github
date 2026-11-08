# `src/github/` 先按功能、再按层分文件夹

`src/github/` 以前只按层分成 `core/`、`io/`、`views/`。做完 PR diff 和 review 后 `core/` 超过 30 个文件，一次普通的功能改动常常要同时动三个文件夹，平铺的目录也看不出哪些文件属于同一个功能、功能之间谁依赖谁。
现在先按功能分文件夹，每个功能文件夹里仍分 `core/`、`io/`、`views/`，分层规则不变：`shared/`（gh、git、焦点文件夹、缓存、轮询、主题）、`detail/`（详情标签页、Markdown、讨论、Projects、写入通知）、`sidebar/`（分组框架、悬浮预览、可见性）、`issues/`、`pulls/`（含 diff 和 review），再由 `roles/` 组装三个角色。
另加一条依赖方向：`shared < detail < sidebar < issues = pulls < roles < main.ts`，只能 import 同级或更低层，同级的功能互不 import。`test/layers.test.ts` 执行这两条规则，测试文件放在 `test/<功能>/core|io/`，跟着源码走。新功能（如 Actions、通知）与 `issues/`、`pulls/` 同级，并加进那张表。
唯一的例外是 `detail/io/changes.ts` 只用 `import type` 引用 `issues/core/issues.ts` 的 `IssueChange`：写入通知里带着 issue 的新行，侧边栏不用重新请求就能移动它。
没有选“层内再分功能”（功能仍散在三个顶层文件夹），也没有选“用文件名后缀区分层”（分层只能靠命名约定）。
