# 只做人要亲自看、亲自判断的部分

用 Herdr 的人主要让 agent 写代码，GitHub mod 的用处是帮人指挥 agent、不让 agent 脱离控制：看 issue 弄清要做什么，review agent 的 PR，看 CI 结果。
所以只做人要看、要判断的功能（阅读、评论、关闭 issue，review、merge PR，重跑 CI）；agent 用 gh 更容易做的事不做，比如新建 issue，尽管 VS Code 插件有这个功能。
