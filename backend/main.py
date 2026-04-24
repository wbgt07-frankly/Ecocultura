import io
import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from PIL import Image

import brand_overlay as bo
import face_swap as fs

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR      = os.path.dirname(os.path.abspath(__file__))
COVERS_DIR    = os.path.join(BASE_DIR, "assets", "cover")
QUALITIES_DIR = os.path.join(COVERS_DIR, "qualities")
FRONTEND_DIR  = os.path.join(os.path.dirname(BASE_DIR), "frontend")

QUALITIES = {
    "juicy":   "Сочность",
    "ripe":    "Спелость",
    "quality": "Качество",
    "tasty":   "Вкус",
    "natural": "Состав",
}

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE = 10 * 1024 * 1024  # 10 MB


@asynccontextmanager
async def lifespan(app: FastAPI):
    bo.ensure_fonts()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/qualities")
async def get_qualities():
    return [{"id": k, "label": v} for k, v in QUALITIES.items()]


_thumb_cache: dict[str, bytes] = {}

@app.get("/api/thumb/{quality}/{gender}")
async def get_thumb(quality: str, gender: str):
    if quality not in QUALITIES or gender not in ("male", "female"):
        raise HTTPException(404)
    key = f"{quality}_{gender}"
    if key in _thumb_cache:
        return Response(content=_thumb_cache[key], media_type="image/jpeg",
                        headers={"Cache-Control": "public, max-age=86400"})
    path = os.path.join(COVERS_DIR, f"{key}.png")
    if not os.path.exists(path):
        raise HTTPException(404)
    img = Image.open(path).convert("RGB")
    img.thumbnail((400, 600), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80, optimize=True)
    _thumb_cache[key] = buf.getvalue()
    return Response(content=_thumb_cache[key], media_type="image/jpeg",
                    headers={"Cache-Control": "public, max-age=86400"})


@app.post("/api/swap")
async def swap(
    user_photo: UploadFile = File(...),
    quality: str = Form(...),
    user_name: str = Form(...),
):
    if quality not in QUALITIES:
        raise HTTPException(400, "Неверное качество")

    if user_photo.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Формат не поддерживается. Используйте JPEG, PNG или WebP.")

    contents = await user_photo.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(400, "Файл слишком большой. Максимум 10 МБ.")

    try:
        gender = fs.detect_gender(contents)

        cover_path = os.path.join(COVERS_DIR, f"{quality}_{gender}.png")
        if not os.path.exists(cover_path):
            cover_path = os.path.join(COVERS_DIR, f"{quality}_male.png")

        result_bytes, _ = fs.swap_face(contents, cover_path)
        final = bo.write_name_on_cover(result_bytes, user_name)
        return Response(content=final, media_type="image/jpeg")

    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        logger.error(f"Ошибка обработки: {e}", exc_info=True)
        raise HTTPException(500, "Ошибка обработки. Попробуйте другое фото.")


app.mount("/quality-images", StaticFiles(directory=QUALITIES_DIR), name="quality-images")
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")
