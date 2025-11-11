# AI-BEM-Checker (BEM命名ルールチェッカー)

BEM命名規則（`block__element--modifier`）の違反を検出し、レポートするLinter（静的解析ツール）です。
`spec.yaml` に定義されたルールに基づき、コードを解析します。

## 🎯 目的

* コードレビューの自動化
* BEMルールの学習支援
* プロジェクト全体の命名規則の統一

---

## 🚀 使い方 (CLIツールとして)

### 1. インストール

チェックしたいプロジェクト（`my-web-project`など）に、ツールをインストールします。

**A) npm publish または GitHub Packages**

```bash
npm install ai-bem-checker --save-dev
```

**B) ローカルの .tgz ファイルで試す場合**

```bash
# ビルドした .tgz ファイルのパスを指定します
npm install /path/to/ai-bem-checker-0.1.0.tgz
```

### 2. 実行

`npx` コマンドを使って、プロジェクト全体（.）のチェックを実行します。

```bash
# プロジェクト全体をチェックする場合（推奨）
npx ai-bem-checker check .

# 特定のフォルダだけをチェックする場合
npx ai-bem-checker check ./faq
```

`check` . を指定することで、`assets/css/` やルート階層のHTMLファイルなど、プロジェクト全体をスキャンします。 （`node_modules` や `.git` フォルダは自動で除外されます）

### 3. 結果

実行すると、ターミナルに違反箇所が表示されます。 **同時に、ファイル出力も自動で行われます。**


## ⚙️ ファイル出力と設定 (Configuration)

**設定ファイルは不要です（Zero-Config）**

このツールは「Zero-Config（設定不要）」に対応しています。 `npx ai-bem-checker check .` を実行すると、**設定ファイルがなくても**、プロジェクトルートに `./bem-reports/` フォルダが自動で作成され、その中にJSONレポートが保存されます。

- デフォルトの出力先: `./bem-reports/`
- デフォルトのファイル名: `bem-report_{YYYY}-{MM}-{DD}_{HH}{mm}{ss}.json`

**（オプション）出力先をカスタマイズする方法**

もし、**出力先や「無視するクラス」をカスタマイズしたい場合**、プロジェクトのルート（`package.json` と同じ場所）に `.bem-checker-rc.json` ファイルを作成してください。

`.bem-checker-rc.json` の例: （時分秒 `{HH}{mm}{ss}` も使えます）

```bash
{
  "output": {
    "path": "./lint-results/bem/",
    "filenamePattern": "BEM_{YYYY}{MM}{DD}_{HH}{mm}.json"
  },
  "ignoreList": [
    "mgn-top-48",
    "mgn-top-160",
    "mgn-center",
    "text-center",
    "pc_br"
  ]
}
```

**ignoreList（無視リスト）について**

- `ai-bem-checker` のシステム（`analyzeBEM.ts`）は、`swiper-` などのごく一部の一般的なライブラリや `is-` で始まる状態クラスのみをデフォルトで無視します。
- `text-center` のようなプロジェクト固有のユーティリティクラスは、この `ignoreList` に利用者が自分で追加する必要があります。
- `ignoreList` に追加されたクラスは、BEMチェッカーの違反検出から除外されます。

-----

## ✅ チェックされるルール

詳細は `spec.yaml` を参照してください。

  * **(R1) Block:** Block名はケバブケース（`profile-card`）であること。
  * **(R2) Element:** Elementは `__` で連結されていること。
  * **(R3) Modifier:** Modifierは `--` で連結されていること。
  * **(R4) ネスト禁止:** Elementのネスト（`block__elem__sub-elem`）がされていないこと。

-----

## 🧑‍💻 開発者向け

このライブラリ自体を開発する場合は、以下のコマンドを使用します。

```powershell
# 依存をインストール
npm install

# テストを実行
npm test
```