import { NoteForm } from "../components/NoteForm.tsx";
import { readNotes } from "../notes.ts";
import { Shell } from "./Shell.tsx";

export async function Notes() {
  const items = readNotes();
  return (
    <Shell title="Notes">
      <p className="eyebrow">EXPLICIT HTTP API DEMO</p>
      <h1>読んで、書いて。</h1>
      <p className="lead">
        この一覧は Server Component。追加は Client Component の fetch です。
      </p>
      <ul className="notes">
        {items.map((note) => (
          <li key={note.id}>
            <a href={`/notes/${note.id}`}>{note.text}</a>
            <span>#{note.id}</span>
          </li>
        ))}
      </ul>
      <NoteForm />
      <p className="muted">メモはサーバーのメモリに保存され、再起動時に消えます。</p>
    </Shell>
  );
}
