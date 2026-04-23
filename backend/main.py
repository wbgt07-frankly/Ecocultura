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

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_IMAGES_DIR = os.path.join(BASE_DIR, "assets", "base_images")
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), "frontend")

BASE_IMAGES = {
    "female_1":   {"label": "Агроном-женщина 1", "file": "female_1.jpg"},
    "female_2":   {"label": "Агроном-женщина 2", "file": "female_2.png"},
    "female_3":   {"label": "Агроном-женщина 3", "file": "female_3.png"},
    "female_4":   {"label": "Агроном-женщина 4", "file": "female_4.png"},
    "agronom_1":  {"label": "Агроном-женщина 5", "file": "Agronom_1.png"},
    "agronom_2":  {"label": "Агроном-женщина 6", "file": "Agronom_2.png"},
    "male_1":     {"label": "Агроном-мужчина 1", "file": "male_1.png"},
    "male_2":     {"label": "Агроном-мужчина 2", "file": "male_2.png"},
    "male_3":     {"label": "Агроном-мужчина 3", "file": "male_3.png"},
    "agronom_3":  {"label": "Агроном-мужчина 4", "file": "Agronom_3.png"},
}

MIME = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}

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


@app.get("/api/base-images")
async def get_base_images():
    result = []
    for key, info in BASE_IMAGES.items():
        path = os.path.join(BASE_IMAGES_DIR, info["file"])
        if os.path.exists(path):
            result.append({"id": key, "label": info["label"], "thumb": f"/api/thumb/{key}"})
    return result


_thumb_cache: dict[str, bytes] = {}

@app.get("/api/thumb/{image_id}")
async def get_thumb(image_id: str):
    if image_id not in BASE_IMAGES:
        raise HTTPException(404)
    if image_id in _thumb_cache:
        return Response(content=_thumb_cache[image_id], media_type="image/jpeg",
                        headers={"Cache-Control": "public, max-age=86400"})
    path = os.path.join(BASE_IMAGES_DIR, BASE_IMAGES[image_id]["file"])
    if not os.path.exists(path):
        raise HTTPException(404)
    img = Image.open(path).convert("RGB")
    img.thumbnail((600, 1200), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=82, optimize=True)
    _thumb_cache[image_id] = buf.getvalue()
    return Response(content=_thumb_cache[image_id], media_type="image/jpeg",
                    headers={"Cache-Control": "public, max-age=86400"})


@app.post("/api/swap")
async def swap(
    user_photo: UploadFile = File(...),
    base_id: str = Form(...),
):
    if base_id not in BASE_IMAGES:
        raise HTTPException(400, "Неверный образ")

    if user_photo.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Формат не поддерживается. Используйте JPEG, PNG или WebP.")

    contents = await user_photo.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(400, "Файл слишком большой. Максимум 10 МБ.")

    base_path = os.path.join(BASE_IMAGES_DIR, BASE_IMAGES[base_id]["file"])

    try:
        result = fs.swap_face(contents, base_path)
        result = bo.process_result(result)
        return Response(content=result, media_type="image/jpeg")
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        logger.error(f"Ошибка обработки: {e}", exc_info=True)
        raise HTTPException(500, "Ошибка обработки. Попробуйте другое фото.")


app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")
