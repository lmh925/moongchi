#!/usr/bin/env python3
"""그림 시안 비교: 흰 배경을 지우고(누끼), 실제 휴대폰 화면 크기에 얹어서 보여 줘요.

사용법: python3 preview_styles.py 출력.png 시안1.png[:이름] 시안2.png[:이름] ...
- 낮 방 / 밤 방 배경 위에 어른 강아지를 실제 크기로
- 성장 3단계를 목록 아이콘 크기로
- 테두리 확대 (누끼가 깔끔한지)
"""
import sys
from collections import deque

from PIL import Image, ImageDraw, ImageFilter, ImageFont

SCALE = 2  # 휴대폰 화면 2배 해상도로 그려요 (390pt → 780px)


def cutout(img, tol=34):
    """가장자리에서 이어진 흰 배경만 투명하게 (강아지 안쪽 흰 털은 그대로)"""
    img = img.convert('RGBA')
    # 이미 투명 배경이면 그대로 써요
    if img.getchannel('A').getextrema()[0] < 16:
        return img
    w, h = img.size
    px = img.load()
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))

    def bg(p):
        r, g, b, _ = p
        return r > 255 - tol and g > 255 - tol and b > 255 - tol

    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i] or not bg(px[x, y]):
            continue
        seen[i] = 1
        if x > 0: q.append((x - 1, y))
        if x < w - 1: q.append((x + 1, y))
        if y > 0: q.append((x, y - 1))
        if y < h - 1: q.append((x, y + 1))
    alpha = Image.new('L', (w, h), 255)
    ap = alpha.load()
    for y in range(h):
        for x in range(w):
            if seen[y * w + x]:
                ap[x, y] = 0
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.7))
    img.putalpha(alpha)
    return img


def split_figures(img, min_area=0.02):
    """서로 떨어진 그림 덩어리(강아지)를 왼쪽부터 찾아요 (1/4 크기에서 연결된 영역 찾기)"""
    small = img.getchannel('A').resize((img.width // 4, img.height // 4))
    w, h = small.size
    px = small.load()
    seen = [[False] * w for _ in range(h)]
    boxes = []
    for sy in range(h):
        for sx in range(w):
            if seen[sy][sx] or px[sx, sy] < 60:
                continue
            q = deque([(sx, sy)]); seen[sy][sx] = True
            x0, y0, x1, y1, n = sx, sy, sx, sy, 0
            while q:
                x, y = q.popleft(); n += 1
                x0, y0, x1, y1 = min(x0, x), min(y0, y), max(x1, x), max(y1, y)
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and px[nx, ny] >= 60:
                        seen[ny][nx] = True; q.append((nx, ny))
            if n > w * h * min_area * 0.1:
                boxes.append((x0 * 4, y0 * 4, (x1 + 1) * 4, (y1 + 1) * 4, len(boxes) + 1))
    boxes.sort()
    out = []
    for x0, y0, x1, y1, _ in boxes:
        part = img.crop((x0, y0, x1, y1))
        # 옆 강아지 조각이 상자 안에 걸쳐 들어오면 지워요 (가장 큰 덩어리만 남기기)
        a = part.getchannel('A')
        sub = split_once(a)
        part.putalpha(Image.composite(a, Image.new('L', a.size, 0), sub))
        out.append(part)
    return out


def split_once(a):
    """알파에서 가장 큰 연결 덩어리만 흰색인 마스크"""
    small = a.resize((max(1, a.width // 2), max(1, a.height // 2)))
    w, h = small.size
    px = small.load()
    lab = [[0] * w for _ in range(h)]
    best, best_n, cur = 0, 0, 0
    for sy in range(h):
        for sx in range(w):
            if lab[sy][sx] or px[sx, sy] < 30:
                continue
            cur += 1
            q = deque([(sx, sy)]); lab[sy][sx] = cur; n = 0
            while q:
                x, y = q.popleft(); n += 1
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not lab[ny][nx] and px[nx, ny] >= 30:
                        lab[ny][nx] = cur; q.append((nx, ny))
            if n > best_n:
                best, best_n = cur, n
    m = Image.new('L', (w, h), 0)
    mp = m.load()
    for y in range(h):
        for x in range(w):
            if lab[y][x] == best:
                mp[x, y] = 255
    return m.resize(a.size).filter(ImageFilter.MaxFilter(5))


def fit_h(img, hpx):
    return img.resize((max(1, round(img.width * hpx / img.height)), hpx), Image.LANCZOS)


def room(w, h, night=False):
    im = Image.new('RGBA', (w, h))
    d = ImageDraw.Draw(im)
    wall_top, wall_bot = ((52, 56, 98), (70, 72, 120)) if night else ((255, 239, 222), (250, 226, 204))
    floor_top, floor_bot = ((92, 74, 92), (70, 56, 76)) if night else ((236, 196, 152), (222, 176, 130))
    horizon = int(h * 0.55)
    for y in range(h):
        if y < horizon:
            k = y / horizon; c = tuple(int(wall_top[i] + (wall_bot[i] - wall_top[i]) * k) for i in range(3))
        else:
            k = (y - horizon) / (h - horizon); c = tuple(int(floor_top[i] + (floor_bot[i] - floor_top[i]) * k) for i in range(3))
        d.line([(0, y), (w, y)], fill=c + (255,))
    # 창문
    wx, wy, ww, wh = int(w * 0.32), int(h * 0.12), int(w * 0.36), int(h * 0.22)
    d.rounded_rectangle([wx - 10, wy - 10, wx + ww + 10, wy + wh + 10], 18, fill=(160, 110, 70, 255))
    d.rounded_rectangle([wx, wy, wx + ww, wy + wh], 10, fill=(40, 52, 110, 255) if night else (176, 222, 255, 255))
    if night:
        d.ellipse([wx + ww * 0.65, wy + 18, wx + ww * 0.65 + 40, wy + 58], fill=(255, 240, 180, 255))
    return im


def label(d, xy, text, size=26, fill=(74, 51, 48, 255)):
    try:
        f = ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', size)
    except OSError:
        try:
            f = ImageFont.truetype('/home/user/moongchi/public/fonts/Galmuri11-Bold.woff2', size)
        except OSError:
            f = ImageFont.load_default()
    d.text(xy, text, font=f, fill=fill)


def panel(src, name):
    figs = split_figures(cutout(Image.open(src)))
    adult = max(figs, key=lambda f: f.height)
    W, H = 390 * SCALE, 520 * SCALE
    out = Image.new('RGBA', (W, H + 260 * SCALE), (255, 250, 240, 255))
    d = ImageDraw.Draw(out)
    # ① 낮 방 위 어른 강아지 (화면 높이의 약 26% ≈ 실제 게임 크기)
    day = room(W, H // 2)
    dog = fit_h(adult, int(H * 0.27))
    day.alpha_composite(dog, (W // 2 - dog.width // 2, H // 2 - dog.height - 30))
    out.alpha_composite(day, (0, 0))
    # ② 밤 방 (테두리가 어두운 배경에서 지저분하지 않은지)
    night = room(W, H // 2, night=True)
    night.alpha_composite(dog, (W // 2 - dog.width // 2, H // 2 - dog.height - 30))
    out.alpha_composite(night, (0, H // 2))
    # ③ 성장 3단계를 목록 아이콘 크기(56pt)로
    y0 = H + 20
    label(d, (24, y0), f'{name} · 목록 아이콘 크기', 26)
    x = 24
    for f in figs[:3]:
        ic = fit_h(f, 56 * SCALE)
        d.rounded_rectangle([x - 8, y0 + 44, x + ic.width + 8, y0 + 44 + ic.height + 16], 16, fill=(255, 238, 214, 255), outline=(74, 51, 48, 255), width=4)
        out.alpha_composite(ic, (x, y0 + 52))
        x += ic.width + 40
    # ④ 테두리 4배 확대 (밤 배경)
    crop_src = fit_h(adult, int(H * 0.27))
    cx, cy = int(crop_src.width * 0.55), int(crop_src.height * 0.05)
    patch = Image.new('RGBA', (60, 60), (52, 56, 98, 255))
    patch.alpha_composite(crop_src.crop((cx, cy, cx + 60, cy + 60)))
    patch = patch.resize((240, 240), Image.NEAREST)
    out.alpha_composite(patch, (W - 264, y0 + 20))
    label(d, (W - 264, y0 + 266), '귀 테두리 4배', 22)
    return out


if __name__ == '__main__':
    dst, *srcs = sys.argv[1:]
    panels = []
    for s in srcs:
        path, _, name = s.partition(':')
        panels.append(panel(path, name or path))
    gap = 24
    total = Image.new('RGBA', (sum(p.width for p in panels) + gap * (len(panels) - 1), max(p.height for p in panels)), (74, 51, 48, 255))
    x = 0
    for p in panels:
        total.alpha_composite(p, (x, 0)); x += p.width + gap
    total.convert('RGB').save(dst)
    print('saved', dst, total.size)
