# AozoraEpub3 で作った ePub をきめ細かく扱う（第 1 弾）

状態: 実装済み（2026-10-28・未リリース）。検査ページの実測は済み（§1-4・§1-5・§1-6）。実機確認待ち。

yomikake はこれまで novel_downloader の ePub を前提に作ってきた。過去の定番で、今もフォーク（AozoraEpub3-JDK21 など）が広く使われている
**AozoraEpub3** の出力を、崩さず・持っている情報を活かして読めるようにする。

第 1 弾で採用するのは次の 6 項目（2026-10-28 の提案のうち A・10・14）。

| 記号 | 内容 | 対象 |
|---|---|---|
| A1 | CSS の `@import "x.css"` を解決する | **すべての本**（電書協形式の商業 ePub にも効く） |
| A2 | 古い書き方の縦中横に標準の `text-combine-upright` を補う | AozoraEpub3 の本 |
| A3 | 「横書き」モードで、縦書き前提の字下げ・傍線などを置き換える | AozoraEpub3 の本 |
| A4 | ダーク系テーマで、ePub が色を指定した要素を読めるようにする | AozoraEpub3 の本 |
| 10 | AozoraEpub3 製かどうかを判定する（上の A2〜A4 の前提）。青空文庫の奥付を読む | AozoraEpub3 の本 |
| 14 | ファイル名 `[作者名] 題名.epub` から書名・著者を補う | OPF に書名・著者が無い本 |

後の弾に回したもの（提案の B〜E）は §9。

---

## 1. 前提（調査の結果）

### 1-1. 手元の見本

`temp_sample/otherepub` の AozoraEpub3 製 10 冊。

| 種類 | 冊数 | 作り | 特徴 |
|---|---|---|---|
| Web 小説・kepub（`[作者] 題名.kepub.epub`） | 6 | `OPS/css/vertical*.css`、id `kobo.N.M` | 見出しタグが無い（`div.font1` や素の `<p>`）。4 冊は約 400KB ごとにファイルを割っていて、1 ファイルに数十話入る |
| Web 小説・電書協テンプレート（『ポーション頼みで生き延びます！』） | 1 | `item/style/book-style.css` が `@import "aozora.css"` などで 7 本を読む | **§1-3 の不具合で、スタイルがすべて落ちている** |
| 青空文庫（猫・坊っちゃん・銀河鉄道の夜。2026-10-28 にご本人が変換） | 3 | 扉 `title.xhtml` → 目次 `nav.xhtml`（spine に入る）→ 本文 1 ファイル → 奥付 | 本文は 1 ファイル（猫は 1.27MB）。目次は本文の中のアンカーを指す。外字（第 3・第 4 水準）は Unicode に置き換わっていて画像は無い |

青空文庫の 3 冊で使われている注記（元テキストで数えた）: 傍点 335・字下げ（1 行・ブロック）約 90・中見出し 31・下付き小文字 15・地から N 字上げ 4・小書き 5・外字 15 字ほど。
**罫囲み・傍線・割注・窓見出し・返り点・横組み・外字画像・挿絵は出てこない** → テスト用の合成 ePub（§8）で補う。

### 1-2. 判定の手がかり（項目 10）

AozoraEpub3 の OPF は、テンプレートが違っても manifest に **id `v_text` と `v_font` の CSS** を必ず持つ
（`vertical_text.css` / `vertical_font.css`、電書協テンプレートでは `style/text.css` / `style/font.css`）。

`temp_sample` の ePub 43 冊で数えると、**AozoraEpub3 製の 10 冊すべてが該当し、それ以外の 33 冊（novel_downloader・商業・O'Reilly・Project Gutenberg・自炊 FXL）はひとつも該当しない**。

### 1-3. `@import "x.css"` が解決されていない（項目 A1・既存の不具合）

`resolveCssText()` は `url(...)` の形しか書き換えない。`<link>` で読んだ CSS が `@import "style-standard.css";` の形（引用符だけ）で別の CSS を読むと、
本文は `srcdoc` ＋ `<base href="about:blank">` なので**相対パスが解決できず、読み込まれない**。

| 本 | `@import` |
|---|---|
| 『ポーション頼みで生き延びます！』（AozoraEpub3・電書協テンプレート） | 7 本（`aozora.css` を含む） |
| 『ねらわれた学園（新装版）』『仏教入門』『平安朝の事件簿』『蘇我氏』（講談社などの商業 ePub） | 4〜5 本（`style-standard.css` など） |
| 『ITエンジニアのためのMarkdown実践入門』 | 4 本 |

**電書協ガイドに沿った ePub は `book-style.css` から `@import` するのが定型**なので、縦中横・傍点・字下げ・画像の大きさの指定が全部落ちている。
「縦書き」モードは書字方向を強制するので見た目の崩れが小さく、今まで気づかれなかったと考えられる。
`@import url(x.css)` の形は今も `url()` として data URI に置き換わって動いているが、その中の `@import` や `url()` は解決されない。

### 1-4. 縦中横（項目 A2）

AozoraEpub3 は縦中横を **`.tcy span { text-combine: horizontal; -webkit-text-combine: horizontal; -epub-text-combine: horizontal; }` だけ**で書いている。
標準の `text-combine-upright` は無い（2018 年と 2026 年の版で同じ）。

実測（`tests/probe/aozoraepub3-css.html` の [A]・2026-10-28）:

| 環境 | `-webkit-text-combine` の `CSS.supports` | AozoraEpub3 の書き方のまま（[A1]）の見た目 |
|---|---|---|
| Chrome 145（headless） | true | 縦中横になる |
| Android Chrome 155 | true | 縦中横になる |
| Win11 Chrome 156 | true | 縦中横になる |
| iPad Safari（iOS 18.7 / Safari 26.6） | true | 縦中横になる |
| iPhone Safari（iOS 18.7 / Safari 26.5） | true | 縦中横になる |
| **Win11 Firefox 159** | **false** | **縦中横にならない**（`37` `!?` が横倒しのまま。スクリーンショットを拡大して確認） |

→ **Firefox だけ、AozoraEpub3 の本の縦中横が今すべて効いていない。** 標準の `text-combine-upright` は全環境で true。
Chrome / Safari でも廃止済みの書き方なので、いつ外れてもおかしくない。補っておく。

⚠ 検査ページの [A] の「高さ / 1em」の数字は、Firefox で**対照（[A4]・指定なし）まで 1.00** と出た。
`37` のような 2 桁は横倒しでも長さがほぼ 1em に収まるので、この数字では縦中横かどうかを見分けられない（Chrome・Safari では 1.08〜1.27 と環境ごとにばらつき、Win11 Chrome 156 の 1.08 は「収まる」側に判定された。フォントの字幅の偶然）。
判定は `CSS.supports` と見た目で行った。テスト（§8-2）では高さではなく `getComputedStyle(span).textCombineUpright` を見る。

### 1-5. 縦書き前提の書き方（項目 A3）

AozoraEpub3 の CSS は字下げなどを**物理プロパティ**で書いている。縦書き（`vertical-rl`）では「上」が行頭・「下」が行末なので正しく効くが、
yomikake の「横書き」モード（`horizontal-tb` を強制）では**意味が変わる**。

| クラス | AozoraEpub3 の指定 | 縦書きでの意味 | 横書きにすると |
|---|---|---|---|
| `div.pt1`〜`pt30` | `margin-top: Nem` | N 字下げ | **段落の上に N 行の空白**（字下げが消え、ブロックが縦に間延びする） |
| `div.pb1`〜`pb25` | `margin-bottom: Nem` | 地から N 字上げ | 段落の下に空白 |
| `div.jzm1`〜`jzm40` | `max-height: Nem` | N 字詰め | **高さが N 行に切られて中身があふれる** |
| `span.underline` ほか傍線 5 種 | `border-right` | 右傍線 | 文字の右に縦線 |
| `span.left_underline` | `border-left` | 左傍線 | 文字の左に縦線 |
| `span.fullsp` / `.half_em_space` | `padding-top: .5em` | 二分アキ（`!?` の後など。Web 小説では 1 冊に数千） | アキが消える |
| `span.wrc`（割注） | `position:relative; left:-.4em` | 位置合わせ | 左へずれる |
| `.gaiji img`（外字画像） | `position:relative; left:-.2em` | 位置合わせ | 左へずれる |
| `.introduction` / `.postscript`（前書き・後書き。narou.rb 系のテンプレート） | `float:right; height:70%` | 右側の帯 | 右端に高さ 70% の箱 |

`text-align:right`（地付き `div.btm`）と `text-indent`（`idt`）は論理的に解釈されるので、横書きでもそのまま正しい。

検査ページで実測（2026-10-28・headless Chrome 145、Win11 Chrome 156、Win11 Firefox 159、Android Chrome 155、iPad / iPhone Safari）。**6 環境とも同じ結果**:

- [C]（補正なし）: 8 字下げの見出しの `margin-top:8em` と前書きの `float` で、本文が枠の下へ押し出される。二字下げ・十字詰めの段落は枠の外
- [D]（補正あり）: 見出しが 8 字下がり、傍点は文字の上、傍線は文字の下、二字下げは折り返しても二字下がり、十字詰めは十字で折り返し、地から二字上げは右寄せ。正しく組める

### 1-6. ダーク系テーマ（項目 A4）

`buildSrcdoc()` は `html,body` の文字色・背景色だけをテーマ色にする。ePub が要素に色を指定していると、その色のまま残る。

| 要素 | AozoraEpub3 の色 | ダーク（`#111`）で |
|---|---|---|
| リンク | `#00C` / 訪問済み `#609` | ほぼ見えない。**青空文庫の本は目次ページが spine に入るので、本の 2 ページ目が読めない** |
| 罫囲み `.border` / `.dashed_border` | `#000` の線 | 見えない |
| `.custom_parameter_block`（narou.rb 系のテンプレート） | `#000` の線＋`#bbb` の影 | 線が見えない |
| 前書き `.introduction` / 後書き `.postscript` | 文字 `#555` / `#222` | **後書きが読めない** |
| 外字画像 `.gaiji img` | 黒い字の画像（見本には無い） | 見えない |

検査ページの [E]（補正なし）/[F]（§6 の補正あり）で実測（2026-10-28・6 環境とも同じ）: [E] はリンク・後書きがほぼ見えず、罫囲みの線も沈む。[F] はすべて読め、前書き・後書きは本文より少し淡く見分けがつく。

---

## 2. 生成元の判定（項目 10）

### 2-1. `state.bookOrigin`

`loadEpub()` で manifest を読んだ直後に決める。

```js
// AozoraEpub3（とそのフォーク）は テンプレートが違っても id v_text / v_font の CSS を必ず持つ（§1-2）
state.bookOrigin = (state.manifest['v_text'] && state.manifest['v_font']) ? 'aozoraepub3' : '';
```

- 値は `'aozoraepub3'` か `''`。他の生成元を見分ける必要が出たら値を足す（novel_downloader は今どおり `nd:*` で見る。ここに混ぜない）
- **しおりにも本ごとの表示設定にも保存しない**（本を開くたびに ePub から決まる）
- `closeBook()` で `''` に戻す

### 2-2. 使い道

1. A2〜A4 の CSS を入れるかどうかの判定（§4〜§6）。**クラス名だけを頼りに書き換えるので、AozoraEpub3 の本に限る**。`pt2` や `border` は他の ePub でも使われうる名前で、関係の無い本の組版を変えてしまうため
2. ヘルプの書誌ブロックに「作成: AozoraEpub3」を 1 行出す（どの規則が効いているかを利用者が知る手がかり。i18n キー `help.madeWith`）
3. 青空文庫の奥付を読む（§2-3）

### 2-3. 青空文庫の奥付

AozoraEpub3 は青空文庫のテキストの末尾（底本・入力・校正・「青空文庫作成ファイル：」）を**最後の spine に `<p>` のまま**出す。図書カードの URL は入らない（`http://www.aozora.gr.jp/` が本文中に文字で出るだけ）。

- `state.bookOrigin === 'aozoraepub3'` のとき、**最後の spine** のテキストに「青空文庫作成ファイル」を含んでいれば青空文庫の本とみなす
  - `state.bookSourceSite = '青空文庫'`（URL は空のまま）。読了パネルの「アーカイブ系サイト」扱い（`_FP_ARCHIVE_SITES`）にそのまま乗る
  - `底本：` で始まる段落と、それに続く字下げの段落（`　　　1987（昭和62）年…`）を `state.bookAozoraSource` に文字列で持つ（最大 3 段落・200 字）
- ヘルプの書誌ブロックの底本の行に、リンクではなく**文字で**「底本：「夏目漱石全集1」ちくま文庫、筑摩書房 1987（昭和62）年9月29日第1刷発行」と出す
- **図書カードへのリンクは作らない**（作品 ID が ePub に無い。作品名で検索する URL は青空文庫に無い）
- 読みかけリストのサイトバッジ用に、しおりの `site` へ `'青空文庫'` を書く（`saveBookMeta()` の既存の流れ。`source` は空なので書かない）

---

## 3. A1: `@import` を解決する（全ての本）

`<link>` / `<style>` の CSS を取り込むときに、`@import` を**参照先の CSS の中身で置き換える**（展開する）。data URI のまま残すより、
入れ子の `@import` と `url()` を同じ規則で解決できるので確実。

```
resolveCssText(css, cssDir, seen = new Set(), depth = 0)
  1. @import を先に処理する:
       @import "a.css";  @import 'a.css';  @import url(a.css);  @import url("a.css") screen;
     - 参照先を resolvePath(cssDir, href) で ZIP から読み、
       resolveCssText(中身, その CSS のディレクトリ, seen, depth+1) を通した文字列で置き換える
     - メディア指定があれば @media <指定> { … } で包む
     - 中身の先頭の @charset は落とす（2 つ目以降の @charset は無効）
     - ZIP に無い（style-check.css など）・depth が 5 を超える・同じパスを既に展開中（循環）なら、その行を消す
     - http(s): で始まる @import は触らない（CSP で止まるか、そのまま読まれる）
  2. 今までどおり url(...) を data URI に置き換える
```

- **⚠ `@import` を `url()` の置き換え（手順 2）より先に処理すること。** 後にすると `@import url(a.css)` が先に data URI になり、入れ子が解決できない今の状態のまま残る
- 展開した中身に `@namespace` が後ろから入ると規則の途中に来て無効になるが、無視されるだけで害は無い（AozoraEpub3 の `@namespace` は XHTML の既定名前空間で、HTML として読む本文には効いても効かなくても同じ）
- CSS の読み込みは 1 章の描画ごとに走る。電書協の `style-standard.css`（約 55KB）＋`style-advance.css`（約 85KB）で重くなるようなら、
  展開結果をパスごとに `Map` に持つ（本を切り替えたら捨てる）。**まず測ってから決める**
- 実装時の確認（2026-10-28・headless）: 『仏教入門』の 1 章で取り込む CSS が 5.9KB → 147KB（`@import` 5 本ぶん）。headless は仮想時間で動くため描画時間は測れなかった。実機で章送りが重くなっていないかを見る（§8-3）
- `<style>` ブロック（`resolveCssText(style.textContent, dir)`）とインラインの `style` 属性も同じ関数を通るので、そのまま効く

**全ての本に効かせる。** 本来読まれるはずだった CSS を読むだけなので、生成元で分ける理由が無い。
ただし §1-3 の 5 冊の商業本は**見た目が変わる**（落ちていた縦中横・傍点・字下げが戻る）。リリースノートに書く。

---

## 4. A2: 縦中横を補う（AozoraEpub3 の本）

`buildSrcdoc()` の注入スタイルに、`state.bookOrigin === 'aozoraepub3'` のときだけ足す。

```css
.tcy > span { text-combine-upright: all !important; }
```

- AozoraEpub3 自身が `.tcy span` を縦中横にするつもりで書いているので、意味は変わらない
- 横書き（`horizontal-tb`）では `text-combine-upright` は効かないので、書字方向で分けなくてよい
- 既存の `fixTcy()`（初回描画で縦中横が左に寄る問題）は `text-combine-upright` を対象にした対策なので、そのまま効く
- **Firefox では今、AozoraEpub3 の本の縦中横がすべて横倒しになっている**（§1-4 の実測）。この項目で直る。Chrome・Safari は見た目が変わらない

---

## 5. A3: 横書きモードで置き換える（AozoraEpub3 の本）

`state.writingMode === 'horizontal'` かつ `state.bookOrigin === 'aozoraepub3'` のときだけ、§1-5 の表を置き換える CSS を注入する。

```css
div.pt{N}  { margin-top:0 !important;    margin-inline-start:{N}em !important; }   /* N = 1..30 */
div.pb{N}  { margin-bottom:0 !important; margin-inline-end:{N}em !important; }     /* N = 1..25 */
div.jzm{N} { max-height:none !important; max-width:{N}em !important; }             /* N = 1..40 */
span.underline, span.double_underline, span.dotted_underline,
span.dashed_underline, span.wave_underline
           { border-right:0 !important; padding-right:0 !important;
             border-bottom:<元の幅と線種> currentColor !important; padding-bottom:1px !important; }
span.left_underline
           { border-left:0 !important; padding-left:0 !important;
             border-top:1px solid currentColor !important; padding-top:1px !important; }
span.fullsp, .half_em_space
           { padding-top:0 !important; padding-inline-start:.5em !important; }
span.wrc, .gaiji img { left:auto !important; }
.introduction, .postscript
           { float:none !important; height:auto !important; margin-right:0 !important; display:block !important; }
```

- 番号つきのクラスは文字列を組み立てる関数で作る（`aeHorizontalFixCss()`）。数の上限は AozoraEpub3 の CSS と同じ
- 傍線の線種は元のクラスに合わせる（`double_underline` は `3px double`、`dotted` / `dashed` はそれぞれ）
- **「縦書き」「出版社の指定」モードでは何もしない。** 「縦書き」は AozoraEpub3 の前提どおりで、「出版社の指定」は ePub が縦書きを指定している
- **対象外**: 窓見出し `span.mado`（`float:left` は横書きでも行頭側で、むしろ正しい）、画像の回り込み `span.img.ft` / `.fb`（見本に無く、置き換え先が決められない）、扉の `div.vrtl`（扉だけ縦書きのまま残る。中央に寄った縦の書名で、読める）
- AozoraEpub3 には横書きの出力（テンプレート）もあるが、**手元に見本が無い**。その本を「縦書き」モードで開いたときに同じ問題が逆向きに起きるはず。見本が手に入ってから扱う（§9）

---

## 6. A4: ダーク系テーマ（AozoraEpub3 の本）

`state.bookOrigin === 'aozoraepub3'` かつ**暗いテーマ**のときだけ注入する。

```css
a:link, a:visited, a:active { color: inherit !important; }
.border, .dashed_border, .custom_parameter_block { border-color: currentColor !important; box-shadow: none !important; }
.introduction, .postscript { color: inherit !important; opacity: .8; }
.gaiji img { filter: invert(1); }
```

- 「暗いテーマ」は名前で列挙せず、`THEME_CONTENT[theme].paper` の明るさ（相対輝度 < 0.2）で決める（`isDarkPaper()`）。今は `dark` と `hoshi` が該当する。テーマが増えても直さなくてよい
- 明るいテーマでは何もしない。リンクの青・罫囲みの黒は明るい紙では読めるし、出版元の色を残すほうが元の組版に忠実
- 目次ページ（`nav.xhtml`）の `li a` の右線（`border-right`）は色を指定していない（文字色に従う）ので、文字色がテーマ色になれば読める
- `opacity:.8` は前書き・後書きが本文と同じ濃さになって区別がなくなるのを避けるため。小さい字・上の線と合わせて見分けられる
- **外字画像の反転は見本が無いので実測できない**。白地に黒の画像（不透明）なら反転で黒地に白になり、透過 PNG なら黒い字が白くなる。どちらでも読めるはずだが、合成 ePub（§8）で両方を確かめる

---

## 7. 14: ファイル名から書名・著者を補う

AozoraEpub3 は既定でファイル名を `[作者名] 題名.epub` にする（kepub では `.kepub.epub`）。元のテキストに書名や著者の行が無いと、OPF が空になることがある。

### 7-1. 規則

`parseAe3FileName(name)`:

```
拡張子 .epub / .kepub.epub / .kepub を落とす
先頭が [ … ] なら中身を著者、残り（前後の空白を除く）を書名
そうでなければ全体を書名、著者は ''
```

- **OPF に値があるときは使わない。** ファイル名は利用者が変えられるうえ、AozoraEpub3 はファイル名に使えない文字を落とす（OPF の `丘/丘野　優` がファイル名では `丘丘野　優` になっている）。OPF のほうが正確
- 書名が OPF に無いとき: 今は `file.name`（拡張子つき）がそのまま書名になっている。`parseAe3FileName` の書名を使う
- 著者が OPF に無いとき: `[ ]` の中身を `state.bookCreator`（＝`state.bookCreators = [その名前]`）にする
- **AozoraEpub3 の本に限らない**（ファイル名の形だけを見る）。手作業で `[作者] 題名.epub` と名付ける人も多い

### 7-2. しおりのキーが変わる問題

しおりのキーは `makeBookKey(書名, 著者)`。今まで著者が空で開いていた本は、この変更で**キーが変わり、続きから開けなくなる**。

`loadEpub()` で新しいキーにしおりが無ければ、**補う前と同じ組み立てのキー 1 つ**を探して移す（`_rekeyBookmark`。見つかったら新しいキーへ写して古いキーを消す。読書データと本ごとの表示設定 `epub_book_prefs` のキーも移す）:

- 書名＝ `dc:title` が無かったなら拡張子つきの `file.name`、あれば OPF の書名
- 著者＝ ファイル名から補ったなら `''`、そうでなければ OPF の著者

⚠ **`dc:title` が空の要素として在った本は移さない。** 旧キーの書名が空文字になり、同じ形の本どうしで同じキーを共有していた可能性があるため（別の本のしおりを奪いかねない）。
KOReader の対応表（`epub_kosync_docs`）は本の中身からハッシュを計算し直すので移さない。

- Drive やしおりの書き出しには古いキーで残っているかもしれないが、取り込み後にその本を開けば同じ移し替えが走る
- ⚠ 同じ本でもファイル名を変えて開くと、補った書名・著者が変わって**別の本**として扱われる。OPF が空の本だけの話で、今もファイル名が書名なので状況は同じ

---

### 7-3. 実装メモ（現行コードとの対応・2026-10-28 に確認）

| 項目 | 触る場所（両ファイル） | メモ |
|---|---|---|
| 10 | `loadEpub()` の manifest を組んだ直後 | `state.manifest` は id をキーにした辞書なので、`hasOwnKey(state.manifest, 'v_text')` で引ける（`'constructor'` 等を拾わないよう `in` は使わない） |
| 10 奥付 | `loadEpub()` の `resolveSourceFromSpine()` の後 | 新関数 `_aozoraColophon()`。最後の spine を `htmlToText` 相当で読む（既に async の区間）。`state.bookAozoraSource` を `closeBook()` で空に戻す |
| 10 ヘルプ | `_helpSourceHtml()` / `_helpProductionHtml()` | 底本の行は URL も ISBN も無いときだけ `bookAozoraSource` を出す。「作成: AozoraEpub3」は制作者の行（`_helpProductionHtml`）の末尾に足す。今の `_helpProductionHtml` は制作者が居ないと空を返すので、生成元だけでも 1 行出るようにする |
| 10 読了パネル | `_finishedWorkHtml()` | URL が無いと何も出さない作り。青空文庫で URL が無い本は今どおり出さない（図書カードに行けないため） |
| A1 | `resolveCssText(css, cssDir)` | 呼び出しは `<link>`・`<style>`・`style` 属性の 3 箇所。引数を足すだけで呼び出し側は変えない。**`@import` を探す前にコメントを消す**（電書協の `book-style.css` はコメントの中にも `@import` の説明を書く） |
| A2〜A4 | `buildSrcdoc()` の注入スタイル（`img{max-width…}` の直後） | 新関数 `aozoraFixCss()` が 1 本の文字列を返す。AozoraEpub3 でない本では空文字 |
| A4 | 同上 | `isDarkPaper(hex)`（相対輝度）。`THEME_CONTENT` は `dark`（`#111111`）と `hoshi`（`#0e1a2e`）だけが暗い |
| 14 | `loadEpub()` の書名・著者を決めるところ | 今は `titleEl ? titleEl.textContent : file.name`。**`dc:title` が空文字のときも無い扱い**にする。キーの移し替えは新関数 `_rekeyBookmark(oldKey, newKey)`（しおり・`epub_last_book`・読書データ `_rdRekeyStats`・本ごとの表示設定）。KOReader の対応表は中身から計算し直されるので移さない。古いキーの ePub キャッシュ（IDB）と FSA ハンドルは消す（新しいキーで書き直されるので、残すと 1 冊ぶん漏れる） |

## 8. テスト

### 8-1. 合成 ePub（`tests/lib/make-fixtures.py` に追加）

実物は個人の蔵書なので、AozoraEpub3 の形を真似て作る。

| fixture | 中身 |
|---|---|
| `ae3.epub` | `OPS/css/vertical_{text,font,middle,image}.css` ＋ `vertical.css`（id `v_text` / `v_font` など。中身は実物から必要な規則を抜粋）。扉 → 目次（spine）→ 本文 1 ファイル（中見出し・`pt8`・`pt2` ブロック・`pb2 btm`・`jzm10`・傍点・傍線 2 種・`tcy`・`fullsp`・割注・罫囲み・リンク・前書き/後書き・外字画像）→ 奥付（「底本：」「青空文庫作成ファイル：」） |
| `notae3.epub` | `ae3.epub` と同じ本文・CSS で、manifest の id だけ違う（判定が外れることと、外れたときに A2〜A4 が入らないことを見る） |
| `ebpaj-import.epub`（AozoraEpub3 では**ない**本。A1 が全ての本に効くことを見る） | `book-style.css` が `@import "a.css";` / `@import url('b.css') screen;` / ZIP に無い `@import "missing.css";` / 循環（`c.css` ↔ `d.css`）を持つ。`a.css` が下の階層の `sub/e.css` を読み、`e.css` が `url(../x.png)` を参照（入れ子でも参照元のディレクトリで解決できること）。コメントの中の `@import` は無視する |
| `noopf.epub`（ファイル名 `[テスト作者] 書名のない本.epub` として開く） | OPF に `dc:title` も `dc:creator` も無い |

### 8-2. `tests/cases/aozoraepub3.js`（両ファイル）

本を実際に開き、**iframe の中の計算済みスタイル・実寸**を測る（クラスの有無だけでは「規則は入ったのに効いていない」を取り逃がす）。

実装済み: 両ファイル各 67 assertion。修正前のコードに流すと A1・A2〜A4 の項目が落ちることも確認した。

- 判定: `ae3.epub` で `state.bookOrigin === 'aozoraepub3'`、`reflow.epub` で `''`
- A1: `ebpaj-import.epub` で `a.css` の規則が効く・`screen` の規則が効く・`url()` が data URI になる・missing と循環で止まらない（描画が終わる）
- A2: `.tcy > span` の `textCombineUpright === 'all'`。`reflow.epub` に同じ構造を置いても付かない
- A3: 横書きモードで `div.pt2` の `margin-top` が 0・`margin-left` が 2em ぶん。**縦書きモードでは `margin-top` が 2em のまま**。AozoraEpub3 でない本の `div.pt2` は横書きでも変わらない
- A4: `dark` でリンクの色＝本文の色。`''`（明るい既定）ではリンクは `#00C` のまま
- 10: 青空文庫の奥付から `bookSourceSite === '青空文庫'`、`bookAozoraSource` が「底本：」で始まる。ヘルプに「作成: AozoraEpub3」が 4 言語で出る
- 14: `parseAe3FileName` の単体（`.kepub.epub`・`[ ]` 無し・全角の `［ ］` は対象外）。`noopf.epub` で書名・著者が補われる。古いキー（`書名__` / `ファイル名.epub__`）のしおりが新しいキーへ移る

### 8-3. 実機で見ること

- `tests/probe/aozoraepub3-css.html`: 2026-10-28 に 6 環境で実測済み（§1-4〜§1-6）
- 実物: 青空文庫の 3 冊と『ポーション頼みで生き延びます！』を、縦書き・横書き・ダークで開く。電書協の商業本（`ねらわれた学園` など）を開き、**縦中横・傍点が戻り、ほかが崩れていないこと**
- 猫（1 ファイル 1.27MB）の描画時間が、A1 で変わっていないこと

---

### 8-4. 実機で見つかった不具合（2026-10-28）

- **iPad で AozoraEpub3 の本が開けない**（「container.xml に rootfile 要素がありません」）。AozoraEpub3 は `container.xml` を BOM 付きで書く（手元の 9 冊すべて。OPF には付かない）。JSZip の `async('text')` は BOM を U+FEFF として残し、Chrome の `DOMParser` は読み飛ばすが **Safari は XML 宣言の前の文字として解析に失敗する**。今回の変更による退行ではなく以前からの不具合（Chrome でしか試していなかった）。`container.xml` と OPF を `stripBom()` してから解析する。Chrome のテストでは失敗が再現しないので、`DOMParser.prototype.parseFromString` を包んで BOM が渡らないことを検査する

## 9. 後の弾に回したもの

| 提案 | 内容 | 回した理由 |
|---|---|---|
| B5〜B8 | 章送り・現在地の表示・読み上げの受け渡し・話数を、ファイル単位ではなく目次の項目単位にする | 効果は最も大きいが、`renderPage` / 進捗 / TTS / kosync に広く触れる。第 1 弾の表示の修正と分ける |
| B9 | 見出しタグの無い本から補助目次を作る | 推定の精度に課題 |
| C11 | 著者名の表記ゆれ（`ＦＵＮＡ` / `FUNA`）を本棚の著者モードで同一視 | 第 1 弾に入れていない |
| C12 | 「あらすじ」ページを `bookDescription` に読む | 同上 |
| C13・C15 | 底本 URL の無い本の更新確認・novel_downloader で取り直した本へのしおりの引き継ぎ | 設計が要る |
| D | 返り点・割注・窓見出し・画像の回り込みの細部 | 見本の本が無い。§8 の合成 ePub で見た目を確かめてから |
| ― | AozoraEpub3 の横書き出力 | 見本が無い |
| ― | 1 ファイル 1MB 超の本文の描画速度（猫 1.27MB） | 測ってから |
