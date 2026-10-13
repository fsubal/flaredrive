"use client";
import { useState, type FormEvent } from "react";
import { refresh } from "flaredrive/client";
import { useHydrated } from "./useHydrated.ts";

export function NoteForm() {
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const text = new FormData(form).get("text");
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        throw new Error(((await response.json()) as { error: string }).error);
      }
      await refresh();
      form.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="note">新しいメモ</label>
      <div className="input-row">
        <input
          id="note"
          name="text"
          required
          maxLength={200}
          disabled={!hydrated || busy}
          placeholder="RSC でつくりたいもの"
        />
        <button disabled={!hydrated || busy}>{busy ? "保存中…" : "追加する"}</button>
      </div>
      <p role="status">{error}</p>
    </form>
  );
}
