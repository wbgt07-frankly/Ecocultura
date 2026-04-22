import io
import os
import logging
import urllib.request
from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FONTS_DIR = os.path.join(BASE_DIR, "assets", "fonts")

DARK_GREEN = (28, 66, 32)
LIME_GREEN = (125, 194, 66)
WHITE = (255, 255, 255)

FONT_URLS = {
    "Montserrat-Bold.ttf": (
        "https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf"
    ),
    "Montserrat-Regular.ttf": (
        "https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf"
    ),
}


def ensure_fonts():
    os.makedirs(FONTS_DIR, exist_ok=True)
    for filename, url in FONT_URLS.items():
        path = os.path.join(FONTS_DIR, filename)
        if not os.path.exists(path):
            logger.info(f"Загрузка шрифта {filename}...")
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req) as resp, open(path, "wb") as f:
                    f.write(resp.read())
            except Exception as e:
                logger.warning(f"Не удалось загрузить шрифт {filename}: {e}")


def _load_font(name: str, size: int) -> ImageFont.FreeTypeFont:
    path = os.path.join(FONTS_DIR, name)
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


def process_result(img_bytes: bytes) -> bytes:
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    img = _crop_portrait(img)
    img = _add_overlay(img)
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=92, optimize=True)
    return out.getvalue()


def _crop_portrait(img: Image.Image) -> Image.Image:
    w, h = img.size
    target_w = int(h * 4 / 5)
    if w > target_w:
        x = (w - target_w) // 2
        img = img.crop((x, 0, x + target_w, h))
    return img


def _add_overlay(img: Image.Image) -> Image.Image:
    w, h = img.size
    strip_h = int(h * 0.15)

    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    draw.rectangle([(0, h - strip_h), (w, h)], fill=(*DARK_GREEN, 235))

    brand_size = max(22, int(strip_h * 0.36))
    slogan_size = max(13, int(strip_h * 0.21))

    font_brand = _load_font("Montserrat-Bold.ttf", brand_size)
    font_slogan = _load_font("Montserrat-Regular.ttf", slogan_size)

    brand_text = "ЭКО КУЛЬТУРА"
    slogan_text = "овощи, в которых уверен"

    bb = draw.textbbox((0, 0), brand_text, font=font_brand)
    x = (w - (bb[2] - bb[0])) // 2
    y = h - strip_h + int(strip_h * 0.1)
    draw.text((x, y), brand_text, fill=WHITE, font=font_brand)

    bs = draw.textbbox((0, 0), slogan_text, font=font_slogan)
    xs = (w - (bs[2] - bs[0])) // 2
    ys = y + brand_size + int(strip_h * 0.06)
    draw.text((xs, ys), slogan_text, fill=(*LIME_GREEN, 230), font=font_slogan)

    img_rgba = img.convert("RGBA")
    result = Image.alpha_composite(img_rgba, overlay)
    return result.convert("RGB")
