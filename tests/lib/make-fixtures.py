#!/usr/bin/env python3
"""テスト用の小さな ePub を生成する（tests/.fixtures/ 配下・gitignore 対象）。

  python3 tests/lib/make-fixtures.py

- reflow.epub  : リフロー本（4章・ルビと縦中横・SVG 表紙を含む）
- reflow2.epub : もう1冊のリフロー本（書名・著者違い＝bookKey が別になる）
- fxl.epub     : 固定レイアウト本（4ページ・rtl・pre-paginated）

実書籍に依存せずに E2E を回せるようにするのが目的。個人の蔵書（temp_sample/）は
gitignore されているため、クローン直後でもテストが通る状態を保つ。
"""
import os
import struct
import sys
import zipfile
import zlib

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.fixtures')
W, H = 600, 900


def png(w, h, rgb):
    """単色 PNG をライブラリ無しで作る。"""
    def chunk(tag, data):
        c = tag + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    raw = b''.join(b'\x00' + bytes(rgb) * w for _ in range(h))
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw))
            + chunk(b'IEND', b''))


# 背景を単色ベタで塗る（サムネイルの隅の画素を見れば、内在サイズ補完が効いて
# レターボックスされていないことを確かめられる）
COVER_SVG = ('<?xml version="1.0" encoding="UTF-8"?>\n'
             '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1200">'
             '<rect width="800" height="1200" fill="#1a2b3c"/>'
             '<text x="400" y="620" font-size="120" fill="#f0e6d2" text-anchor="middle"'
             ' font-family="serif">表紙</text></svg>')

CONTAINER = ('<?xml version="1.0"?><container version="1.0" '
             'xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles>'
             '<rootfile full-path="OEBPS/content.opf" '
             'media-type="application/oebps-package+xml"/></rootfiles></container>')


def opf(title, creator, items, refs, extra_meta='', ppd='rtl'):
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bid">'
            '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">'
            '<dc:identifier id="bid">urn:uuid:yomikake-test-%s</dc:identifier>'
            '<dc:title>%s</dc:title><dc:creator>%s</dc:creator><dc:language>ja</dc:language>'
            '%s</metadata><manifest>%s</manifest>'
            '<spine page-progression-direction="%s">%s</spine></package>'
            % (title, title, creator, extra_meta, ''.join(items), ppd, ''.join(refs)))


def build_reflow(path, title='テスト用リフロー', creator='テスト作者'):
    z = zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED)
    z.writestr('mimetype', 'application/epub+zip')
    z.writestr('META-INF/container.xml', CONTAINER)
    # SVG 表紙（novel_downloader が出すのと同じ形）。width/height を持たず viewBox だけ
    # なので、しおり用サムネイル生成側の内在サイズ補完も一緒に検証できる。
    z.writestr('OEBPS/images/cover.svg', COVER_SVG)
    items, refs, navpoints = [], [], []
    items.append('<item id="cov" href="images/cover.svg" '
                 'media-type="image/svg+xml" properties="cover-image"/>')
    for i in range(4):
        # ルビと縦中横を含める（字間・行間・縦中横フィックスの検証に要る）
        body = ''.join('<p><ruby>本文<rt>ほんぶん</rt></ruby>です。縦書きの折り返しを'
                       '起こすために、ある程度の分量を並べておきます。'
                       '<span class="tcy">%02d</span>行目。</p>' % (n,)
                       for n in range(40))
        z.writestr('OEBPS/ch%d.xhtml' % i,
                   '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n'
                   '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>第%d章</title>'
                   '<style>.tcy{text-combine-upright:all;-webkit-text-combine:horizontal;}</style></head>'
                   '<body><h1 id="top">第%d章</h1>%s</body></html>' % (i + 1, i + 1, body))
        items.append('<item id="c%d" href="ch%d.xhtml" media-type="application/xhtml+xml"/>' % (i, i))
        refs.append('<itemref idref="c%d"/>' % i)
        navpoints.append('<li><a href="ch%d.xhtml">第%d章</a></li>' % (i, i + 1))
    z.writestr('OEBPS/nav.xhtml',
               '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n'
               '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">'
               '<head><title>目次</title></head><body><nav epub:type="toc"><ol>%s</ol></nav></body></html>'
               % ''.join(navpoints))
    items.append('<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>')
    z.writestr('OEBPS/content.opf', opf(title, creator, items, refs))
    z.close()


def build_fxl(path):
    z = zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED)
    z.writestr('mimetype', 'application/epub+zip')
    z.writestr('META-INF/container.xml', CONTAINER)
    colors = [(220, 80, 80), (80, 140, 220), (80, 200, 120), (230, 200, 90)]
    items, refs = [], []
    for i, rgb in enumerate(colors):
        z.writestr('OEBPS/img/p%d.png' % i, png(W, H, rgb))
        z.writestr('OEBPS/p%d.xhtml' % i,
                   '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n'
                   '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>p%d</title>'
                   '<meta name="viewport" content="width=%d, height=%d"/></head>'
                   '<body style="margin:0"><img src="img/p%d.png" width="%d" height="%d"/></body></html>'
                   % (i, W, H, i, W, H))
        items.append('<item id="x%d" href="p%d.xhtml" media-type="application/xhtml+xml"/>'
                     '<item id="i%d" href="img/p%d.png" media-type="image/png"%s/>'
                     % (i, i, i, i, ' properties="cover-image"' if i == 0 else ''))
        refs.append('<itemref idref="x%d"/>' % i)
    meta = ('<meta property="rendition:layout">pre-paginated</meta>'
            '<meta property="rendition:spread">landscape</meta>')
    z.writestr('OEBPS/content.opf', opf('テスト用FXL', 'テスト作者', items, refs, meta))
    z.close()


def build_blank(path):
    """空行の詰め方（design_blank_lines.md）の検査用。

    Web 小説にありがちな空行の入れ方と、詰めてはいけないものを1章に混ぜてある。
    ⚠ reflow.epub を触ると e2e・TTS・kosync が影響を受けるので別の1冊にしている。
    """
    z = zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED)
    z.writestr('mimetype', 'application/epub+zip')
    z.writestr('META-INF/container.xml', CONTAINER)
    z.writestr('OEBPS/images/p.png', png(20, 20, (200, 120, 60)))
    B = '<p class="body-blank">&#160;</p>'       # Web 小説の空行（nbsp だけ）
    # 1章が1画面に収まってしまうと「詰めたぶん短くなった」を実寸で測れないので、
    # 各行は折り返しが起きる長さにしておく（iOS 版は body が viewport より短いと
    # offsetWidth が viewport 幅で頭打ちになり、変化が見えない）
    L = '同じ話を長めに書いて行の折り返しを起こします。' * 6
    body = (
        '<p class="body-line" id="head">地の文のはじまり。' + L + '</p>'
        + B + B +                                 # 2 連続（collapse で1つ消える）
        '<p class="body-line">「会話がはじまる」' + L + '</p>'
        + B + B +
        '<p class="body-line">「続けて会話」' + L + '</p>'  # 会話どうし＝境目ではない
        + B +                                     # 単独の空行（collapse では残る）
        '<p class="body-line">地の文にもどる。' + L + '</p>'
        + B + B + B +                             # 3 連続
        '<p><br/></p>'                            # br だけの空行も空行
        + '<p class="body-line" id="anchor-blank">&#160;</p>'   # id 付き＝隠さない
        + '<p class="body-line">おわりの地の文。' + L + '</p>'
        + '<p class="body-line"><img src="images/p.png" alt=""/></p>'  # 画像だけ＝空行ではない
        # 戻り先アンカーだけの段落（textContent は空だが隠すと目次・脚注が飛べなくなる）
        + '<p class="body-line"><a id="note-anchor"></a></p>'
        # 空のセル（隠すと行から消えて以降の列がずれる）
        + '<table><tr><td id="cell-empty"></td><td>セル</td></tr></table>'
    )
    z.writestr('OEBPS/ch0.xhtml',
               '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n'
               '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>空行の章</title>'
               '<style>p.body-line{margin:0}p.body-blank{margin:0;height:1em}</style></head>'
               '<body>%s</body></html>' % body)
    items = ['<item id="c0" href="ch0.xhtml" media-type="application/xhtml+xml"/>',
             '<item id="im" href="images/p.png" media-type="image/png"/>']
    refs = ['<itemref idref="c0"/>']
    z.writestr('OEBPS/nav.xhtml',
               '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n'
               '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">'
               '<head><title>目次</title></head><body><nav epub:type="toc"><ol>'
               '<li><a href="ch0.xhtml">空行の章</a></li></ol></nav></body></html>')
    items.append('<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>')
    z.writestr('OEBPS/content.opf', opf('テスト用空行', 'テスト作者', items, refs))
    z.close()


def build_blank_web(path):
    """おまかせ（自動判定）の検査用。会話の前後だけ空行を入れる Web 小説型。

    実蔵書「１０歳から始める冒険者生活」と同じ形（空行/本文≒1.3・会話の前に空行 100%・
    地の文どうしの間は 0%）。判定材料が足りる量（本文ブロック 150 以上）が要るので
    6章×30組にしてある。
    """
    z = zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED)
    z.writestr('mimetype', 'application/epub+zip')
    z.writestr('META-INF/container.xml', CONTAINER)
    B = '<p class="body-blank">&#160;</p>'
    L = '地の文を長めに書いて行の折り返しを起こします。' * 3
    items, refs, navpoints = [], [], []
    for i in range(6):
        group = ('<p class="body-line">%s</p>'
                 '<p class="body-line">%s</p>' % (L, L)          # 地の文どうしは詰まっている
                 + B + B +
                 '<p class="body-line">「会話です。%s」</p>' % L  # 会話の前後にだけ空行
                 + B + B)
        z.writestr('OEBPS/ch%d.xhtml' % i,
                   '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n'
                   '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>第%d章</title>'
                   '<style>p{margin:0}</style></head><body>%s</body></html>'
                   % (i + 1, group * 30))
        items.append('<item id="c%d" href="ch%d.xhtml" media-type="application/xhtml+xml"/>' % (i, i))
        refs.append('<itemref idref="c%d"/>' % i)
        navpoints.append('<li><a href="ch%d.xhtml">第%d章</a></li>' % (i, i + 1))
    z.writestr('OEBPS/nav.xhtml',
               '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n'
               '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">'
               '<head><title>目次</title></head><body><nav epub:type="toc"><ol>%s</ol></nav></body></html>'
               % ''.join(navpoints))
    items.append('<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>')
    z.writestr('OEBPS/content.opf', opf('テスト用Web小説', 'テスト作者', items, refs))
    z.close()


def build_webnovel(path):
    """novel_downloader 産を模した連載中の Web 小説（読了パネルの検証用）。
    本文は ep*.xhtml（_countEpisodesInSpine が数える名前）で 3 話、サイト側の総話数は 5 話。
    dcterms:modified は鮮度表示の基準（古い日付＝強調表示になる）。"""
    z = zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED)
    z.writestr('mimetype', 'application/epub+zip')
    z.writestr('META-INF/container.xml', CONTAINER)
    items, refs = [], []
    for i in range(3):
        body = ''.join('<p>第%d話の本文です。%02d</p>' % (i + 1, n) for n in range(20))
        z.writestr('OEBPS/ep%03d.xhtml' % (i + 1),
                   '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n'
                   '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>第%d話</title></head>'
                   '<body><h1>第%d話</h1>%s</body></html>' % (i + 1, i + 1, body))
        items.append('<item id="e%d" href="ep%03d.xhtml" media-type="application/xhtml+xml"/>' % (i, i + 1))
        refs.append('<itemref idref="e%d"/>' % i)
    meta = ('<dc:source>https://kakuyomu.jp/works/1234567890</dc:source>'
            '<meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>'
            '<meta property="nd:serialStatus">連載中</meta>'
            '<meta property="nd:episodeCount">5</meta>'
            '<meta property="nd:updated">2026-01-10</meta>'
            '<meta property="nd:authorUrl">https://kakuyomu.jp/users/web_author</meta>'
            '<meta property="belongs-to-collection" id="col">テストシリーズ</meta>'
            '<meta refines="#col" property="group-position">2</meta>')
    z.writestr('OEBPS/content.opf', opf('テスト用ウェブ小説', 'ウェブ作者', items, refs, meta))
    z.close()


def build_grow(path, n_eps, toc_at_end=False):
    """続きを追記した本の開き位置の検証用（yomikake/design_update_check.md §4-4）。
    novel_downloader と同じ並び（表紙ページ・目次・ep*.xhtml・奥付。toc_at_end なら目次を奥付の後ろ）。
    同じ題名・著者で話数だけ違う版を作り、追記の前後を模す。"""
    z = zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED)
    z.writestr('mimetype', 'application/epub+zip')
    z.writestr('META-INF/container.xml', CONTAINER)

    def page(name, title, body):
        z.writestr('OEBPS/' + name,
                   '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n'
                   '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>%s</title></head>'
                   '<body>%s</body></html>' % (title, body))
    page('cover.xhtml', '表紙', '<h1>テスト用連載</h1>')
    page('toc.xhtml', '目次', '<p>目次</p>')
    page('colophon.xhtml', '奥付', '<p>奥付</p>')
    eps = []
    for i in range(n_eps):
        name = 'ep%04d.xhtml' % (i + 1)
        page(name, '第%d話' % (i + 1),
             '<h1>第%d話</h1>' % (i + 1) + ''.join('<p>第%d話の本文。%02d</p>' % (i + 1, n) for n in range(20)))
        eps.append(name)
    order = ['cover.xhtml'] + ([] if toc_at_end else ['toc.xhtml']) + eps + ['colophon.xhtml'] \
        + (['toc.xhtml'] if toc_at_end else [])
    items = ['<item id="i%d" href="%s" media-type="application/xhtml+xml"/>' % (k, h) for k, h in enumerate(order)]
    refs = ['<itemref idref="i%d"/>' % k for k in range(len(order))]
    meta = ('<dc:source>https://kakuyomu.jp/works/9999999999</dc:source>'
            '<meta property="nd:serialStatus">連載中</meta>')
    title = 'テスト用連載（末尾目次）' if toc_at_end else 'テスト用連載'
    z.writestr('OEBPS/content.opf', opf(title, '連載作者', items, refs, meta))
    z.close()


def main():
    out = os.path.normpath(OUT_DIR)
    os.makedirs(out, exist_ok=True)
    for name, fn in (('reflow.epub', build_reflow),
                     ('reflow2.epub', lambda p: build_reflow(p, 'テスト用リフロー2', 'べつの作者')),
                     ('fxl.epub', build_fxl),
                     ('blank.epub', build_blank),
                     ('blankweb.epub', build_blank_web),
                     ('webnovel.epub', build_webnovel),
                     ('grow3.epub', lambda p: build_grow(p, 3)),
                     ('grow5.epub', lambda p: build_grow(p, 5)),
                     ('growtoc3.epub', lambda p: build_grow(p, 3, toc_at_end=True)),
                     ('growtoc5.epub', lambda p: build_grow(p, 5, toc_at_end=True))):
        p = os.path.join(out, name)
        fn(p)
        print('%s (%d bytes)' % (p, os.path.getsize(p)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
