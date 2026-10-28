// AozoraEpub3 で作った ePub をきめ細かく扱う（design_aozoraepub3.md）
//
// fixture（tests/lib/make-fixtures.py）:
//   ae3.epub          AozoraEpub3 の形（青空文庫を変換した本の並び・実物の CSS の書き方）
//   notae3.epub       同じ中身で manifest の id だけ違う本（判定が外れることの対照）
//   ebpaj-import.epub book-style.css が @import で CSS を読む電書協形式の本（AozoraEpub3 ではない）
//   noopf.epub        OPF に書名も著者も無い本
// **実際に本を開いて iframe の中の計算済みスタイルを測る**（規則が入ったのに効いていない、を取り逃がさない）。

function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function idoc() {
  var f = document.getElementById('content-iframe');
  return f && f.contentDocument;
}
function cs(id) {
  var d = idoc(), el = d && d.getElementById(id);
  return el ? d.defaultView.getComputedStyle(el) : null;
}
function openFixture(name, fileName) {
  return fetch('tests/.fixtures/' + name)
    .then(function (r) { return r.blob(); })
    .then(function (b) { return loadEpub(new File([b], fileName || name, { type: 'application/epub+zip' })); })
    .then(function () { return wait(900); });
}
// 指定した spine を描いて待つ
function showSpine(idx) { renderPage(idx, 'start'); return wait(900); }
function spineIdxOf(name) {
  for (var i = 0; i < state.spine.length; i++) if ((state.spine[i].href || '').indexOf(name) >= 0) return i;
  return -1;
}

function px(v) { return parseFloat(v) || 0; }
function em(id) { return px(cs(id).fontSize); }
function near(a, b) { return Math.abs(a - b) <= 1; }
function injected() { var s = idoc().getElementById('epub-viewer-inject'); return s ? s.textContent : ''; }

// Safari の DOMParser は先頭に BOM（U+FEFF）のある XML を解析できない（Chrome は読み飛ばすので
// このテストの Chrome では失敗が再現しない）。XML として渡される文字列に BOM が残っていないことを見張る
var __xmlBom = [];
(function () {
  var orig = DOMParser.prototype.parseFromString;
  DOMParser.prototype.parseFromString = function (str, type) {
    if (/xml/.test(type) && String(str).charCodeAt(0) === 0xFEFF) __xmlBom.push(String(str).slice(1, 60));
    return orig.call(this, str, type);
  };
})();

localStorage.clear();
var CHAIN = Promise.resolve()

// ══ A1: @import を解決する（全ての本） ═════════════════════════════
.then(function () { return openFixture('ebpaj-import.epub'); })
.then(function () {
  T('A1: 電書協の本が開けた', !!state.epub && state.renderMode === 'reflow', state.bookTitle);
  var d = idoc();
  T('A1: iframe の中を読める', !!d && !!d.getElementById('tcy'));
  var tcy = cs('tcy'), upr = cs('upr');
  T('A1: @import "a.css" の縦中横が効く', !!tcy && tcy.textCombineUpright === 'all', tcy && tcy.textCombineUpright);
  T('A1: @import "a.css" の正立が効く', !!upr && upr.textOrientation === 'upright', upr && upr.textOrientation);
  var bg = cs('bg');
  T('A1: 入れ子の @import（sub/e.css）の url(../../) が data URI になる',
    !!bg && bg.backgroundImage.indexOf('data:image/png') >= 0, bg && bg.backgroundImage.slice(0, 40));
  var scr = cs('scr');
  T('A1: メディア指定つき @import url() screen が効く', !!scr && scr.fontStyle === 'italic', scr && scr.fontStyle);
  T('A1: 循環 c.css の規則が効く', cs('cc').fontWeight === '700', cs('cc').fontWeight);
  T('A1: 循環 d.css の規則が効く', cs('dd').textDecorationLine === 'line-through', cs('dd').textDecorationLine);
  T('A1: 読み込み元自身の規則も残る', cs('own').textDecorationLine === 'underline', cs('own').textDecorationLine);
  var css = [].map.call(d.querySelectorAll('style'), function (s) { return s.textContent; }).join('\n');
  T('A1: 相対パスの @import が残っていない', !/@import\s+(url\()?['"]?(?!https?:)[^'"\s)]*\.css/i.test(css),
    (css.match(/@import[^;]*;/g) || []).join(' '));
  T('A1: コメントの中の @import は展開しない（evil.css は無い）', css.indexOf('evil') < 0);
})

// ══ 10: 生成元の判定・青空文庫の奥付 ═══════════════════════════════
.then(function () {
  T('10: AozoraEpub3 でない本は空', state.bookOrigin === '', state.bookOrigin);
  return openFixture('ae3.epub');
})
.then(function () {
  T('10: AozoraEpub3 の本を判定できる', state.bookOrigin === 'aozoraepub3', state.bookOrigin);
  T('BOM: BOM 付きの container.xml / OPF の本が開ける', state.bookTitle === 'テスト青空', state.bookTitle);
  T('BOM: XML として解析する文字列に BOM を残さない', __xmlBom.length === 0, __xmlBom.join(' | '));
  T('10: 青空文庫の奥付から site を決める', state.bookSourceSite === '青空文庫', state.bookSourceSite);
  T('10: URL は作らない', state.bookSourceUrl === '', state.bookSourceUrl);
  T('10: 底本の段落と続く字下げの段落を読む',
    /^底本：「テスト全集1」テスト文庫、テスト書房 1987（昭和62）年9月29日第1刷発行$/.test(state.bookAozoraSource),
    state.bookAozoraSource);
  T('10: 底本の親本は含めない', state.bookAozoraSource.indexOf('親本') < 0);
  var saved = JSON.parse(localStorage.getItem(state.bookKey) || '{}');
  T('10: しおりの site に青空文庫を書く', saved.site === '青空文庫' && !saved.source, JSON.stringify({site: saved.site, source: saved.source}));
  // ヘルプの書誌ブロック（4 言語）
  var langs = ['ja', 'en', 'zh-TW', 'zh-CN'], ok = true, detail = '';
  langs.forEach(function (lg) {
    setLang(lg); updateHelpContent();
    var html = document.getElementById('modal-body').innerHTML;
    var good = html.indexOf('AozoraEpub3') >= 0 && html.indexOf(esc(t('help.fromAozora'))) >= 0 && html.indexOf('テスト全集') >= 0;
    if (!good) { ok = false; detail += lg + ' '; }
  });
  setLang('ja');
  T('10: ヘルプに作成ツールと底本が 4 言語で出る', ok, detail);
  closeBook();
  T('10: 本を閉じると空に戻る', state.bookOrigin === '' && state.bookAozoraSource === '');
  return openFixture('notae3.epub');
})
.then(function () {
  T('10: id が違えば AozoraEpub3 とみなさない', state.bookOrigin === '', state.bookOrigin);
  T('10: 判定が外れた本では奥付も読まない', state.bookSourceSite === '' && state.bookAozoraSource === '',
    state.bookSourceSite + '/' + state.bookAozoraSource);
  updateHelpContent();
  T('10: ヘルプに作成ツールを出さない', document.getElementById('modal-body').innerHTML.indexOf('AozoraEpub3') < 0);
})

// ══ A2〜A4: AozoraEpub3 の CSS の補正 ═══════════════════════════════
.then(function () { return openFixture('ae3.epub'); })
.then(function () {
  state.theme = ''; state.writingMode = 'vertical';
  return showSpine(spineIdxOf('0001.xhtml'));
})
.then(function () {
  var t = idoc().querySelector('#tcy > span');
  T('A2: .tcy > span に text-combine-upright:all', !!t && idoc().defaultView.getComputedStyle(t).textCombineUpright === 'all');
  T('A2: 注入スタイルに縦中横の規則がある', injected().indexOf('.tcy>span{text-combine-upright:all') >= 0);
  // 縦書きは AozoraEpub3 の前提どおりなので A3 は入れない
  T('A3: 縦書きでは字下げは margin-top のまま', near(px(cs('pt2').marginTop), 2 * em('pt2')),
    cs('pt2').marginTop + ' / em=' + em('pt2'));
  T('A3: 縦書きでは置き換えの規則を入れない', injected().indexOf('div.pt2{') < 0);
  T('A4: 明るいテーマではリンクは出版元の色', cs('link').color === 'rgb(0, 0, 204)', cs('link').color);
  changeWritingMode('horizontal');
  return wait(900);
})
.then(function () {
  T('A3: 横書きにした', state.writingMode === 'horizontal' && idoc().defaultView.getComputedStyle(idoc().body).writingMode === 'horizontal-tb');
  var p2 = cs('pt2');
  T('A3: 横書きで二字下げは行頭の 2em', near(px(p2.marginLeft), 2 * em('pt2')) && px(p2.marginTop) === 0,
    'left=' + p2.marginLeft + ' top=' + p2.marginTop);
  var pb = cs('pb2');
  T('A3: 横書きで地から二字上げは行末の 2em', near(px(pb.marginRight), 2 * em('pb2')) && px(pb.marginBottom) === 0,
    'right=' + pb.marginRight + ' bottom=' + pb.marginBottom);
  var jz = cs('jzm');
  T('A3: 横書きで十字詰めは幅 10em', near(px(jz.maxWidth), 10 * em('jzm')) && jz.maxHeight === 'none',
    'max-width=' + jz.maxWidth + ' max-height=' + jz.maxHeight);
  var ul = cs('ul');
  T('A3: 横書きで傍線は下線', ul.borderBottomStyle === 'solid' && px(ul.borderRightWidth) === 0,
    ul.borderBottomStyle + '/' + ul.borderRightWidth);
  T('A3: 二重傍線は二重の下線', cs('dul').borderBottomStyle === 'double' && px(cs('dul').borderBottomWidth) >= 3,
    cs('dul').borderBottomStyle + '/' + cs('dul').borderBottomWidth);
  T('A3: 左傍線は上線', cs('lul').borderTopStyle === 'solid' && px(cs('lul').borderLeftWidth) === 0,
    cs('lul').borderTopStyle + '/' + cs('lul').borderLeftWidth);
  T('A3: 二分アキは行頭側の padding', px(cs('fullsp').paddingLeft) > 0 && px(cs('fullsp').paddingTop) === 0,
    cs('fullsp').paddingLeft + '/' + cs('fullsp').paddingTop);
  T('A3: 割注・外字のずらしを戻す', cs('wrc').left === 'auto' || px(cs('wrc').left) === 0, cs('wrc').left);
  T('A3: 前書きの回り込みを外す', cs('intro').cssFloat === 'none' && cs('intro').height !== '70%', cs('intro').cssFloat);
  // 実寸: 二字下げの段落の左端が、地の文の段落より 2em 右にある（規則が入っても効いていない、を拾う）
  var d = idoc(), base = d.querySelector('#kobo\\.2\\.1 ~ p'), ind = d.querySelector('#pt2 p');
  var dx = ind.getBoundingClientRect().left - base.getBoundingClientRect().left;
  T('A3: 実寸で二字下がっている', near(dx, 2 * em('pt2')), 'dx=' + dx.toFixed(1));
  changeTheme('dark');
  return wait(900);
})
.then(function () {
  var body = idoc().defaultView.getComputedStyle(idoc().body).color;
  T('A4: ダークでリンクは本文の色', cs('link').color === body, cs('link').color + ' / ' + body);
  T('A4: ダークで罫囲みの線は本文の色', cs('border').borderTopColor === body, cs('border').borderTopColor);
  T('A4: ダークで後書きは本文の色', cs('post').color === body, cs('post').color);
  T('A4: ダークで外字画像を反転', cs('gaiji').filter.indexOf('invert') >= 0, cs('gaiji').filter);
  changeTheme('hoshi');
  return wait(900);
})
.then(function () {
  T('A4: 星空（暗いテーマ）でも効く', cs('link').color === idoc().defaultView.getComputedStyle(idoc().body).color, cs('link').color);
  T('A4: 暗いテーマの判定', isDarkPaper('#111111') && isDarkPaper('#0e1a2e') && !isDarkPaper('#fdf8f0') && !isDarkPaper('#dfc89a') && !isDarkPaper('#f0f0fa'));
  return openFixture('notae3.epub');
})
// 対照: 同じ中身でも AozoraEpub3 と判定されなければ何も足さない（横書き・ダークのまま開く）
.then(function () { return showSpine(spineIdxOf('0001.xhtml')); })
.then(function () {
  T('対照: 横書き・星空のまま', state.writingMode === 'horizontal' && state.theme === 'hoshi');
  T('対照: 補正の規則を入れない', injected().indexOf('text-combine-upright:all') < 0 && injected().indexOf('div.pt2{') < 0);
  T('対照: 字下げは ePub の指定のまま（margin-top）', near(px(cs('pt2').marginTop), 2 * em('pt2')), cs('pt2').marginTop);
  T('対照: リンクは ePub の色のまま', cs('link').color === 'rgb(0, 0, 204)', cs('link').color);
  changeWritingMode('vertical'); changeTheme('');
  return wait(900);
})

// ══ 14: ファイル名 [作者名] 題名.epub から補う ═══════════════════════
.then(function () {
  function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  T('14: [作者] 題名.epub', eq(parseAe3FileName('[夏目漱石] 坊っちゃん.epub'), {creator: '夏目漱石', title: '坊っちゃん'}));
  T('14: .kepub.epub も落とす', eq(parseAe3FileName('[伏瀬] 転生したらスライムだった件.kepub.epub'), {creator: '伏瀬', title: '転生したらスライムだった件'}));
  T('14: 空白なしでも分ける', eq(parseAe3FileName('[作者]題名.epub'), {creator: '作者', title: '題名'}));
  T('14: [ ] が無ければ全体が書名', eq(parseAe3FileName('ただの本.epub'), {creator: '', title: 'ただの本'}));
  T('14: 全角の［ ］は対象外', eq(parseAe3FileName('［作者］題名.epub'), {creator: '', title: '［作者］題名'}));
  T('14: 書名が無ければ分けない', eq(parseAe3FileName('[作者].epub'), {creator: '', title: '[作者]'}));
  // 補う前のキー（書名＝拡張子つきのファイル名・著者なし）で読みかけていた本
  localStorage.clear();
  var oldKey = makeBookKey('[テスト作者] 書名のない本.epub', '');
  localStorage.setItem(oldKey, JSON.stringify({spineIdx: 0, ratio: 0, lastOpenedAt: '2026-01-01T00:00:00Z', creator: '', spineCount: 1, __probe: 'old'}));
  localStorage.setItem('epub_last_book', JSON.stringify({title: '[テスト作者] 書名のない本.epub', bookKey: oldKey}));
  var bp = {v: 1, books: {}}; bp.books[oldKey] = {fontSize: 140, t: Date.now()};
  localStorage.setItem('epub_book_prefs', JSON.stringify(bp));
  window.__oldKey = oldKey;
  return openFixture('noopf.epub', '[テスト作者] 書名のない本.epub');
})
.then(function () {
  T('14: OPF に無い書名をファイル名から補う', state.bookTitle === '書名のない本', state.bookTitle);
  T('14: OPF に無い著者をファイル名から補う', state.bookCreator === 'テスト作者', state.bookCreator);
  T('14: キーは補った書名と著者', state.bookKey === makeBookKey('書名のない本', 'テスト作者'), state.bookKey);
  var v = JSON.parse(localStorage.getItem(state.bookKey) || '{}');
  // 位置は 1 画面の章なので開いた直後に実測で書き直される。引き継いだ印として値の中身（__probe）を見る
  T('14: 補う前のキーのしおりを引き継ぐ', v.__probe === 'old', JSON.stringify(v).slice(0, 80));
  T('14: 古いキーは消える', localStorage.getItem(window.__oldKey) === null);
  T('14: epub_last_book も新しいキー', JSON.parse(localStorage.getItem('epub_last_book')).bookKey === state.bookKey);
  T('14: 本ごとの表示設定も引き継ぐ', (_bpGet(state.bookKey) || {}).fontSize === 140 && !_bpGet(window.__oldKey));
  return openFixture('noopf-empty.epub', '[テスト作者] 空の書名.epub');
})
.then(function () {
  T('14: dc:title が空でもファイル名から補う', state.bookTitle === '空の書名' && state.bookCreator === 'テスト作者',
    state.bookTitle + ' / ' + state.bookCreator);
  return openFixture('ae3.epub', '[別の作者] 別の書名.epub');
})
.then(function () {
  T('14: OPF に値があればファイル名は使わない', state.bookTitle === 'テスト青空' && state.bookCreator === '青空作者',
    state.bookTitle + ' / ' + state.bookCreator);
})

// ══ 後片付け ═════════════════════════════════════════════════════
.then(function () {
  closeBook();
  T('本を閉じられる', !state.epub);
  localStorage.clear();
})
.catch(function (e) { T('AozoraEpub3 E2E 例外', false, e && (e.stack || e.message)); });
