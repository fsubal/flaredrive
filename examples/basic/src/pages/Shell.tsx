import type { ReactNode } from "react";
import { Counter } from "../components/Counter.tsx";
import { CurrentLocation } from "../components/CurrentLocation.tsx";
import "../style.css";

// A plain Server Component used as a shared layout. No nested routes needed.
export function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`${title} · flaredrive`}</title>
      </head>
      <body>
        <div className="shell">
          <header>
            <a className="brand" href="/">
              flaredrive<span> / example</span>
            </a>
            <span className="muted">static for queries, dynamic for mutations</span>
          </header>
          <nav aria-label="メイン">
            <a href="/">Overview</a>
            <a href="/about">Design</a>
            <a href="/notes">Notes demo</a>
          </nav>
          <main>{children}</main>
          <footer>
            <span>
              現在の URL <CurrentLocation />
            </span>
            <Counter />
          </footer>
        </div>
      </body>
    </html>
  );
}
