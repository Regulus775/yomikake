# 読了パネル（次の一冊への導線） 概要設計書（v2.30.0）

対象: `yomikake.html`・`yomikake_ios.html` **両ファイル**（行番号は v2.29.0 の `yomikake.html`）

関連: `design_finished_sync.md`（読了の記録・`finishedAt`/`finishedCount`・`hasMore`）・
`design_bibliography_source_link.md`／`design_bibliography_v2.md`（著者検索・底本リンク）・
`design_metadata_bookshelf.md`（`nd:*` メタ・連載状態）・`design_reading_list_v2.md`（読みかけリスト）

**状態: 第1弾（A・B・C）実装済み（両ファイル）。** §8 の 2 点は決定済み。§10 に現行コード確認と実装での補正をまとめた。テストは `tests/cases/finished-panel.js`（両ファイル各 128 assertion）。実機確認は未実施。 本書の範囲は第1弾の **A・B・C**。D・E・G は §7 に方針だけ置き、別の設計書で確定させる。F（タグからサイトのタグ一覧へ）は**不採用**（効果が小さく、サイトごとの URL 書式を持つと黙って壊れる）。

---

## 1. 症状

最終ページ（奥付）から先へ進むと `#finished-banner` に「📖 最後まで読みました　読みかけリストへ／閉じない」が出る。この瞬間に読者がしたいことは本の種類で違う。

| 本 | 読み終えた直後にしたいこと |
|---|---|
| Web 小説（novel_downloader 産） | 連載の続きが出ていないか確かめる → あれば novel_downloader で取得して続きを読む。無い・完結なら同じ作者の別作品を探す |
| 自炊本（FXL 等） | 次の巻を読む（手元にあるかもしれない）・同じ作者の本 |
| DRM フリーの市販本（O'Reilly 等） | 同じ著者・同じシリーズ |

ところが現状は次の 3 つの穴がある。

1. **読了の瞬間に次の行動が無い。** 必要な情報（著者検索 `_authorSearchLink`・底本リンク `_helpSourceHtml`・話数の差 `_helpVolumeHtml` の `partial`）は全部ヘルプにしか無く、読者はそれを知っていないと辿り着けない。
2. **「読みかけリストへ」を押すと、いま読み終えた本がリストから消える**（`_rlFilterSort` が `atEnd` を隠す）。続きを確かめたい本なのに、「✓読了も表示」を入れて探し直すことになる。
3. **読みかけリストに著者からの導線が無い。** `creators` はしおりに保存済みでデータは揃っている。

## 2. 方針

- **読了パネル（A）** を新設し、`#finished-banner` を置き換える。ヘルプと同じく**本文の上に重なる**形。PC は中央のダイアログ、スマホ（`max-width:640px`）は設定パネルと同じ**ボトムシート**。
- 出すのは**手元にある情報だけ**（通信しない）。手元の情報は**古いことがある**ので、Web 小説では**いつの情報か**を必ず添え、確認は「サイトを開く」で人に委ねる。自動の更新確認は G（§7-3）で別途設計する。
- **読み終えた本はそのセッションの間リストに残す（B）。**
- **カードの著者名から蔵書内の同じ著者の本へ（C）。** Web 検索はリスト上部の著者バーに置く（カードの密度を上げない）。

## 3. A. 読了パネル

### 3-1. 発火と置き換え

`showFinishedBanner()`（10961）の呼び出し元 5 箇所（5783・5918・5927・6287・7383：リフローの章末・FXL・読み上げの最終章など）はそのまま。関数の中身を「`_bookFinished=true` → `_rdMarkFinishedAt()` → パネルを開く」に変える。名前は互換のため残す（呼び出し元を触らない）。

- `#finished-banner` の markup・CSS・`dismissFinishedBanner()` は削除し、`#finished-panel` に一本化する。i18n の `finished.msg` / `finished.backToList` / `finished.dismiss` は流用する。
- **読み上げからの発火**: TTS は最終章末で `ttsStop()` と同時にパネルを出す（現状どおり）。
- **同じ本で 2 回目以降の発火**（「この本に戻る」のあと再び末尾で次へを押した）: 毎回出す。現状のバナーと同じ。

### 3-2. 置き場所と重なり順

`<div id="finished-overlay"><div id="finished-box">…</div></div>` を `#modal-overlay` の隣に置く（`#page-container` の子ではない — 全画面中でも出すため `position:fixed`）。

- `z-index:205`（`#modal-overlay` 200 と `#reading-data-overlay` 210 の間）。トースト 300・ローディング 250 より下。
- 開くときに **`#settings-popover` とサイドバー・タップメニュー・タップガイドを閉じる**（`showTtsHandoff()` と同じ理由 — 設定 500 の後ろに隠れる）。
- 背景タップで閉じる＝「この本に戻る」と同じ。

### 3-3. 形（PC とスマホ）

| | PC（>640px） | スマホ（≤640px） |
|---|---|---|
| 配置 | 中央・`max-width:440px` | 下端接地・全幅・上角丸（設定パネルのボトムシートと同じ寸法の決め方） |
| 高さ | 内容なり・`max-height:80vh` でスクロール | `max-height:min(82dvh, calc(100dvh - 56px))` |
| 主ボタン | 下端に横並び | 下端に横並び・押しやすい高さ 44px |

### 3-4. 中身

上から順に。**行は該当する情報があるときだけ出す。**

```
📖 最後まで読みました
[表紙]  書名
        著者 🔍  ／ 著者2 🔍

── この作品（Web 小説のとき）───────────────
  連載中 ・ サイト最終更新 2026-10-01
  サイトでは 120 話まで（この本は 98 話）        ← ダウンロード時に差があったときだけ
  ダウンロード 2026-08-01（87 日前）の情報です
  [📖 カクヨムで続きを確認 ↗]  [📋 URL をコピー]

── 次の巻（ISBN／シリーズ情報があるとき）────
  シリーズ名（3）
  [🔍 次の巻を探す ↗]                          ← NDL サーチ

── この著者の本 ────────────────────────
  蔵書に 3 冊  [リストで見る]                   ← 0 冊なら行ごと出さない
  [🔍 Web で探す ↗]

            [この本に戻る]   [読みかけリストへ]
```

- **Web 小説の判定**: `state.bookSourceUrl` があり、`siteNameFromUrl()` が青空文庫・杉田玄白・結城浩翻訳の部屋**以外**。青空文庫等は完結した作品なので「この作品」節を出さず、底本リンクだけ「この著者の本」節の上に出す。
- **連載状態**: `state.bookSerial`。`完結` を含めば「完結」、それ以外の非空は「連載中」（リストのバッジと同じ判定）。完結ならリンクの文言を「📖 ○○で読む」にする（続きは無いので）。
- **話数の差**: `_helpVolumeHtml` と同じ式（`_countEpisodesInSpine()` と `state.bookEpisodeCount`）。共通関数 `_volumeInfo()` に切り出して両方から使う。
- **情報の日付**: `nd:*` を 1 件でも持つ本だけ、OPF の `dcterms:modified`（novel_downloader が生成時刻を入れる）を `state.bookGeneratedAt` として読む。**他ツール製の本では読まない**（出版社の改訂日であって、手元情報の鮮度ではない）。30 日以上前なら行の色を少し強める。
- **URL をコピー**: `navigator.clipboard.writeText(state.bookSourceUrl)` → `toast.copied`。clipboard が無い・失敗したら URL を選択状態のテキストで見せる。yomikake はファイルのフルパスを知らないので、`--append <file>` のコマンドまでは組まない。
- **次の巻を探す**: `state.bookSeries`（`_seriesFromOpf`）か `state.bookSourceIsbn` があるとき。NDL サーチのキーワードはシリーズ名（巻数を除いたもの）＋著者。シリーズ名の取り出しのため `_seriesFromOpf` を `{name, vol}` を返す形にし、表示用の文字列は呼び出し側で組む。
- **この著者の本**: `_rlCollect()` の結果から `_authorsOf()`（§10-3）が一致する**この本以外**を数える。照合は `_rlNorm()` で正規化。「リストで見る」は「読みかけリストへ」と同じく `closeBook()` してから C の著者絞り込みをかける。
- **Web で探す**: 既存の `_authorSearchLink()` と同じ URL（`"名前" 作品`）。著者が複数なら著者行の各 🔍 で代用し、この行は出さない。E（`nd:authorUrl`）が入ったら「作者ページ ↗」を優先する（§7-2）。
- **ボタン**: 「読みかけリストへ」＝ `closeBook()`（主ボタン・アクセント色）。「この本に戻る」＝ パネルを閉じて本に留まる（旧「閉じない」。§10-1）。**パネル内のリンクを押してもパネルは閉じない**（別タブで確認して戻ってくる流れ）。

### 3-5. キーボード

- 既存のモーダルガード（`handleKey` の `#modal-overlay` 判定）に `#finished-overlay` を加える＝**Escape 以外は通さない**（裏でページが送られない）。
- Escape ＝「この本に戻る」。Escape チェーンの先頭に置く。
- **既定フォーカスは「この本に戻る」**。主ボタンに置くと、末尾で Space/Enter を連打していた勢いのまま本を閉じてしまう。
- 開いたらフォーカスを親へ引き取る（`showTapMenu()` と同じく、iframe にフォーカスがあると Escape が届かない）。

### 3-6. 実装しないこと

- 通信して最新の話数を確かめること（G で別途）。
- タグのリンク化（F・不採用）。

## 4. B. 読み終えた本をセッション中は残す

- モジュール変数 `_rlJustFinished = new Set()`（永続化しない）。`showFinishedBanner()` で `state.bookKey` を入れる。
- `_rlFilterSort` の `atEnd` 除外の例外にする: `items.filter(it => !it.atEnd || _rlJustFinished.has(it.key))`。件数の分母（`total`）にも含める。
- カードは既存の `rl-finished`（薄く表示）＋ ✓読了 バッジのままでよい。ソートは既存どおり（最近開いた順なら自然に先頭に来る）。
- **外す契機**: リロード（自然に消える）・完全削除・論理削除（`doDeleteBook` で `delete`）。読み返して `atEnd` が外れた場合は Set に残っていても無害。
- Drive／インポートで別端末の読了を受け取った本は入れない（このセッションで読み終えた本だけ）。

## 5. C. 著者からの導線

### 5-1. カードの著者名

- `.rl-creator` の中身を著者ごとの `<button class="rl-author" data-author="…">` にする（`_authorsOf(item)`・§10-3）。**inline onclick にデータを埋め込まない規約**どおり `this.dataset.author` で渡す。`event.stopPropagation()`（グリッドのカード全体クリックと分ける）。
- 押すと `setRlAuthor(name)`: 検索欄（`#rl-search`）に名前を入れて `_rlQuery` を更新 → `buildReadingList()`。既存の検索は著者名も対象（`_rlFilterSort` の `hay`）なので、**新しい絞り込みの仕組みは作らない**。
- 読了本も見えないと「同じ著者の本」にならないので、著者で絞るときは**読了を一時的に含める**か — **§8 の決めていただきたい点 1**。
- 編集モード中は無効（ボタンにしない）。

### 5-2. 著者バー

- 検索語が**いずれかのカードの著者名と完全一致**（`_rlNorm` 後）しているとき、リストの上に 1 行出す: `著者: ○○（3 冊）  🔍 Web で探す ↗  ✕`。
- ✕ は `clearRlFilters()`。Web で探すは `_authorSearchLink` と同じ URL。
- 完全一致で判定するので、普通に検索しているときには出ない。

### 5-3. キーボード

- カードのローミング tabindex には入れない（`.rl-author` は `tabindex="-1"`）。キーボードで著者に絞りたいときは `/` で検索欄へ入る既存の操作で足りる。

## 6. 両ファイルの差

- 違いは無い。パネルは両ファイル共通。iOS 版のスマホ表示（ボトムシート）は `@media(max-width:640px)` で同じ。
- 「URL をコピー」は iOS Safari でもクリック由来なら `navigator.clipboard.writeText` が通る。

## 7. 第2弾以降（方針のみ）

### 7-1. D. 蔵書から次の一冊

同じシリーズの次巻・同じ著者の読みかけ／未読・🆕 続きが出た連載を、読了パネルの「この著者の本」節の上に並べる。**しおりに `series` / `seriesIdx` を足す必要がある**ので、しおりの仕様（Drive 同期・書き出し・墓標・`_rdMergePos` / `_rdMergePosBest` の合流則・quota 時の落とし順）を検討してから別の設計書で確定させる。巻番号が無い自炊本はタイトル末尾の巻数（NFKC で揃えて比較）で推定する案がある。

### 7-2. E. 作者ページの URL（novel_downloader 側）

novel_downloader が `nd:authorUrl`（例: なろうの mypage・カクヨムの users ページ）を出力する。yomikake 側は `_ndMeta(opfDoc, 'authorUrl')` を読み、http(s) のときだけ「作者ページ ↗」を出す（Google 検索より優先）。**novel_downloader の改修を先に行い、yomikake の受け側はその後**。

### 7-3. G. 連載の更新をその場で確かめる

オンラインで使っているときの価値は大きい。ただし**十数サイトのスクレイピングを yomikake 本体に持つのは筋が違う**（novel_downloader の担当で、二重実装になる）し、ブラウザから各サイトを直接読むのは CORS で弾かれる見込みが高い（要実測）。そこで次の形を検討する。

- **yomikake 側は「更新確認の窓口」を 1 つだけ持つ。** 設定に URL の欄が 1 つあり、そこへ `{url}` を投げて `{episodeCount, updated, serialStatus}` を受け取るだけ。相手が何かを知らない（kosync の「サーバ URL 欄 1 つ」と同じ設計判断）。窓口が未設定なら読了パネルの「更新を確認」ボタンは出さない。
- **窓口の実装は差し替えられる。** 候補:
  1. **novel_downloader の更新確認部分を切り出した小さなサービス**を `www.ayati.com` に置く（kosync の中継と同じく同一オリジン）。全端末（iPhone・Android を含む）で効く。⚠ 行き先を `SOURCE_SITES` の作品 URL の形に限定しないと誰でも使える中継になる。レート制限と結果のキャッシュも要る。
  2. **novel_downloader に `--serve`（localhost の HTTP サーバ）を足す。** PC でだけ効くが、サーバの設置が要らない。
  3. 逆向き: novel_downloader の `--check-update-dir` / `--watch` の結果を JSON で置き、yomikake が読む。オンデマンドではない。
- ブラウザ拡張（アドオン）は Android Chrome と iOS Safari で使えない（拡張が無い／App が要る）ので候補から外す。
- 契約（要求・応答の形）を先に決めれば、1 と 2 は同じ yomikake のコードで使える。設計書 `design_update_check.md` で、実測（なろう公式 API の CORS など）から始める。

## 8. 決定事項

1. **著者で絞ったときは読了本を含める**（§5-1）。著者バーが出ている間だけ `showFinished` を無視する。
2. **手元情報の鮮度は日付で示す**（「ダウンロード 2026-08-01（87 日前）の情報です」）。

## 9. 実装の順（第1弾）

1. `_volumeInfo()` の切り出し・`_seriesFromOpf` の `{name, vol}` 化・`state.bookGeneratedAt`（ヘルプの表示は変えない）
2. B（`_rlJustFinished`）
3. A（パネル本体・PC/スマホ・キーボード・i18n 4 言語）
4. C（カードの著者・著者バー）
5. ヘルプ本文に読了パネルの説明を 1 行・CLAUDE.md・README

テストは `tests/cases/finished-panel.js`（両ファイル）。fixture の `reflow.epub` に `nd:serialStatus` / `nd:episodeCount` / `dcterms:modified` を足した本を `make-fixtures.py` で作り、**末尾で次へ → パネルが出る・各行の有無・Escape で閉じて本に留まる・「読みかけリストへ」で閉じた本がリストに残る・リロード相当（Set を空にする）で消える・著者を押すと絞り込まれる**を見る。実機で確かめるのはボトムシートの見た目と、末尾で連打したときに本を閉じてしまわないこと。

## 10. 現行コード確認での補正（v2.29.0）

### 10-1. ボタンの文言

「閉じない」は**何を**閉じないのか（本か、パネルか）が読めない。本に留まる操作なので **「この本に戻る」** にする（en `Back to the book` / zh-TW `回到本書` / zh-CN `回到本书`）。キーは `finished.dismiss` を流用し文言だけ替える。主ボタンは既存の **「読みかけリストへ」**（`finished.backToList`）のまま —— 読了の記録はパネルが出た時点で `_rdMarkFinishedAt()` が済ませているので、「読了にして」と書くと押さなければ読了にならないように読める。

### 10-2. 関数名と呼び出し元

- `showFinishedBanner()` / `dismissFinishedBanner()` は**名前を残して中身だけ差し替える**。呼び出し元は yomikake.html で開く側 5 箇所・閉じる側 2 箇所（`renderPage` 冒頭・`closeBook`）、iOS 版も同数で、触らずに済む。
- FXL の 1 箇所（`advanceFxlZoomStep` 系）は直後に `disableFxlZoom()` を呼ぶ。パネルは `position:fixed` で全体を覆うので順序の影響は無い。
- **閉じたら `reclaimKeyFocus()`** —— パネルのボタンにあったフォーカスを `#page-container` へ戻さないと、「この本に戻る」の直後にキーが効かない（ボタンが `blur` されると `body` に落ち、Space がブラウザ既定のスクロールになる）。
- **言語切替でパネルを組み直す** —— `setLang()` の「ヘルプが開いていれば `updateHelpContent()`」と並べて `_finishedRender()` を呼ぶ。

### 10-3. 著者名は「・」で分割しない

§3-4 と §5-1 の「`creator` を `・` で分割」は誤り。外国人名（「ジョン・スミス」）が割れる。`_rdAuthorRanking()` と同じく **`creators` 配列があればそれ、無ければ `creator` を丸ごと 1 名**として扱う。読了パネル側は `state.bookCreators`（無ければ `[state.bookCreator]`）。共通関数 `_authorsOf(item)` に切り出す。

### 10-4. 著者で絞る仕組み

新しい状態は持たない。**検索語（`_rlQuery` を `_rlNorm` したもの）が蔵書のいずれかの著者名と完全一致したら「著者モード」**とし、`_rlFilterSort()` で
- `atEnd` の除外をしない（§8-1）
- 著者バー（`#rl-author-bar`）を出す（`_rlRender` の外・`#reading-list-tools` の直後。リスト本体の innerHTML 再生成に巻き込まれない位置）

検索欄を手で消せば普通の検索に戻る。`clearRlFilters()` も検索語を消すので ✕ はそれを呼ぶだけでよい。著者モードの判定は `_rlFilterSort` の戻り値に `author`（一致した表示名・冊数）として載せ、`buildReadingList` が著者バーを更新する。

### 10-5. 読み終えた本の残し方（B）の抜け

`doDeleteBook()` の**論理削除（`markAsFinished`）は位置を末尾に書く＝`atEnd` にするだけ**なので、`_rlJustFinished` に入ったままだと**削除したのにリストに残る**。`doDeleteBook()` で必ず `_rlJustFinished.delete(bookKey)` する（purge も同じ）。

### 10-6. Drive の取り直し（`DRIVE_RETRY_SKIP_SEL`）

iOS の Drive 認証取り直しはクリックの「ユーザー操作の権利」を使う。パネル内では
- **「URL をコピー」は除外に加える**（`navigator.clipboard.writeText` も権利が要る。`[onclick*="finishedCopyUrl"]`）。リンク（`a[href]`）は既に除外されている。
- **「読みかけリストへ」は除外しない** —— ツールバーの「リストへ」と同じく、ここで取り直せば `closeBook → driveSaveNow` が保存できる。

### 10-7. シリーズ名

`_seriesFromOpf()` は表示用の文字列（`名前（巻）`）を返し、ヘルプがそのまま使っている。戻り値の型は変えず、`_seriesInfoFromOpf()`（`{name, vol}`）を新設して `_seriesFromOpf()` をその薄いラッパにする。`state.bookSeriesName` を足して「次の巻を探す」のキーワードに使う。

### 10-8. 鮮度の日付

`state.bookGeneratedAt` は `nd:` で始まる property を 1 件でも持つ本だけ `dcterms:modified` から読む（`loadEpub` の `nd:*` 読み取りの隣）。`closeBook` の state リセットにも足す。

### 10-9. コピー

yomikake にはまだクリップボードを使う箇所が無い。`navigator.clipboard.writeText` が無い・失敗したら、URL を入れた `<input readonly>` をパネル内に出して全選択する（手でコピーできる）。トーストは新キー `toast.urlCopied`。

### 10-10. テスト

`tests/cases/finished-panel.js`（`RAF_SHIM=1`）。fixture に `webnovel.epub`（`nd:serialStatus=連載中` / `nd:episodeCount=10` / `nd:updated` / `dc:source` にカクヨムの URL / `dcterms:modified`）を足す。

### 10-11. 実装で決めたこと

- **次の巻はシリーズ名があるときだけ出す**（§3-4 では ISBN でも出す案だった）。ISBN では同じ本の書誌にしか辿れず「次の巻」と書くと嘘になる。ISBN の書誌検索はヘルプに残っている。
- **著者バーの ✕ は検索語だけ消す**（`setRlAuthor('')`）。`clearRlFilters()` はジャンルや「すぐ開ける」まで消してしまう。
- **開いて 400ms（`FINISHED_GUARD_MS`）はボタン・背景タップ・Space/Enter を無視**し、キーリピートは常に握りつぶす（§3-5 の既定フォーカスだけでは、Enter の長押しで「閉じる→次へ→開く」を繰り返した）。
  - **タッチ端末（`(hover:none) and (pointer:coarse)`）は 800ms（`FINISHED_GUARD_TOUCH_MS`）**。スマホのボトムシートは 2 つのボタンが下端に全幅で並び、既定のタップ帯（L字）の「次へ」と重なる。どんどんページを送っていると、パネルに気づかず「読みかけリストへ」を押しうる（コードレビューの指摘・ご本人の判断で延長）。
- カードの著者名は `<span role="button">`（`<button>` は原子的なインラインなので、長い著者名に省略記号が付かず途中で切れる）。
- 旧バナーの重なり順を見ていた `tests/cases/screen-filter.js` の行は削除した（パネルは `#main` の外の固定配置で、明るさフィルタと同じスタッキングコンテキストにいない）。
