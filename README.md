# flaredrive

> _Static for queries, dynamic for mutations_

React Server Components を**参照・表示専用**に使い、Server Functions（`"use server"`）を持たない React フレームワーク。
更新は Client Components から明示的な HTTP API を `fetch()` で呼びます。設計の背景と責務分担は [ARCHITECTURE.md](./ARCHITECTURE.md) を参照してください。

> Status: 実験的なプロトタイプです。API は予告なく変わります。

## 構成

```
packages/flaredrive   フレームワーク本体（npm パッケージ形）
examples/basic        サンプルアプリ + 単体/E2E テスト
```

| import                | 内容                                                              |
| --------------------- | ----------------------------------------------------------------- |
| `flaredrive/vite`     | Vite プラグイン（`"use server"` 拒否 + plugin-rsc + plugin-react） |
| `flaredrive/hono`     | `page(Component, { status })` Hono アダプター、`PageProps` 型       |
| `flaredrive/server`   | `getRequestURL()` / `getRouteParams()`（request-local）           |
| `flaredrive/client`   | `useLocation()` / `refresh()`                                     |
| `flaredrive/node`     | `serve()` / `generate()` / `preview()`                            |
| `flaredrive` CLI      | `flaredrive serve` / `generate` / `preview`                       |

## 使い方

```ts
// vite.config.ts
import flaredrive from "flaredrive/vite";
export default defineConfig({ plugins: [flaredrive({ app: "src/server.tsx" })] });
```

```tsx
// src/server.tsx — ルート定義の正本は Hono
const app = new Hono();
app.route("/api", api);                 // 更新は普通の HTTP API
app.get("/posts/:id", page(PostPage));  // 同じ URL で HTML / Flight
app.notFound(page(Missing, { status: 404 }));
export default app;
export const staticPaths = ["/", "/about"]; // flaredrive generate の対象
```

- 通常の GET は HTML（Flight を埋め込み、Hydration に追加 GET なし）。`Accept: text/x-component` には Flight。
- ページは GET / HEAD のみ。他メソッドは 405 + `Allow`。アクション実行経路は存在しない。
- `"use server"` はモジュール先頭・関数内とも、RSC 変換より前にビルドエラー。
- ブラウザは Navigation API で同一オリジンの `<a href>` を捕捉して Flight を取得。`/api`・`/assets`・`data-native`・フォーム送信・ダウンロードは捕捉しない。非対応ブラウザは通常遷移。
- 新しい遷移が古い取得を abort。redirect や Flight 以外の応答は document 遷移にフォールバック。通信失敗時は再読み込みリンク付きのエラー UI。
- 更新後は Client Component から `await refresh()` で現在 URL の Flight を再取得。

## コマンド

```sh
npm install          # flaredrive パッケージも build される
npm run dev          # examples/basic の Vite dev server（HMR あり）
npm run build        # パッケージ + サンプルの本番ビルド
npm run typecheck
npm test             # 単体テスト（guard / context / protocol / API）
npm run test:e2e     # build + generate + Playwright（要 Google Chrome）
```

サンプル単体では `npm start`（:4173）、`npm run generate && npm run preview:static`（:4174）。

## 未実装

ファイルベースルーティング、params の型生成、prefetch、Flight の履歴キャッシュ、ストリーミング開始後の status / redirect 変更、CSP nonce、Workers / Bun 対応。詳細は [ARCHITECTURE.md](./ARCHITECTURE.md#未決事項) を参照。
