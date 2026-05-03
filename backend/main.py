import io
import os
import logging
import re
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
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
VIDEO_PATH = os.path.join(FRONTEND_DIR, "startvideo.mp4")


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
_quality_image_cache: dict[str, bytes] = {}


@app.head("/startvideo.mp4")
@app.get("/startvideo.mp4")
async def get_start_video(request: Request):
    if not os.path.exists(VIDEO_PATH):
        raise HTTPException(404)

    file_size = os.path.getsize(VIDEO_PATH)
    range_header = request.headers.get("range")
    headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=86400",
    }

    if not range_header:
        return FileResponse(VIDEO_PATH, media_type="video/mp4", headers=headers)

    match = re.match(r"bytes=(\d*)-(\d*)$", range_header)
    if not match:
        return Response(status_code=416, headers={**headers, "Content-Range": f"bytes */{file_size}"})

    start_s, end_s = match.groups()
    if start_s:
        start = int(start_s)
        end = int(end_s) if end_s else file_size - 1
    else:
        suffix_len = int(end_s) if end_s else 0
        start = max(file_size - suffix_len, 0)
        end = file_size - 1

    if start >= file_size or end < start:
        return Response(status_code=416, headers={**headers, "Content-Range": f"bytes */{file_size}"})

    end = min(end, file_size - 1)
    chunk_size = end - start + 1
    with open(VIDEO_PATH, "rb") as video:
        video.seek(start)
        data = video.read(chunk_size)

    return Response(
        content=data,
        status_code=206,
        media_type="video/mp4",
        headers={
            **headers,
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Content-Length": str(chunk_size),
        },
    )


@app.get("/api/quality-image/{quality}")
async def get_quality_image(quality: str):
    if quality not in QUALITIES:
        raise HTTPException(404)
    if quality in _quality_image_cache:
        return Response(
            content=_quality_image_cache[quality],
            media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=86400"},
        )

    path = os.path.join(QUALITIES_DIR, f"{quality}.png")
    if not os.path.exists(path):
        raise HTTPException(404)

    img = Image.open(path).convert("RGB")
    img.thumbnail((720, 960), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=84, optimize=True)
    _quality_image_cache[quality] = buf.getvalue()
    return Response(
        content=_quality_image_cache[quality],
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )

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
