# 界面照抄 VS Code 插件，功能范围由 ADR 决定

GitHub mod 的界面布局、用词和交互尽量照抄 VS Code 插件（分组和顺序、PR 行的写法、描述页布局、Add Comment / Start Review、标记文件已看过等），这样用过 VS Code 插件的人不用重新学。
但做哪些功能仍由其他 ADR 决定：插件里违反它们的功能不做，比如新建 PR、在描述页编辑 reviewer 和标签（ADR 0001），Copilot 相关功能（ADR 0002）。两者冲突时以 ADR 为准；新出现的冲突先问人，不由实现者自己取舍。
Herdr 做不到插件的效果时（如原生标签页和终端共用顶部、不能给 diff 行做语法高亮），选最接近插件体验的做法，并在 spec 里说明差别。
