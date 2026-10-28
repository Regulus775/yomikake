// 連載の続き（design_update_check.md）
// §4-3 読了パネルの「novel_downloader で更新を確認」（Android の共有シートへ底本 URL）
// §4-4 続きを追記した本を開き直すと、増えた最初の話の先頭から開く（以前は 1 話飛ばしていた）
localStorage.clear();

function openFixture(name) {
  if (state.epub) closeBook();
  return fetch('tests/.fixtures/' + name)
    .then(function (r) { return r.blob(); })
    .then(function (b) { return loadEpub(new File([b], name, { type: 'application/epub+zip' })); });
}
function hrefAt(i) { return (state.spine[i] || {}).href || ''; }
function shareBtn() { return document.querySelector('#finished-body [onclick="finishedShareUrl()"]'); }
// 末尾で次へを押したのと同じ状態（呼び出し元は savePos(1.0) → showFinishedBanner）
function finishBook() {
  state.currentSpineIdx = state.spine.length - 1;
  savePos(1.0);
  showFinishedBanner();
}

// ══ 純粋関数・i18n ══
['ja', 'en', 'zh-TW', 'zh-CN'].forEach(function (lg) {
  setLang(lg);
  T('i18n finished.shareToNd (' + lg + ')', t('finished.shareToNd') !== 'finished.shareToNd');
  T('i18n readingList.shareToNd (' + lg + ')', t('readingList.shareToNd') !== 'readingList.shareToNd');
  T('i18n finished.partialStart の {n} (' + lg + ')', t('finished.partialStart', { n: 'N7' }).indexOf('N7') >= 0);
  T('i18n toast.resumeNew の {n} (' + lg + ')', t('toast.resumeNew', { n: 'N7' }).indexOf('N7') >= 0);
});
setLang('ja');
T('ソリスピアを配信元として名指しできる', siteNameFromUrl('https://solispia.com/title/123') === 'ソリスピア');
T('_grownStartIdx: しおりが無ければ null', _grownStartIdx(null, 5) === null);

// 共有シートの代役（headless の Chrome には navigator.share が無い・UA も Android ではない）
var shared = null, uaAndroid = true;
Object.defineProperty(navigator, 'userAgent', { configurable: true,
  get: function () { return uaAndroid ? 'Mozilla/5.0 (Linux; Android 16) Chrome/141 Mobile' : 'Mozilla/5.0 (Windows NT 10.0)'; } });
Object.defineProperty(navigator, 'share', { configurable: true, writable: true,
  value: function (d) { shared = d; return Promise.resolve(); } });

openFixture('grow3.epub')
.then(function () {
  // ══ §4-4 続きを追記した本の開き位置 ══
  T('3 話版が開けた', state.bookTitle === 'テスト用連載' && state.spine.length === 6, state.spine.length);
  state.currentSpineIdx = state.spine.length - 1; savePos(1.0);     // 奥付で読み終えた
  return openFixture('grow5.epub');
})
.then(function () {
  T('5 話版は同じ本（しおりのキーが同じ）', state.spine.length === 8);
  T('増えた最初の話（第4話）の先頭から開く', /ep0004\.xhtml$/.test(hrefAt(state.currentSpineIdx)),
    state.currentSpineIdx + ' ' + hrefAt(state.currentSpineIdx));
  T('開き位置は保存し直されている（もう一度開いても第4話）',
    (loadSavedPos() || {}).spineIdx === state.currentSpineIdx);
  return openFixture('grow5.epub');
})
.then(function () {
  T('増えていない本は保存位置のまま', /ep0004\.xhtml$/.test(hrefAt(state.currentSpineIdx)), hrefAt(state.currentSpineIdx));
  // 読みかけ（前の版の本文の中）に続きが足されたら、今の位置から読み進めればよい
  localStorage.clear();
  return openFixture('grow3.epub');
})
.then(function () {
  state.currentSpineIdx = 3; savePos(0.5);                         // 第2話の途中
  return openFixture('grow5.epub');
})
.then(function () {
  T('読みかけの位置は動かさない', /ep0002\.xhtml$/.test(hrefAt(state.currentSpineIdx)), hrefAt(state.currentSpineIdx));
  return openFixture('growtoc3.epub');
})
.then(function () {
  T('末尾目次の 3 話版（目次が奥付の後ろ）', /toc\.xhtml$/.test(hrefAt(state.spine.length - 1)));
  state.currentSpineIdx = state.spine.length - 1; savePos(1.0);     // 末尾の目次まで進んで読み終えた
  return openFixture('growtoc5.epub');
})
.then(function () {
  T('末尾目次でも第4話の先頭から', /ep0004\.xhtml$/.test(hrefAt(state.currentSpineIdx)), hrefAt(state.currentSpineIdx));
  // 途中から取った版の印（start）は、同じ本を全話の版で開き直したら消える（...existing から残さない）
  var m = loadSavedPos(); m.start = 12; localStorage.setItem(state.bookKey, JSON.stringify(m));
  return openFixture('growtoc5.epub');
})
.then(function () {
  T('全話の版を開き直すと start は消える', !('start' in (loadSavedPos() || {})), JSON.stringify(loadSavedPos()));
  // 同期: 受け取ったしおりに start が無くても手元の start は残す（genre / serial と同じ）
  var key = state.bookKey, m = loadSavedPos();
  localStorage.setItem(key, JSON.stringify(Object.assign({}, m, { start: 7 })));
  _rdMergePos(key, JSON.stringify(m));
  T('同期で手元の start を消さない', (JSON.parse(localStorage.getItem(key)) || {}).start === 7);
  // ══ §4-3 読了パネルの共有ボタン ══
  return openFixture('webnovel.epub');
})
.then(function () {
  finishBook();
  var b = shareBtn();
  T('連載中・Android なら「小説ダウンローダーで更新を確認」', !!b && b.textContent.indexOf('小説ダウンローダーで更新を確認') >= 0);
  var links = document.querySelector('#finished-body .fp-links').children;   // 「この作品」節（最初の節）
  T('サイトのリンクが先・共有・コピーの順', links.length === 3 && links[0].tagName === 'A'
    && links[1] === b && links[2].getAttribute('onclick') === 'finishedCopyUrl()');
  b.click();
  T('底本 URL だけを共有する', shared && shared.url === 'https://kakuyomu.jp/works/1234567890'
    && Object.keys(shared).length === 1, JSON.stringify(shared));
  T('Drive の取り直しの対象から外す（ユーザー操作の権利を共有に残す）', b.matches(DRIVE_RETRY_SKIP_SEL));

  uaAndroid = false; _finishedRender();
  T('Android 以外では出さない', !shareBtn());
  uaAndroid = true;
  var savedShare = navigator.share; navigator.share = undefined; _finishedRender();
  T('navigator.share が無ければ出さない', !shareBtn());
  navigator.share = savedShare;

  var serial = state.bookSerial; state.bookSerial = '完結'; _finishedRender();
  T('完結済みには出さない', !shareBtn());
  state.bookSerial = ''; _finishedRender();
  T('連載状態が不明でも出す', !!shareBtn());
  state.bookSerial = serial;

  state.bookStartOffset = 3; _finishedRender();
  T('途中から取得した本には出さない', !shareBtn());
  T('途中から取得した旨を出す', document.getElementById('finished-body').textContent.indexOf('第 3 話から取得') >= 0);
  state.bookStartOffset = 0; _finishedRender();

  // 失敗はコピーへ。閉じた（AbortError）だけは何もしない
  var copied = 0, savedCopy = window.finishedCopyUrl;
  window.finishedCopyUrl = function () { copied++; };
  navigator.share = function () { var e = new Error('x'); e.name = 'AbortError'; return Promise.reject(e); };
  finishedShareUrl();
  return new Promise(function (r) { setTimeout(r, 50); }).then(function () {
    T('共有シートを閉じただけならコピーしない', copied === 0);
    navigator.share = function () { return Promise.reject(new Error('NotAllowedError')); };
    finishedShareUrl();
    return new Promise(function (r) { setTimeout(r, 50); });
  }).then(function () {
    T('共有に失敗したら URL コピーに落とす', copied === 1);
    window.finishedCopyUrl = savedCopy;
    navigator.share = savedShare;
  });
})
.then(function () {
  closeBook();
  T('本を閉じると開始話は消える', state.bookStartOffset === 0);

  // ══ §4-5 読みかけリストのカード（読了済みの連載中 Web 小説）══
  localStorage.clear();
  var K = 'https://kakuyomu.jp/works/';
  function put(title, v) {
    localStorage.setItem('epub_pos_' + title + '__作者', JSON.stringify(Object.assign({
      spineIdx: 9, ratio: 1, spineCount: 10, creator: '作者', lastOpenedAt: '2026-10-01T00:00:00Z',
      finishedAt: '2026-10-01T00:00:00Z', finishedCount: 10, site: 'カクヨム', serial: '連載中' }, v)));
  }
  put('読了連載', { source: K + '1' });
  put('読了完結', { source: K + '2', serial: '完結済み' });
  put('読了状態不明', { source: K + '3', serial: '' });
  put('続きあり', { source: K + '4', spineIdx: 9, spineCount: 15 });          // 手元に続きがある
  put('途中から', { source: K + '5', start: 12 });
  put('青空', { source: 'https://www.aozora.gr.jp/cards/000119/card624.html', site: '青空文庫', serial: '' });
  put('読みかけ', { source: K + '7', spineIdx: 3, ratio: 0.5, finishedAt: null, finishedCount: 0 });
  put('底本なし', { source: '' });
  put('危ないURL', { source: 'javascript:alert(1)' });
  _rlPrefs.showFinished = true; _rlPrefs.view = 'list'; _rlPrefs.filterHasMore = false; _rlPrefs.filterReady = false;
  setRlAuthor('');
  buildReadingList();
  function cardBtn(title) {
    var c = document.querySelector('#reading-list-items .rl-card[data-key="epub_pos_' + title + '__作者"]');
    return c ? c.querySelector('.rl-nd-btn') : 'nocard';
  }
  T('読了・連載中のカードに「🔄 更新を確認」', !!cardBtn('読了連載') && cardBtn('読了連載') !== 'nocard'
    && cardBtn('読了連載').textContent.indexOf('更新を確認') >= 0);
  T('ボタンの title は正式名（小説ダウンローダーで更新を確認）',
    cardBtn('読了連載').title === '小説ダウンローダーで更新を確認');
  T('連載状態が不明でも出す', !!cardBtn('読了状態不明') && cardBtn('読了状態不明') !== 'nocard');
  ['読了完結', '続きあり', '途中から', '青空', '読みかけ', '底本なし', '危ないURL'].forEach(function (k) {
    T('出さない: ' + k, cardBtn(k) === null, String(cardBtn(k)));
  });
  shared = null;
  var cardsBefore = !!state.epub;
  cardBtn('読了連載').click();
  T('カードのボタンは作品 URL だけを共有する', shared && shared.url === K + '1' && Object.keys(shared).length === 1,
    JSON.stringify(shared));
  var dc = document.querySelector('#reading-list-items .rl-card[data-key="epub_pos_危ないURL__作者"]');
  T('javascript: の底本は配信元リンクにしない（読み込んだしおり由来）', !!dc && !dc.querySelector('a.rl-source'));
  T('カードのボタンは本を開かない（stopPropagation）', !state.epub && !cardsBefore);
  uaAndroid = false; buildReadingList();
  T('Android 以外ではカードにも出さない', cardBtn('読了連載') === null);
  uaAndroid = true;
  _rlPrefs.view = 'grid'; buildReadingList();
  var g = cardBtn('読了連載');
  T('グリッドでは隠す（配信元リンクと同じ）', !g || g === 'nocard' || getComputedStyle(g).display === 'none');
  _rlPrefs.view = 'list'; _rlPrefs.showFinished = false;
  ['en', 'zh-TW', 'zh-CN'].forEach(function (lg) {
    setLang(lg); T('i18n readingList.shareToNd (' + lg + ')', t('readingList.shareToNd') !== 'readingList.shareToNd');
  });
  setLang('ja');
  localStorage.clear();
})
.catch(function (e) { T('連載の続き E2E 例外', false, e && (e.stack || e.message)); });
