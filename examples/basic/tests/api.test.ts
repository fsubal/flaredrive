import assert from "node:assert/strict";
import { test } from "node:test";
import { api } from "../src/api.ts";

const post = (body: string, headers: Record<string, string> = {}) =>
  api.request("/notes", { method: "POST", body, headers });

test("rejects cross-origin and missing-origin writes", async () => {
  assert.equal((await post("{}")).status, 403);
  assert.equal((await post("{}", { Origin: "https://evil.test" })).status, 403);
});

test("validates media type, body shape, length and size", async () => {
  const origin = { Origin: "http://localhost" };
  assert.equal((await post("{}", origin)).status, 415);

  const headers = { ...origin, "Content-Type": "application/json" };
  for (const body of ["null", "{", "{}", '{"text":""}', JSON.stringify({ text: "x".repeat(201) })]) {
    assert.equal((await post(body, headers)).status, 400, body);
  }
  assert.equal((await post(JSON.stringify({ text: "x".repeat(5000) }), headers)).status, 413);
  assert.equal((await post('{"text":"valid"}', headers)).status, 201);
});

test("reads are open and never cached", async () => {
  const response = await api.request("/notes");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
