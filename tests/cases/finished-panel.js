// 読了パネル（design_finished_next.md）
// 最終ページから先へ進んだときに出るパネルの中身・キー操作・閉じ方と、
// 読み終えた本をそのセッションの間リストに残すこと（B）を、fixture の実本で見る。
localStorage.clear();

function ov() { return document.getElementById('finished-overlay'); }
function bodyText() { return document.getElementById('finished-body').textContent; }
function key(k, extra) {
  var ev = { key: k, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, repeat: false,
             prevented: false, preventDefault: function () { this.prevented = true; } };
  for (var x in (extra || {})) ev[x] = extra[x];
  handleKey(ev);
  return ev;
}
function openFixture(name) {
  return fetch('tests/.fixtures/' + name)
    .then(function (r) { return r.blob(); })
    .then(function (b) { return loadEpub(new File([b], name, { type: 'application/epub+zip' })); });
}
// 末尾で次へを押したのと同じ状態を作る（呼び出し元は savePos(1.0) → showFinishedBanner）
function finishBook() {
  state.currentSpineIdx = state.spine.length - 1;
  savePos(1.0);
  showFinishedBanner();
}

// ══ 純粋関数・i18n ══
T('showFinishedBanner が定義', typeof showFinishedBanner === 'function');
T('_authorsOf: creators を優先', JSON.stringify(_authorsOf({ creators: ['甲', '乙'], creator: '甲・乙' })) === '["甲","乙"]');
T('_authorsOf: 「・」で割らない（外国人名）',
  JSON.stringify(_authorsOf({ creator: 'ジョン・スミス' })) === '["ジョン・スミス"]');
T('_authorsOf: 著者なし', _authorsOf({ creator: '' }).length === 0);
T('旧バナーの DOM は無い', !document.getElementById('finished-banner'));
T('パネルは最初は閉じている', !ov().classList.contains('show'));

['ja', 'en', 'zh-TW', 'zh-CN'].forEach(function (lg) {
  setLang(lg);
  ['finished.dismiss', 'finished.secWork', 'finished.checkOnSite', 'finished.copyUrl',
   'finished.secNext', 'finished.findNext', 'finished.secAuthor', 'finished.showInList',
   'finished.searchWeb', 'toast.urlCopied', 'toast.urlCopyManual'].forEach(function (k) {
    T('i18n ' + k + ' (' + lg + ')', t(k) !== k);
  });
  T('i18n finished.siteHasMore の {total}{n} (' + lg + ')',
    t('finished.siteHasMore', { total: 'X', n: 'Y' }).indexOf('X') >= 0 &&
    t('finished.siteHasMore', { total: 'X', n: 'Y' }).indexOf('Y') >= 0);
  T('i18n finished.asOf の {date}{days} (' + lg + ')',
    t('finished.asOf', { date: 'D', days: 'N' }).indexOf('D') >= 0 &&
    t('finished.asOf', { date: 'D', days: 'N' }).indexOf('N') >= 0);
});
setLang('ja');
T('「閉じない」ではなく「この本に戻る」', t('finished.dismiss') === 'この本に戻る');

// 同じ著者の別の本（蔵書にある）と、無関係な本
localStorage.setItem('epub_pos_同じ著者の別作品__ウェブ作者',
  JSON.stringify({ spineIdx: 0, ratio: 0.2, spineCount: 5, creator: 'ウェブ作者', lastOpenedAt: '2026-01-01T00:00:00Z' }));
localStorage.setItem('epub_pos_他人の本__べつの人',
  JSON.stringify({ spineIdx: 0, ratio: 0.2, spineCount: 5, creator: 'べつの人', lastOpenedAt: '2026-01-01T00:00:00Z' }));

openFixture('webnovel.epub')
.then(function () {
  T('Web 小説が開けた', state.bookTitle === 'テスト用ウェブ小説');
  T('鮮度の日付を読む（nd:* あり）', !!state.bookGeneratedAt, state.bookGeneratedAt);
  T('シリーズ名は巻を除く', state.bookSeriesName === 'テストシリーズ', state.bookSeriesName);
  T('ヘルプ用のシリーズ表示は従来どおり', state.bookSeries === 'テストシリーズ（2）', state.bookSeries);
  var v = _volumeInfo();
  T('話数: 3 話収録・サイトは 5 話', v.eps === 3 && v.total === 5 && v.partial, JSON.stringify(v));

  finishBook();
  T('パネルが開く', ov().classList.contains('show') && _finishedOpen);
  T('既定フォーカスは「この本に戻る」', document.activeElement && document.activeElement.id === 'finished-stay-btn',
    document.activeElement && document.activeElement.id);
  var txt = bodyText();
  T('書名', txt.indexOf('テスト用ウェブ小説') >= 0);
  T('連載状態', txt.indexOf('連載中') >= 0);
  T('サイトの総話数との差', txt.indexOf('5 話まで') >= 0 && txt.indexOf('3 話') >= 0, txt);
  T('鮮度の日付と経過日数', /ダウンロード .*日前/.test(txt), txt);
  T('30 日以上前は強調', !!document.querySelector('#finished-body .fp-stale.fp-old'));
  var link = [].filter.call(document.querySelectorAll('#finished-body a.fp-btn'),
    function (a) { return a.href.indexOf('kakuyomu.jp/works/1234567890') >= 0; })[0];
  T('連載中は「続きを確認」リンク', !!link && link.textContent.indexOf('カクヨムで続きを確認') >= 0,
    link && link.textContent);
  T('リンクは別タブ・noopener', link && link.target === '_blank' && /noopener/.test(link.rel));
  T('URL コピーのボタン', !!document.querySelector('#finished-body [onclick="finishedCopyUrl()"]'));
  T('次の巻（シリーズ名＋著者で NDL）', [].some.call(document.querySelectorAll('#finished-body a'),
    function (a) { return a.href.indexOf('ndlsearch.ndl.go.jp') >= 0 && decodeURIComponent(a.href).indexOf('テストシリーズ ウェブ作者') >= 0; }));
  T('蔵書の同じ著者は 2 冊（この本を含む・他人の本は数えない）', txt.indexOf('蔵書に 2 冊') >= 0, txt);
  // 暦日で数える: 昨夜 23:30 は経過時間が 1 日未満でも「1 日前」（「今日」ではない）
  var savedGen = state.bookGeneratedAt, mid = new Date(); mid.setHours(0, 0, 0, 0);
  state.bookGeneratedAt = new Date(mid.getTime() - 30 * 60000).toISOString();
  _finishedRender();
  T('鮮度は暦日の差（昨夜は 1 日前）', bodyText().indexOf('（1 日前）') >= 0, bodyText());
  state.bookGeneratedAt = new Date(mid.getTime() + 60000).toISOString();
  _finishedRender();
  T('今日の 0:01 は「今日」', bodyText().indexOf('（今日）') >= 0);
  state.bookGeneratedAt = savedGen; _finishedRender();
  T('著者の Web 検索', [].some.call(document.querySelectorAll('#finished-body a'),
    function (a) { return a.href.indexOf('google.com/search') >= 0; }));
  T('読了は記録済み（パネルが出た時点）', !!JSON.parse(localStorage.getItem(state.bookKey)).finishedAt);
  T('このセッションの読了に入る', _rlJustFinished.has(state.bookKey));

  // ── キー操作 ──
  var before = state.currentSpineIdx;
  var e1 = key(' ');
  T('開いた直後の Space は握りつぶす', e1.prevented && ov().classList.contains('show'));
  _finishedOpenedAt = 0;   // 猶予を過ぎた扱い
  var e2 = key(' ', { repeat: true });
  T('キーリピートの Space も握りつぶす', e2.prevented);
  key('n');
  T('裏のページは送られない', state.currentSpineIdx === before && ov().classList.contains('show'));
  key('q');
  T('q でも本は閉じない', !!state.epub);

  // ── 言語切替で組み直す ──
  setLang('en');
  T('言語切替でパネルも訳される', bodyText().indexOf('Finished reading') >= 0, bodyText().slice(0, 40));
  setLang('ja');

  // ── 開いた直後のボタン・背景クリックは無視 ──
  _finishedOpenedAt = Date.now();
  document.getElementById('finished-stay-btn').click();
  T('開いた直後のボタンは効かない', ov().classList.contains('show'));
  _finishedBackdropClick();
  T('開いた直後の背景タップも効かない', ov().classList.contains('show'));
  _finishedOpenedAt = 0;

  // ── Escape ＝ この本に戻る ──
  key('Escape');
  T('Escape で閉じる', !ov().classList.contains('show') && !_finishedOpen);
  T('本は開いたまま', !!state.epub);
  T('フォーカスは本文へ戻る', document.activeElement && document.activeElement.id === 'page-container',
    document.activeElement && document.activeElement.id);

  // ── スマホ幅ではボトムシート ──
  finishBook();
  // 出現アニメーション（translateY）の途中を測らない
  var boxEl = document.getElementById('finished-box');
  if (boxEl.getAnimations) boxEl.getAnimations().forEach(function (a) { a.finish(); });
  var box = boxEl.getBoundingClientRect();
  T('ボトムシート: 下端に接地', Math.abs(box.bottom - window.innerHeight) <= 1,
    box.bottom + ' / ' + window.innerHeight);
  T('ボトムシート: 全幅', Math.abs(box.width - window.innerWidth) <= 1, box.width + ' / ' + window.innerWidth);
  T('重なり順: モーダルと読書データの間', getComputedStyle(ov()).zIndex === '205');

  // ── URL コピー ──
  var copied = null;
  Object.defineProperty(navigator, 'clipboard', { configurable: true,
    value: { writeText: function (s) { copied = s; return Promise.resolve(); } } });
  finishedCopyUrl();
  return new Promise(function (r) { setTimeout(r, 50); }).then(function () {
    T('URL をコピー', copied === 'https://kakuyomu.jp/works/1234567890', copied);
    T('コピーのトースト', document.getElementById('toast').textContent.indexOf('コピーしました') >= 0);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    finishedCopyUrl();
    var box = document.querySelector('#fp-copy-fallback input');
    T('clipboard が無ければ選択済みの入力欄', !!box && box.value === 'https://kakuyomu.jp/works/1234567890'
      && box.selectionEnd === box.value.length);
    T('Drive の取り直しはコピーで発火しない',
      !!document.querySelector('#finished-body [onclick="finishedCopyUrl()"]').closest(DRIVE_RETRY_SKIP_SEL));
  });
})
.then(function () {
  // ── 読みかけリストへ（B: このセッションの間は残す）──
  _finishedOpenedAt = 0;
  var k = state.bookKey;
  document.getElementById('finished-list-btn').click();
  T('「読みかけリストへ」で本を閉じる', !state.epub && !ov().classList.contains('show'));
  _rlQuery = ''; _rlPrefs.showFinished = false; _rlPrefs.filterReady = false;
  _rlPrefs.filterHasMore = false; _rlPrefs.genre = '';
  var item = _rlCollect().filter(function (it) { return it.key === k; })[0];
  T('末尾にいる（atEnd）', item && item.atEnd);
  var shown = function () { return _rlFilterSort(_rlCollect()).shown.map(function (it) { return it.key; }); };
  T('読み終えた本はこのセッションの間リストに残る', shown().indexOf(k) >= 0);
  _rlJustFinished.delete(k);
  T('セッションが変われば（Set が空）従来どおり隠れる', shown().indexOf(k) < 0);
  _rlJustFinished.add(k);
  // 論理削除しても残っていたら「消したのに消えない」
  _rlPendingDeleteKey = k; _rlPendingDeleteMode = 'hide';
  doDeleteBook();
  T('削除したらセッション中でも消える', !_rlJustFinished.has(k) && shown().indexOf(k) < 0);
  return openFixture('webnovel.epub');
})
.then(function () {
  // ── 「リストで見る」→ 著者で絞り込む ──
  finishBook();
  _finishedOpenedAt = 0;
  finishedShowAuthor();
  T('本を閉じてリストへ', !state.epub);
  T('検索欄に著者名', document.getElementById('rl-search').value === 'ウェブ作者');
  var keys = _rlFilterSort(_rlCollect()).shown.map(function (it) { return it.key; });
  T('同じ著者の別作品が出る', keys.indexOf('epub_pos_同じ著者の別作品__ウェブ作者') >= 0, keys.join(','));
  T('他人の本は出ない', keys.indexOf('epub_pos_他人の本__べつの人') < 0);
  clearRlFilters();
  return openFixture('reflow.epub');
})
.then(function () {
  // ── 底本も nd:* も無い本 ──
  T('nd:* の無い本は鮮度を読まない', state.bookGeneratedAt === '');
  finishBook();
  T('「この作品」節は出ない', bodyText().indexOf('この作品') < 0);
  T('「次の巻」節は出ない', bodyText().indexOf('次の巻') < 0);
  T('著者の節は出る（Web 検索）', bodyText().indexOf('この著者の本') >= 0);
  T('蔵書が無ければ冊数は出さない', bodyText().indexOf('蔵書に') < 0);
  // 本を切り替えたら（renderPage を通る）パネルは閉じる
  renderPage(0, 'start');
  T('章を移るとパネルは閉じる', !ov().classList.contains('show'));
  closeBook();

  // ══ C. カードの著者名から絞り込む ══
  localStorage.clear();
  _rlJustFinished.clear();
  function put(k, o) { localStorage.setItem(k, JSON.stringify(Object.assign(
    { spineCount: 5, lastOpenedAt: '2026-01-01T00:00:00Z' }, o))); }
  put('epub_pos_読みかけA__甲山', { spineIdx: 1, ratio: 0.2, creator: '甲山' });
  put('epub_pos_読了B__甲山',     { spineIdx: 4, ratio: 1.0, creator: '甲山', finishedAt: '2026-01-02T00:00:00Z' });
  put('epub_pos_共著C__甲山・乙川', { spineIdx: 0, ratio: 0.1, creator: '甲山・乙川', creators: ['甲山', '乙川'] });
  put('epub_pos_外国D__ジョン・スミス', { spineIdx: 0, ratio: 0.1, creator: 'ジョン・スミス' });
  put('epub_pos_甲山の思い出__べつの人', { spineIdx: 4, ratio: 1.0, creator: 'べつの人', finishedAt: '2026-01-02T00:00:00Z' });
  _rlQuery = ''; _rlPrefs.showFinished = false; _rlPrefs.view = 'list';
  document.getElementById('rl-search').value = '';
  buildReadingList();
  var spans = document.querySelectorAll('#reading-list-items .rl-author');
  var names = [].map.call(spans, function (e) { return e.dataset.author; });
  T('カードの著者名は押せる', names.indexOf('甲山') >= 0 && names.indexOf('乙川') >= 0, names.join(','));
  T('外国人名は割らない', names.indexOf('ジョン・スミス') >= 0 && names.indexOf('スミス') < 0);
  T('著者バーは普段は出ない', !document.getElementById('rl-author-bar').classList.contains('show'));
  var kou = [].filter.call(spans, function (e) { return e.dataset.author === '甲山'; })[0];
  kou.click();
  var r = _rlFilterSort(_rlCollect());
  var keys = r.shown.map(function (it) { return it.key; });
  T('著者で絞り込む', document.getElementById('rl-search').value === '甲山');
  T('著者モードでは読了も出る', keys.indexOf('epub_pos_読了B__甲山') >= 0, keys.join(','));
  T('共著も出る', keys.indexOf('epub_pos_共著C__甲山・乙川') >= 0);
  T('他の著者は出ない', keys.indexOf('epub_pos_外国D__ジョン・スミス') < 0);
  T('書名に著者名を含む他人の読了本は出ない', keys.indexOf('epub_pos_甲山の思い出__べつの人') < 0, keys.join(','));
  T('著者バーの冊数＝並んでいるカード', r.author && r.author.count === r.shown.length, r.author && r.author.count);
  var bar = document.getElementById('rl-author-bar');
  T('著者バーが出る', bar.classList.contains('show'));
  T('著者バーに冊数', bar.textContent.indexOf('甲山') >= 0 && bar.textContent.indexOf('3') >= 0, bar.textContent);
  T('著者バーの Web 検索', bar.querySelector('.rl-ab-web').href.indexOf('google.com/search') >= 0);
  T('カードのクリックはカードを開かない（stopPropagation）', !state.epub);
  // 部分一致の普通の検索では著者モードにならない（読了は隠れたまま）
  setRlAuthor('甲');
  T('部分一致では著者バーは出ない', !bar.classList.contains('show'));
  T('部分一致では読了は隠れたまま',
    _rlFilterSort(_rlCollect()).shown.map(function (it) { return it.key; }).indexOf('epub_pos_読了B__甲山') < 0);
  setRlAuthor('ジョン・スミス');
  T('外国人名で完全一致', bar.classList.contains('show'));
  bar.querySelector('.rl-ab-clear').click();
  T('✕ で検索語だけ消える', document.getElementById('rl-search').value === '' && !bar.classList.contains('show'));
  _editMode = true; buildReadingList();
  document.querySelector('#reading-list-items .rl-author').click();
  T('編集モードでは絞り込まない', document.getElementById('rl-search').value === '');
  _editMode = false; buildReadingList();
  setLang('en'); setRlAuthor('甲山');
  T('著者バーの英語', bar.textContent.indexOf('Author:') >= 0, bar.textContent);
  setLang('ja'); setRlAuthor('');
  localStorage.clear();
})
.catch(function (e) { T('読了パネル E2E 例外', false, e && (e.stack || e.message)); });
