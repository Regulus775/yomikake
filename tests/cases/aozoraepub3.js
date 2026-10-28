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

// ══ 後片付け ═════════════════════════════════════════════════════
.then(function () {
  closeBook();
  T('本を閉じられる', !state.epub);
  localStorage.clear();
})
.catch(function (e) { T('AozoraEpub3 E2E 例外', false, e && (e.stack || e.message)); });
