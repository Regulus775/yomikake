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

// ══ 後片付け ═════════════════════════════════════════════════════
.then(function () {
  closeBook();
  T('本を閉じられる', !state.epub);
  localStorage.clear();
})
.catch(function (e) { T('AozoraEpub3 E2E 例外', false, e && (e.stack || e.message)); });
