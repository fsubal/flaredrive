import type { PageProps } from "flaredrive/hono";
import { getRequestURL, getRouteParams } from "flaredrive/server";
import { findNote } from "../notes.ts";
import { Shell } from "./Shell.tsx";

export async function Note({ params }: PageProps) {
  const note = findNote(params.id ?? "");
  return (
    <Shell title={`Note ${params.id}`}>
      <p className="eyebrow">ROUTE PARAMS</p>
      <h1>Note {params.id}</h1>
      <p className="lead">{note?.text ?? "このメモはありません。"}</p>
      <DeepContext />
      <a href="/notes">← メモ一覧</a>
    </Shell>
  );
}

// Reads the request without props drilling, from deep in the tree.
export async function DeepContext() {
  await new Promise((resolve) => setTimeout(resolve, 10));
  return (
    <p data-testid="context">
      深い Server Component: {getRequestURL().pathname} / id=
      {getRouteParams().id}
    </p>
  );
}
