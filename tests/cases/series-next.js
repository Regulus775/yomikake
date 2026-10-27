// 次の巻を選ぶ（design_series_next.md）
// 書名からシリーズ名と巻数を割り出す規則・蔵書の次の巻・「次の巻を選ぶ」の呼び出し順を見る。
// ファイル選択が実際に同じフォルダで開くか・検索で絞り込めるかは実機でしか確かめられない
// （tests/probe/next-volume-picker.html で実測済み）。
localStorage.clear();
setLang('ja');
var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
function openFixture(name) {
  return fetch('tests/.fixtures/' + name)
    .then(function (r) { return r.blob(); })
    .then(function (b) { return loadEpub(new File([b], name, { type: 'application/epub+zip' })); });
}
function sec() { return document.getElementById('finished-body').textContent; }

// ══ 書名からシリーズ名と巻数 ══
function S(title) { var r = _seriesOf(title); return r ? r.name + '|' + r.vol + (r.ud ? '|ud' : '') : 'null'; }
[
  ['RAIL＿WARS！2', 'RAIL_WARS!|2'],
  ['ふたつのスピカ　8', 'ふたつのスピカ|8'],
  ['寄生獣１０', '寄生獣|10'],
  ['綿の国星(1)', '綿の国星|1'],
  ['そんな奴ァいねえ！！　（１）', 'そんな奴ァいねえ!!|1'],
  ['三重のあまいもん第2集', '三重のあまいもん|2'],
  ['風の万里黎明の空上', '風の万里黎明の空|1|ud'],
  ['ホークミストレス下', 'ホークミストレス|3|ud'],
  ['Foo Bar Vol.3', 'Foo Bar|3'],
  ['AKIRA 4', 'AKIRA|4'],
  ['越前の禅文化20241120', 'null'],          // 日付を巻数にしない
  ['RAIL＿WARS！', 'null'],                  // 番号なしの 1 巻目は単発の本と見分けられない
  ['Pythonチュートリアル 第3版', 'null'],
  ['ふたりの距離の概算', 'null'],
  ['上', 'null'],
  ['坂の上', 'null'],                         // 直前がひらがなの上中下は普通の語
  ['東京の空の下', 'null'],
  ['風の海迷宮の岸 下', '風の海迷宮の岸|3|ud'],
  ['風の海迷宮の岸上巻', '風の海迷宮の岸|1|ud'],
  ['入門書 2.5', 'null'],                     // 小数は巻数にしない
].forEach(function (c) { T('_seriesOf: ' + c[0], S(c[0]) === c[1], S(c[0])); });
T('_seriesOf: belongs-to-collection が最優先', JSON.stringify(_seriesOf('なんでも 9', '本当のシリーズ', '２')) === '{"name":"本当のシリーズ","vol":2}');
T('_seriesOf: collection で巻数なし → vol 0', _seriesOf('x', '本当のシリーズ', '').vol === 0);
T('_seriesOf: collection に巻数が無ければ書名の巻数を借りる', JSON.stringify(_seriesOf('薬屋 2', '薬屋のひとりごと', '')) === '{"name":"薬屋のひとりごと","vol":2}');
T('_seriesKey: 全角半角・記号の差を吸収', _seriesKey('RAIL_WARS!') === _seriesKey('ＲＡＩＬ＿ＷＡＲＳ！'.normalize('NFKC')) && _seriesKey('RAIL WARS') === _seriesKey('RAIL_WARS!'));

// ══ dcndl:seriesTitle（叢書名）は次の巻に使わない ══
var opf = new DOMParser().parseFromString(
  '<package xmlns="http://www.idpf.org/2007/opf"><metadata><meta property="dcndl:seriesTitle">角川文庫 ; よ23-5</meta></metadata></package>', 'application/xml');
T('dcndl:seriesTitle は src=dcndl', _seriesInfoFromOpf(opf).src === 'dcndl');
var opf2 = new DOMParser().parseFromString(
  '<package xmlns="http://www.idpf.org/2007/opf"><metadata><meta property="belongs-to-collection" id="c">古典部</meta><meta refines="#c" property="group-position">5</meta></metadata></package>', 'application/xml');
T('belongs-to-collection は src=collection', _seriesInfoFromOpf(opf2).src === 'collection' && _seriesInfoFromOpf(opf2).vol === '5');

(async function () {
  // ══ 読了パネル ══
  // fixture webnovel.epub は belongs-to-collection「テストシリーズ」2 巻・著者「ウェブ作者」
  localStorage.setItem('epub_pos_テストシリーズ 3__ウェブ作者', JSON.stringify({ spineIdx: 0, ratio: 0, spineCount: 5, creator: 'ウェブ作者', lastOpenedAt: '2026-01-01T00:00:00Z' }));
  localStorage.setItem('epub_pos_テストシリーズ 3__べつの人', JSON.stringify({ spineIdx: 0, ratio: 0, spineCount: 5, creator: 'べつの人', lastOpenedAt: '2026-01-02T00:00:00Z' }));
  await openFixture('webnovel.epub');
  await wait(500);
  T('collection のシリーズ名と巻数を読む', state.bookSeriesName === 'テストシリーズ' && state.bookSeriesVol === '2', state.bookSeriesName + '/' + state.bookSeriesVol);
  state.currentSpineIdx = state.spine.length - 1; savePos(1.0); showFinishedBanner();
  T('次の巻の節（シリーズ名と巻数）', sec().indexOf('テストシリーズ（2）') >= 0, sec());
  T('蔵書の次の巻の書名を出す（同じ著者）', sec().indexOf('次の巻は『テストシリーズ 3』です') >= 0);
  T('キャッシュが無ければ「開く」ボタンは出ない', !document.querySelector('#finished-body [onclick*="finishedOpenNext"]'));
  T('「次の巻を選ぶ」ボタン', !!document.querySelector('#finished-body [onclick*="finishedPickNext"]'));
  T('国会図書館サーチは残る', sec().indexOf('国立国会図書館サーチ') >= 0);
  T('コピーの説明', sec().indexOf('シリーズ名「テストシリーズ」をコピー') >= 0);
  T('「次の巻を選ぶ」は Drive の取り直し対象から外す', !!document.querySelector('#finished-body [onclick*="finishedPickNext"]').closest(DRIVE_RETRY_SKIP_SEL));

  // キャッシュがあれば直接開くボタン
  _cachedKeys.add('epub_pos_テストシリーズ 3__ウェブ作者');
  _finishedRender();
  var openBtn = document.querySelector('#finished-body [onclick*="finishedOpenNext"]');
  T('キャッシュがあれば「次の巻を開く」', !!openBtn && openBtn.textContent.indexOf('テストシリーズ 3') >= 0);
  T('開く本のキーは data-key で渡す（別の著者の本ではない）', openBtn && openBtn.dataset.key === 'epub_pos_テストシリーズ 3__ウェブ作者');
  _cachedKeys.delete('epub_pos_テストシリーズ 3__ウェブ作者');

  // ── 「次の巻を選ぶ」: クリップボード → ファイル選択の順、startIn に今の本のハンドル ──
  var calls = [];
  var origClipDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: function (s) { calls.push('clip:' + s); return Promise.resolve(); } } });
  // iOS 版の openFilePicker は常に <input type=file>（headless Chrome には showOpenFilePicker があっても）
  var hadFSA = typeof window.showOpenFilePicker === 'function' && typeof _handleKeys !== 'undefined';
  var origSOFP = window.showOpenFilePicker, origInputClick = null, inp = document.getElementById('file-input');
  var fakeHandle = { kind: 'file', name: 'テストシリーズ 2.epub' };
  if (hadFSA) {
    window.showOpenFilePicker = function (o) { calls.push('picker:' + (o && o.startIn === fakeHandle ? 'startIn' : 'none')); return Promise.reject(new DOMException('x', 'AbortError')); };
    _fpStartIn = fakeHandle;
  } else {
    origInputClick = inp.click; inp.click = function () { calls.push('input'); };
  }
  finishedPickNext();
  await wait(50);
  T('クリップボードが先・シリーズ名', calls[0] === 'clip:テストシリーズ', calls.join(','));
  if (hadFSA) T('今の本と同じフォルダから開く（startIn）', calls[1] === 'picker:startIn', calls.join(','));
  else T('ファイル選択（input）を開く', calls[1] === 'input', calls.join(','));
  T('コピーしたことをトーストで知らせる', document.getElementById('toast').textContent.indexOf('「テストシリーズ」をコピーしました') >= 0);
  // ハンドルが無ければ startIn を渡さない
  if (hadFSA) { calls = []; _fpStartIn = null; finishedPickNext(); await wait(50); T('ハンドルが無ければ前回の場所', calls[1] === 'picker:none', calls.join(',')); }
  if (hadFSA) window.showOpenFilePicker = origSOFP; else inp.click = origInputClick;
  delete navigator.clipboard;
  if (origClipDesc) Object.defineProperty(Navigator.prototype, 'clipboard', origClipDesc);
  hideLoading();
  dismissFinishedBanner();

  // ══ 「次の巻を開く」でキャッシュが読めなければファイル選択へ落ちる（本を開いたまま呼ぶ経路）══
  var picks = 0, origIdbGet = _idbGet, origSOFP2 = window.showOpenFilePicker, inp2 = document.getElementById('file-input'), origClick2 = inp2.click;
  var isMain = typeof _handleKeys !== 'undefined';
  if (isMain) window.showOpenFilePicker = function () { picks++; return Promise.reject(new DOMException('x', 'AbortError')); };
  else inp2.click = function () { picks++; };
  _idbGet = function () { return Promise.reject(new Error('dead blob')); };
  _cachedKeys.add('epub_pos_テストシリーズ 3__ウェブ作者');
  var bookBefore = state.epub;
  await finishedOpenNext('epub_pos_テストシリーズ 3__ウェブ作者');
  await wait(100);
  T('キャッシュが読めなければファイル選択を開く', picks === 1, picks);
  T('前の本は開いたまま', state.epub === bookBefore);
  _idbGet = origIdbGet;
  if (isMain) window.showOpenFilePicker = origSOFP2; else inp2.click = origClick2;
  _cachedKeys.delete('epub_pos_テストシリーズ 3__ウェブ作者');
  hideLoading();
  if (isMain) {
    // startIn のハンドルが古くて開けなければ、前回の場所で開き直す
    var tries = [];
    window.showOpenFilePicker = function (o) { tries.push(o && o.startIn ? 's' : 'n'); return tries.length === 1 ? Promise.reject(new DOMException('gone', 'NotFoundError')) : Promise.reject(new DOMException('x', 'AbortError')); };
    await openFilePicker({ startIn: { kind: 'file' } });
    await wait(50);
    T('startIn が駄目なら指定なしで開き直す', tries.join('') === 'sn', tries.join(''));
    window.showOpenFilePicker = origSOFP2;
    hideLoading();
  }

  // ══ 上・下の 2 巻本: 上の次は下 ══
  state.bookTitle = '風の海迷宮の岸上'; state.bookSeriesName = ''; state.bookSeriesVol = '';
  localStorage.setItem('epub_pos_風の海迷宮の岸下__ウェブ作者', JSON.stringify({ spineIdx: 0, ratio: 0, spineCount: 5, creator: 'ウェブ作者' }));
  var nx = _fpNextInLibrary(_seriesOf(state.bookTitle), ['ウェブ作者']);
  T('上の次は下（中が無い 2 巻本）', nx && nx.key === 'epub_pos_風の海迷宮の岸下__ウェブ作者', nx && nx.key);
  T('番号の巻は飛ばさない（2 の次に 4 は出さない）', (function () {
    localStorage.setItem('epub_pos_飛び巻 4__ウェブ作者', JSON.stringify({ spineIdx: 0, ratio: 0, spineCount: 5, creator: 'ウェブ作者' }));
    return _fpNextInLibrary({ name: '飛び巻', vol: 2 }, ['ウェブ作者']) === null; })());

  // ══ 巻数の分からない本では節を出さない ══
  await openFixture('reflow.epub');
  await wait(500);
  state.currentSpineIdx = state.spine.length - 1; savePos(1.0); showFinishedBanner();
  T('シリーズの分からない本では「次の巻」節を出さない', sec().indexOf('次の巻') < 0);
  dismissFinishedBanner();
  closeBook();
  ['ja', 'en', 'zh-TW', 'zh-CN'].forEach(function (lg) {
    setLang(lg);
    T('i18n finished.openNext {title} (' + lg + ')', t('finished.openNext', { title: 'QQ' }).indexOf('QQ') >= 0);
    T('i18n finished.pickNextNote {name} (' + lg + ')', t('finished.pickNextNote', { name: 'QQ' }).indexOf('QQ') >= 0);
    T('i18n toast.seriesCopied {name} (' + lg + ')', t('toast.seriesCopied', { name: 'QQ' }).indexOf('QQ') >= 0);
    T('i18n finished.pickNextTitle (' + lg + ')', t('finished.pickNextTitle', { title: 'QQ' }).indexOf('QQ') >= 0);
  });
  setLang('ja');
  localStorage.clear();
})();
