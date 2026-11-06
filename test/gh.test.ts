// gh.ts through a fake `exec`. Replies are real gh 2.96 output (stdout/stderr/exit code).
import { afterEach, describe, expect, test } from "bun:test";
import { machine, reset } from "./fake-herdr.ts";
import * as gh from "../src/github/gh.ts";

afterEach(reset);

const BAD_CREDENTIALS = '{\n  "message": "Bad credentials",\n  "documentation_url": "https://docs.github.com/rest",\n  "status": "401"\n}';

describe("status", () => {
  test("signed in: the account's login", async () => {
    machine(null, { "~$ gh api user --jq .login": { stdout: "lw396\n" } });
    expect(await gh.status()).toEqual({ ok: true, user: "lw396" });
  });

  test("never signed in: auth", async () => {
    machine(null, { "~$ gh api user --jq .login": { code: 4, stderr: "To get started with GitHub CLI, please run:  gh auth login\nAlternatively, populate the GH_TOKEN environment variable with a GitHub API authentication token.\n" } });
    expect(await gh.status()).toMatchObject({ ok: false, reason: "auth" });
  });

  test("revoked token: auth", async () => {
    machine(null, { "~$ gh api user --jq .login": { code: 1, stdout: BAD_CREDENTIALS, stderr: "gh: Bad credentials (HTTP 401)\n" } });
    expect(await gh.status()).toMatchObject({ ok: false, reason: "auth" });
  });

  test("gh not installed here: missing", async () => {
    machine(null, {});
    expect(await gh.status()).toMatchObject({ ok: false, reason: "missing" });
  });

  test("gh not installed on the space's machine: missing", async () => {
    machine("center", {});
    expect(await gh.status({ on: "center" })).toMatchObject({ ok: false, reason: "missing" });
  });

  test("asks the space's machine, not this one", async () => {
    machine(null, { "~$ gh api user --jq .login": { stdout: "here\n" } });
    machine("center", { "~$ gh api user --jq .login": { stdout: "there\n" } });
    expect(await gh.status({ on: "center" })).toEqual({ ok: true, user: "there" });
  });

  test("GitHub unreachable: error, not missing", async () => {
    machine(null, { "~$ gh api user --jq .login": { code: 1, stderr: 'error connecting to api.github.com\ncheck your internet connection or https://githubstatus.com\n' } });
    expect(await gh.status()).toMatchObject({ ok: false, reason: "error" });
  });

  test("an HTTP 404 is an error, not a missing gh", async () => {
    machine(null, { "~$ gh api user --jq .login": { code: 1, stdout: '{"message":"Not Found","status":"404"}', stderr: "gh: Not Found (HTTP 404)\n" } });
    expect(await gh.status()).toMatchObject({ ok: false, reason: "error" });
  });
});

describe("apiText", () => {
  test("jq output as plain text, in the repository's folder", async () => {
    machine("center", { "/w/app$ gh api repos/herdrdev/herdr-app --jq .full_name": { stdout: "herdrdev/herdr-app\n" } });
    expect(await gh.apiText("repos/herdrdev/herdr-app", ".full_name", { cwd: "/w/app", on: "center" })).toBe("herdrdev/herdr-app");
  });

  test("one value per line with --paginate", async () => {
    machine(null, { "~$ gh api repos/herdrdev/herdr-app/branches?per_page=1 --paginate --jq .[].name": { stdout: "feat/conditional-mods\nfix/durable-agent-session-capture\n" } });
    expect(await gh.apiText("repos/herdrdev/herdr-app/branches?per_page=1", ".[].name", { paginate: true }))
      .toBe("feat/conditional-mods\nfix/durable-agent-session-capture");
  });

  test("a missing repository rejects with a 404 GhError", async () => {
    machine(null, { "~$ gh api repos/lw396/wechat-wcp --jq .full_name": {
      code: 1,
      stdout: '{"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}',
      stderr: "gh: Not Found (HTTP 404)\n",
    } });
    const error = await gh.apiText("repos/lw396/wechat-wcp", ".full_name").catch((e) => e);
    expect(error).toBeInstanceOf(gh.GhError);
    expect(error).toMatchObject({ message: "gh: Not Found (HTTP 404)", code: 1, notFound: true });
  });

  test("other failures are not 404s", async () => {
    machine(null, { "~$ gh api user --jq .login": { code: 1, stdout: BAD_CREDENTIALS, stderr: "gh: Bad credentials (HTTP 401)\n" } });
    expect(await gh.apiText("user", ".login").catch((e) => e)).toMatchObject({ notFound: false });
  });
});

describe("api", () => {
  test("paginated arrays arrive as one array", async () => {
    machine(null, { "~$ gh api repos/herdrdev/herdr-app/contributors?per_page=1 --paginate": { stdout: '[{"login":"ogulcancelik","id":7064011},{"login":"dependabot[bot]","id":49699333}]' } });
    expect(await gh.api("repos/herdrdev/herdr-app/contributors?per_page=1", { paginate: true }))
      .toEqual([{ login: "ogulcancelik", id: 7064011 }, { login: "dependabot[bot]", id: 49699333 }]);
  });

  test("POST with fields", async () => {
    machine(null, { "~$ gh api repos/o/r/actions/runs/42/rerun -X POST -F enable_debug_logging=true": { stdout: "{}" } });
    expect(await gh.api("repos/o/r/actions/runs/42/rerun", { method: "POST", fields: { enable_debug_logging: true } })).toEqual({});
  });
});

describe("graphql", () => {
  const QUERY = "query($o:String!,$n:String!){repository(owner:$o,name:$n){nameWithOwner stargazerCount}}";

  test("resolves with data", async () => {
    machine(null, { [`~$ gh api graphql -f query=${QUERY} -f o=herdrdev -f n=herdr-app`]: { stdout: '{"data":{"repository":{"nameWithOwner":"herdrdev/herdr-app","stargazerCount":2078}}}' } });
    expect(await gh.graphql(QUERY, { o: "herdrdev", n: "herdr-app" })).toEqual({ repository: { nameWithOwner: "herdrdev/herdr-app", stargazerCount: 2078 } });
  });

  test("a query error rejects with GitHub's message", async () => {
    machine(null, { "~$ gh api graphql -f query={ viewer { nope } }": {
      code: 1,
      stdout: '{"errors":[{"path":["query","viewer","nope"],"extensions":{"code":"undefinedField","typeName":"User","fieldName":"nope"},"locations":[{"line":1,"column":12}],"message":"Field \'nope\' doesn\'t exist on type \'User\'"}]}',
      stderr: "gh: Field 'nope' doesn't exist on type 'User'\n",
    } });
    expect(await gh.graphql("{ viewer { nope } }").catch((e) => e)).toMatchObject({ message: "gh: Field 'nope' doesn't exist on type 'User'" });
  });
});
