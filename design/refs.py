# -*- coding: utf-8 -*-
"""스킬마켓 디자인 레퍼런스 수집 (Mobbin API) + 컨택트 시트.

C:/pjt/mobbin 의 API 래퍼(scripts/mobbin.py)와 키(.env)를 그대로 쓴다. 키는 출력하지 않는다.
교훈(C:/pjt/mobbin/lesson.md): deep 모드 필수, 이미지 즉시 저장, 응답 캐시, web 스크린샷은 가로형.
    PYTHONIOENCODING=utf-8 python design/refs.py
"""
import pathlib
import sys
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, "C:/pjt/mobbin/scripts")
import mobbin  # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
mobbin.CACHE = HERE / "cache"
REFDIR, SHEETDIR = HERE / "refs", HERE / "sheets"

# 화면 1개만 묘사, 앱 이름·추상어·부정문 없이 (mobbin CLAUDE.md 쿼리 작성법)
QUERIES = [
    ("web", "template marketplace homepage with featured section and grid of large preview cards"),
    ("web", "plugin marketplace listing page with cards showing install count and likes"),
    ("web", "resource library page with category filter chips above a card grid"),
    ("web", "template detail page with large preview images and a sidebar with install button"),
    ("web", "creator profile page with stats and a grid of published templates"),
    ("web", "community gallery of user submitted designs with like counts"),
    ("web", "search results page with filter chips and thumbnail grid"),
    ("web", "upload form for publishing a template with file drop zone"),
    ("web", "frosted glass navigation bar over a colorful blurred background"),
    ("web", "hero section with translucent frosted glass cards over gradient blobs"),
    ("ios", "frosted glass card with translucent blurred background over colorful gradient"),
    ("ios", "app store style detail page with screenshot carousel and get button"),
]


def collect():
    def one(job):
        p, q = job
        r = mobbin.search_cached(q, p, 10)
        sys.stderr.write(f"  {len(r):>2} {p} {q[:60]}\n")
        return [(p, q, s) for s in r]

    with ThreadPoolExecutor(max_workers=4) as ex:
        found = [x for chunk in ex.map(one, QUERIES) for x in chunk]
    uniq = {s["id"]: (p, q, s) for p, q, s in found}
    REFDIR.mkdir(parents=True, exist_ok=True)
    mobbin.SHOTS = REFDIR
    with ThreadPoolExecutor(max_workers=8) as ex:
        paths = list(ex.map(lambda t: mobbin.download(t[2]), uniq.values()))
    return [(meta, mobbin.ROOT / p) for meta, p in zip(uniq.values(), paths) if p]


def sheets(items, per=9, cols=3, cell=(560, 400)):
    from PIL import Image, ImageDraw
    SHEETDIR.mkdir(parents=True, exist_ok=True)
    out = []
    for n in range(0, len(items), per):
        chunk = items[n:n + per]
        rows = (len(chunk) + cols - 1) // cols
        sheet = Image.new("RGB", (cell[0] * cols, (cell[1] + 24) * rows), (24, 24, 28))
        d = ImageDraw.Draw(sheet)
        for i, ((p, q, s), path) in enumerate(chunk):
            x, y = (i % cols) * cell[0], (i // cols) * (cell[1] + 24)
            with Image.open(path) as im:
                im = im.convert("RGB")
                im.thumbnail((cell[0] - 10, cell[1] - 6))  # contain: 가로·세로 모두 전체가 보이게 (lesson L10)
                sheet.paste(im, (x + (cell[0] - im.width) // 2, y + 22))
            d.text((x + 6, y + 5), f"{n + i:>3} {s['app_name']} [{p}]", fill=(225, 225, 230))
        f = SHEETDIR / f"sheet-{n // per:02d}.png"
        sheet.save(f)
        out.append(f)
    return out


if __name__ == "__main__":
    items = collect()
    made = sheets(items)
    print(f"{len(items)} screens -> {len(made)} sheets")
    for i, ((p, q, s), _) in enumerate(items):
        print(f"{i:>3} {s['app_name']:<24}{p:<4} {q[:56]}  {s['mobbin_url']}")
