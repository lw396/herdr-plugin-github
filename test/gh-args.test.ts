import { describe, expect, test } from "bun:test";
import { apiArgs, graphqlArgs, parseJson, errorMessage } from "../src/github/gh-args.ts";

describe("apiArgs", () => {
  test("GET is the default and adds no -X", () => {
    expect(apiArgs("repos/{owner}/{repo}")).toEqual(["api", "repos/{owner}/{repo}"]);
  });

  test("method, fields and flags", () => {
    expect(apiArgs("repos/{owner}/{repo}/actions/runs/1/rerun", { method: "post", fields: { debug: true }, rawFields: { note: "x" }, paginate: true, jq: ".id", cache: "60s" }))
      .toEqual(["api", "repos/{owner}/{repo}/actions/runs/1/rerun", "-X", "POST", "-F", "debug=true", "-f", "note=x", "--paginate", "--jq", ".id", "--cache", "60s"]);
  });
});

describe("graphqlArgs", () => {
  test("strings go as -f, other values as -F", () => {
    expect(graphqlArgs("query($n:Int!,$o:String!){x}", { n: 5, o: "me" }))
      .toEqual(["api", "graphql", "-F", "n=5", "-f", "query=query($n:Int!,$o:String!){x}", "-f", "o=me"]);
  });
});

describe("parseJson", () => {
  test("empty output is null", () => expect(parseJson("  \n")).toBeNull());
  test("one document", () => expect(parseJson('{"a":1}')).toEqual({ a: 1 }));
  test("paginated arrays are joined", () => expect(parseJson('[{"a":1}]\n[{"a":2}]')).toEqual([{ a: 1 }, { a: 2 }]));
  test("not JSON throws", () => expect(() => parseJson("oops")).toThrow());
});

test("errorMessage takes gh's last line", () => {
  expect(errorMessage("warning\nHTTP 404: Not Found (https://api.github.com/x)\n")).toBe("HTTP 404: Not Found (https://api.github.com/x)");
  expect(errorMessage("")).toBe("gh failed");
});
