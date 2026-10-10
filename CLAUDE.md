# wdw-futari 運用ルール（Claude Code用）

2027年5月のフロリダ・ディズニー旅行のための、夫婦2人用の計画アプリ（PWA）。

## 出力言語
- Claudeからの出力（チャット・コミットメッセージ・コメント）は**日本語**。画面の文言もすべて日本語

## 仕様の正
- 仕様書はこのリポジトリではなく、Toshiの `2nd-brain` リポジトリにある: `01_プロジェクト/フロリダ2027/00_仕様書_WDW夫婦計画アプリ.md`
- このリポジトリは**公開**。**個人情報（メールアドレス・氏名・予約番号・旅程の細部など）をコードやコミットに書かない**
  - 2人の識別は `toshi` / `tsuma` の呼び名だけ。メールアドレスは Firebase コンソールのセキュリティルールにだけ書く（`firestore.rules.template` はひな形）

## 構成
- Vite + React + TypeScript（`any` 禁止）。データ同期は Firebase（Authentication + Firestore、無料のSparkプラン）
- `src/firebaseConfig.ts` が `null` の間は「お試しモード」（端末内保存のみ）
- アトラクション情報は `src/data/rides.ts`。仕組みが変わったらデータだけ直す
- 計算ルールは `src/lib/consensus.ts`。変更したら `src/lib/consensus.test.ts` も直す

## 確認
- 変更後は `npm test` と `npm run build`（型チェック込み）を通してから push する
- `main` に push すると GitHub Actions で GitHub Pages（https://pyonkichi777.github.io/wdw-futari/）に公開される
