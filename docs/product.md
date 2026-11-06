# 产品

herdr-plugin-github 是什么、长什么样、按什么顺序做。这里记的是和项目负责人商定的决定：要改的话，先改这里，再改代码。

## 是什么

在 Herdr 里查看你正在用的那个仓库的 GitHub 内容：Issues、Pull Request 和 Actions 运行记录。功能参照 VS Code 的 GitHub Pull Requests 和 GitHub Actions 插件。

- **只看一个仓库：焦点文件夹所在的仓库。** 面板跟随 Herdr 的焦点文件夹，显示该文件夹 git remote 对应的 GitHub 仓库。不做跨仓库的视图（没有"我的所有 PR"，也没有跨仓库的通知收件箱；通知只看这个仓库的）。
- **gh 在文件夹所在的机器上执行。** 文件夹在本机就用本机的 gh；在远程机器上就用那台机器的 gh。两边不互相退回。那台机器没装 gh 或没登录时，显示提示（在那台机器上运行 `gh auth login`）。
  传给 gh 的仍然是从 `git remote -v` 解析出的 `owner/repo`，不用 gh 的 `{owner}/{repo}` 占位符。
  （还没实现：现在的 `gh.account()` 仍然优先用本机的 gh。README 和 AGENTS.md 会随代码一起改。）

## 放在哪

- **侧边栏**：点标签栏里 Files、Changes 旁边的 GitHub 按钮打开，宽约 300–400 px，只用来导航。这里只放列表，不放需要长时间阅读的内容。
- **详情窗格**：在主区域打开（`pane.split`，带上角色和 props，例如 `{ role: "issue", repo, number }`），显示一个 issue、一个 PR 或一次 run。每种详情是 `views/` 里的一个角色，由 `main.ts` 分发。窗格会随标签页保存，所以它的 props 里要带齐重新加载所需的全部信息。
- **终端**（`terminal.open`）：放内容长的或需要交互的操作，例如完整的 Actions 日志（`gh run view --log`）、跟随运行（`gh run watch`）、PR diff（`gh pr diff`）。`exec` 有 30 秒的时间限制，这些本来也只能放在终端里做。

## 侧边栏

```
┌ GitHub    owner/repo   ↻┐   标题栏：仓库名、刷新
│ Issues PRs Actions 通知3 │   标签页（通知带未读数）
│ ▾ 我的 Issues           │   列表（可滚动）：Issues 标签页是
│   ▾ v1.2                │   几组可折叠的查询（见下文 Issues）
│     #42 Login fails  →  │
│ ▸ 我创建的              │
│ ▸ 最近更新              │
│─────────────────────────│
│ ⎇ feat/x   ↑2 ↓0        │   当前分支（固定在底部）：
│ PR #43 Fix login     ✓  │   它的 PR、它上面最新的 run
│ CI ● running 2/5      ⟳ │
└─────────────────────────┘
```

- **标题栏**：显示仓库名和刷新按钮。出错时（没有 remote、没有 gh、404），在列表的位置显示错误。
- **标签页**：Issues · PRs · Actions · 通知，每个标签页的列表各有形式。标签页跟着功能一个个出现。
- **当前分支**：始终固定在底部，显示分支、它的 PR、它上面最新的 run。上方的列表单独滚动。点任意一行打开对应的详情窗格。

## 刷新

- 面板打开时、焦点文件夹变化时、点 ↻ 时刷新。
- 只有在显示的 run 处于排队或运行中时才轮询，每 10–20 秒一次；其他时候不轮询。（面板隐藏时计时器仍在运行，轮询要克制。）

## 写操作

只做少量写操作，每个都只是一条 gh 命令，在显示该对象的窗格或面板里执行。需要编辑器或要填很多字段的操作，交给终端里的 gh。

第 1–5 步只写 GitHub，不改本地仓库：git 只用来读（remote、当前分支）。新建、切换分支和 worktree 放到第 6、7 步。

## 顺序

1. **Issues**（第一版，见下文）
2. **Pull Request**：列表和窗格（描述、checks、review、评论）；在浏览器中打开、在终端里看 diff。merge、approve 和 review 评论以后再做。
3. **通知**（照 VS Code 插件的 Notifications 视图，它在那里还是实验功能）：只看这个仓库的通知
   （`repos/{owner}/{repo}/notifications`）；标签上显示未读数；点一条打开对应的 issue / PR 详情窗格；
   标为已读、标为完成、在浏览器中打开、加载更多。轮询按 GitHub 给的 `X-Poll-Interval`，用 `Last-Modified` 只在有变化时取全量（`gh api -i` 能拿到响应头）。
   不做：Copilot 排序和总结、跨仓库收件箱、系统弹窗。
4. **Actions**：仓库和当前分支的 run 列表；run 窗格显示 jobs 和 steps，以及失败 step 的最后几行日志；完整日志和 watch 在终端里看；可以重跑失败的 job、取消 run、触发 workflow_dispatch。
5. **底部的当前分支卡片**：第 1 步先显示分支，随 2、4 逐步补全（它的 PR、它最新的 run）。
6. **分支**（会改本地仓库，在文件夹所在的机器上执行）：checkout PR（`gh pr checkout`）；Issues 的开始处理 / 停止处理
   （VS Code 插件的 Start Working：为 issue 新建分支并切过去）。
7. **worktree**：VS Code 插件的"在 worktree 中检出"（Checkout in Worktree），删除分支时一起删 worktree。

在做第 1 步之前，先完成 gh 的改动（"gh 在文件夹所在的机器上执行"）。

## Issues（第一版）

照着 VS Code 的 GitHub Pull Requests 插件（下称"VS Code 插件"）做：它的
[IssueFeatures.md](https://github.com/microsoft/vscode-pull-request-github/blob/main/documentation/IssueFeatures.md)，
以及 `package.json` 里的 `githubIssues.*` 设置和 `issue.*` 命令。依赖代码编辑器的功能 Herdr 里没有对应的地方，不做。

### 侧边栏的 Issues 标签页

- 列表由几条**查询**组成，每条是一个可折叠的分组，和插件的默认查询相同：
  - **我的 Issues**：`is:open assignee:<我> repo:<owner/repo>`，再按 milestone 分组；
  - **我创建的**：`author:<我> state:open repo:<owner/repo> sort:created-desc`；
  - **最近更新**：`state:open repo:<owner/repo> sort:updated-desc`。

  `<我>` 是 gh 登录的用户，查询用的是 GitHub 的搜索语法。这三条是固定的，不能自定义（插件的 `githubIssues.queries` 先不做）。

- 每行显示编号、标题、负责人。
- 标题栏按钮：刷新、新建 issue。
- 每行的操作（悬停按钮或右键菜单）：打开详情、在浏览器中打开、复制链接、复制编号。
  浏览器和剪贴板用 Herdr 提供的 `cx.open_url`、`cx.write_to_clipboard`。

### Issue 详情窗格

- 显示标题、状态、作者、标签、负责人、milestone；正文和评论按时间线排列，用 Markdown 渲染（`TextView.markdown`）。
- 操作：评论（`Textarea`）、关闭 / 重新打开、在浏览器中打开、复制链接。
- 编辑标题、标签、负责人、milestone：第一版先去浏览器里改。

### 新建 issue

插件先让你输入标题，需要时再打开一个编辑器填标题、负责人、标签和正文。这里对应成一个**新建 issue 窗格**：
标题、正文（`Textarea`）、负责人、标签；提交后打开新 issue 的详情窗格。

### 不做

- 从 `TODO` 注释或选中的代码创建 issue（CodeLens / code action）；
- 输入 `#` / `@` 时补全 issue 和用户，以及悬停卡片；
- 复制代码的 GitHub permalink；
- Copilot 相关功能（交给 coding agent、总结 issue）；
- 开始处理 / 停止处理（Start Working）：第一版不做，放在第 6 步（分支）。
