import { describe, expect, test } from "bun:test";
import { parseRemoteUrl, pickRemote } from "../../src/github/core/remote.ts";

describe("parseRemoteUrl", () => {
  const want = { host: "github.com", owner: "lw396", repo: "wechat-mcp" };
  test("https", () => expect(parseRemoteUrl("https://github.com/lw396/wechat-mcp.git")).toEqual(want));
  test("https without .git", () => expect(parseRemoteUrl("https://github.com/lw396/wechat-mcp")).toEqual(want));
  test("scp-like ssh", () => expect(parseRemoteUrl("git@github.com:lw396/wechat-mcp.git")).toEqual(want));
  test("ssh url with port", () => expect(parseRemoteUrl("ssh://git@github.com:22/lw396/wechat-mcp.git")).toEqual(want));
  test("token in url", () => expect(parseRemoteUrl("https://x-access-token:abc@github.com/lw396/wechat-mcp.git")).toEqual(want));
  test("not a repo url", () => expect(parseRemoteUrl("/srv/git/repo")).toBeNull());
});

describe("pickRemote", () => {
  const v = [
    "origin\thttps://github.com/me/fork.git (fetch)",
    "origin\thttps://github.com/me/fork.git (push)",
    "upstream\tgit@github.com:them/project.git (fetch)",
    "upstream\tgit@github.com:them/project.git (push)",
    "gitlab\thttps://gitlab.com/x/y.git (fetch)",
  ].join("\n");
  test("prefers upstream", () => expect(pickRemote(v)).toEqual({ remote: "upstream", host: "github.com", owner: "them", repo: "project" }));
  test("origin when alone", () => expect(pickRemote("origin\thttps://github.com/lw396/wechat-wcp.git (fetch)")?.repo).toBe("wechat-wcp"));
  test("skips non-GitHub hosts", () => expect(pickRemote("origin\thttps://gitlab.com/x/y.git (fetch)")).toBeNull());
  test("enterprise hosts when listed", () => expect(pickRemote("origin\thttps://ghe.corp/x/y.git (fetch)", ["ghe.corp"])?.owner).toBe("x"));
  test("no remotes", () => expect(pickRemote("")).toBeNull());
});
