import { Shell } from "./Shell.tsx";

export function Missing() {
  return (
    <Shell title="Not Found">
      <h1>404</h1>
      <p>ページが見つかりませんでした。</p>
      <a href="/">Overview に戻る</a>
    </Shell>
  );
}
