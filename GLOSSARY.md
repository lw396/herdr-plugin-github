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

**详情窗格**：
主区域里显示一个 issue、PR 或 run 的窗格。Issue 详情独占一个 Herdr 原生标签页，与终端标签页并列；从侧边栏打开的不同 issue 各有自己的标签页；在详情窗格里点同一仓库的 issue 链接时，这个标签页改为显示那个 issue，可以"返回"上一个。
_避免_：详情页、详情面板

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
