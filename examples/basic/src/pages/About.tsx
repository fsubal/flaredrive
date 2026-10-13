import { Shell } from "./Shell.tsx";

export function About() {
  return (
    <Shell title="Design">
      <p className="eyebrow">DESIGN PRINCIPLES</p>
      <h1>責務を小さく。</h1>
      <p className="lead">React が担うのは表示のための仕事だけです。</p>
      <ol>
        <li>Server Components でデータを取得し、HTML / Flight を生成する。</li>
        <li>Client Components で操作を受け取り、HTTP API に更新を依頼する。</li>
        <li>ルートの一致判定と認証は Hono。クライアントルーターを持たない。</li>
        <li>"use server" はビルド時に拒否。RPC の実行経路を設けない。</li>
      </ol>
      <p>このページと Overview は静的生成（SSG）にも対応しています。</p>
      <a href="/">← Overview</a>
    </Shell>
  );
}
