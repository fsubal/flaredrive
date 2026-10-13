import assert from "node:assert/strict";
import { test } from "node:test";
import {
  shouldIntercept,
  staticFlightPath,
  staticPageDir,
  wantsFlight,
} from "../src/protocol.ts";

test("Flight requires an explicit non-zero media type", () => {
  const accepts = (accept?: string) =>
    wantsFlight(
      new Request("https://example.test", {
        headers: accept === undefined ? {} : { accept },
      }),
    );

  assert.equal(accepts(), false);
  assert.equal(accepts("text/html"), false);
  assert.equal(accepts("*/*"), false);
  assert.equal(accepts("text/x-component"), true);
  assert.equal(accepts("TEXT/X-COMPONENT"), true);
  assert.equal(accepts("text/html, text/x-component;q=0.8"), true);
  assert.equal(accepts("text/x-component;q=0"), false);
  assert.equal(accepts("text/x-component; q=0.0"), false);
});

test("static file layout", () => {
  assert.equal(staticFlightPath("/"), "/index.rsc");
  assert.equal(staticFlightPath("/about"), "/about/index.rsc");
  assert.equal(staticFlightPath("/about/"), "/about/index.rsc");
  assert.equal(staticPageDir("/"), "");
  assert.equal(staticPageDir("/docs/intro/"), "/docs/intro");
});

test("navigation excludes forms, hashes, downloads, APIs, assets and other origins", () => {
  const event = {
    canIntercept: true,
    hashChange: false,
    downloadRequest: null,
    formData: null,
    destination: { url: "https://example.test/about" },
  };
  const here = "https://example.test/";

  assert.equal(shouldIntercept(event, here), true);

  for (const patch of [
    { canIntercept: false },
    { hashChange: true },
    { downloadRequest: "" },
    { formData: new FormData() },
    { destination: { url: "https://elsewhere.test/" } },
    { destination: { url: "https://example.test/api/notes" } },
    { destination: { url: "https://example.test/assets/app.js" } },
  ]) {
    assert.equal(shouldIntercept({ ...event, ...patch }, here), false, JSON.stringify(patch));
  }

  const native = { closest: (selector: string) => (selector === "[data-native]" ? {} : null) };
  assert.equal(
    shouldIntercept({ ...event, sourceElement: native as unknown as Element }, here),
    false,
  );
});
