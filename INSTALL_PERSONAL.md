# 個人用 yomikake の導入・運用

- アプリ: https://regulus775.github.io/yomikake/yomikake.html
- 独立リポジトリ: https://github.com/Regulus775/yomikake
- 作者のリポジトリ: https://github.com/ayati/yomikake
- Google Cloud プロジェクト: `yomikake` / `silicon-smithy-513201-s2`
- GitHub Pages: `main` / `/ (root)`、HTTPS

2026-10-30 に作者の v2.34.0（`c1d9f0b`）を取得し、独立リポジトリを作成。
Drive API、外部・テストモード、テストユーザー、ウェブ用 OAuth クライアント、
`drive.appdata` の登録と両 HTML への ID 設定を実施済み。
残る初回操作は、各端末でのインストールと Google アカウントのアクセス許可。
Android 実機での端末間同期確認は利用者が行う。

## Google Drive の設定（初回）

1. Google Cloud の上記プロジェクトで Google Drive API を有効にする。
2. Google Auth Platform のアプリ名を `yomikake`、対象を「外部」にし、利用するアカウントをテストユーザーへ追加する。
3. データアクセスで `https://www.googleapis.com/auth/drive.appdata` のみを使用する。
4. OAuth クライアントを「ウェブ アプリケーション」で作る。承認済み JavaScript 生成元は `https://regulus775.github.io`（パス・末尾スラッシュなし）。リダイレクト URI は空欄。
5. 取得したクライアント ID を次のコマンドで両 HTML に反映する。

```powershell
python scripts/configure-google-drive.py '取得したクライアントID.apps.googleusercontent.com'
node tests/lib/syntax-check.js yomikake.html yomikake_ios.html
git add yomikake.html yomikake_ios.html
git commit -m "Configure personal Google Drive sync"
git push origin main
```

クライアント ID は公開する値。クライアントシークレットは使用しないため、リポジトリへ追加しない。

## Android（Chrome）

1. Chrome で上記「アプリ」の URL を開く。
2. Chrome の「︙」→「ホーム画面に追加」→「インストール」（表示によっては「アプリをインストール」）を選ぶ。
3. ホーム画面の yomikake を起動する。
4. ⚙ → Google Drive →「しおり自動保存」をオンにする。Windows と同じ Google アカウントを選び、アプリ専用データへのアクセスを許可する。
5. EPUB を Google Drive の通常のフォルダから端末へダウンロードし、yomikake のファイル選択で開く。ファイルアプリの「共有」→ yomikake からも開ける。
6. 読み終えたら ⚙ →「この本を閉じる」で Drive 保存完了の通知を確認する。

初回のインストール、Google 認証、EPUB の読み込みはオンラインで行う。読み込んだ本は端末にキャッシュされ、圏外でも読める。同期はオンライン時に行われる。

## Windows（Chrome）

1. 同じアプリ URL を開く。
2. アドレスバー右のインストールアイコンを押す。見当たらない場合は Chrome の「︙」→「キャスト、保存、共有」→「ページをアプリとしてインストール」を選ぶ。
3. インストールしたアプリで ⚙ → Google Drive →「しおり自動保存」をオンにし、Android と同じアカウントを使う。

## 端末間の同期を確認する

1. Windows で EPUB を開いて数ページ進み、「この本を閉じる」で保存完了を確認する。
2. Android をオンラインで起動し、同じ EPUB を開いて位置が反映されることを確認する。
3. Android でも読み進めて閉じ、Windows へ戻り、逆向きの反映を確認する。

同期対象はしおり・読書記録。EPUB 本体、端末のキャッシュ、ローカルフォントは同期しない。EPUB は両端末で一度開く。しおりファイルは Drive のアプリ専用隠し領域に保存され、通常のフォルダ一覧には表示されない。同じ本の位置が食い違う場合、通常の位置マージは進んだ位置を採用する。

作者のサイトで読んでいたデータを移す場合、作者側でしおり JSON を書き出してから、自分用アプリで読み込み、Drive に保存する。Google Cloud プロジェクトが異なるアプリの Drive データは自動で移行されない。

## 作者の更新を取り込む

実際のクライアント ID・公開 URL・更新コマンド・競合時の対処は
[個人用アップデート手順](UPDATE_PERSONAL.md) にまとめてある。
`origin` は自分用、`upstream` は作者用。通常の更新で Google Cloud の再設定は不要。
