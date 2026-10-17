// 上下スワイプでページ送り（design_swipe_paging.md）
//
// 目的: Android アプリ volumetap のドラッグ送り（音量キー → 画面を縦になぞる操作を注入）で
// yomikake を読めるようにする。書字方向によらず「上へ＝次・下へ＝前」。
// 設定は 3 択: 'vertical'（縦書き・FXL のみ／既定）・'all'（横書きも）・'off'。
// 横書きの既定を変えないのは、横書きの上下スワイプには一般に自由スクロールが期待されるため。

// _handleKeys（File System Access のハンドル集合）は yomikake.html にしか無い
var IS_IOS = (typeof _handleKeys === 'undefined');

// ── 設定 ──
T('既定は「縦書き・FXL のみ」', state.swipePaging === 'vertical', state.swipePaging);
T('表示設定の既定値に含まれる（リセット対象）', DISPLAY_DEFAULTS.swipePaging === 'vertical');
var sel = document.getElementById('swipe-paging-select');
T('設定の行がある', !!sel);
var vals = sel ? Array.prototype.map.call(sel.options, function (o) { return o.value; }) : [];
T('選択肢は vertical / all / off', vals.join(',') === 'vertical,all,off', vals.join(','));

['all', 'off', 'vertical'].forEach(function (v) {
  localStorage.setItem('epub_settings', JSON.stringify({ swipePaging: v }));
  state.swipePaging = 'vertical';
  loadSettings();
  T('保存値 ' + v + ' が復元される', state.swipePaging === v, state.swipePaging);
  T('保存値 ' + v + ' でセレクトも同期', sel && sel.value === v, sel && sel.value);
});
localStorage.setItem('epub_settings', JSON.stringify({ swipePaging: 'bogus' }));
state.swipePaging = 'vertical';
loadSettings();
T('壊れた保存値は無視', state.swipePaging === 'vertical', state.swipePaging);

changeSwipePaging('bogus');
T('不正な値には切り替えない', state.swipePaging === 'vertical');
changeSwipePaging('off');
T('切り替えると保存される',
  JSON.parse(localStorage.getItem('epub_settings') || '{}').swipePaging === 'off');
changeSwipePaging('vertical');

// ── 文言 ──
['ja', 'en', 'zh-TW', 'zh-CN'].forEach(function (lg) {
  ['settings.swipePaging', 'swipePaging.vertical', 'swipePaging.all', 'swipePaging.off'].forEach(function (k) {
    T('i18n ' + lg + ' ' + k, !!I18N[lg][k]);
  });
  T('ヘルプに節がある (' + lg + ')', /👆 (上下|Swipe)/.test(I18N[lg]['help.body']));
});

// ── 判定（純関数）──
var vh = 800;
T('上へ大きく＝次', swipeDirection(0, -500, vh) === 1);
T('下へ大きく＝前', swipeDirection(0, 500, vh) === -1);
T('volumetap の送り（高さの 63%）を拾う', swipeDirection(0, -0.63 * vh, vh) === 1);
T('volumetap の戻し（高さの 63%）を拾う', swipeDirection(0, 0.63 * vh, vh) === -1);
T('短い動き（高さの 11%）は拾わない', swipeDirection(0, -0.11 * vh, vh) === 0);
T('低い画面でも 48px 未満は拾わない', swipeDirection(0, -47, 200) === 0);
T('斜めの動きは拾わない', swipeDirection(-400, -500, vh) === 0);
T('縦が横の 1.5 倍以上なら拾う', swipeDirection(-300, -460, vh) === 1);
T('左右スワイプは拾わない', swipeDirection(-500, -10, vh) === 0);

// ── 注入スクリプト ──
['vertical', 'all', 'off'].forEach(function (sp) {
  state.swipePaging = sp;
  ['vertical', 'horizontal', 'publisher'].forEach(function (mode) {
    var src = buildScrollScript('start', mode, 1);
    var tag = sp + '/' + mode + ': ';
    // ⚠ tests/lib/syntax-check.js は iframe へ注入する文字列を見ないので、ここで構文を確かめる
    var ok = true;
    try { new Function(src); } catch (e) { ok = false; }
    T(tag + '構文が妥当', ok);
    if (!IS_IOS) {
      T(tag + '設定値が焼き込まれる', src.indexOf('var SWIPE = ' + JSON.stringify(sp)) >= 0);
      T(tag + 'EPUB_SWIPE を親へ送る', src.indexOf('type:"EPUB_SWIPE"') > 0);
      T(tag + '閾値が親の定数と一致',
        src.indexOf('Math.max(' + SWIPE_MIN_PX + ', window.innerHeight * ' + SWIPE_MIN_RATIO + ')') > 0 &&
        src.indexOf('Math.abs(dx) * ' + SWIPE_AXIS_RATIO + ')') > 0);
      T(tag + '軸の判定を持つ', /function isVertAxis\(\)\{ return (true|false|axis\(\) === "h"); \}/.test(src));
      T(tag + '上下のパンを止める CSS を入れられる', src.indexOf('touch-action:pan-x pinch-zoom') > 0);
      T(tag + '文字選択は除外する', src.indexOf('sel.type === "Range"') > 0);
    } else if (mode === 'horizontal') {
      // iOS の横書きはもとから上下スワイプで送る（transform スクロールで自由スクロールが無い）
      T(tag + '横書きは従来の処理のまま', src.indexOf('swipeV') < 0);
    } else {
      T(tag + '設定値が焼き込まれる', src.indexOf('var SWIPE = ' + JSON.stringify(sp)) >= 0);
      T(tag + '上下の判定を左右より先に見る', /var v = swipeV\(dx, dy\);\s*if\(v\)\{ doScroll\(v\); return; \}/.test(src));
      T(tag + '閾値が親の定数と一致',
        src.indexOf('Math.max(' + SWIPE_MIN_PX + ', window.innerHeight * ' + SWIPE_MIN_RATIO + ')') > 0 &&
        src.indexOf('Math.abs(dx) * ' + SWIPE_AXIS_RATIO + ')') > 0);
    }
  });
});
state.swipePaging = 'vertical';

// ── 親ページ：「引っ張って更新」でページごと読み込み直さない（§4.3）──
T('html の overscroll-behavior-y が none',
  getComputedStyle(document.documentElement).overscrollBehaviorY === 'none');
T('body の overscroll-behavior-y が none',
  getComputedStyle(document.body).overscrollBehaviorY === 'none');

// ── FXL ズーム中：上下スワイプで次／前の領域へ（§4.4・両ファイル）──
// attachFxlPan の pointerup を合成イベントで叩く。描画系はスタブにして、送り先だけを記録する
(function () {
  var cont = document.getElementById('fxl-container');
  if (!cont) { T('#fxl-container がある', false); return; }
  var orig = {
    step: advanceFxlZoomStep, clamp: clampFxlPan, apply: applyFxlZoom,
    pill: updateFxlRegionPillUI, nbtn: updateFxlNextBtnUI,
  };
  var saved = { renderMode: state.renderMode, en: state.fxlZoomEnabled, order: state.fxlRegionOrder,
                z: JSON.stringify(state.fxlZoom) };
  var calls, excessX;
  advanceFxlZoomStep = function (d) { calls.push({ dir: d, mode: state.fxlZoom.mode }); };
  clampFxlPan = function (tx, ty) { return { tx: tx, ty: ty, excessX: excessX, excessY: 0 }; };
  applyFxlZoom = function () {};
  updateFxlRegionPillUI = function () {};
  updateFxlNextBtnUI = function () {};

  function drag(o) {
    calls = []; excessX = o.excessX || 0;
    state.renderMode = 'fxl'; state.fxlZoomEnabled = true;
    state.fxlRegionOrder = o.order || 'story';
    state.swipePaging = o.sp || 'vertical';
    state.fxlZoom.level = 2; state.fxlZoom.tx = 0; state.fxlZoom.ty = 0;
    state.fxlZoom.regionIdx = 0; state.fxlZoom.mode = o.free ? 'free' : 'preset';
    function ev(type, x, y) {
      cont.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true,
        clientX: x, clientY: y, bubbles: true }));
    }
    ev('pointerdown', 200, 500);
    ev('pointermove', 200 + (o.dx || 0) / 2, 500 + (o.dy || 0) / 2);
    ev('pointermove', 200 + (o.dx || 0), 500 + (o.dy || 0));
    ev('pointerup',   200 + (o.dx || 0), 500 + (o.dy || 0));
    return calls;
  }
  function desc(c) { return JSON.stringify(c); }

  var c = drag({ dy: -400 });
  T('ズーム中: 上へ大きくなぞると次の領域へ', c.length === 1 && c[0].dir === 1, desc(c));
  T('ズーム中: 領域表示から送るときは preset に戻してから（次ページへ飛ばない）',
    c.length === 1 && c[0].mode === 'preset', desc(c));
  c = drag({ dy: 400 });
  T('ズーム中: 下へ大きくなぞると前の領域へ', c.length === 1 && c[0].dir === -1, desc(c));
  c = drag({ dy: -30 });
  T('ズーム中: 短い動きはパンのまま', c.length === 0 && state.fxlZoom.mode === 'free', desc(c));
  c = drag({ dx: -400, dy: -20 });
  T('ズーム中: 左右はパンのまま', c.length === 0, desc(c));
  c = drag({ dx: -300, dy: -300 });
  T('ズーム中: 斜めはパンのまま', c.length === 0, desc(c));
  c = drag({ dy: -400, free: true });
  T('ズーム中: 自由移動中からは Next ボタンと同じ扱い', c.length === 1 && c[0].mode === 'free', desc(c));
  c = drag({ dy: -400, sp: 'off' });
  T('ズーム中×しない: パンのまま', c.length === 0, desc(c));
  c = drag({ dy: -400, order: 'vfill' });
  T('ズーム中×横送りモード（縦を捨てる）でも上下スワイプを拾う', c.length === 1 && c[0].dir === 1, desc(c));
  c = drag({ dy: -400, order: 'hfill' });
  T('ズーム中×縦送りモードでも上下スワイプで送る', c.length === 1 && c[0].dir === 1, desc(c));
  c = drag({ dx: -400, dy: -20, excessX: 80 });
  T('ラバーバンドで送ったら指を離しても二重に送らない', c.length === 1, desc(c));

  advanceFxlZoomStep = orig.step; clampFxlPan = orig.clamp; applyFxlZoom = orig.apply;
  updateFxlRegionPillUI = orig.pill; updateFxlNextBtnUI = orig.nbtn;
  state.renderMode = saved.renderMode; state.fxlZoomEnabled = saved.en;
  state.fxlRegionOrder = saved.order; state.fxlZoom = JSON.parse(saved.z);
  state.swipePaging = 'vertical';
})();

// ── ナビボタンの上で始まった上下スワイプ（§4.6・両ファイル）──
// 次へボタン「大」は下 42vh を覆い、volumetap の送り（高さ 80% から）がボタンの上で始まる
(function () {
  var btn = document.getElementById('btn-scroll-fwd');
  if (!btn) { T('#btn-scroll-fwd がある', false); return; }
  if (typeof Touch !== 'function' || typeof TouchEvent !== 'function') {
    T('この環境ではタッチイベントを作れないため省略', true); return;
  }
  var origScroll = scrollPage;
  var saved = { renderMode: state.renderMode, writingMode: state.writingMode };
  var calls;
  scrollPage = function (d) { calls.push(d); };
  function swipe(o) {
    calls = [];
    state.renderMode = o.fxl ? 'fxl' : 'reflow';
    state.writingMode = o.wm || 'vertical';
    state.swipePaging = o.sp || 'vertical';
    var t0 = new Touch({ identifier: 3, target: btn, clientX: 200, clientY: 500 });
    var t1 = new Touch({ identifier: 3, target: btn, clientX: 200 + (o.dx || 0), clientY: 500 + (o.dy || 0) });
    btn.dispatchEvent(new TouchEvent('touchstart', { touches: [t0], targetTouches: [t0], changedTouches: [t0], bubbles: true }));
    btn.dispatchEvent(new TouchEvent('touchend', { touches: [], targetTouches: [], changedTouches: [t1], bubbles: true }));
    return calls.join();
  }
  T('ボタン上: 上へなぞると次へ（FXL・ズーム中も scrollPage が振り分ける）', swipe({ fxl: true, dy: -400 }) === '1');
  T('ボタン上: 下へなぞると前へ', swipe({ fxl: true, dy: 400 }) === '-1');
  T('ボタン上: 縦書きの本文でも送る', swipe({ dy: -400 }) === '1');
  T('ボタン上: 短い動きでは送らない', swipe({ fxl: true, dy: -30 }) === '');
  T('ボタン上: 左右では送らない', swipe({ fxl: true, dx: -400 }) === '');
  T('ボタン上×しない: 送らない', swipe({ fxl: true, dy: -400, sp: 'off' }) === '');
  if (IS_IOS) {
    T('ボタン上×横書き（iOS はもとから上下で送る）', swipe({ wm: 'horizontal', dy: -400 }) === '1');
  } else {
    T('ボタン上×横書き×縦書きのみ: 送らない', swipe({ wm: 'horizontal', dy: -400 }) === '');
    T('ボタン上×横書き×すべて: 送る', swipe({ wm: 'horizontal', dy: -400, sp: 'all' }) === '1');
  }
  swipe({ fxl: true, dy: -400 });
  calls = [];
  btn.click();
  T('スワイプ直後の click は捨てる（二重に送らない）', calls.join() === '', calls.join());
  T('ボタンはブラウザにパンを取らせない', getComputedStyle(btn).touchAction === 'none', getComputedStyle(btn).touchAction);
  scrollPage = origScroll;
  state.renderMode = saved.renderMode; state.writingMode = saved.writingMode;
  state.swipePaging = 'vertical';
})();

// ── 実際に注入して指の動きを流す（yomikake.html のみ）──
// iOS 版は iframe 内で直接 doScroll するので親へのメッセージが無い。そちらは上の文字列検査まで。
function runInFrame(mode, sp, dy) {
  return new Promise(function (resolve) {
    state.swipePaging = sp;
    var src = buildScrollScript('start', mode, 1);
    var fr = document.createElement('iframe');
    fr.style.cssText = 'position:fixed;left:0;top:0;width:400px;height:600px;';
    var got = [];
    function onMsg(e) {
      if (e.source === fr.contentWindow && e.data && e.data.type === 'EPUB_SWIPE') got.push(e.data.direction);
    }
    window.addEventListener('message', onMsg);
    fr.srcdoc = '<!DOCTYPE html><html><head></head><body><p>本文</p><script>' + src + '<\/script></body></html>';
    document.body.appendChild(fr);
    fr.onload = function () {
      // init() は 80ms 後に applyInit と touch-action の注入を行う
      setTimeout(function () {
        var d = fr.contentDocument, w = fr.contentWindow;
        var ta = w.getComputedStyle(d.documentElement).touchAction;
        var t0 = new w.Touch({ identifier: 1, target: d.body, clientX: 200, clientY: 300 });
        var t1 = new w.Touch({ identifier: 1, target: d.body, clientX: 200, clientY: 300 + dy });
        d.dispatchEvent(new w.TouchEvent('touchstart', { touches: [t0], changedTouches: [t0], bubbles: true }));
        d.dispatchEvent(new w.TouchEvent('touchend', { touches: [], changedTouches: [t1], bubbles: true }));
        setTimeout(function () {
          window.removeEventListener('message', onMsg);
          fr.remove();
          resolve({ got: got, touchAction: ta });
        }, 50);
      }, 200);
    };
  });
}

var canTouch = !IS_IOS && typeof Touch === 'function' && typeof TouchEvent === 'function';
if (IS_IOS) {
  T('iOS 版は文字列検査まで（親へのメッセージを使わない）', true);
} else if (!canTouch) {
  T('この環境ではタッチイベントを作れないため挙動検査を省略', true);
} else {
  runInFrame('vertical', 'vertical', -400)
  .then(function (r) {
    T('縦書き×縦書きのみ: 上へなぞると次へ送る', r.got.join() === '1', r.got.join());
    T('縦書き×縦書きのみ: 上下のパンを止める', r.touchAction === 'pan-x pinch-zoom', r.touchAction);
    return runInFrame('vertical', 'vertical', 400);
  })
  .then(function (r) {
    T('縦書き: 下へなぞると前へ戻す', r.got.join() === '-1', r.got.join());
    return runInFrame('vertical', 'vertical', -30);
  })
  .then(function (r) {
    T('縦書き: 短い動きでは送らない', r.got.length === 0, r.got.join());
    return runInFrame('horizontal', 'vertical', -400);
  })
  .then(function (r) {
    T('横書き×縦書きのみ: 送らない（自由スクロールのまま）', r.got.length === 0, r.got.join());
    T('横書き×縦書きのみ: パンを止めない', r.touchAction === 'auto', r.touchAction);
    return runInFrame('horizontal', 'all', -400);
  })
  .then(function (r) {
    T('横書き×すべて: 上へなぞると次へ送る', r.got.join() === '1', r.got.join());
    T('横書き×すべて: 上下のパンを止める（二重に動かさない）', r.touchAction === 'pan-x pinch-zoom', r.touchAction);
    return runInFrame('vertical', 'off', -400);
  })
  .then(function (r) {
    T('縦書き×しない: 送らない', r.got.length === 0, r.got.join());
    T('縦書き×しない: パンを止めない', r.touchAction === 'auto', r.touchAction);
    state.swipePaging = 'vertical';
    localStorage.clear();
  })
  .catch(function (e) { T('例外', false, e && (e.stack || e.message)); });
}
