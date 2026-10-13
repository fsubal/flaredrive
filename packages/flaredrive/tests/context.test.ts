import assert from "node:assert/strict";
import { test } from "node:test";
import { getRequestURL, getRouteParams, withRequest } from "../src/context.ts";

test("request context is isolated across concurrent async work", async () => {
  await Promise.all(
    ["a", "b", "c"].map((id) =>
      withRequest(
        { url: new URL(`https://example.test/${id}?x=1`), params: { id } },
        async () => {
          getRequestURL().pathname = "/mutated";
          await new Promise((resolve) => setTimeout(resolve, 5));
          assert.equal(getRequestURL().pathname, `/${id}`);
          assert.equal(getRequestURL().searchParams.get("x"), "1");
          assert.equal(getRouteParams().id, id);
        },
      ),
    ),
  );
});

test("params are frozen and the URL is a fresh copy", () => {
  withRequest({ url: new URL("https://example.test/"), params: { id: "1" } }, () => {
    assert.ok(Object.isFrozen(getRouteParams()));
    assert.notEqual(getRequestURL(), getRequestURL());
  });
});

test("accessors throw outside a request", () => {
  assert.throws(getRequestURL, /only available/);
  assert.throws(getRouteParams, /only available/);
});
