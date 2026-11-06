# GitHub mod 不直接接触 agent

GitHub mod 不启动 agent、不给 agent 发消息（`tab.new {task}`、`hc send`），也不把 PR 和正在做它的 agent 对应起来，尽管 Herdr 提供了这些接口。
人把 issue / PR 编号告诉 agent，agent 自己用 gh 去读；GitHub mod 只负责让人看清楚，所以"复制编号"做得顺手，"交给 agent"不做。
