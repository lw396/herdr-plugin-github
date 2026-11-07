# herdr-plugin-github

在 Herdr 里查看和处理一个 GitHub 仓库的 Issues、Pull Request、Actions 和通知。

## 产品

**GitHub mod**：
本项目做的东西：Herdr 里的一个 mod。
_避免_：插件、扩展

**VS Code 插件**：
VS Code 的 GitHub Pull Requests 扩展，本项目功能的参照对象。只指它，不指本项目。
_避免_：插件（单独使用）

## 界面

**侧边栏**：
右侧和 Files、Changes 叠在一起的导航列表，点标签栏里的 GitHub 按钮打开。
_避免_：面板

**分组**：
侧边栏一个标签页里可折叠的一组列表，如"正在等待我的审阅"、"全部打开"。
_避免_：分支、类别、查询

**详情窗格**：
主区域里显示一个 issue、PR 或 run 的窗格，独占一个 Herdr 原生标签页，与终端标签页并列；从侧边栏打开的不同 issue、PR 各有自己的标签页；在详情窗格里点同一仓库的 issue 或 PR 链接时，这个标签页改为显示那个对象，可以"返回"上一个。PR 的详情窗格显示描述或其中一个改动文件的 diff。
_避免_：详情页、详情面板

## Review

**本地拉取请求分支**：
焦点文件夹里有对应 PR 的本地分支；也是 PRs 标签页里列出这些 PR 的分组名。
_避免_：本地 PR、已 checkout 的 PR

**待提交 review**：
我在一个 PR 上已经开始、还没提交的 review，存在 GitHub 上，包含行内评论草稿；每人每个 PR 最多一个。
_避免_：草稿 review、pending review（中文语境里）

**已看过**：
我在一个 PR 里标记过、此后没有再改动的文件；文件在标记后又被改动，就不再算已看过。
_避免_：已读、已查看

**窗口**：
GitHub mod 以浮层方式打开在其他内容之上的样子。
_避免_：弹窗、overlay

## 仓库

**焦点文件夹**：
焦点所在终端的当前文件夹。焦点落在没有自己文件夹的窗格上时，沿用上一个焦点文件夹。
_避免_：当前目录、工作区

**当前仓库**：
焦点文件夹的 git remote 指向的 GitHub 仓库；有多个 remote 时按 upstream、github、origin、第一个的顺序选。
_避免_：项目、remote
