# Architecture

> _Static for queries, dynamic for mutations_

## 目的と基本方針

React Server Components (RSC) を**参照・表示の最適化**に使い、React Server Functions / Server Actions（`"use server"`）はフレームワークとして**サポートしない**。更新処理は Client Components が明示的な HTTP API を `fetch()` で呼び出す。

RSC はサーバーでのデータ取得、HTML / Flight の生成、SSR / SSG、クライアント JS の削減に使う。React 固有の RPC に更新 API を結合しない。アクション実行エンドポイントを持たず、`"use server"` はビルド時に拒否する。

`<form>` は `FormData` や submit イベントの抽象として有用なので、`onSubmit` + `preventDefault()` + `fetch()` の形で使ってよい。ネイティブの POST フォーム遷移による更新は前提にしない。

### 非目標

- `"use server"` と Server Function RPC
- React Router / TanStack Router への依存
- 専用 `<Link>` の強制、Nested Routes、Route Loaders / Actions
- Next.js App Router の全機能の再実装、複雑な revalidation / partial rendering
- JavaScript なしで更新フォームを動かす progressive enhancement の保証

## 全体像

```text
Browser
  ├─ <a href>, Navigation API, history entries
  ├─ Client Components → fetch('/api/...') ───────────┐
  └─ Flight GET → React root update                   │
                       │                              │
                       ▼                              ▼
                 HTTP Router (Hono)
                   ├─ GET page: HTML or RSC Flight
                   │       └─ RSC + SSR renderer
                   └─ POST/PUT/DELETE API: validation, auth, mutation

Build: @vitejs/plugin-rsc (rsc / ssr / client environments)
```

責務は (1) HTTP ルート解決 (2) RSC / SSR レンダリング (3) クライアント遷移 (4) 独立した更新 API (5) ビルド・SSG の 5 つに分かれる。

| 責務 | 実装 |
| --- | --- |
| ルート解決 | アプリの Hono インスタンス。`page()` は Hono ハンドラーを返すだけ |
| RSC / SSR | `src/hono.tsx`（RSC 環境）、`src/entry.ssr.tsx`（SSR 環境） |
| クライアント遷移 | `src/entry.browser.tsx`、`src/protocol.ts` |
| 更新 API | アプリが Hono に登録する。フレームワークは関与しない |
| ビルド・SSG | `src/vite.ts`、`src/guard.ts`、`src/ssg.ts`、`src/node.ts` |

## サーバー HTTP ルーティング

**ルートマッチングの正本はサーバー側の Hono。** ページと API は同じルーターで判定され、ブラウザにルート表を配布して再マッチさせることはしない。ファイルベースルーティングを足す場合も、ファイル配置から Hono の登録コードを生成する形にして、二重のルーティングエンジンを持たない。

### HTML と Flight の出し分け

同じ URL が、通常のリクエストには HTML、`Accept: text/x-component`（q > 0）を明示したリクエストには Flight を返す。

- ページは GET / HEAD のみ。その他のメソッドは 405 + `Allow: GET, HEAD`。
- `Vary: Accept` を必ず付ける。`Cache-Control` が未設定なら `private, no-store` を既定にする。
- HEAD は RSC を評価せずヘッダーだけ返す。
- HTTP status はストリーミング開始前に決まる（`page(C, { status })`）。

### HTML への Flight 埋め込み

RSC 環境が Flight を生成し、SSR 環境がそれを読み戻して HTML をストリーミングする。同じ Flight を `rsc-html-stream` で HTML に埋め込むので、初回 Hydration に追加の GET は発生しない。

## クライアント遷移: Navigation API

`navigate` イベントを捕捉し、同一オリジンのページ遷移だけを `intercept()` して Flight を取得・適用する。通常の `<a href>` がそのまま SPA 遷移になる。

- ハッシュのみの変更、ダウンロード、フォーム送信、`/api/*`、`/assets/*`、`data-native` 付き要素からの遷移は捕捉しない。
- 新しい遷移が古い取得を abort する。結果を適用する直前にも世代番号を確認する。
- `intercept()` のハンドラーは React が新しいツリーを commit するまで完了しない。
- redirect された応答や Flight 以外の応答は、通常の document 遷移にフォールバックする。
- 通信・描画に失敗したら、再読み込みリンク付きのエラー UI を出す。
- Navigation API がないブラウザでは何もしない。リンクは通常の MPA 遷移になる。
- 戻る/進むも Flight を再取得する。履歴エントリ単位のキャッシュは持たない。

Client Components の state は、同じ型・位置・key であれば React の reconciliation で保持される。共通レイアウトを通常のコンポーネントとして書けば、遷移をまたいで state が残る。

## URL と params の参照

- **ページ入口:** `page()` に登録したコンポーネントは `{ url, params }` を同期的な props として受け取る。
- **深い Server Component:** `getRequestURL()` / `getRouteParams()` で同じリクエストを参照できる。AsyncLocalStorage で並行リクエストを分離し、URL は毎回コピー、params は凍結して返す。
- **Client Component:** `useLocation()` が `useSyncExternalStore` で現在の URL を購読する。SSR 時はリクエスト URL を初期値にする。

## 更新後の再表示

更新 API の成功後、Client Component が `refresh()` を呼ぶと、現在の URL の Flight を再取得して commit する。きめ細かな invalidation は持たない。ローカル state の更新や full reload で済ませてもよい。

## SSG

`flaredrive generate` は各パスについて Hono を通した 1 回の描画を行い、Flight を分岐して `index.html` と `index.rsc` を書き出す。HTML と Flight は同じ描画結果から作られるので食い違わない。

生成物の Flight には生成済みパスの一覧が入り、ブラウザはそれを見て `/about` への遷移で `/about/index.rsc` を取得する。一覧にないパスや query 付き URL は通常遷移に戻す。静的ホストは `.rsc` を `text/x-component` で配信する必要がある。Pure SSG は公開環境に RSC サーバーを置かずに済む。

## セキュリティ

1. RSC 用の HTTP エンドポイントは GET / HEAD のみで、Server Function RPC の POST ハンドラーは存在しない。アクション ID の解決、引数デコード、関数ディスパッチを実装していない。
2. `"use server"` は Vite の pre transform で Babel により検査し、RSC プラグインの変換より前にビルドを失敗させる。モジュール先頭と関数内のディレクティブの両方が対象。コメントや通常の文字列は許可する。
3. 更新 API の入力検証、認証・認可、CSRF 対策はアプリの責任。サンプルは Origin、Content-Type、本文サイズ、入力長を検査する。GET で書き込まないこともアプリの規約。
4. より強い境界が必要なら、RSC と更新 API のプロセスや DB 資格情報を分け、RSC 側を読み取り専用権限にする。
5. **Server Functions 非サポートは RSC 全体の安全性を保証しない。** ソース検査は、Vite が外部化した依存、他プラグインが後段で生成したコード、コンパイル済みの server reference を対象にできない場合がある。React Server DOM の脆弱性対応のため、依存の更新を続ける。
6. React はバンドラー向け RSC API の minor 間互換性を保証していないため、依存は exact version と lockfile で固定する。

## 未決事項

1. Parcel RSC との比較と、Workers / Bun など Node.js 以外の実行環境への移植。
2. HTML と Flight の CDN キャッシュキーの分け方。
3. 同時遷移、`intercept()` の commit 時点、React の更新完了の調停の精緻化。
4. SSG とリクエスト依存処理の組み合わせの検出。
5. ルート params の型生成、静的パスと動的パスの競合検出。
6. Flight の履歴キャッシュと `refresh()` の失効モデル。
7. 依存ライブラリ内の `"use server"` をどの段階で拒否するか。
8. 深い非同期コンポーネントからの status / redirect の確定。
9. ファイルベースルーティング、prefetch、CSP nonce、タイムアウトと切断時の資源回収。

## 参考資料

- [React Server Components](https://react.dev/reference/rsc/server-components)
- [Vite RSC plugin](https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-rsc)
- [Hono](https://hono.dev/)
- [Navigation API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API)
- [FUNSTACK Router](https://github.com/uhyo/funstack-router)：Navigation API に立脚したクライアントルーター。本プロジェクトはサーバー側でマッチした結果の Flight を取得する点が異なる。
