import assert from "node:assert/strict";
import { test } from "node:test";
import { assertNoServerFunctions } from "../src/guard.ts";

const rejected = [
  '"use server"; export async function run() {}',
  "'use server';\nexport const x = 1;",
  'export async function run() { "use server"; }',
  'const run = async () => { "use strict"; "use server"; };',
  'class A { async run() { "use server"; } }',
  'export default function Page() { async function inner() { "use server"; } return null; }',
];

for (const source of rejected) {
  test(`rejects: ${source}`, () => {
    assert.throws(
      () => assertNoServerFunctions(source, "fixture.tsx"),
      /Server Functions are not supported/,
    );
  });
}

const allowed = [
  '"use client"; export const Widget = () => <div />;',
  '// "use server"\nconst text = "use server";',
  "export async function Page() { return <p>hello</p>; }",
  'const label = `use server`; console.log("use server", label);',
  'function f() { const s = "use server"; return s; }',
];

for (const source of allowed) {
  test(`allows: ${source}`, () => {
    assert.doesNotThrow(() => assertNoServerFunctions(source, "fixture.tsx"));
  });
}
