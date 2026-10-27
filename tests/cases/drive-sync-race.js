// Drive 同期の競合（design_drive_sync_race.md）
// 端末 A を開いた直後の自動保存が起動時の取り込みと競合し、別の端末 B で進めた位置を
// A の古い位置で上書きしていた（実機で発生）。Drive をモックして順序と中身を見る。
localStorage.clear();
var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
function openFixture(name) {
  return fetch('tests/.fixtures/' + name)
    .then(function (r) { return r.blob(); })
    .then(function (b) { return loadEpub(new File([b], name, { type: 'application/epub+zip' })); });
}
(async function () {
  setLang('ja');
  var _origFetch = window.fetch, _origGoogle = window.google;
  window.google = { accounts: { oauth2: { initTokenClient: function (c) {
    return { requestAccessToken: function () { setTimeout(function () { c.callback({ access_token: 'tok', expires_in: 3600 }); }, 20); } };
  } } } };
  // メモリ上の Drive（応答に 40ms の遅れ）
  var drive = null, log = [];
  var lat = function (v) { return new Promise(function (r) { setTimeout(function () { r(v); }, 40); }); };
  window.fetch = function (url, opt) {
    url = String(url); var m = (opt && opt.method) || 'GET';
    if (url.indexOf('tests/.fixtures/') >= 0) return _origFetch.apply(this, arguments);
    if (url.indexOf('/about') >= 0) return lat(new Response('{"user":{"emailAddress":"a@b"}}'));
    if (url.indexOf('alt=media') >= 0) { log.push('GET'); return lat(new Response(JSON.stringify(drive))); }
    if (m === 'PATCH') { log.push('PATCH'); drive = JSON.parse(opt.body); return lat(new Response('{}')); }
    if (url.indexOf('/drive/v3/files') >= 0) return lat(new Response('{"files":[{"id":"abcdefghij0123"}]}'));
    return Promise.reject(new Error('unexpected fetch ' + url));
  };
  function reset(bm) {
    drive = { version: 1, bookmarks: bm }; log = [];
    _drivePulled = false; _lastAutoSaveAt = 0; _autoSaveDirty = false; state.driveFileId = null;
  }
  state.driveAutoSave = true;

  // ══ 1. 起動直後: 取り込みと自動保存が同時に走っても B の位置を消さない ══
  var KEY = 'epub_pos_本__作者';
  var b = {}; b[KEY] = { spineIdx: 8, ratio: 0.5, spineCount: 20, lastOpenedAt: '2026-10-27T01:00:00Z', creator: '作者' };
  reset(b);
  localStorage.setItem(KEY, JSON.stringify({ spineIdx: 2, ratio: 0.1, spineCount: 20, lastOpenedAt: new Date().toISOString(), creator: '作者' }));
  driveSyncPull({ force: true });
  await wait(30);
  scheduleAutoSave();       // 本を開いた savePos が呼ぶのと同じ（起動直後は待ち時間 0）
  await wait(1200);
  T('取り込む前に送らない（最初は GET）', log[0] === 'GET', log.join('→'));
  T('Drive の B の位置が残る', drive.bookmarks[KEY].spineIdx === 8, drive.bookmarks[KEY].spineIdx);
  T('端末側も B の位置', JSON.parse(localStorage.getItem(KEY)).spineIdx === 8);
  T('取り込み済みの印が立つ', _drivePulled === true);

  // 取り込み済みなら送るだけ（毎回 GET しない）
  log = []; _autoSaveDirty = true;
  await driveUploadCore('tok');
  T('取り込み済みなら GET しない', log.join() === 'PATCH', log.join());

  // タブ復帰で取り込み直しの印を下ろす
  _lastSyncPullAt = Date.now();   // 復帰時の取り込みはスロットリングで見送られる想定
  document.dispatchEvent(new Event('visibilitychange'));
  if (!document.hidden) T('タブ復帰で「取り込み直し」に戻る', _drivePulled === false);
  log = [];
  await driveUploadCore('tok');
  T('復帰後の最初の送信は先に取り込む', log.join() === 'GET,PATCH', log.join());

  // ══ 2. 開いたまま触れていない本 → B の位置へ移り、タップで戻れる ══
  localStorage.clear();
  await openFixture('reflow.epub');
  await wait(600);
  var bk = state.bookKey, n = state.spine.length;
  T('本が開けた（第 1 章）', !!state.epub && state.currentSpineIdx === 0);
  T('開いた位置を覚える', _openPos && _openPos.idx === 0 && !_navSinceOpen);
  var bm = {}; bm[bk] = { spineIdx: 2, ratio: 0.3, spineCount: n, lastOpenedAt: '2026-10-27T01:00:00Z', creator: 'テスト作者' };
  reset(bm);
  await driveSyncPull({ force: true });
  await wait(600);
  var toast = document.getElementById('toast');
  T('触れていなければ B の位置へ移る', state.currentSpineIdx === 2, state.currentSpineIdx);
  T('移ったことを知らせる（タップで戻る）', toast.classList.contains('show') && toast.textContent.indexOf('移動しました') >= 0, toast.textContent);
  toast.click();
  await wait(600);
  T('タップで元の位置へ戻る', state.currentSpineIdx === 0);
  T('戻したら以後は黙って移らない', _navSinceOpen === true);

  // ══ 3. 読み進めていたら移らず、提案だけ ══
  reset(bm);
  await driveSyncPull({ force: true });
  await wait(300);
  T('触れていたら移らない', state.currentSpineIdx === 0);
  T('「タップで移動」を出す', toast.textContent.indexOf('タップで移動') >= 0, toast.textContent);

  // ══ 4. 同じ位置なら空振りの移動をしない（EPUB_POS が届く前でも） ══
  await wait(800);   // 前の描画の EPUB_POS が出切ってから「届く前」の状態を作る
  _navSinceOpen = false; _posSeenSinceOpen = false; _openPos = { idx: 0, ratio: 0.4 };
  var same = {}; same[bk] = { spineIdx: 0, ratio: 0.4, spineCount: n, lastOpenedAt: '2026-10-27T01:00:00Z', creator: 'テスト作者' };
  localStorage.setItem(bk, JSON.stringify(same[bk]));
  reset(same); toast.classList.remove('show');
  await driveSyncPull({ force: true });
  await wait(300);
  T('同じ位置なら移らない・知らせない', state.currentSpineIdx === 0 && !toast.classList.contains('show'),
    state.currentSpineIdx + ' / ' + toast.className + ' / ' + toast.textContent + ' / ' + _intraChapterRatio + ' ' + _posSeenSinceOpen);

  // ══ 5. 取り込めないまま本を閉じても、古い位置で上書きしない（iOS の Safari タブ） ══
  reset(bm);
  _autoSaveBusy = false;
  closeBook();               // savePos(古い位置) → driveSaveNow
  await wait(1200);
  T('閉じるときの保存も先に取り込む', log[0] === 'GET', log.join('→'));
  T('閉じても Drive の B の位置が残る', drive.bookmarks[bk].spineIdx === 2, drive.bookmarks[bk].spineIdx);
  T('端末側も B の位置', JSON.parse(localStorage.getItem(bk)).spineIdx === 2);
  T('閉じたら開いた位置を忘れる', _openPos === null);

  // i18n
  ['ja', 'en', 'zh-TW', 'zh-CN'].forEach(function (lg) {
    setLang(lg);
    T('toast.driveSyncJumped の {n} (' + lg + ')', t('toast.driveSyncJumped', { n: 7 }).indexOf('7') >= 0);
  });
  setLang('ja');

  state.driveAutoSave = false; _autoSaveDirty = false; clearTimeout(_autoSaveTimer);
  window.fetch = _origFetch; window.google = _origGoogle;
  localStorage.clear();
})();
