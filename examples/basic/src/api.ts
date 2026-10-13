import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { countNotes, createNote, readNotes } from "./notes.ts";

// Explicit mutation API. Mounted under /api by the server module.
// Pages never write; writes never go through React.
export const api = new Hono();

api.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    const origin = c.req.header("Origin");
    if (origin !== new URL(c.req.url).origin) {
      return c.json({ error: "Origin rejected" }, 403);
    }
  }
  await next();
});
api.use("*", bodyLimit({ maxSize: 4096 }));

api.get("/notes", (c) => c.json(readNotes()));

api.post("/notes", async (c) => {
  if (!c.req.header("Content-Type")?.startsWith("application/json")) {
    return c.json({ error: "Expected JSON" }, 415);
  }
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const text = (body as { text?: unknown } | null)?.text;
  if (typeof text !== "string" || !text.trim() || text.length > 200) {
    return c.json({ error: "1〜200 文字で入力してください" }, 400);
  }
  if (countNotes() >= 100) {
    return c.json({ error: "Demo storage is full" }, 409);
  }
  return c.json(createNote(text.trim()), 201);
});
