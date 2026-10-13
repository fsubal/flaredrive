import { Hono } from "hono";
import { page } from "flaredrive/hono";
import { api } from "./api.ts";
import { About } from "./pages/About.tsx";
import { Home } from "./pages/Home.tsx";
import { Missing } from "./pages/Missing.tsx";
import { Note } from "./pages/Note.tsx";
import { Notes } from "./pages/Notes.tsx";
import { Slow } from "./pages/Slow.tsx";

const app = new Hono();

// Mutations: an ordinary HTTP API. Auth / CSRF / validation live here.
app.route("/api", api);

// Reads: Server Components. The same route serves HTML and Flight.
app.get("/old-about", (c) => c.redirect("/about", 302));
app.get("/", page(Home));
app.get("/about", page(About));
app.get("/notes", page(Notes));
app.get("/notes/:id", page(Note));
app.get("/slow/:id", page(Slow));
app.notFound(page(Missing, { status: 404 }));

export default app;

// Pages exported by `flaredrive generate` when no paths are given.
export const staticPaths = ["/", "/about"];
