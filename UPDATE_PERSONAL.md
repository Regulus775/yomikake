# 個人用 yomikake のアップデート手順

2026-10-30 時点の構成。Windows の PowerShell で実行する。
通常のアップデートでは Google Cloud の設定やクライアント ID の作り直しは不要。
Git は個人用 ID の変更を通常は維持するが、更新後に設定用スクリプトを実行して、両 HTML の ID を確実にそろえる。

## 設定値

| 項目 | 値 |
|---|---|
| 作業フォルダ | `D:\Python_Project\yomikake` |
| 作業ブランチ | `main` |
| 自分用リモート `origin` | `https://github.com/Regulus775/yomikake.git` |
| 作者用リモート `upstream` | `https://github.com/ayati/yomikake` |
| アプリ URL | https://regulus775.github.io/yomikake/yomikake.html |
| Pages の公開元 | `main` / `/ (root)` |
| Google Cloud プロジェクト名 | `yomikake` |
| Google Cloud プロジェクト ID | `silicon-smithy-513201-s2` |
| OAuth クライアント名 | `yomikake-github-pages` |
| OAuth の種類 | ウェブ アプリケーション |
| クライアント ID | `340885667633-1irenmtc1l2l6hm2dj61f8stih3fiqf1.apps.googleusercontent.com` |
| 承認済み JavaScript 生成元 | `https://regulus775.github.io` |
| 承認済みリダイレクト URI | 空欄 |
| Drive スコープ | `https://www.googleapis.com/auth/drive.appdata` |
| OAuth 公開状態 | 外部・テスト中 |
| 登録済みテストユーザー | `shi8888@gmail.com` |

クライアント ID は公開する設定値。クライアントシークレットは使用しない。
ID を変更するのは Google Cloud 側でクライアントを変更した場合だけ。
公開 URL のホスト名を変更する場合は、Google Cloud 側の承認済み JavaScript 生成元も更新する。

## 1. 更新前に保存状態を確認する

読書中の場合は、各端末で「この本を閉じる」を押して Drive 保存完了を確認する。
必要に応じて、⚙ →「🔖 しおりデータ（JSON）」から書き出しておく。

```powershell
Set-Location 'D:\Python_Project\yomikake'
git status --short
git branch --show-current
git remote -v
```

`git status --short` が空で、ブランチが `main` であることを確認する。
未保存の変更がある場合は内容を確認してコミットするなどしてから進む。
**以下の各段階でエラーや競合が出たら、その場で止める。後続のコマンドは実行しない。**

自分の GitHub へ他の PC から変更を送っていた場合にも備えて、自分用の最新版に合わせる。

```powershell
git pull --ff-only origin main
```

成功後、更新前へ戻れるようにローカルのバックアップブランチを作る。

```powershell
$backupBranch = 'backup/before-update-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
git branch $backupBranch
Write-Host "更新前のバックアップ: $backupBranch"
```

## 2. 作者の更新を取得して取り込む

```powershell
git fetch upstream
git log --oneline HEAD..upstream/main
git diff --stat HEAD...upstream/main
```

更新内容を確認してから取り込む。

```powershell
git merge upstream/main
```

`Already up to date.` の場合は作者の新しい更新はない。設定の確認だけなら次へ進める。
競合が出た場合は後述の「競合した場合」へ進む。

## 3. 自分用クライアント ID を両 HTML に反映する

次のコマンドは、`yomikake.html` と `yomikake_ios.html` の
`const GOOGLE_CLIENT_ID` を両方とも自分用の値にする。すでに同じ値なら内容は変わらない。

```powershell
python scripts/configure-google-drive.py '340885667633-1irenmtc1l2l6hm2dj61f8stih3fiqf1.apps.googleusercontent.com'
```

`Configured Google Drive client ID in both HTML files.` と表示されることを確認する。
宣言が見つからない等のエラーの場合、作者が設定方式を変更した可能性があるため、ソースを確認する。

確認コマンド：

```powershell
Select-String -Path yomikake.html,yomikake_ios.html -Pattern '^const GOOGLE_CLIENT_ID'
Select-String -Path yomikake.html,yomikake_ios.html,sw.js -Pattern '^const (APP_VERSION|VERSION)'
```

2 つの HTML に上記の自分用 ID が入っていることを確認する。
バージョン番号は作者の更新に含まれるものを使う。通常は手で変更しない。
両 HTML の `APP_VERSION` が一致し、`sw.js` の `VERSION` が同じ版の
`yomikake-shell-vX.Y.Z` になっていることも確認する。

## 4. 検証して自分の GitHub に送る

Python と Node.js は現在の PC に導入済み。

```powershell
node tests/lib/syntax-check.js yomikake.html yomikake_ios.html
node --check sw.js
git diff --check
git diff --stat
git diff -- yomikake.html yomikake_ios.html
```

HTML の構文チェックがすべて `OK` であることを確認する。
`node --check sw.js` と `git diff --check` は成功時に通常何も表示しない。
これらは構文等の確認であり、実機の表示や Google Drive 同期の動作保証ではない。

手順 3 によって ID の差分ができた場合だけ、その変更をコミットする。
`git status --short` に何も出ない場合、ID はすでに維持されているため追加コミットは不要。

```powershell
git status --short
```

ID の変更がある場合：

```powershell
git add yomikake.html yomikake_ios.html
git commit -m "Keep personal Google Drive client ID after upstream update"
```

最後に自分用リポジトリへ送る。**送信先は `origin`。作者用の `upstream` には送らない。**

```powershell
git push origin main
git status --short
```

GitHub の [Actions](https://github.com/Regulus775/yomikake/actions) で Pages の処理が成功したことを確認する。
公開設定は [Settings → Pages](https://github.com/Regulus775/yomikake/settings/pages) で確認できる。

## 5. Windows・Android に更新を反映する

1. Pages の公開処理が完了してから、両端末をオンラインにする。
2. インストールした yomikake を閉じて開き直す。表示が古い場合は同じ URL を Chrome で開いて再読み込みする。
3. ヘルプ画面の `yomikake vX.Y.Z` が取り込んだ版になっているか確認する。
4. ⚙ → Google Drive の「しおり自動保存」がオンであることを確認する。Google の許可を再度求められた場合は、登録した同じアカウントで許可する。
5. Windows で同じ EPUB を少し読み進め、「この本を閉じる」で保存完了を確認する。
6. Android でアプリを開き直し、同じ EPUB の位置を確認する。Android → Windows の向きでも確認する。

通常、アプリの再インストールや Android への HTML のコピーは不要。
アプリは公開 URL から新しい版を取得する。オフライン中は保存済みの古い版で起動することがある。
**更新のために Cookie・サイトデータやアプリの保存データを消さない。**
しおり・EPUB キャッシュ・ローカルフォントまで消える可能性がある。

## 競合した場合

```powershell
git status
git diff --name-only --diff-filter=U
```

競合ファイルをエディタで開き、`<<<<<<<` / `=======` / `>>>>>>>` の箇所を解決する。
基本は作者の新しい処理を取り入れつつ、`GOOGLE_CLIENT_ID` は上記の自分用 ID を残す。
**HTML 全体を一律に「自分側」または「作者側」で上書きしない。**
片側の機能更新や個人設定を失う可能性がある。

マーカーを除去して解決したら、手順 3 の ID 設定と手順 4 の検証を行い、解決したファイルを明示してコミットする。
例えば競合が両 HTML だけだった場合：

```powershell
git add yomikake.html yomikake_ios.html
git commit -m "Merge upstream update and retain personal Google Drive configuration"
git push origin main
```

取り込み途中で中止して考え直す場合（マージが未完了のときだけ）：

```powershell
git merge --abort
```

`git push` が拒否された場合も force push せずに止まり、`origin/main` 側の変更を確認する。

## 次回この作業を依頼する場合

次の文をそのまま使える。

> UPDATE_PERSONAL.md に従って upstream/main の更新を取り込み、自分用の Google クライアント ID を両 HTML に維持してください。構文と差分を確認し、origin/main に push して GitHub Pages への反映を確認してください。
