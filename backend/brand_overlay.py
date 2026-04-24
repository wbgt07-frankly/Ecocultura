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
    "MarckScript.ttf": (
        "https://raw.githubusercontent.com/google/fonts/main/ofl/marckscript/MarckScript-Regular.ttf"
    ),
    "OswaldBold.ttf": (
        "https://raw.githubusercontent.com/google/fonts/main/ofl/oswald/Oswald%5Bwght%5D.ttf"
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


LOGO_PATH = os.path.join(os.path.dirname(BASE_DIR), "frontend", "Logotype.png")


def _add_overlay(img: Image.Image) -> Image.Image:
    w, h = img.size
    strip_h = int(h * 0.15)
    PAD = int(strip_h * 0.12)

    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    draw.rectangle([(0, h - strip_h), (w, h)], fill=(*DARK_GREEN, 235))

    text_x_start = PAD

    # Logo on the left
    if os.path.exists(LOGO_PATH):
        try:
            logo = Image.open(LOGO_PATH).convert("RGBA")
            lw, lh = logo.size
            logo_h = strip_h - 2 * PAD
            logo_w = int(logo_h * lw / lh)
            logo = logo.resize((logo_w, logo_h), Image.LANCZOS)
            logo_x = PAD
            logo_y = h - strip_h + PAD
            overlay.paste(logo, (logo_x, logo_y), logo)

            div_x = logo_x + logo_w + PAD
            draw.line(
                [(div_x, h - strip_h + PAD * 2), (div_x, h - PAD * 2)],
                fill=(*LIME_GREEN, 160),
                width=max(1, int(strip_h * 0.015)),
            )
            text_x_start = div_x + PAD
        except Exception as e:
            logger.warning(f"Не удалось добавить логотип: {e}")

    # Slogan text — two lines
    line1 = "ЭКО-Культура —"
    line2 = "овощи которым я доверяю"
    text_area_w = w - text_x_start - PAD
    slogan_size = max(14, int(strip_h * 0.27))
    font_slogan = _load_font("Montserrat-Regular.ttf", slogan_size)

    b1 = draw.textbbox((0, 0), line1, font=font_slogan)
    b2 = draw.textbbox((0, 0), line2, font=font_slogan)
    lh1 = b1[3] - b1[1]
    lh2 = b2[3] - b2[1]
    gap = max(2, int(strip_h * 0.04))
    block_h = lh1 + gap + lh2
    ys = h - strip_h + (strip_h - block_h) // 2

    for line, b in ((line1, b1), (line2, b2)):
        lw = b[2] - b[0]
        xs = text_x_start + max(0, (text_area_w - lw) // 2)
        draw.text((xs, ys), line, fill=WHITE, font=font_slogan)
        ys += (lh1 if line == line1 else 0) + gap

    img_rgba = img.convert("RGBA")
    result = Image.alpha_composite(img_rgba, overlay)
    return result.convert("RGB")


# ── v2: write user name on magazine cover ─────────────────────────

# Name frame position (relative, calibrated for 1055×1491 covers)
NAME_X_REL    = 0.05   # horizontal anchor (left edge of name)
NAME_Y_REL    = 0.64   # vertical center of name
NAME_MAX_W    = 0.55   # max width as fraction of image width
NAME_TRACKING = -0.04  # letter spacing as fraction of font_size (negative = tighter)


def _text_width_tracked(draw, text, font, tracking_px):
    """Measure total width of text rendered with custom tracking."""
    total = 0
    for ch in text:
        bb = draw.textbbox((0, 0), ch, font=font)
        total += (bb[2] - bb[0]) + tracking_px
    return total


def write_name_on_cover(img_bytes: bytes, user_name: str) -> bytes:
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    w, h = img.size

    font_size = max(32, int(h * 0.115))
    font = _load_font("OswaldBold.ttf", font_size)

    name = user_name.strip().upper()
    tracking_px = int(font_size * NAME_TRACKING)

    tmp_draw = ImageDraw.Draw(img)

    # measure with tracking
    tw = _text_width_tracked(tmp_draw, name, font, tracking_px)
    bb0 = tmp_draw.textbbox((0, 0), name[0], font=font)
    th = bb0[3] - bb0[1]

    max_px = int(w * NAME_MAX_W)
    if tw > max_px:
        font_size = int(font_size * max_px / tw)
        font = _load_font("OswaldBold.ttf", font_size)
        tracking_px = int(font_size * NAME_TRACKING)
        tw = _text_width_tracked(tmp_draw, name, font, tracking_px)
        bb0 = tmp_draw.textbbox((0, 0), name[0], font=font)
        th = bb0[3] - bb0[1]

    pad = int(font_size * 0.25)
    layer_w = tw + pad * 2
    layer_h = th + pad * 2
    txt_layer = Image.new("RGBA", (layer_w, layer_h), (0, 0, 0, 0))
    td = ImageDraw.Draw(txt_layer)

    # fixed vertical baseline from full string measurement
    full_bb = td.textbbox((0, 0), name, font=font)
    vert_off = full_bb[1]

    # draw char by char with tracking — same vertical baseline for all chars
    cx = pad
    cy = pad
    for ch in name:
        bb = td.textbbox((0, 0), ch, font=font)
        td.text((cx - bb[0] + 4, cy - vert_off + 4), ch, font=font, fill=(0, 0, 0, 130))
        td.text((cx - bb[0], cy - vert_off), ch, font=font, fill=(255, 215, 60, 255))
        cx += (bb[2] - bb[0]) + tracking_px

    anchor_x = int(w * NAME_X_REL)
    anchor_y = int(h * NAME_Y_REL) - txt_layer.height // 2

    img_rgba = img.convert("RGBA")
    img_rgba.paste(txt_layer, (anchor_x, anchor_y), txt_layer)
    img = img_rgba.convert("RGB")

    out = io.BytesIO()
    img.save(out, format="JPEG", quality=92, optimize=True)
    return out.getvalue()
