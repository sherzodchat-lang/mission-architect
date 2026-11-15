# Converts the downloaded NASA/USGS source imagery into web textures for public/textures/planets.
# usage: venv/bin/python -I make_planets.py <dl_dir> <out_dir>
import sys, os
import numpy as np
from PIL import Image, ImageFilter
import tifffile

Image.MAX_IMAGE_PIXELS = None
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
P = lambda f: os.path.join(src, f)
O = lambda f: os.path.join(out, f)


def save_webp(im, name, q):
    im.save(O(name), 'WEBP', quality=q, method=6)


def save_jpg(im, name, q, sub=0):
    im.save(O(name), 'JPEG', quality=q, subsampling=sub, optimize=True, progressive=True)


def color_set(im, base, q=84):
    im = im.convert('RGB')
    save_webp(im.resize((4096, 2048), Image.LANCZOS), f'{base}_4k.webp', q)
    save_webp(im.resize((1024, 512), Image.LANCZOS), f'{base}_1k.webp', 80)


def slopes(h, radius_m, exag, w=2048, hgt=1024):
    """h: 2-D float heights in metres, equirectangular, lon -180..180 left→right, north at top.
    Returns (east, north) slope encoded 0..255 at w×h."""
    im = Image.fromarray(h.astype(np.float32), mode='F').resize((w, hgt), Image.BILINEAR)
    a = np.asarray(im, dtype=np.float64)
    lat = (0.5 - (np.arange(hgt) + 0.5) / hgt) * np.pi
    dlon = 2 * np.pi / w
    dlat = np.pi / hgt
    de = (np.roll(a, -1, axis=1) - np.roll(a, 1, axis=1)) / (2 * dlon * np.maximum(np.cos(lat), 0.05)[:, None] * radius_m)
    up = np.vstack([a[:1], a[:-1]])
    dn = np.vstack([a[1:], a[-1:]])
    dnorth = (up - dn) / (2 * dlat * radius_m)
    enc = lambda s: np.clip(0.5 + 0.5 * np.clip(s * exag, -1, 1), 0, 1) * 255
    return enc(de).astype(np.uint8), enc(dnorth).astype(np.uint8)


def data_jpg(r, g, b, name):
    save_jpg(Image.merge('RGB', [Image.fromarray(x) for x in (r, g, b)]), name, 90)


# ---------------------------------------------------------------- Earth
day = Image.open(P('bm_base_07.jpg'))
color_set(day, 'earth_day', 84)

night = np.asarray(Image.open(P('blackmarble_3km.jpg')).convert('RGB').resize((4096, 2048), Image.LANCZOS), dtype=np.float32) / 255
# Black Marble shows moonlit (blue) ground; keep only the warm artificial light
lum = 0.6 * night[..., 0] + 0.35 * night[..., 1] + 0.05 * night[..., 2]
lights = np.clip((lum - 0.13) / 0.8, 0, 1) ** 1.15
save_jpg(Image.fromarray((lights * 255).astype(np.uint8), 'L'), 'earth_lights_4k.jpg', 82)

clouds = Image.open(P('clouds_2048.jpg')).convert('L')
save_jpg(clouds, 'earth_clouds_2k.jpg', 86)

elev = np.asarray(Image.open(P('gebco_elev_5400.jpg')).convert('L'), dtype=np.float32) / 255 * 6400
bath = np.asarray(Image.open(P('gebco_bath_5400.jpg')).convert('L').resize((2048, 1024), Image.BILINEAR), dtype=np.float32)
water = np.clip((252 - bath) / 8, 0, 1)
se, sn = slopes(elev, 6371000, 10)
data_jpg(se, sn, (water * 255).astype(np.uint8), 'earth_data_2k.jpg')

# ---------------------------------------------------------------- Moon
color_set(Image.open(P('lroc_4k.tif')), 'moon_color', 82)
ld = tifffile.imread(P('ldem_16_uint.tif')).astype(np.float32) * 0.5
se, sn = slopes(ld, 1737400, 5)
hn = Image.fromarray(ld, mode='F').resize((2048, 1024), Image.BILINEAR)
ha = np.asarray(hn)
ha = ((ha - ha.min()) / (ha.max() - ha.min()) * 255).astype(np.uint8)
data_jpg(se, sn, ha, 'moon_data_2k.jpg')

# ---------------------------------------------------------------- Mars
color_set(Image.open(P('mars_viking_3840.jpg')), 'mars_color', 82)
mola = np.fromfile(P('mola16.img'), dtype='>i2').reshape(2880, 5760).astype(np.float32)
mola = np.roll(mola, 2880, axis=1)  # 0..360 E → -180..180
se, sn = slopes(mola, 3389500, 4)
mn = np.asarray(Image.fromarray(mola, mode='F').resize((2048, 1024), Image.BILINEAR))
mh = ((mn - mn.min()) / (mn.max() - mn.min()) * 255).astype(np.uint8)
data_jpg(se, sn, mh, 'mars_data_2k.jpg')

for f in sorted(os.listdir(out)):
    print(f'{f:26s} {os.path.getsize(O(f)) / 1024:8.0f} KB')
