# 访问 GitHub 一律通过 gh，不用 fetch

Herdr 的 `fetch` 拿不到响应头（没有 ETag、限额、分页 `Link`），带 Authorization 的跨域重定向会被拒绝（Actions 日志和 artifact 下载不了），响应体也只按文本解码。
所以所有 GitHub 请求都通过 `gh`（`io/gh.ts`），登录也交给 gh；代价是每个请求都要启动一个进程，并受 `exec` 30 秒、8 MiB 的限制。
