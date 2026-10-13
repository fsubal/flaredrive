import { Shell } from "./Shell.tsx";

export function Home() {
  return (
    <Shell title="Overview">
      <p className="eyebrow">REACT FOR READING. HTTP FOR WRITING.</p>
      <h1>
        表示は Server Components、
        <br />
        更新は HTTP API。
      </h1>
      <p className="lead">
        Server Functions を持たない React フレームワークのサンプルです。
      </p>
      <div className="cards">
        <article>
          <span>01 / SERVER</span>
          <h2>Hono がルートの正本</h2>
          <p>ページも API も同じルーターに登録。HTML と Flight は同じ URL。</p>
        </article>
        <article>
          <span>02 / BROWSER</span>
          <h2>通常の &lt;a href&gt;</h2>
          <p>Navigation API が遷移を捕捉し Flight を取得。非対応なら MPA。</p>
        </article>
        <article>
          <span>03 / MUTATION</span>
          <h2>fetch() して refresh()</h2>
          <p>Client Component から JSON API を呼び、表示だけ再取得。</p>
        </article>
      </div>
      <a href="/notes">メモのデモを試す →</a>
    </Shell>
  );
}
