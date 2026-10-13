// Deliberately transient demo storage. Replace with a database or data layer.
export interface Note {
  id: string;
  text: string;
}

const notes: Note[] = [{ id: "1", text: "表示は RSC。更新は HTTP API。" }];

export function readNotes(): Note[] {
  return notes.map((note) => ({ ...note }));
}

export function findNote(id: string): Note | undefined {
  const note = notes.find((note) => note.id === id);
  return note && { ...note };
}

export function createNote(text: string): Note {
  const note = { id: String(notes.length + 1), text };
  notes.push(note);
  return note;
}

export function countNotes(): number {
  return notes.length;
}
